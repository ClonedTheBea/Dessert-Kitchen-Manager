using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
public static class SalesEndpoints {
 public static void MapSales(this RouteGroupBuilder api,Store store,object gate){
 var s=api.MapGroup("/sales");
 s.MapGet("/report",(DateOnly from,DateOnly to)=>{lock(gate)return store.SalesReport(from,to);});
 s.MapPost("/csv/headers",(CsvText input)=>store.ParseSalesCsv(input.Csv)[0]);
 s.MapPost("/csv/preview",(SalesImportInput input)=>{lock(gate)return store.PreviewSalesImport(input);});
 s.MapPost("/csv/confirm",(SalesImportInput input)=>{lock(gate)return store.ConfirmSalesImport(input);});
 s.MapGet("/mappings",()=>store.All<CsvMap>("sales-mapping"));
 s.MapPost("/mappings",(CsvMap input)=>{lock(gate)return store.SaveSalesMapping(input);});
 s.MapGet("/payouts",()=>{lock(gate)return store.PayoutView();});
 s.MapPost("/payouts",(PayoutInput input)=>{lock(gate)return store.RecordPayout(input);});
 s.MapGet("/orders",()=>{lock(gate)return store.Orders();});
 s.MapGet("/catalogue",()=>{lock(gate)return store.SalesCatalogue();});
 s.MapPost("/orders",(OrderInput input)=>{lock(gate)return store.SaveOrder(input);});
 s.MapPost("/action",(OrderAction input)=>{lock(gate)return store.ActOrder(input);});
 s.MapGet("/history/{id}",(string id)=>{lock(gate)return store.OrderHistory(id);});
 }
}

public record CsvText(string Csv);
