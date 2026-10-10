using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;
public class RedesignTests
{
    static async Task<HttpClient> Login(KitchenFactory f)
    {
        var c=f.CreateClient();c.DefaultRequestHeaders.Add("X-Kitchen-Request","1");
        (await c.PostAsJsonAsync("/api/auth/setup",new{password="redesign-test-password"})).EnsureSuccessStatusCode();return c;
    }
    static IngredientSetup Setup(string supplier="sample-supplier")=>new(new Ingredient("",0,"Combined butter","Dairy","","g","","",0),DomainTests.Cheese(12) with{SupplierId=supplier,PackQuantity=2,Unit="kg",VatRate=20,RecoverVat=true});
    static async Task<WorkingDraft> Draft(HttpClient c,IngredientSetup setup,int revision=0)
    {
        var r=await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new",new DraftInput(revision,JsonSerializer.SerializeToElement(setup,Store.Json),Guid.NewGuid().ToString()));r.EnsureSuccessStatusCode();return (await r.Content.ReadFromJsonAsync<WorkingDraft>())!;
    }
    [Theory][InlineData(false)][InlineData(true)]
    public async Task CombinedCreationIsAtomicAndRetryDoesNotDuplicate(bool newSupplier)
    {
        using var f=new KitchenFactory();using var c=await Login(f);var store=new Store(f.DatabasePath);
        var before=store.All<Ingredient>("ingredient").Count;var prices=store.Prices().Count;var suppliers=store.All<Supplier>("supplier").Count;
        var input=Setup() with{NewSupplierName=newSupplier?"New butter supplier":""};var d=await Draft(c,input);
        Assert.Equal(before,store.All<Ingredient>("ingredient").Count);Assert.Equal(prices,store.Prices().Count);
        var first=await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new/publish",new{revision=d.Revision});first.EnsureSuccessStatusCode();
        var retry=await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new/publish",new{revision=d.Revision});retry.EnsureSuccessStatusCode();Assert.Equal(await first.Content.ReadAsStringAsync(),await retry.Content.ReadAsStringAsync());
        Assert.Equal(before+1,store.All<Ingredient>("ingredient").Count);Assert.Equal(prices+1,store.Prices().Count);Assert.Equal(suppliers+(newSupplier?1:0),store.All<Supplier>("supplier").Count);
        var item=store.All<Ingredient>("ingredient").Single(i=>i.Name=="Combined butter");var quote=store.Prices().Single(p=>p.IngredientId==item.Id);Assert.Equal(.005m,Costing.IngredientCost(quote,1,"g",0));
        Assert.Throws<ValidationException>(()=>store.DeleteUnused("ingredient",item.Id,1));
        Assert.Throws<ValidationException>(()=>store.DeleteUnused("supplier",quote.SupplierId,1));
    }
    [Fact] public async Task InvalidPriceCreatesNothingAndRetainsDraftForCorrection()
    {
        using var f=new KitchenFactory();using var c=await Login(f);var store=new Store(f.DatabasePath);var before=store.All<Ingredient>("ingredient").Count;var suppliers=store.All<Supplier>("supplier").Count;var prices=store.Prices().Count;
        var input=Setup() with{NewSupplierName="Must not be created",Price=Setup().Price! with{Unit="ml"}};var d=await Draft(c,input);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new/publish",new{revision=d.Revision})).StatusCode);
        Assert.Equal(before,store.All<Ingredient>("ingredient").Count);Assert.Equal(prices,store.Prices().Count);Assert.Equal(suppliers,store.All<Supplier>("supplier").Count);Assert.Null(store.Draft("ingredient-setup","new")!.Result);
        var newer=await Draft(c,Setup(),d.Revision);
        Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new/publish",new{revision=d.Revision})).StatusCode);
        (await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new/publish",new{revision=newer.Revision})).EnsureSuccessStatusCode();
    }
    [Fact] public async Task CombinedDraftProtectsSupplierAndRejectsArchivedSupplier()
    {
        using var f=new KitchenFactory();using var c=await Login(f);var store=new Store(f.DatabasePath);store.Save("supplier","new-source",0,new Supplier("new-source",1,"New source"));
        var d=await Draft(c,Setup("new-source"));Assert.Throws<ValidationException>(()=>store.DeleteUnused("supplier","new-source",1));
        store.Save("supplier","new-source",1,new Supplier("new-source",2,"New source",Archived:true));
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/drafts/ingredient-setup/new/publish",new{revision=d.Revision})).StatusCode);
    }
    [Fact] public async Task UnitPreviewUsesExistingDecimalVatRulesWithoutWritingPrices()
    {
        using var f=new KitchenFactory();using var c=await Login(f);var store=new Store(f.DatabasePath);var before=store.Prices().Count;
        var result=await c.PostAsJsonAsync("/api/prices/preview",Setup().Price);result.EnsureSuccessStatusCode();var value=await result.Content.ReadFromJsonAsync<JsonElement>();Assert.Equal(.005m,value.GetProperty("cost").GetDecimal());Assert.Equal("g",value.GetProperty("unit").GetString());Assert.Equal(before,store.Prices().Count);
        Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/prices/preview",Setup().Price! with{PackQuantity=0})).StatusCode);
    }
}
