using System.Text;
using System.Text.Json;
using DessertKitchen.Domain;

namespace DessertKitchen.Infrastructure;

public sealed partial class Store
{
    public string PriceSource(string id)
    {
        var price=Prices().Where(p=>p.IngredientId==id && p.EffectiveDate<=AllergenRules.Today()).OrderByDescending(p=>p.EffectiveDate).ThenByDescending(p=>p.RecordedAt).FirstOrDefault();
        return price==null?"no-quote":price.SupplierId+"\n"+price.ProductReference;
    }
    public Ingredient EffectiveIngredient(Ingredient item)
    {
        if(item.AllergenInfo is {Verification:"verified"} info && info.VerifiedPriceSource!=PriceSource(item.Id))
            item=item with {AllergenInfo=info with {Verification="unverified"}};
        return item;
    }
    public AllergenAssessment Assess(Recipe r)=>AllergenRules.Assess(r,id=>EffectiveIngredient(Get<Ingredient>("ingredient",id)),id=>Get<Recipe>("recipe",id));
    public List<DietaryReview> Reviews(string id)
    {
        using var db=Open(); using var cmd=Command(db,null,"SELECT body FROM dietary_reviews WHERE recipe_id=$id ORDER BY rowid DESC",("$id",id));
        using var reader=cmd.ExecuteReader(); var rows=new List<DietaryReview>();
        while(reader.Read()) rows.Add(JsonSerializer.Deserialize<DietaryReview>(reader.GetString(0),Json)!); return rows;
    }
    public RecipeSafety Safety(Recipe r)
    {
        var a=Assess(r); var reviews=Reviews(r.Id);
        var statuses=AllergenRules.Catalogue.Keys.Append("gluten-free").ToDictionary(k=>k,k=>AllergenRules.Status(a,k,reviews));
        var reviewDraft=Draft("review",r.Id);
        var pendingControls=false;
        if(reviewDraft!=null && reviewDraft.Body.TryGetProperty("target",out var target))
        {
            var key=target.GetString()??"";
            var latest=reviews.Where(x=>x.Target==key).OrderByDescending(x=>x.RecordedAt).FirstOrDefault();
            if(statuses.GetValueOrDefault(key)=="verified" && string.CompareOrdinal(reviewDraft.UpdatedAt,latest?.RecordedAt)>0){statuses[key]="unverified";pendingControls=true;}
        }
        var snapshot=Latest(r.Id).AllergenSnapshot;
        return new(a,pendingControls || snapshot==null || snapshot.Fingerprint!=a.Fingerprint || reviews.GroupBy(x=>x.Target).Select(g=>g.OrderByDescending(x=>x.RecordedAt).First()).Any(x=>x.Approved && x.Fingerprint!=a.Fingerprint),statuses,reviews,
            statuses.Where(x=>x.Value=="verified").Select(x=>x.Key=="gluten-free"?"Gluten-free":AllergenRules.Catalogue[x.Key]+": verified under documented controls").ToList());
    }
    public DietaryReview AddReview(string id,DietaryReview input)
    {
        var a=Assess(Get<Recipe>("recipe",id)); AllergenRules.ValidateReview(input,a);
        var saved=input with { Id=Guid.NewGuid().ToString("N"),RecipeId=id,RecordedAt=Now() };
        using var db=Open(); using var tx=db.BeginTransaction();
        Execute(db,tx,"INSERT INTO dietary_reviews(id,recipe_id,body) VALUES($id,$recipe,$body)",("$id",saved.Id),("$recipe",id),("$body",JsonSerializer.Serialize(saved,Json)));
        Audit(db,tx,saved.Approved?"dietary:approved":"dietary:not-approved",id); tx.Commit(); return saved;
    }
    public List<string> Dependencies(string kind,string id)
    {
        using var db=Open(); using var cmd=Command(db,null,"SELECT DISTINCT description FROM record_dependencies WHERE target_kind=$kind AND target_id=$id ORDER BY description",("$kind",kind),("$id",id));
        using var reader=cmd.ExecuteReader(); var result=new List<string>(); while(reader.Read()) result.Add(reader.GetString(0)); return result;
    }
    public void DeleteUnused(string kind,string id,int revision)
    {
        Guard.Require(kind is "ingredient" or "supplier","Only unused ingredients and suppliers can be deleted.");
        using var db=Open(); using var tx=db.BeginTransaction();
        using(var refs=Command(db,tx,"SELECT description FROM record_dependencies WHERE target_kind=$kind AND target_id=$id",("$kind",kind),("$id",id)))
        using(var reader=refs.ExecuteReader())
        {
            var reasons=new List<string>(); while(reader.Read()) reasons.Add(reader.GetString(0));
            Guard.Require(reasons.Count==0,"Permanent deletion blocked by: "+string.Join("; ",reasons)+". Archive the record instead.");
        }
        using var cmd=Command(db,tx,"DELETE FROM documents WHERE kind=$kind AND id=$id AND revision=$revision",("$kind",kind),("$id",id),("$revision",revision));
        if(cmd.ExecuteNonQuery()!=1) throw new ConflictException("Record changed or no longer exists. Refresh before deleting.");
        Audit(db,tx,"delete:"+kind,id); tx.Commit();
    }
    public string AllergenCsv()
    {
        static string Cell(string s)=>"\""+(s.Length>0 && "=+-@\t\r".Contains(s[0])?"'":"")+s.Replace("\"","\"\"")+"\"";
        var rows=new List<string[]> { new[]{"Recipe","Version","Type","Variant of","Review required"}.Concat(AllergenRules.Catalogue.Values).Concat(["Gluten-free review","Unknown ingredients","Unverified ingredients","Cross-contact notes"]).ToArray() };
        foreach(var r in All<Recipe>("recipe"))
        {
            var s=Safety(r);
            rows.Add(new[]{r.Name,r.Revision.ToString(),r.IsSellable?"Sellable":"Internal",r.VariantOf??"",s.NeedsReview?"Yes":"No"}
                .Concat(AllergenRules.Catalogue.Keys.Select(k=>StatusLabel(s.Statuses[k])))
                .Concat([StatusLabel(s.Statuses["gluten-free"]),string.Join("; ",s.Assessment.UnknownIngredients),string.Join("; ",s.Assessment.UnverifiedIngredients),string.Join("; ",s.Assessment.CrossContactNotes)]).ToArray());
        }
        return "\uFEFF"+string.Join("\r\n",rows.Select(r=>string.Join(",",r.Select(Cell))));
    }
    public static string StatusLabel(string status)=>status switch { "contains"=>"Contains", "risk"=>"May contain / cross-contact risk", "verified"=>"Verified under documented controls", "unknown"=>"Unknown", _=>"No relevant allergen identified — not verified" };
}
