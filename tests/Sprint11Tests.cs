using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Microsoft.Data.Sqlite;
using Xunit;

namespace DessertKitchen.Tests;

public class Sprint11Tests
{
    static string Temp()=>Path.Combine(Path.GetTempPath(),"dessert-kitchen-tests",Guid.NewGuid().ToString("N"),"kitchen.db");
    static AllergenProfile Profile(string[]? contains=null,string[]? may=null,string verification="verified")=>
        new(contains?.ToList()??[],may?.ToList()??[],verification,"Manufacturer declaration for all 14 allergens","Specification reference",AllergenRules.Today(),"","Reviewer");
    static Ingredient Item(string id,AllergenProfile? p=null,int revision=1)=>new(id,revision,id,"Baking","","g","","",0,false,false,p);
    static Recipe R(string id,params RecipeLine[] lines)=>DomainTests.Recipe() with {Id=id,Lines=lines.ToList(),MethodSteps=["First step","Second step"]};
    static DietaryReview Review(string id,AllergenAssessment a,string target="milk")=>new("",id,target,true,a.Fingerprint,"Kitchen owner",AllergenRules.Today(),"Supplier spec verified","Dedicated equipment, validated cleaning, separate storage","Test report and control procedure","",target=="gluten-free"?10:null);
    static async Task<HttpClient> Login(KitchenFactory f)
    { var c=f.CreateClient(); c.DefaultRequestHeaders.Add("X-Kitchen-Request","1"); (await c.PostAsJsonAsync("/api/auth/setup",new{password="sprint11-test-password"})).EnsureSuccessStatusCode();return c; }
    static RecipeVersion Save(Store s,Recipe recipe)
    {var r=recipe with{Revision=recipe.Revision+1};var v=new RecipeVersion(r,s.Calculate(r),Store.Now(),s.Assess(r));s.Save("recipe",r.Id,recipe.Revision,r,v);return v;}
    static void AddItem(Store s,string id,AllergenProfile p,decimal price=1)
    {
        s.Save("ingredient",id,0,Item(id,p));
        s.AddPrice(DomainTests.Cheese(price) with{Id=Guid.NewGuid().ToString("N"),IngredientId=id,SupplierId="sample-supplier",PackQuantity=100,RecordedAt=Store.Now()});
        s.Save("ingredient",id,1,Item(id,p with{VerifiedPriceSource=s.PriceSource(id)},2));
    }

    [Fact] public void PopulatedV1MigrationPreservesProseSnapshotsAndOldBackups()
    {
        var path=Temp();Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var oldRecipe=R("legacy",new RecipeLine("ingredient","flour",75,"g")) with{Description="Description and method together.\n1. Mix slowly.\n2. Bake.\nDo not lose this text.",Category="Sub-recipes",Revision=1};
        var originalCost=DomainTests.Calculate(oldRecipe);
        using(var db=new SqliteConnection($"Data Source={path}"))
        {
            db.Open();void Execute(string sql,params (string,object)[] values){using var cmd=db.CreateCommand();cmd.CommandText=sql;foreach(var (k,v) in values)cmd.Parameters.AddWithValue(k,v);cmd.ExecuteNonQuery();}
            Execute(File.ReadAllText(Path.Combine(AppContext.BaseDirectory,"Migrations","001_foundation.sql")));
            Execute("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL); INSERT INTO schema_migrations VALUES(1,'original')");
            void Doc(string kind,string id,object value){var node=JsonSerializer.SerializeToNode(value,Store.Json)!.AsObject();foreach(var key in new[]{"archived","allergenInfo","methodSteps","isSellable","variantOf"})node.Remove(key);Execute("INSERT INTO documents VALUES($kind,$id,1,$body)",("$kind",kind),("$id",id),("$body",node.ToJsonString()));}
            Doc("supplier","supplier",new Supplier("supplier",1,"Original supplier"));Doc("ingredient","flour",Item("flour") with{Allergens="Wheat; may contain soya"});Doc("recipe","legacy",oldRecipe);Doc("scenario","baseline",DomainTests.Baseline());
            var version=JsonSerializer.SerializeToNode(new RecipeVersion(oldRecipe,originalCost,"original-date"),Store.Json)!;var rp=version["recipe"]!.AsObject();rp.Remove("methodSteps");rp.Remove("isSellable");rp.Remove("variantOf");version.AsObject().Remove("allergenSnapshot");
            Execute("INSERT INTO recipe_versions VALUES('legacy',1,'original-date',$body)",("$body",version.ToJsonString()));
            Execute("INSERT INTO prices VALUES('quote','flour','original-date',$body)",("$body",JsonSerializer.Serialize(DomainTests.Cheese() with{IngredientId="flour"},Store.Json)));
        }
        var oldBackup=path+".v1.db";File.Copy(path,oldBackup);
        var upgraded=new Store(path);Assert.Equal(oldRecipe.Description,upgraded.Get<Recipe>("recipe","legacy").Description);
        Assert.Empty(upgraded.Get<Recipe>("recipe","legacy").MethodSteps!);Assert.False(upgraded.Get<Recipe>("recipe","legacy").IsSellable);
        Assert.Equal(oldRecipe.Description,upgraded.Latest("legacy").Recipe.Description);Assert.Equal(originalCost.BatchCost,upgraded.Latest("legacy").Cost.BatchCost);
        Assert.Equal("Wheat; may contain soya",upgraded.Get<Ingredient>("ingredient","flour").AllergenInfo!.SupplierText);
        Assert.Equal("unknown",upgraded.Get<Ingredient>("ingredient","flour").AllergenInfo!.Verification);Assert.Single(upgraded.Prices());
        Assert.NotEmpty(Directory.GetFiles(Path.Combine(Path.GetDirectoryName(path)!,"backups")));
        var restored=Temp();Store.Restore(oldBackup,restored);var migratedRestore=new Store(restored);
        Assert.Equal(oldRecipe.Description,migratedRestore.Latest("legacy").Recipe.Description);
        Assert.Throws<ValidationException>(()=>migratedRestore.DeleteUnused("ingredient","flour",1));
    }
    [Fact] public async Task MethodOrderingAndInternalConversionPersistInVersions()
    {
        using var f=new KitchenFactory();using var c=await Login(f);
        var original=(await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/cheesecake-base/versions"))![0].Recipe;
        Assert.False(original.IsSellable);
        var first=original with{MethodSteps=[new string('a',5000),"Melt butter","Mix"]};
        var response=await c.PostAsJsonAsync("/api/recipes",first);response.EnsureSuccessStatusCode();var v=(await response.Content.ReadFromJsonAsync<RecipeVersion>())!;
        var next=v.Recipe with{MethodSteps=["Mix",new string('a',5000)],IsSellable=true};(await c.PostAsJsonAsync("/api/recipes",next)).EnsureSuccessStatusCode();
        var versions=(await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/cheesecake-base/versions"))!;
        Assert.Equal("Mix",versions[0].Recipe.MethodSteps![0]);Assert.True(versions[0].Recipe.IsSellable);
        Assert.Equal(5000,versions[1].Recipe.MethodSteps![0].Length);Assert.False(versions[1].Recipe.IsSellable);
        Assert.Equal(original.Description,versions[2].Recipe.Description);
    }
    [Fact] public void NestedAllergensIncludeOptionalToppingsAndPackaging()
    {
        var items=new Dictionary<string,Ingredient>{["milk"]=Item("milk",Profile(["milk"])),["nuts"]=Item("nuts",Profile(may:["tree-nuts"])),["pack"]=Item("pack",Profile(["soya"])) with{IsPackaging=true}};
        var child=R("child",new RecipeLine("ingredient","milk",1,"g"));
        var root=R("root",new RecipeLine("recipe","child",1,"each"),new RecipeLine("ingredient","nuts",1,"g",0,"optional"),new RecipeLine("ingredient","pack",1,"g",0,"packaging"));
        var a=AllergenRules.Assess(root,id=>items[id],_=>child);
        Assert.Contains("milk",a.Contains);Assert.Contains("soya",a.Contains);Assert.Contains("tree-nuts",a.MayContain);
        Assert.Equal("contains",AllergenRules.Status(a,"milk",[]));Assert.Equal("risk",AllergenRules.Status(a,"tree-nuts",[]));
    }
    [Fact] public void MissingAndUnverifiedDataNeverBecomeSuitable()
    {
        var r=R("root",new RecipeLine("ingredient","unknown",1,"g"));
        var a=AllergenRules.Assess(r,_=>Item("unknown"),_=>throw new Exception());Assert.Equal("unknown",AllergenRules.Status(a,"milk",[]));
        Assert.Throws<ValidationException>(()=>AllergenRules.ValidateReview(Review(r.Id,a),a));
        var unverified=AllergenRules.Assess(r,_=>Item("unknown",Profile(verification:"unverified")),_=>throw new Exception());
        Assert.Equal("unverified",AllergenRules.Status(unverified,"milk",[]));Assert.Throws<ValidationException>(()=>AllergenRules.ValidateReview(Review(r.Id,unverified),unverified));
    }
    [Fact] public void GlutenApprovalRequiresEvidenceControlsThresholdAndExplicitReview()
    {
        var r=R("root",new RecipeLine("ingredient","rice",1,"g"));var a=AllergenRules.Assess(r,_=>Item("rice",Profile()),_=>throw new Exception());
        Assert.Equal("unverified",AllergenRules.Status(a,"gluten-free",[]));var review=Review(r.Id,a,"gluten-free");
        Assert.Throws<ValidationException>(()=>AllergenRules.ValidateReview(review with{GlutenPpm=null},a));
        Assert.Throws<ValidationException>(()=>AllergenRules.ValidateReview(review with{GlutenPpm=21},a));
        Assert.Throws<ValidationException>(()=>AllergenRules.ValidateReview(review with{Controls=""},a));
        Assert.Throws<ValidationException>(()=>AllergenRules.ValidateReview(review with{Evidence=""},a));
        AllergenRules.ValidateReview(review with{GlutenPpm=20},a);Assert.Equal("verified",AllergenRules.Status(a,"gluten-free",[review]));
        Assert.Equal("unverified",AllergenRules.Status(a,"gluten-free",[review with{Approved=false}]));
    }
    [Fact] public void NestedChangesAndSubstitutionsInvalidateApprovalsAndRecalculateCost()
    {
        var s=new Store(Temp());Seed.Run(s);AddItem(s,"safe",Profile(),1);AddItem(s,"dairy",Profile(["milk"]),3);
        var child=Save(s,R("child",new RecipeLine("ingredient","safe",100,"g")) with{Revision=0});
        var parent=Save(s,R("parent",new RecipeLine("recipe","child",5,"each")) with{Revision=0});
        s.AddReview("parent",Review("parent",s.Assess(parent.Recipe)));
        Assert.Equal("verified",s.Safety(parent.Recipe).Statuses["milk"]);
        var changed=Save(s,child.Recipe with{Lines=[new RecipeLine("ingredient","dairy",100,"g")]});
        Assert.True(s.Safety(parent.Recipe).NeedsReview);Assert.Equal("contains",s.Safety(parent.Recipe).Statuses["milk"]);
        Assert.True(s.Calculate(parent.Recipe).BatchCost>parent.Cost.BatchCost);Assert.Equal(parent.Cost.BatchCost,s.Latest("parent").Cost.BatchCost);
        var variant=Save(s,parent.Recipe with{Id="variant",Revision=0,VariantOf="parent",Lines=[new RecipeLine("ingredient","safe",100,"g")]});
        Assert.Equal("unverified",s.Safety(variant.Recipe).Statuses["milk"]);Assert.Empty(s.Reviews("variant"));
        Assert.Equal("parent",variant.Recipe.VariantOf);
    }
    [Fact] public void DifferentSupplierQuoteInvalidatesSupplierVerification()
    {
        var s=new Store(Temp());Seed.Run(s);AddItem(s,"safe",Profile());var v=Save(s,R("parent",new RecipeLine("ingredient","safe",100,"g")) with{Revision=0});s.AddReview(v.Recipe.Id,Review(v.Recipe.Id,s.Assess(v.Recipe)));
        s.Save("supplier","other",0,new Supplier("other",1,"Other supplier"));
        s.AddPrice(DomainTests.Cheese() with{Id="new-price",IngredientId="safe",SupplierId="other",EffectiveDate=AllergenRules.Today(),RecordedAt=Store.Now()});
        Assert.Equal("unverified",s.Safety(v.Recipe).Statuses["milk"]);Assert.Empty(s.Safety(v.Recipe).PublicClaims);Assert.True(s.Safety(v.Recipe).NeedsReview);
    }
    [Fact] public async Task SafeDeletionArchiveRestoreAndHistoricalPrices()
    {
        using var f=new KitchenFactory();using var c=await Login(f);var s=new Store(f.DatabasePath);var prices=s.Prices().Count;
        var blocked=await c.PostAsJsonAsync("/api/records/ingredient/cream-cheese/manage",new{action="delete",revision=1});Assert.Equal(HttpStatusCode.BadRequest,blocked.StatusCode);Assert.Contains("Historic recipe",await blocked.Content.ReadAsStringAsync());
        (await c.PostAsJsonAsync("/api/records/ingredient/cream-cheese/manage",new{action="archive",revision=1})).EnsureSuccessStatusCode();Assert.True(s.Get<Ingredient>("ingredient","cream-cheese").Archived);
        Assert.Equal(prices,s.Prices().Count);Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/recipes",DomainTests.Recipe() with{Id="",Revision=0,Lines=[new RecipeLine("ingredient","cream-cheese",75,"g")]})).StatusCode);
        (await c.PostAsJsonAsync("/api/records/ingredient/cream-cheese/manage",new{action="restore",revision=2})).EnsureSuccessStatusCode();Assert.False(s.Get<Ingredient>("ingredient","cream-cheese").Archived);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/records/supplier/sample-supplier/manage",new{action="delete",revision=1})).StatusCode);
        (await c.PostAsJsonAsync("/api/suppliers",new Supplier("unused",0,"Unused"))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync("/api/records/supplier/unused/manage",new{action="delete",revision=99})).StatusCode);
        (await c.PostAsJsonAsync("/api/records/supplier/unused/manage",new{action="delete",revision=1})).EnsureSuccessStatusCode();Assert.DoesNotContain(s.All<Supplier>("supplier"),x=>x.Id=="unused");
        (await c.PostAsJsonAsync("/api/ingredients",Item("unused-item") with{Revision=0})).EnsureSuccessStatusCode();(await c.PostAsJsonAsync("/api/records/ingredient/unused-item/manage",new{action="delete",revision=1})).EnsureSuccessStatusCode();
    }
    [Fact] public void DatabaseForeignKeysBlockBypassingDeletionChecks()
    {
        var s=new Store(Temp());Seed.Run(s);using var db=s.Open();using var cmd=db.CreateCommand();cmd.CommandText="DELETE FROM documents WHERE kind='ingredient' AND id='cream-cheese'";
        Assert.Throws<SqliteException>(()=>cmd.ExecuteNonQuery());Assert.Equal(17,s.Prices().Count);
    }
    [Fact] public async Task OrdinaryIngredientSaveCannotRebindOutdatedVerification()
    {
        using var f=new KitchenFactory();using var c=await Login(f);var s=new Store(f.DatabasePath);AddItem(s,"safe-binding",Profile());
        var old=s.Get<Ingredient>("ingredient","safe-binding");s.Save("supplier","changed-supplier",0,new Supplier("changed-supplier",1,"Changed supplier"));
        s.AddPrice(DomainTests.Cheese() with{Id="changed-quote",IngredientId=old.Id,SupplierId="changed-supplier",EffectiveDate=AllergenRules.Today(),RecordedAt=Store.Now()});
        var response=await c.PostAsJsonAsync("/api/ingredients",old with{MinimumStock=99});response.EnsureSuccessStatusCode();var saved=(await response.Content.ReadFromJsonAsync<Ingredient>())!;
        Assert.Equal("unverified",saved.AllergenInfo!.Verification);
        var verified=await c.PostAsJsonAsync("/api/ingredients",saved with{AllergenInfo=saved.AllergenInfo with{Verification="verified",VerifiedPriceSource=null}});verified.EnsureSuccessStatusCode();
        Assert.Equal(s.PriceSource(old.Id),(await verified.Content.ReadFromJsonAsync<Ingredient>())!.AllergenInfo!.VerifiedPriceSource);
    }
    [Fact] public void BackupAfterMigrationIncludesReviewsAndArchiveState()
    {
        var s=new Store(Temp());Seed.Run(s);AddItem(s,"safe",Profile());var v=Save(s,R("verified",new RecipeLine("ingredient","safe",100,"g")) with{Revision=0});s.AddReview(v.Recipe.Id,Review(v.Recipe.Id,s.Assess(v.Recipe)));
        var supplier=s.Get<Supplier>("supplier","sample-supplier");s.Save("supplier",supplier.Id,supplier.Revision,supplier with{Revision=2,Archived=true});
        var backup=Temp();Directory.CreateDirectory(Path.GetDirectoryName(backup)!);File.WriteAllBytes(backup,s.Backup());var target=Temp();Store.Restore(backup,target);var restored=new Store(target);
        Assert.Single(restored.Reviews("verified"));Assert.True(restored.Get<Supplier>("supplier","sample-supplier").Archived);Assert.Equal("verified",restored.Safety(restored.Get<Recipe>("recipe","verified")).Statuses["milk"]);
    }
    [Fact] public void StaffingAndChannelMixAreOptInAndDecimalSafe()
    {
        var scenario=DomainTests.Baseline() with{Channels=[new("Uber Eats",50,30,20),new("Direct",50,0,0)],StaffHoursWeekly=10,StaffHourlyRate=12,EmployerCostPercent=20,OtherChargePerOrder=.5m};
        var model=Costing.Model(scenario);Assert.Equal(11.72m,model.ContributionPerOrder);Assert.Equal(624,model.StaffingCosts);Assert.Equal(1999,model.FixedCosts);Assert.Equal(2063.93m,model.OperatingProfit);
        Assert.Equal(8.44m,Costing.Model(DomainTests.Baseline()).ContributionPerOrder);
        Assert.Throws<ValidationException>(()=>Costing.Model(scenario with{Channels=[new("Uber",80,30,20)]}));
    }
    [Fact] public async Task ScenarioComparisonDoesNotMutateEitherSavedScenario()
    {
        using var f=new KitchenFactory();using var c=await Login(f);var input=DomainTests.Baseline() with{Expenses=[new("Rent",900),new("Other",750)]};
        var response=await c.PostAsJsonAsync("/api/scenarios/compare",new{current=input,otherId="baseline"});response.EnsureSuccessStatusCode();var result=await response.Content.ReadFromJsonAsync<JsonElement>();Assert.Equal(-275,result.GetProperty("differences").GetProperty("operatingProfit").GetDecimal());
        Assert.Equal(625,new Store(f.DatabasePath).Get<Scenario>("scenario","baseline").Expenses[0].MonthlyAmount);
    }
    [Fact] public void CsvContainsEveryAllergenAndNeutralisesFormulaNames()
    {
        var s=new Store(Temp());Seed.Run(s);var original=s.Get<Recipe>("recipe","lemon-pot");Save(s,original with{Name="=DANGEROUS()"});var csv=s.AllergenCsv();Assert.Contains("'"+"=DANGEROUS()",csv);foreach(var name in AllergenRules.Catalogue.Values)Assert.Contains(name,csv);Assert.Contains("Unknown",csv);
    }
}
