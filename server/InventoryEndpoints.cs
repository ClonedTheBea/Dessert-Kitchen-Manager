using System.Text;
using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
public static class InventoryEndpoints
{
    public static void MapInventory(this RouteGroupBuilder api,Store store,object gate)
    {
        var inventory=api.MapGroup("/inventory");
        inventory.MapGet("/state",()=>{lock(gate)return store.InventoryState();});
        inventory.MapPost("/locations",(StockLocation input)=>{lock(gate)return store.AddLocation(input);});
        inventory.MapPost("/existing",(ExistingStockInput input)=>{lock(gate)return store.AddExistingStock(input);});
        inventory.MapPost("/purchase",(PurchaseInput input)=>{lock(gate)return store.Receive(input);});
        inventory.MapPost("/purchase/draft/{id}/discard",(string id,PublishRequest request)=>{lock(gate){store.DiscardPurchaseDraft(id,request.Revision);return Results.Ok();}});
        inventory.MapPost("/production/preview",(ProductionInput input)=>{lock(gate)return store.PreviewProduction(input);});
        inventory.MapPost("/production",(ProductionInput input)=>{lock(gate)return store.Produce(input);});
        inventory.MapPost("/action/{type}",(string type,StockActionInput input)=>{lock(gate)return store.StockAction(type,input);});
        inventory.MapPost("/reverse",(ReverseInput input)=>{lock(gate)return store.ReverseStock(input);});
        inventory.MapPost("/date-review/bulk",(BulkDateReview input)=>{lock(gate)return store.ReviewLots(input);});
        inventory.MapPost("/date-review",(LotDateReview input)=>{lock(gate)return store.ReviewLot(input);});
        inventory.MapPost("/stocktakes/start",(StocktakeStart input)=>{lock(gate)return store.StartStocktake(input);});
        inventory.MapPost("/stocktakes/finalise",(StocktakeInput input)=>{lock(gate)return store.FinaliseStocktake(input);});
        inventory.MapPost("/shopping",(ShoppingInput input)=>{lock(gate)return store.Shopping(input);});
        inventory.MapGet("/shopping/{id}/csv",(string id)=>{lock(gate){var d=store.Draft("inventory-shopping",id)??throw new ValidationException("Save the shopping draft first.");return Results.File(Encoding.UTF8.GetBytes(store.ShoppingCsv(d.Body.Deserialize<ShoppingInput>(Store.Json)!)),"text/csv; charset=utf-8","kitchen-shopping-list.csv");}});
        inventory.MapPost("/purchase/preview",(PurchaseInput input)=>
        {
            decimal gross=0,valuation=0;
            foreach(var l in input.Lines){Guard.Require(l.Packs>0&&l.PackSize>0&&l.PacksPerCase>0,"Enter positive pack quantities.");Guard.Amount(l.PackPrice,"Pack price");Guard.Amount(l.VatRate,"VAT rate",100);var count=l.Packs*(l.PackLabel=="case"?l.PacksPerCase:1);var p=new Price("",l.IngredientId,input.SupplierId,l.PackSize,l.Unit,l.PackPrice,l.VatRate,l.PriceIncludesVat,l.RecoverVat,"",input.Date,false);gross+=count*Costing.PurchaseGross(p);valuation+=count*Costing.UsablePackCost(p);}
            return new{gross=Costing.Money(gross),stockValue=Costing.Money(valuation),recoverableVat=Costing.Money(gross-valuation)};
        });
        inventory.MapPost("/confirm/{kind}/{id}",(string kind,string id,PublishRequest request)=>
        {
            lock(gate)
            {
                var d=store.Draft("inventory-"+kind,id)??throw new ValidationException("Enter and save the operation draft first.");
                if(d.Revision!=request.Revision)throw new ConflictException("The draft changed in another window. Reopen it before confirming.");
                if(d.Result is JsonElement resultBody && resultBody.ValueKind==JsonValueKind.Object && resultBody.TryGetProperty("discarded",out var discarded) && discarded.GetBoolean())throw new ValidationException("This purchase draft was discarded. Start a new purchase.");
                if(d.Result!=null)return Results.Json(d.Result);
                object result=kind switch{
                    "existing"=>store.AddExistingStock(d.Body.Deserialize<ExistingStockInput>(Store.Json)!,draft:d),
                    "purchase"=>store.Receive(d.Body.Deserialize<PurchaseInput>(Store.Json)!,draft:d),
                    "production"=>store.Produce(d.Body.Deserialize<ProductionInput>(Store.Json)!,draft:d),
                    "waste" or "transfer" or "adjustment"=>store.StockAction(kind,d.Body.Deserialize<StockActionInput>(Store.Json)!,draft:d),
                    "stocktake"=>store.FinaliseStocktake(d.Body.Deserialize<StocktakeInput>(Store.Json)!,draft:d),
                    _=>throw new ValidationException("Unsupported inventory confirmation.")};
                return Results.Json(result);
            }
        });
    }
}
