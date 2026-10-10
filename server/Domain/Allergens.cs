using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace DessertKitchen.Domain;

public record AllergenProfile(List<string> Contains, List<string> MayContain, string Verification,
    string SupplierText = "", string Source = "", DateOnly? VerifiedOn = null, string CrossContactNotes = "", string Reviewer = "", string? VerifiedPriceSource = null, string SupplierName = "", string VerificationNotes = "");
public record AllergenAssessment(List<string> Contains, List<string> MayContain, List<string> UnknownIngredients,
    List<string> UnverifiedIngredients, List<string> CrossContactNotes, Dictionary<string,int> Dependencies, string Fingerprint);
public record DietaryReview(string Id, string RecipeId, string Target, bool Approved, string Fingerprint,
    string Reviewer, DateOnly ReviewedOn, string SupplierVerification, string Controls, string Evidence,
    string Notes, decimal? GlutenPpm = null, string RecordedAt = "");
public record RecipeSafety(AllergenAssessment Assessment, bool NeedsReview, Dictionary<string,string> Statuses,
    List<DietaryReview> Reviews, List<string> PublicClaims);

public static class AllergenRules
{
    public static readonly Dictionary<string,string> Catalogue = new() {
        ["celery"]="Celery", ["cereals-gluten"]="Cereals containing gluten", ["crustaceans"]="Crustaceans",
        ["eggs"]="Eggs", ["fish"]="Fish", ["lupin"]="Lupin", ["milk"]="Milk", ["molluscs"]="Molluscs",
        ["mustard"]="Mustard", ["peanuts"]="Peanuts", ["sesame"]="Sesame", ["soya"]="Soya",
        ["sulphites"]="Sulphur dioxide / sulphites", ["tree-nuts"]="Tree nuts"
    };
    public static void Validate(AllergenProfile? p)
    {
        if (p == null) return;
        Guard.Require(p.Contains != null && p.MayContain != null && p.Contains.Concat(p.MayContain).All(Catalogue.ContainsKey), "Choose allergens from the UK 14-allergen list.");
        Guard.Require(p.Verification is "unknown" or "unverified" or "verified", "Choose an allergen verification status.");
        if (p.Verification == "verified")
        {
            Guard.Text(p.Source,"Verification source",2000); Guard.Text(p.SupplierText,"Supplier allergen information",20000);
            Guard.Text(p.Reviewer,"Allergen reviewer");
            Guard.Require(p.VerifiedOn != null && p.VerifiedOn <= Today(), "Enter a verification date that is not in the future.");
        }
    }
    public static DateOnly Today() => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow,"GMT Standard Time"));
    public static AllergenAssessment Assess(Recipe root, Func<string,Ingredient> ingredient, Func<string,Recipe> recipe)
    {
        var contains=new HashSet<string>(); var may=new HashSet<string>(); var unknown=new HashSet<string>();
        var unverified=new HashSet<string>(); var notes=new HashSet<string>(); var dependencies=new Dictionary<string,int>();
        void Visit(Recipe r, HashSet<string> chain)
        {
            Guard.Require(chain.Count < 40 && chain.Add(r.Id), "Sub-recipes form a cycle or exceed 40 nesting levels.");
            dependencies["recipe:"+r.Id]=r.Revision;
            foreach(var line in r.Lines)
            {
                if(line.Kind=="recipe") { Visit(recipe(line.ReferenceId),new(chain)); continue; }
                Guard.Require(line.Kind=="ingredient","Unknown line type.");
                var i=ingredient(line.ReferenceId); dependencies["ingredient:"+i.Id]=i.Revision;
                var p=i.AllergenInfo;
                if(p==null) { unknown.Add(i.Name); continue; }
                contains.UnionWith(p.Contains); may.UnionWith(p.MayContain);
                if(p.Verification=="unknown") unknown.Add(i.Name);
                else if(p.Verification!="verified") unverified.Add(i.Name);
                if(!string.IsNullOrWhiteSpace(p.CrossContactNotes)) notes.Add(i.Name+": "+p.CrossContactNotes);
            }
        }
        Visit(root,[]);
        var fingerprint=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { root, dependencies=dependencies.OrderBy(x=>x.Key),contains=contains.Order(),may=may.Order(),unknown=unknown.Order(),unverified=unverified.Order(),notes=notes.Order() }))));
        return new(contains.Order().ToList(),may.Order().ToList(),unknown.Order().ToList(),unverified.Order().ToList(),notes.Order().ToList(),dependencies,fingerprint);
    }
    public static string Status(AllergenAssessment a,string target,IEnumerable<DietaryReview> reviews)
    {
        var allergen=target=="gluten-free"?"cereals-gluten":target;
        if(a.Contains.Contains(allergen)) return "contains";
        if(a.MayContain.Contains(allergen) || a.CrossContactNotes.Count>0) return "risk";
        if(a.UnknownIngredients.Count>0) return "unknown";
        var review=reviews.Where(r=>r.Target==target).OrderByDescending(r=>r.RecordedAt).FirstOrDefault();
        if(a.UnverifiedIngredients.Count==0 && review is { Approved:true } && review.Fingerprint==a.Fingerprint) return "verified";
        return "unverified";
    }
    public static void ValidateReview(DietaryReview r,AllergenAssessment a)
    {
        Guard.Require(Catalogue.ContainsKey(r.Target)||r.Target=="gluten-free","Choose an allergen or gluten-free review.");
        Guard.Require(r.Fingerprint==a.Fingerprint,"Recipe or ingredient information changed. Refresh the assessment before reviewing.");
        Guard.Text(r.Reviewer,"Reviewer / approver");
        Guard.Require(r.ReviewedOn!=default && r.ReviewedOn<=Today(),"Enter a valid review date, not in the future.");
        if(!r.Approved) return;
        Guard.Require(Status(a,r.Target,[])=="unverified" && a.UnverifiedIngredients.Count==0,"Approval blocked: resolve declared allergens, precautionary risks and all unknown/unverified ingredients first.");
        Guard.Text(r.SupplierVerification,"Supplier verification",10000); Guard.Text(r.Controls,"Preparation and cross-contact controls",10000);
        Guard.Text(r.Evidence,"Supporting evidence",10000);
        if(r.Target=="gluten-free") Guard.Require(r.GlutenPpm is >=0 and <=20,"Gluten-free approval requires documented evidence for gluten at or below 20 mg/kg (ppm) in the food as sold, plus preparation controls.");
    }
}
