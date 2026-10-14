using System.Text;
using System.Text.Json;
using System.Security.Cryptography;
using Microsoft.Data.Sqlite;
using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;
public sealed partial class Store
{
    static string SalesHash(object input)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(input,Json))));
    public List<SaleOrder> Orders(){using var db=Open();return InventoryRows<SaleOrder>(db,null,"sales_orders").OrderByDescending(o=>o.RecordedAt).ToList();}
    static SaleOrder ReadOrder(SqliteConnection db,SqliteTransaction tx,string id){using var cmd=Command(db,tx,"SELECT body FROM sales_orders WHERE id=$id",("$id",id));return JsonSerializer.Deserialize<SaleOrder>((string?)cmd.ExecuteScalar()??throw new ValidationException("Order not found."),Json)!;}
    static void WriteOrder(SqliteConnection db,SqliteTransaction tx,SaleOrder o){
        using var check=Command(db,tx,"SELECT id FROM sales_orders WHERE channel=$c AND reference=$r AND id<>$id",("$c",o.ChannelId),("$r",o.Reference),("$id",o.Id));
        Guard.Require(o.Reference.Length==0||check.ExecuteScalar()==null,"This channel reference already exists. Open the existing order instead of duplicating the sale.");
        Execute(db,tx,"INSERT INTO sales_orders VALUES($id,$c,$ref,$v,$b) ON CONFLICT(id) DO UPDATE SET channel=$c,reference=$ref,revision=$v,body=$b",("$id",o.Id),("$c",o.ChannelId),("$ref",o.Reference.Length==0?DBNull.Value:o.Reference),("$v",o.Revision),("$b",JsonSerializer.Serialize(o,Json)));
    }
    T SalesCommand<T>(string op,string order,object input,Func<SqliteConnection,SqliteTransaction,T> run){
        Guard.Text(op,"Request reference",100);using var db=Open();using var tx=db.BeginTransaction();var hash=SalesHash(input);
        using(var cmd=Command(db,tx,"SELECT hash,result FROM sales_events WHERE id=$id",("$id",op)))using(var r=cmd.ExecuteReader()){if(r.Read()){if(r.GetString(0)!=hash)throw new ConflictException("This request was already used with different details. Reopen the order.");return JsonSerializer.Deserialize<T>(r.GetString(1),Json)!;}}
        var result=run(db,tx);Execute(db,tx,"INSERT INTO sales_events VALUES($id,$o,$at,$h,$b,$r)",("$id",op),("$o",order),("$at",Now()),("$h",hash),("$b",JsonSerializer.Serialize(input,Json)),("$r",JsonSerializer.Serialize(result,Json)));Audit(db,tx,"sales:record",order);tx.Commit();return result;
    }
    public object SalesCatalogue(){var b=BusinessAt(AllergenRules.Today());return new{channels=b.Channels,locations=Locations(),products=ProfitRecipes(AllergenRules.Today()).Select(r=>new{r.Id,r.Name,r.Revision,prices=b.Channels.ToDictionary(c=>c.Id,c=>b.Products.FirstOrDefault(p=>p.RecipeId==r.Id)?.Channels.FirstOrDefault(p=>p.ChannelId==c.Id)?.Price??r.SellingPrice)}),production=StockOperations().Where(o=>o.Type=="production"&&o.Result.GetProperty("mode").GetString()=="made-to-order"&&!StockOperations().Any(x=>x.Reverses==o.Id))};}
    public SaleOrder SaveOrder(OrderInput input)=>SalesCommand(input.OperationId,input.Id,input,(db,tx)=>{
        Guard.Text(input.Id,"Order ID",100);Guard.Require(!input.Id.StartsWith("import-",StringComparison.Ordinal),"Reserved order ID prefix.");Guard.Require(input.Notes.Length<=2000&&input.Reference.Length<=150,"Notes or reference are too long.");
        Guard.Require(input.Items is {Count:>0 and <=100}&&input.Items.Select(i=>i.RecipeId).Distinct().Count()==input.Items.Count,"Add distinct products to the basket.");
        SaleOrder? old=null;if(input.Revision>0){old=ReadOrder(db,tx,input.Id);if(old.Revision!=input.Revision)throw new ConflictException("Order changed. Reopen it before saving.");Guard.Require(old.Status=="draft","Confirmed orders cannot be rewritten. Cancel an unfulfilled order or record a refund.");}
        else {using var check=Command(db,tx,"SELECT count(*) FROM sales_orders WHERE id=$id",("$id",input.Id));Guard.Require((long)check.ExecuteScalar()! ==0,"Order already exists. Reopen it.");}
        var day=AllergenRules.Today();var b=BusinessAt(day);var channel=b.Channels.SingleOrDefault(c=>c.Id==input.ChannelId)??throw new ValidationException("Choose a sales channel.");
        var lines=new List<SaleLine>();foreach(var item in input.Items){Guard.Require(item.Quantity>0&&item.Quantity<=10000&&item.Quantity==decimal.Truncate(item.Quantity),"Use whole positive quantities up to 10,000.");var v=PublishedAt(item.RecipeId,day);Guard.Require(v.Recipe.IsSellable,"Choose a sellable dessert.");Guard.Require(v.Recipe.YieldUnit=="each","For order entry, publish a sellable recipe yielding individual portions (each).");var p=b.Products.FirstOrDefault(p=>p.RecipeId==item.RecipeId)??DefaultProduct(v.Recipe,b);var price=item.Price??p.Channels.FirstOrDefault(c=>c.ChannelId==channel.Id)?.Price??v.Recipe.SellingPrice;Guard.Amount(price,"Selling price");lines.Add(new(item.RecipeId,v.Recipe.Revision,v.Recipe.Name,item.Quantity,price,Costing.Money(price*item.Quantity),0,null,(v.Cost.IngredientCost+v.Cost.PackagingCost+v.Cost.LabourCost)/v.Recipe.Yield*item.Quantity));}
        var gross=lines.Sum(l=>l.Gross);Guard.Amount(input.Discount,"Discount");Guard.Require(input.Discount<=gross,"Discount cannot exceed the item total.");Guard.Require(input.Discount==Costing.Money(input.Discount),"Use whole pennies for discounts.");
        var discounts=lines.Select(l=>gross==0?0:decimal.Floor(input.Discount*l.Gross/gross*100)/100).ToArray();
        var pennies=(int)((input.Discount-discounts.Sum())*100);foreach(var i in Enumerable.Range(0,lines.Count).OrderByDescending(i=>gross==0?0:input.Discount*lines[i].Gross/gross-discounts[i]).Take(pennies))discounts[i]+=.01m;
        for(int i=0;i<lines.Count;i++){var l=lines[i];var discount=discounts[i];var p=b.Products.FirstOrDefault(p=>p.RecipeId==l.RecipeId);decimal? vat=!b.VatRegistered?0:p==null||p.VatTreatment=="unconfigured"?null:Costing.Money((l.Gross-discount)-(l.Gross-discount)/(1+p.OutputVatPercent/100));lines[i]=l with{Discount=discount,OutputVat=vat};}
        var total=gross-input.Discount;decimal? output=lines.Any(l=>l.OutputVat==null)?null:lines.Sum(l=>l.OutputVat!.Value);decimal? feeBase=channel.CommissionBasis=="net"?total-output:total;
        decimal? fees=CommissionKnown(channel)&&feeBase!=null?Costing.Money((feeBase.Value*channel.CommissionPercent/100+channel.ChargePerUnit*lines.Sum(l=>l.Quantity))*(1+channel.FeeVatPercent/100)):null;
        using var sequence=Command(db,tx,"SELECT count(*)+1 FROM sales_orders");
        var o=new SaleOrder(input.Id,old?.Number??"O-"+Convert.ToInt64(sequence.ExecuteScalar()).ToString("D6"),input.Revision+1,input.Confirm?Now():old?.RecordedAt??Now(),channel.Id,channel.Name,input.Reference.Trim(),input.Confirm?"received":"draft","unpaid","",lines,gross,input.Discount,total,output,fees,channel.FeeVatPercent,b.VatRegistered?b.InputRecoveryPercent:0,b.Revision,input.Notes,ChannelSnapshot:channel);
        WriteOrder(db,tx,o);foreach(var l in lines)Execute(db,tx,"INSERT OR IGNORE INTO record_dependencies VALUES('sale',$id,'recipe',$r,$d)",("$id",o.Id),("$r",l.RecipeId),("$d","Order "+o.Number));return o;
    });
    public SaleOrder ActOrder(OrderAction input)=>SalesCommand(input.OperationId,input.Id,input,(db,tx)=>{
        var o=ReadOrder(db,tx,input.Id);if(o.Revision!=input.Revision)throw new ConflictException("Order changed. Reopen it before continuing.");var next=o with{Revision=o.Revision+1};
        switch(input.Action){
        case "preparing":case "ready":Guard.Require(o.Status is "received" or "preparing" or "ready","Only active orders can change preparation state.");next=next with{Status=input.Action};break;
        case "cancel":Guard.Require(o.Status is "draft" or "received" or "preparing" or "ready","A completed order needs a refund, not cancellation.");Guard.Text(input.Reason,"Cancellation reason");next=next with{Status="cancelled"};break;
        case "paid":Guard.Require(o.ChannelId=="direct"&&o.Status is not "draft" and not "cancelled","Record direct payment on a confirmed active or completed order.");Guard.Require(o.PaymentStatus=="unpaid","Payment is already recorded.");Guard.Require(input.Method is "cash" or "card" or "bank" or "manual","Choose a payment method.");next=next with{PaymentStatus="paid",PaymentMethod=input.Method};break;
        case "refund":Guard.Require(o.Status=="completed"||o.Status=="cancelled"&&o.PaymentStatus=="paid","Refund a completed sale or paid cancelled order.");Guard.Require(input.Amount>0&&o.Refunds+input.Amount<=o.Total,"Refund must be positive and cannot exceed the remaining sale total.");Guard.Text(input.Reason,"Refund reason");next=next with{Refunds=o.Refunds+input.Amount,PaymentStatus=o.Refunds+input.Amount==o.Total?"refunded":"part-refunded"};break;
        case "complete":case "verify-fulfilment":
            var verify=input.Action=="verify-fulfilment";
            Guard.Require(verify?o.FinancialOnly&&o.Status=="completed"&&o.Lines.All(l=>l.Allocations==null):o.Status is "received" or "preparing" or "ready","Only an active order can be fulfilled once; historical verification must not already be linked.");
            Guard.Require(!o.FinancialOnly||verify,"Historical financial-only orders cannot consume today's stock.");
            if(verify){Guard.Text(input.Reason,"Historical fulfilment verification evidence");Guard.Require(o.Lines.All(l=>!string.IsNullOrEmpty(l.RecipeId)&&!string.IsNullOrEmpty(input.ProductionLinks?.GetValueOrDefault(l.RecipeId))),"Historical verification requires explicit production links for every mapped product. No current stock is consumed.");}
            var ctx=new InventoryContext(db,tx,input.OperationId,"owner");ctx.Location(input.LocationId);var lines=new List<SaleLine>();
            foreach(var l in o.Lines){
                var link=input.ProductionLinks?.GetValueOrDefault(l.RecipeId);if(!string.IsNullOrWhiteSpace(link)){
                    using var cmd=Command(db,tx,"SELECT result,body FROM inventory_operations WHERE id=$id AND type='production' AND NOT EXISTS(SELECT 1 FROM inventory_operations r WHERE r.reverses=$id)",("$id",link));using var r=cmd.ExecuteReader();Guard.Require(r.Read(),"Choose a valid, unreversed production action.");var production=JsonSerializer.Deserialize<ProductionResult>(r.GetString(0),Json)!;var source=JsonSerializer.Deserialize<ProductionInput>(r.GetString(1),Json)!;r.Close();
                    Guard.Require(production.Mode=="made-to-order"&&production.RecipeId==l.RecipeId&&production.Version==l.Version&&production.ActualYield==l.Quantity&&source.LocationId==input.LocationId&&(!verify||source.Date==DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.Parse(o.RecordedAt),"GMT Standard Time").Date)),"Made-to-order production must match this product, version, quantity and location exactly.");
                    using var used=Command(db,tx,"SELECT count(*) FROM sales_production_links WHERE production_id=$p",("$p",link));Guard.Require((long)used.ExecuteScalar()! ==0,"This production action is already linked to an order.");Execute(db,tx,"INSERT INTO sales_production_links VALUES($p,$o)",("$p",link),("$o",o.Id));lines.Add(l with{InventoryCost=production.BatchCost,CostStatus=production.ValuationStatus,Allocations=production.Allocations});continue;
                }
                var available=ctx.Lots.Where(x=>x.Kind=="recipe"&&x.ItemId==l.RecipeId&&x.RecipeVersion==l.Version&&Usable(x,AllergenRules.Today())).Sum(x=>ctx.Balance(x.Id,input.LocationId));Guard.Require(available>=l.Quantity,$"Only {available} {l.Name} available in the matching recipe version. Adjust the order or record production in Stock.");
                var remaining=l.Quantity;var allocations=new List<StockAllocation>();foreach(var lot in ctx.Lots.Where(x=>x.Kind=="recipe"&&x.ItemId==l.RecipeId&&x.RecipeVersion==l.Version&&Usable(x,AllergenRules.Today())).OrderBy(x=>x.RecordedAt).ThenBy(x=>x.Id)){var q=Math.Min(remaining,ctx.Balance(lot.Id,input.LocationId));if(q<=0)continue;ctx.Move(lot,input.LocationId,-q,"sale-fulfilment",AllergenRules.Today(),o.Number);allocations.Add(new(lot.Id,lot.BatchReference,lot.Name,lot.Unit,q,lot.UnitCost,q*lot.UnitCost,lot.ValuationStatus));remaining-=q;if(remaining==0)break;}
                lines.Add(l with{InventoryCost=MaterialCost(allocations),CostStatus=Valuation(allocations),Allocations=allocations});
            }
            Execute(db,tx,"INSERT INTO inventory_operations VALUES($id,'sale-fulfilment',$h,$at,'owner',$b,$r,NULL)",("$id",input.OperationId),("$h",SalesHash(input)),("$at",Now()),("$b",JsonSerializer.Serialize(input,Json)),("$r",JsonSerializer.Serialize(lines,Json)));
            foreach(var move in ctx.NewMoves)Execute(db,tx,"INSERT INTO inventory_movements VALUES($s,$o,$l,$loc,$b)",("$s",move.Sequence),("$o",input.OperationId),("$l",move.LotId),("$loc",move.LocationId),("$b",JsonSerializer.Serialize(move,Json)));
            next=next with{Status="completed",Lines=lines};break;
        default:throw new ValidationException("Choose a supported order action.");}
        WriteOrder(db,tx,next);return next;
    });
    public object OrderHistory(string id){using var db=Open();using var cmd=Command(db,null,"SELECT occurred_at,body,result FROM sales_events WHERE order_id=$id ORDER BY rowid",("$id",id));using var r=cmd.ExecuteReader();var rows=new List<object>();while(r.Read())rows.Add(new{at=r.GetString(0),request=JsonSerializer.Deserialize<JsonElement>(r.GetString(1)),snapshot=JsonSerializer.Deserialize<JsonElement>(r.GetString(2))});return rows;}
}
