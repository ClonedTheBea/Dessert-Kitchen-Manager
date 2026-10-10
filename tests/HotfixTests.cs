using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;
public class HotfixTests
{
 [Fact] public async Task NewIngredientDraftPreservesUnitChoiceUntilFinalisation()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var s=new Store(f.DatabasePath);var count=s.All<Ingredient>("ingredient").Count;
  var item=new Ingredient("",0,"Draft ingredient","Baking","","g","","",0,false);
  var d=await Draft(c,"ingredient","new",item);d=await Draft(c,"ingredient","new",item with{BaseUnit="ml"},d.Revision);Assert.Equal(count,s.All<Ingredient>("ingredient").Count);
  var result=await c.PostAsJsonAsync("/api/drafts/ingredient/new/publish",new{revision=d.Revision});result.EnsureSuccessStatusCode();var saved=(await result.Content.ReadFromJsonAsync<Ingredient>())!;Assert.Equal("ml",saved.BaseUnit);
  (await c.PostAsJsonAsync("/api/drafts/ingredient/new/publish",new{revision=d.Revision})).EnsureSuccessStatusCode();Assert.Equal(count+1,s.All<Ingredient>("ingredient").Count);
 }
 [Fact] public async Task ChangingPreparationReviewDraftWithholdsClaimUntilReapproved()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var s=new Store(f.DatabasePath);var ingredient=s.Get<Ingredient>("ingredient","cream-cheese");
  var profile=new AllergenProfile([],[],"verified","Synthetic test source","Test reference",AllergenRules.Today(),"","Tester");
  (await c.PostAsJsonAsync("/api/ingredients",ingredient with{AllergenInfo=profile})).EnsureSuccessStatusCode();
  var r=DomainTests.Recipe() with{Id="review-control-test",Revision=0,Lines=[new("ingredient","cream-cheese",10,"g")]};
  var response=await c.PostAsJsonAsync("/api/recipes",r);response.EnsureSuccessStatusCode();r=(await response.Content.ReadFromJsonAsync<RecipeVersion>())!.Recipe;
  var review=new DietaryReview("",r.Id,"milk",true,s.Assess(r).Fingerprint,"Reviewer",AllergenRules.Today(),"Spec reference","Validated equipment and cleaning","Test evidence","");s.AddReview(r.Id,review);Assert.NotEmpty(s.Safety(r).PublicClaims);
  var d=await Draft(c,"review",r.Id,review with{Controls="Changed cleaning procedure awaiting validation"});Assert.Empty(s.Safety(r).PublicClaims);Assert.Equal(2,s.Reviews(r.Id).Count);
  await Draft(c,"review",r.Id,review with{Target="gluten-free"},d.Revision);Assert.Empty(s.Safety(r).PublicClaims);
 }
 static async Task<HttpClient> Login(KitchenFactory f){var c=f.CreateClient();c.DefaultRequestHeaders.Add("X-Kitchen-Request","1");(await c.PostAsJsonAsync("/api/auth/setup",new{password="hotfix-test-password"})).EnsureSuccessStatusCode();return c;}
 static DraftInput Input(object body,int revision=0,string? request=null)=>new(revision,JsonSerializer.SerializeToElement(body,Store.Json),request??Guid.NewGuid().ToString());
 static async Task<WorkingDraft> Draft(HttpClient c,string kind,string id,object body,int revision=0,string? request=null){var r=await c.PostAsJsonAsync($"/api/drafts/{kind}/{id}",Input(body,revision,request));r.EnsureSuccessStatusCode();return (await r.Content.ReadFromJsonAsync<WorkingDraft>())!;}
 [Fact] public async Task DraftSavesDoNotPublishAndPublishRetryIsIdempotent()
 {
  using var f=new KitchenFactory();using var c=await Login(f);
  var original=(await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))![0];
  var d=await Draft(c,"recipe","lemon-pot",original.Recipe with{MethodSteps=["Mix"]});
  d=await Draft(c,"recipe","lemon-pot",original.Recipe with{MethodSteps=["Mix slowly","Chill"]},d.Revision);
  Assert.Single((await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))!);
  var published=await c.PostAsJsonAsync("/api/drafts/recipe/lemon-pot/publish",new{revision=d.Revision});published.EnsureSuccessStatusCode();
  var again=await c.PostAsJsonAsync("/api/drafts/recipe/lemon-pot/publish",new{revision=d.Revision});again.EnsureSuccessStatusCode();Assert.Equal(await published.Content.ReadAsStringAsync(),await again.Content.ReadAsStringAsync());
  var versions=(await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))!;Assert.Equal(2,versions.Count);Assert.Equal(original.Cost,versions[1].Cost with {Lines=original.Cost.Lines});Assert.Equal(new[]{"Mix slowly","Chill"},versions[0].Recipe.MethodSteps);
 }
 [Fact] public async Task DraftConflictAndLostAcknowledgementKeepNewerEdits()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var request=Guid.NewGuid().ToString();var d=await Draft(c,"recipe","new",new{name="First"},0,request);
  var retry=await Draft(c,"recipe","new",new{name="First"},0,request);Assert.Equal(d.Revision,retry.Revision);
  var newer=await Draft(c,"recipe","new",new{name="Newer"},d.Revision);
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync("/api/drafts/recipe/new",Input(new{name="Stale"},d.Revision))).StatusCode);
  Assert.Equal("Newer",(await c.GetFromJsonAsync<WorkingDraft>("/api/drafts/recipe/new"))!.Body.GetProperty("name").GetString());
 }
 [Fact] public async Task InvalidDraftIsRetainedButCannotPublish()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var recipe=(await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))![0].Recipe;
  var d=await Draft(c,"recipe",recipe.Id,recipe with{Name="",MethodSteps=[""]});
  Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync($"/api/drafts/recipe/{recipe.Id}/publish",new{revision=d.Revision})).StatusCode);
  Assert.Null((await c.GetFromJsonAsync<WorkingDraft>($"/api/drafts/recipe/{recipe.Id}"))!.Result);Assert.Single((await c.GetFromJsonAsync<List<RecipeVersion>>($"/api/recipes/{recipe.Id}/versions"))!);
 }
 [Fact] public async Task ConcurrentPublishedRecipeRejectsOlderDraft()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var r=(await c.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))![0].Recipe;
  var d=await Draft(c,"recipe",r.Id,r with{Description="Working"});(await c.PostAsJsonAsync("/api/recipes",r with{Description="Other window"})).EnsureSuccessStatusCode();
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync($"/api/drafts/recipe/{r.Id}/publish",new{revision=d.Revision})).StatusCode);
  Assert.Equal("Working",(await c.GetFromJsonAsync<WorkingDraft>($"/api/drafts/recipe/{r.Id}"))!.Body.GetProperty("description").GetString());
 }
 [Fact] public async Task QuoteDraftFinalisesExactlyOnceAndPreservesHistory()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var s=new Store(f.DatabasePath);var count=s.Prices().Count;var p=DomainTests.Cheese(3) with{IngredientId="cream-cheese",SupplierId="sample-supplier"};
  var d=await Draft(c,"price",p.IngredientId,p);d=await Draft(c,"price",p.IngredientId,p with{PackPrice=4},d.Revision);Assert.Equal(count,s.Prices().Count);
  for(int i=0;i<2;i++)(await c.PostAsJsonAsync($"/api/drafts/price/{p.IngredientId}/publish",new{revision=d.Revision})).EnsureSuccessStatusCode();
  Assert.Equal(count+1,s.Prices().Count);
 }
 [Fact] public async Task DraftsSurviveBackupRestoreAndProtectReferences()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var s=new Store(f.DatabasePath);
  s.Save("supplier","draft-only",0,new Supplier("draft-only",1,"Working quote supplier"));
  await Draft(c,"price","test",DomainTests.Cheese() with{IngredientId="cream-cheese",SupplierId="draft-only"});
  Assert.Throws<ValidationException>(()=>s.DeleteUnused("supplier","draft-only",1));
  var backup=f.DatabasePath+".backup";File.WriteAllBytes(backup,s.Backup());var target=f.DatabasePath+".restored";Store.Restore(backup,target);var restored=new Store(target);Assert.NotNull(restored.Draft("price","test"));Assert.Equal(s.Prices().Count,restored.Prices().Count);
 }
 [Fact] public async Task MutableRecordRetryDoesNotCreateDuplicateOrRevision()
 {
  using var f=new KitchenFactory();using var c=await Login(f);var supplier=new Supplier("retry-supplier",0,"Retry test");
  (await c.PostAsJsonAsync("/api/suppliers",supplier)).EnsureSuccessStatusCode();(await c.PostAsJsonAsync("/api/suppliers",supplier)).EnsureSuccessStatusCode();
  var s=new Store(f.DatabasePath);Assert.Equal(1,s.Get<Supplier>("supplier",supplier.Id).Revision);
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync("/api/suppliers",supplier with{Name="Different stale edit"})).StatusCode);
 }
}
