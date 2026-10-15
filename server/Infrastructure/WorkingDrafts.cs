using System.Text.Json;
using DessertKitchen.Domain;
using Microsoft.Data.Sqlite;
namespace DessertKitchen.Infrastructure;
public record WorkingDraft(string Kind,string Id,int Revision,JsonElement Body,string RequestId,string UpdatedAt,JsonElement? Result=null);
public record DraftInput(int Revision,JsonElement Body,string RequestId);
public sealed partial class Store
{
    public void DiscardPurchaseDraft(string id,int revision)
    {
        const string kind="inventory-purchase";
        var draft=Draft(kind,id)??throw new ValidationException("Purchase draft not found.");
        if(draft.Revision==revision+1 && draft.Result is JsonElement prior && prior.ValueKind==JsonValueKind.Object && prior.TryGetProperty("discarded",out var discarded) && discarded.GetBoolean())return;
        Guard.Require(draft.Result==null,"A received purchase cannot be discarded.");
        using var db=Open();using var tx=db.BeginTransaction();
        using var cmd=Command(db,tx,"UPDATE working_drafts SET revision=revision+1,result=$r,updated_at=$at WHERE kind=$k AND id=$id AND revision=$v AND result IS NULL",("$r","{\"discarded\":true}"),("$at",Now()),("$k",kind),("$id",id),("$v",revision));
        if(cmd.ExecuteNonQuery()!=1)throw new ConflictException("Purchase draft changed. Reopen it before discarding.");
        Execute(db,tx,"DELETE FROM record_dependencies WHERE source_kind='draft' AND source_id=$id",("$id",kind+":"+id));
        Audit(db,tx,"draft:discard-purchase",id);tx.Commit();
    }
    public WorkingDraft? Draft(string kind,string id)
    {
        using var db=Open();using var cmd=Command(db,null,"SELECT revision,body,request_id,updated_at,result FROM working_drafts WHERE kind=$k AND id=$id",("$k",kind),("$id",id));using var r=cmd.ExecuteReader();
        return !r.Read()?null:new(kind,id,r.GetInt32(0),JsonSerializer.Deserialize<JsonElement>(r.GetString(1)),r.GetString(2),r.GetString(3),r.IsDBNull(4)?null:JsonSerializer.Deserialize<JsonElement>(r.GetString(4)));
    }
    public WorkingDraft SaveDraft(string kind,string id,DraftInput input)
    {
        Guard.Require(kind is "inventory-existing" or "ingredient-setup" or "recipe" or "price" or "review" or "ingredient" or "inventory-purchase" or "inventory-production" or "inventory-waste" or "inventory-transfer" or "inventory-adjustment" or "inventory-stocktake" or "inventory-shopping","Unsupported working draft.");
        Guard.Text(id,"Draft ID",200);Guard.Text(input.RequestId,"Save request ID",100);
        Guard.Require(input.Body.ValueKind==JsonValueKind.Object,"Draft must be a record.");
        var old=Draft(kind,id);
        if(old?.RequestId==input.RequestId)return old;
        if((old?.Revision??0)!=input.Revision)throw new ConflictException("This draft changed in another window. Your edits are retained here. Reopen to load the current draft before merging changes.");
        using var db=Open();using var tx=db.BeginTransaction();
        if(kind=="review" && input.Body.TryGetProperty("target",out var target))
        {
            var previous=Reviews(id).FirstOrDefault(r=>r.Target==target.GetString());
            string Field(string name)=>input.Body.TryGetProperty(name,out var field)?field.ToString():"";
            if(previous is {Approved:true} && (previous.Controls!=Field("controls") || previous.SupplierVerification!=Field("supplierVerification") || previous.Evidence!=Field("evidence") || (previous.GlutenPpm?.ToString(System.Globalization.CultureInfo.InvariantCulture)??"")!=Field("glutenPpm")))
            {
                var withdrawal=previous with{Id=Guid.NewGuid().ToString("N"),Approved=false,RecordedAt=Now(),Notes="Approval withdrawn because preparation controls or supporting evidence were edited in the working review. Explicit re-approval is required."};
                Execute(db,tx,"INSERT INTO dietary_reviews(id,recipe_id,body) VALUES($id,$recipe,$body)",("$id",withdrawal.Id),("$recipe",id),("$body",JsonSerializer.Serialize(withdrawal,Json)));
                Audit(db,tx,"dietary:controls-edited",id);
            }
        }
        Execute(db,tx,"INSERT INTO working_drafts VALUES($k,$id,$v,$b,$r,$at,NULL) ON CONFLICT(kind,id) DO UPDATE SET revision=$v,body=$b,request_id=$r,updated_at=$at,result=NULL",("$k",kind),("$id",id),("$v",input.Revision+1),("$b",input.Body.GetRawText()),("$r",input.RequestId),("$at",Now()));
        Execute(db,tx,"DELETE FROM record_dependencies WHERE source_kind='draft' AND source_id=$id",("$id",kind+":"+id));
        if(kind=="recipe")Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies SELECT 'draft',$id,d.kind,d.id,'Working recipe draft: '||$id FROM json_each($body,'$.lines') l JOIN documents d ON d.kind=json_extract(l.value,'$.kind') AND d.id=json_extract(l.value,'$.referenceId')",("$id",kind+":"+id),("$body",input.Body.GetRawText()));
        if(kind=="price")Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies SELECT 'draft',$id,kind,id,'Working supplier quote: '||$id FROM documents WHERE (kind='ingredient' AND id=json_extract($body,'$.ingredientId')) OR (kind='supplier' AND id=json_extract($body,'$.supplierId'))",("$id",kind+":"+id),("$body",input.Body.GetRawText()));
        if(kind=="inventory-purchase")Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies SELECT 'draft',$id,kind,id,'Working purchase: '||$id FROM documents WHERE (kind='supplier' AND id=json_extract($body,'$.supplierId')) OR (kind='ingredient' AND id IN (SELECT json_extract(value,'$.ingredientId') FROM json_each($body,'$.lines')))",("$id",kind+":"+id),("$body",input.Body.GetRawText()));
        if(kind is "inventory-production" or "inventory-shopping")Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies SELECT 'draft',$id,kind,id,'Working production plan: '||$id FROM documents WHERE kind='recipe' AND (id=json_extract($body,'$.recipeId') OR id IN (SELECT json_extract(value,'$.recipeId') FROM json_each($body,'$.plans')))",("$id",kind+":"+id),("$body",input.Body.GetRawText()));
        if(kind=="ingredient-setup")Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies SELECT 'draft',$id,kind,id,'Working ingredient setup: '||$id FROM documents WHERE kind='supplier' AND id=json_extract($body,'$.price.supplierId')",("$id",kind+":"+id),("$body",input.Body.GetRawText()));
        if(kind=="inventory-existing")Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies SELECT 'draft',$id,kind,id,'Existing stock draft: '||$id FROM documents WHERE kind=json_extract($body,'$.kind') AND id=json_extract($body,'$.itemId')",("$id",kind+":"+id),("$body",input.Body.GetRawText()));
        tx.Commit();return Draft(kind,id)!;
    }
    static void CompleteDraft(SqliteConnection db,SqliteTransaction tx,WorkingDraft? draft,object result)
    {
        if(draft==null)return;
        using var cmd=Command(db,tx,"UPDATE working_drafts SET result=$r WHERE kind=$k AND id=$id AND revision=$v AND result IS NULL",("$k",draft.Kind),("$id",draft.Id),("$v",draft.Revision),("$r",JsonSerializer.Serialize(result,Json)));
        if(cmd.ExecuteNonQuery()!=1)throw new ConflictException("Draft changed while publishing. Reload before trying again.");
        Execute(db,tx,"DELETE FROM record_dependencies WHERE source_kind='draft' AND source_id=$id",("$id",draft.Kind+":"+draft.Id));
    }
}
