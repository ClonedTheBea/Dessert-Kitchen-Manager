using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;

public class UsabilityPolishTests
{
    static string Id()=>Guid.NewGuid().ToString("N");
    static DateOnly Today=>AllergenRules.Today();
    static Store Kitchen(){var s=new Store(Path.Combine(Path.GetTempPath(),"kitchen-polish",Id(),"test.db"));Seed.Run(s);return s;}
    static ExistingStockInput Existing(string kind="ingredient",string item="flour",decimal quantity=500,string unit="g") => new(Id(),kind,item,quantity,unit,"home",Today,"Already in my cupboard",DateReviewed:true,DateEvidence:"Owner reviewed original packaging");
    static decimal Balance(Store s,string id)=>s.StockMovements().Where(m=>m.LotId==id).Sum(m=>m.Quantity);
    static JsonElement State(Store s)=>JsonSerializer.SerializeToElement(s.InventoryState(),Store.Json);

    [Fact] public void ExistingIngredientsAreUnvaluedAuditedAndDoNotInventPurchases()
    {
        var s=Kitchen();var before=JsonSerializer.Serialize(s.Prices());var input=Existing();var lot=s.AddExistingStock(input);
        Assert.Equal(500,lot.InitialQuantity);Assert.Null(lot.UnitCost);Assert.Equal("unknown",lot.ValuationStatus);Assert.Equal("Opening stock",lot.Provenance);
        Assert.Single(s.StockOperations());Assert.Equal("existing-stock",s.StockOperations()[0].Type);Assert.Equal("opening-stock",s.StockMovements()[0].Type);Assert.Null(s.StockMovements()[0].Value);Assert.Equal(before,JsonSerializer.Serialize(s.Prices()));
        Assert.Equal(JsonValueKind.Null,State(s).GetProperty("summaries")[0].GetProperty("physicalValue").ValueKind);
        Assert.Equal(lot,s.AddExistingStock(input));Assert.Single(s.StockMovements());Assert.Throws<ConflictException>(()=>s.AddExistingStock(input with{Quantity=501}));
        Assert.Throws<ValidationException>(()=>s.DeleteUnused("ingredient","flour",1));
    }
    [Fact] public void HistoricalDessertsHaveProvenanceWithoutAssumedRecipeVersionOrConsumption()
    {
        var s=Kitchen();var versions=JsonSerializer.Serialize(s.Versions("biscoff-pot"));var input=Existing("recipe","biscoff-pot",4,"each") with{Source="Four pots made yesterday",PreparedOn=Today.AddDays(-1),UseBy=Today.AddDays(1)};
        var lot=s.AddExistingStock(input);Assert.Null(lot.RecipeVersion);Assert.Null(lot.AllergenSnapshot);Assert.Equal(input.PreparedOn,lot.PreparedOn);Assert.Equal("Historical preparation",lot.Provenance);Assert.Single(s.StockMovements());Assert.Equal("historical-preparation",s.StockMovements()[0].Type);
        Assert.True(State(s).GetProperty("balances")[0].GetProperty("allergenReviewRequired").GetBoolean());Assert.Equal(versions,JsonSerializer.Serialize(s.Versions("biscoff-pot")));
        s.StockAction("waste",new(Id(),lot.Id,"home",1,"quality-control-sample"));Assert.Equal(3,Balance(s,lot.Id));Assert.Null(s.StockMovements().Last().Value);
        Assert.Throws<ValidationException>(()=>s.ReverseStock(new(Id(),input.OperationId,"Wrong opening count")));
        Assert.Throws<ValidationException>(()=>s.StockAction("waste",new(Id(),lot.Id,"home",4,"quality-control-sample")));
    }
    [Theory][InlineData("unknown")][InlineData("estimated")][InlineData("known")]
    public void CostsPropagateThroughFifoProductionWithoutTurningUnknownIntoZero(string status)
    {
        var s=Kitchen();var p=new ProductionInput(Id(),"lemon-pot",1,4,4,"home","home",Today,"New batch",DateReviewed:true,DateEvidence:"Test review",LabourCost:2);
        foreach(var r in s.Requirements(p.RecipeId,1,4))s.AddExistingStock(Existing("ingredient",r.ItemId,r.Quantity,r.Unit) with{ValuationStatus=status,TotalCost=status=="unknown"?null:1});
        var preview=s.PreviewProduction(p);Assert.True(preview.CanProduce);Assert.Equal(status,preview.ValuationStatus);
        var result=s.Produce(p);Assert.Equal(status,result.ValuationStatus);var lot=s.StockLots().Single(l=>l.Id==result.FinishedLotId);Assert.Equal(status,lot.ValuationStatus);Assert.Equal(4,Balance(s,lot.Id));
        if(status=="unknown"){Assert.Null(preview.ActualMaterialCost);Assert.Null(result.BatchCost);Assert.Null(lot.UnitCost);Assert.All(result.Allocations,a=>Assert.Null(a.Cost));}
        else {Assert.NotNull(result.BatchCost);Assert.InRange(result.BatchCost.Value,s.Requirements(p.RecipeId,1,4).Count+2-.00000000000000000001m,s.Requirements(p.RecipeId,1,4).Count+2+.00000000000000000001m);Assert.NotNull(lot.UnitCost);}
        Assert.Throws<ValidationException>(()=>s.Produce(p with{OperationId=Id()}));Assert.Equal(4,Balance(s,lot.Id));
    }
    [Fact] public void UnknownAndKnownLayersRemainSeparateInFifoAndSummary()
    {
        var s=Kitchen();var first=s.AddExistingStock(Existing("ingredient","cream-cheese",100));var second=s.AddExistingStock(Existing("ingredient","cream-cheese",300) with{TotalCost=6,ValuationStatus="known"});
        Assert.Null(State(s).GetProperty("summaries")[0].GetProperty("physicalValue").Deserialize<decimal?>());
        var p=new ProductionInput(Id(),"lemon-pot",1,4,4,"home","home",Today,"Mixed batch");
        foreach(var r in s.Requirements("lemon-pot",1,4).Where(r=>r.ItemId!="cream-cheese"))s.AddExistingStock(Existing("ingredient",r.ItemId,r.Quantity,r.Unit) with{TotalCost=1,ValuationStatus="known"});
        var result=s.Produce(p);var used=result.Allocations.Where(a=>a.Item=="Cream cheese").ToList();Assert.Equal(first.Id,used[0].LotId);Assert.Equal(100,used[0].Quantity);Assert.Null(used[0].Cost);Assert.Equal(4,used[1].Cost);Assert.Null(result.BatchCost);Assert.Equal(100,Balance(s,second.Id));
    }
    [Fact] public void ExistingStockRetainsDateQuarantineAndRejectsInvalidInputsAtomically()
    {
        var s=Kitchen();var valid=Existing();
        foreach(var bad in new[]{valid with{Source=""},valid with{Quantity=-1},valid with{Unit="ml"},valid with{Date=Today.AddDays(1)},valid with{TotalCost=1},valid with{ValuationStatus="known"},valid with{DateEvidence=""},valid with{PreparedOn=Today},valid with{Kind="recipe",ItemId="lemon-pot",Unit="each",PreparedOn=Today.AddDays(1)}})
            Assert.Throws<ValidationException>(()=>s.AddExistingStock(bad));
        Assert.Empty(s.StockOperations());
        var lot=s.AddExistingStock(valid with{DateReviewed=false,DateEvidence=""});Assert.Equal(0,State(s).GetProperty("balances")[0].GetProperty("usable").GetDecimal());Assert.Throws<ValidationException>(()=>s.StockAction("waste",new(Id(),lot.Id,"home",1,"personal-consumption")));
        Assert.Throws<ValidationException>(()=>s.ReviewLot(new(Id(),lot.Id,Today.AddDays(-1),true,"Expired packet")));
        s.ReviewLot(new(Id(),lot.Id,Today.AddDays(-1),false,"Expired packet"));Assert.Equal("Expired",State(s).GetProperty("balances")[0].GetProperty("status").GetString());Assert.Equal(0,State(s).GetProperty("balances")[0].GetProperty("usable").GetDecimal());
    }
    [Fact] public void UnvaluedLotsSurviveBackupRestoreWithTheirAuditTrail()
    {
        var s=Kitchen();s.AddExistingStock(Existing());var path=Path.Combine(Path.GetTempPath(),Id()+".db");File.WriteAllBytes(path,s.Backup());Store.Restore(path,path+".restored");var restored=new Store(path+".restored");Assert.Equal(JsonSerializer.Serialize(s.StockLots()),JsonSerializer.Serialize(restored.StockLots()));Assert.Equal(JsonSerializer.Serialize(s.StockOperations()),JsonSerializer.Serialize(restored.StockOperations()));Assert.Null(restored.StockLots()[0].UnitCost);
    }
    [Fact] public async Task DraftConfirmationIsAuthenticatedRevisionCheckedAndIdempotent()
    {
        using var f=new KitchenFactory();using var c=f.CreateClient();c.DefaultRequestHeaders.Add("X-Kitchen-Request","1");Assert.Equal(HttpStatusCode.Unauthorized,(await c.PostAsJsonAsync("/api/inventory/existing",Existing())).StatusCode);
        (await c.PostAsJsonAsync("/api/auth/setup",new{password="polish-test-password"})).EnsureSuccessStatusCode();
        var input=new DraftInput(0,JsonSerializer.SerializeToElement(Existing(),Store.Json),Id());var response=await c.PostAsJsonAsync("/api/drafts/inventory-existing/current",input);response.EnsureSuccessStatusCode();var d=(await response.Content.ReadFromJsonAsync<WorkingDraft>())!;
        Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync("/api/inventory/confirm/existing/current",new{revision=0})).StatusCode);
        var first=await c.PostAsJsonAsync("/api/inventory/confirm/existing/current",new{revision=d.Revision});first.EnsureSuccessStatusCode();var again=await c.PostAsJsonAsync("/api/inventory/confirm/existing/current",new{revision=d.Revision});Assert.Equal(await first.Content.ReadAsStringAsync(),await again.Content.ReadAsStringAsync());Assert.Single(new Store(f.DatabasePath).StockMovements());
    }
}
