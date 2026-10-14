using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DessertKitchen.Domain;
using Microsoft.Data.Sqlite;
namespace DessertKitchen.Infrastructure;

public sealed partial class Store
{
    static List<T> InventoryRows<T>(SqliteConnection db,SqliteTransaction? tx,string table)
    {
        using var cmd=Command(db,tx,$"SELECT body FROM {table} ORDER BY rowid");using var r=cmd.ExecuteReader();var result=new List<T>();
        while(r.Read())result.Add(JsonSerializer.Deserialize<T>(r.GetString(0),Json)!);return result;
    }
    public List<StockLocation> Locations(){using var db=Open();return InventoryRows<StockLocation>(db,null,"inventory_locations");}
    public StockLocation AddLocation(StockLocation input)
    {
        Guard.Text(input.Name,"Location name");Guard.Require(input.Mode is "testing" or "commercial","Choose testing or commercial stock.");
        var value=input with{Id=Guid.NewGuid().ToString("N")};using var db=Open();using var tx=db.BeginTransaction();
        Execute(db,tx,"INSERT INTO inventory_locations VALUES($id,$body)",("$id",value.Id),("$body",JsonSerializer.Serialize(value,Json)));Audit(db,tx,"inventory:location",value.Id);tx.Commit();return value;
    }
    static List<StockLot> ReviewedLots(SqliteConnection db,SqliteTransaction? tx)
    {
        var lots=InventoryRows<StockLot>(db,tx,"inventory_lots");
        using var cmd=Command(db,tx,"SELECT body FROM inventory_operations WHERE type='date-review' ORDER BY rowid");using var r=cmd.ExecuteReader();
        while(r.Read()){var review=JsonSerializer.Deserialize<LotDateReview>(r.GetString(0),Json)!;var i=lots.FindIndex(l=>l.Id==review.LotId);if(i>=0)lots[i]=lots[i] with{UseBy=review.UseBy,DateReviewed=review.DateReviewed,DateEvidence=review.DateEvidence};}return lots;
    }
    public List<StockLot> StockLots(){using var db=Open();return ReviewedLots(db,null);}
    public LotDateReview ReviewLot(LotDateReview input)=>InventoryPost("date-review",input.OperationId,input,"owner",ctx=>{ctx.Lot(input.LotId);ReviewDate(input.DateReviewed,input.DateEvidence);Guard.Text(input.DateEvidence,"Reason and date evidence",2000);return input;});
    public List<StockMovement> StockMovements(){using var db=Open();return InventoryRows<StockMovement>(db,null,"inventory_movements");}
    public List<StockOperation> StockOperations()
    {
        using var db=Open();using var cmd=Command(db,null,"SELECT id,type,recorded_at,actor,body,result,reverses FROM inventory_operations ORDER BY rowid DESC");using var r=cmd.ExecuteReader();var result=new List<StockOperation>();
        while(r.Read())result.Add(new(r.GetString(0),r.GetString(1),r.GetString(2),r.GetString(3),JsonSerializer.Deserialize<JsonElement>(r.GetString(4)),JsonSerializer.Deserialize<JsonElement>(r.GetString(5)),r.IsDBNull(6)?null:r.GetString(6)));return result;
    }
    static void StockDate(DateOnly date)=>Guard.Require(date!=default && date<=AllergenRules.Today(),"Enter an actual date, not a future stock event.");
    static void ReviewDate(bool reviewed,string evidence){if(reviewed)Guard.Text(evidence,"Date / shelf-life review evidence",2000);}
    static bool Usable(StockLot l,DateOnly date)=>l.DateReviewed && l.ReceivedOn<=date && (l.UseBy==null || l.UseBy>=date) && (l.UseBy==null || l.UseBy>=AllergenRules.Today());
    static string LotStatus(StockLot l)=>l.UseBy<AllergenRules.Today()?"Expired":!l.DateReviewed?"Date review required":l.UseBy<=AllergenRules.Today().AddDays(3)?"Use-by approaching":l.UseBy==null?"Reviewed · no recorded use-by":"Available";
    sealed class InventoryContext
    {
        public List<StockLot> Lots;public List<StockMovement> Moves;public List<StockLocation> Locations;
        public List<StockLot> NewLots=[];public List<StockMovement> NewMoves=[];
        readonly string operation,actor;
        public InventoryContext(SqliteConnection db,SqliteTransaction tx,string id,string user){Lots=ReviewedLots(db,tx);Moves=InventoryRows<StockMovement>(db,tx,"inventory_movements");Locations=InventoryRows<StockLocation>(db,tx,"inventory_locations");operation=id;actor=user;}
        public StockLocation Location(string id)=>Locations.FirstOrDefault(l=>l.Id==id)??throw new ValidationException("Choose an existing stock location.");
        public StockLot Lot(string id)=>Lots.Concat(NewLots).FirstOrDefault(l=>l.Id==id)??throw new ValidationException("Stock lot not found.");
        public decimal Balance(string lot,string location)=>Moves.Concat(NewMoves).Where(m=>m.LotId==lot&&m.LocationId==location).Sum(m=>m.Quantity);
        public void Move(StockLot lot,string location,decimal quantity,string type,DateOnly date,string notes)
        {
            Location(location);Guard.Require(Balance(lot.Id,location)+quantity>=0,$"Not enough {lot.Name} in this location. Negative stock is not permitted.");
            var seq=(Moves.LastOrDefault()?.Sequence??0)+NewMoves.Count+1;
            NewMoves.Add(new(seq,operation,lot.Id,location,type,quantity,lot.Unit,quantity*lot.UnitCost,date,Now(),actor,notes));
        }
    }
    T InventoryPost<T>(string type,string id,object input,string actor,Func<InventoryContext,T> perform,WorkingDraft? draft=null,string? reverses=null)
    {
        Guard.Text(id,"Operation ID",100);var body=JsonSerializer.Serialize(input,Json);var hash=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(type+body)));
        using var db=Open();using var tx=db.BeginTransaction();
        using(var prior=Command(db,tx,"SELECT request_hash,result FROM inventory_operations WHERE id=$id",("$id",id)))using(var r=prior.ExecuteReader())
        {if(r.Read()){if(r.GetString(0)!=hash)throw new ConflictException("This operation ID was already used for different stock details. Start a new operation.");var priorResult=JsonSerializer.Deserialize<T>(r.GetString(1),Json)!;r.Close();CompleteDraft(db,tx,draft,priorResult!);tx.Commit();return priorResult;}}
        if(reverses!=null){using var check=Command(db,tx,"SELECT count(*) FROM inventory_operations WHERE reverses=$id",("$id",reverses));Guard.Require((long)check.ExecuteScalar()! == 0,"This operation has already been reversed.");}
        var ctx=new InventoryContext(db,tx,id,actor);var result=perform(ctx);
        Execute(db,tx,"INSERT INTO inventory_operations VALUES($id,$type,$hash,$at,$actor,$body,$result,$reverses)",("$id",id),("$type",type),("$hash",hash),("$at",Now()),("$actor",actor),("$body",body),("$result",JsonSerializer.Serialize(result,Json)),("$reverses",(object?)reverses??DBNull.Value));
        foreach(var lot in ctx.NewLots)Execute(db,tx,"INSERT INTO inventory_lots VALUES($id,$kind,$item,$version,$operation,$body)",("$id",lot.Id),("$kind",lot.Kind),("$item",lot.ItemId),("$version",(object?)lot.RecipeVersion??DBNull.Value),("$operation",id),("$body",JsonSerializer.Serialize(lot,Json)));
        foreach(var move in ctx.NewMoves)Execute(db,tx,"INSERT INTO inventory_movements VALUES($seq,$operation,$lot,$location,$body)",("$seq",move.Sequence),("$operation",id),("$lot",move.LotId),("$location",move.LocationId),("$body",JsonSerializer.Serialize(move,Json)));
        if(input is PurchaseInput purchase)Execute(db,tx,"INSERT INTO record_dependencies VALUES('purchase',$id,'supplier',$supplier,$description)",("$id",id),("$supplier",purchase.SupplierId),("$description","Stock purchase: "+purchase.Reference+" "+id));
        CompleteDraft(db,tx,draft,result!);Audit(db,tx,"inventory:"+type,id);tx.Commit();return result;
    }
    static decimal? TotalValue(IEnumerable<decimal?> values){var list=values.ToList();return list.Any(v=>v==null)?null:Costing.Money(list.Sum(v=>v!.Value));}
    public object InventoryState()
    {
        var lots=StockLots();var moves=StockMovements();var locations=Locations();var balances=new List<StockBalance>();var operations=StockOperations();
        bool Changed(StockLot lot,HashSet<string> seen)
        {
            if(!seen.Add(lot.Id))return false;
            if(lot.AllergenSnapshot==null)return true;
            if(lot.Kind=="ingredient")return lot.AllergenSnapshot.Dependencies.GetValueOrDefault("ingredient:"+lot.ItemId)!=Get<Ingredient>("ingredient",lot.ItemId).Revision || lot.AllergenSnapshot.Fingerprint!=PriceSource(lot.ItemId) || lot.SupplierSnapshot!=null&&!lot.AllergenSnapshot.Fingerprint.StartsWith(lot.SupplierSnapshot.Id+"\n",StringComparison.Ordinal);
            if(Assess(Get<Recipe>("recipe",lot.ItemId)).Fingerprint!=lot.AllergenSnapshot.Fingerprint)return true;
            var op=operations.FirstOrDefault(o=>o.Id==lot.OperationId);var production=op?.Type=="production"?op.Result.Deserialize<ProductionResult>(Json):null;
            return production?.Allocations.Any(a=>Changed(lots.Single(l=>l.Id==a.LotId),seen))??true;
        }
        foreach(var lot in lots)foreach(var location in locations)
        {
            var qty=moves.Where(m=>m.LotId==lot.Id&&m.LocationId==location.Id).Sum(m=>m.Quantity);if(qty==0)continue;
            bool changed=Changed(lot,[]);
            balances.Add(new(lot,location,qty,Usable(lot,AllergenRules.Today())?qty:0,qty*lot.UnitCost,LotStatus(lot),changed));
        }
        var reversed=operations.Where(o=>o.Reverses!=null).Select(o=>o.Reverses!).ToHashSet();
        var summaries=locations.Select(location=>{var waste=moves.Where(m=>m.LocationId==location.Id&&m.Type.StartsWith("waste:")&&!reversed.Contains(m.OperationId)).ToList();return new{locationId=location.Id,wasteValuationStatus=waste.Any(m=>lots.First(l=>l.Id==m.LotId).ValuationStatus!="known")?"Includes unknown or estimated costs":"Known costs",valuationStatus=balances.Any(b=>b.Location.Id==location.Id&&b.Lot.ValuationStatus!="known")?"Includes unknown or estimated costs":"Known costs",physicalValue=TotalValue(balances.Where(b=>b.Location.Id==location.Id).Select(b=>b.Value)),wasteValue=TotalValue(waste.Select(m=>-m.Value)),wasteByReason=waste.GroupBy(m=>m.Type).ToDictionary(g=>g.Key,g=>TotalValue(g.Select(m=>-m.Value)))};}).ToList();
        using var db=Open();return new{locations,balances,lots,summaries,movements=moves.OrderByDescending(m=>m.Sequence),operations,stocktakes=InventoryRows<StocktakeSnapshot>(db,null,"inventory_stocktakes"),valuationMethod="FIFO by receipt entry; lot costs held at full decimal precision. Physical stock value includes quarantined/expired stock until disposal. No reservations."};
    }
    public List<StockLot> Receive(PurchaseInput input,string actor="owner",WorkingDraft? draft=null)=>InventoryPost("purchase",input.OperationId,input,actor,ctx=>
    {
        StockDate(input.Date);ctx.Location(input.LocationId);var supplier=Get<Supplier>("supplier",input.SupplierId);Guard.Require(!supplier.Archived,"Restore the supplier before recording a new purchase.");
        Guard.Require(input.Lines is {Count:>0 and <=100},"Add 1–100 purchase lines.");var result=new List<StockLot>();
        foreach(var line in input.Lines)
        {
            var item=Get<Ingredient>("ingredient",line.IngredientId);Guard.Require(!item.Archived,"Restore the ingredient before receiving new stock.");
            Guard.Require(line.Packs>0&&line.Packs<=1000000&&line.PackSize>0&&line.PackSize<=1000000,"Pack count and size must be positive, at most 1,000,000.");Guard.Require(line.PackLabel is "pack" or "case","Choose packs or cases.");Guard.Require(line.PacksPerCase>0&&line.PacksPerCase<=1000000,"Packs per case must be positive.");Guard.Amount(line.PackPrice,"Pack price");Guard.Amount(line.VatRate,"VAT rate",100);ReviewDate(line.DateReviewed,line.DateEvidence);
            var count=line.Packs*(line.PackLabel=="case"?line.PacksPerCase:1);var quantity=count*Units.Convert(line.PackSize,line.Unit,item.BaseUnit);
            var price=new Price("",item.Id,supplier.Id,line.PackSize,line.Unit,line.PackPrice,line.VatRate,line.PriceIncludesVat,line.RecoverVat,"",input.Date,false);
            var unitCost=count*Costing.UsablePackCost(price)/quantity;
            var snapshot=new AllergenAssessment(item.AllergenInfo?.Contains??[],item.AllergenInfo?.MayContain??[],item.AllergenInfo==null?[item.Name]:[],EffectiveIngredient(item).AllergenInfo?.Verification!="verified"?[item.Name]:[],string.IsNullOrWhiteSpace(item.AllergenInfo?.CrossContactNotes)?[]:[item.AllergenInfo.CrossContactNotes],new(){["ingredient:"+item.Id]=item.Revision},PriceSource(item.Id));
            var lot=new StockLot(Guid.NewGuid().ToString("N"),"ingredient",item.Id,item.Name,item.BaseUnit,null,input.OperationId,line.BatchReference,input.Date,line.UseBy,line.DateReviewed,line.DateEvidence,quantity,unitCost,Now(),snapshot,item,supplier);
            ctx.NewLots.Add(lot);ctx.Move(lot,input.LocationId,quantity,"purchase-receipt",input.Date,input.Reference+" "+input.Notes);result.Add(lot);
        }return result;
    },draft);
    public List<StockMovement> StockAction(string type,StockActionInput input,string actor="owner",WorkingDraft? draft=null)=>InventoryPost(type,input.OperationId,input,actor,ctx=>
    {
        Guard.Require(type is "waste" or "transfer" or "adjustment","Choose waste, transfer or adjustment.");var lot=ctx.Lot(input.LotId);var date=input.Date??AllergenRules.Today();StockDate(date);Guard.Require(date>=lot.ReceivedOn,"Movement cannot predate receipt/production.");Guard.Text(input.Reason,"Reason",2000);Guard.Require(input.Quantity!=0&&Math.Abs(input.Quantity)<=1000000,"Enter a non-zero quantity up to 1,000,000 in the lot's unit.");
        if(type=="waste"){Guard.Require(input.Reason is "expired" or "damaged" or "spoiled" or "production-error" or "quality-control-sample" or "personal-consumption" or "staff-consumption" or "other","Choose a supported waste reason.");if(input.Reason=="other")Guard.Text(input.Notes,"Explain other waste");}
        if(type=="adjustment")ctx.Move(lot,input.LocationId,input.Quantity,"manual-adjustment",date,input.Reason+" "+input.Notes);
        else
        {
            Guard.Require(input.Quantity>0,"Enter a positive quantity.");
            if(type=="waste"&&input.Reason is "quality-control-sample" or "personal-consumption" or "staff-consumption")Guard.Require(Usable(lot,date),"Review the recorded dates first; expired/unreviewed stock cannot be sampled or consumed.");
            if(type=="transfer"){Guard.Require(input.DestinationId!=input.LocationId,"Choose a different destination.");Guard.Require(ctx.Location(input.LocationId).Mode==ctx.Location(input.DestinationId??"").Mode,"Testing stock cannot be transferred into commercial stock, or vice versa.");}
            ctx.Move(lot,input.LocationId,-input.Quantity,type=="transfer"?"transfer-out":"waste:"+input.Reason,date,input.Notes);
            if(type=="transfer")ctx.Move(lot,input.DestinationId!,input.Quantity,"transfer-in",date,input.Notes);
        }return ctx.NewMoves.ToList();
    },draft);
    public List<StockMovement> ReverseStock(ReverseInput input,string actor="owner")=>InventoryPost("reversal",input.OperationId,input,actor,ctx=>
    {
        Guard.Text(input.Reason,"Correction reason",2000);var original=StockOperations().FirstOrDefault(o=>o.Id==input.OriginalId)??throw new ValidationException("Operation not found.");Guard.Require(original.Type is not "sale-fulfilment", "Sale fulfilment cannot be reversed. Record an explained stock adjustment separately from any refund.");using(var sales=Open())using(var linked=Command(sales,null,"SELECT count(*) FROM sales_production_links WHERE production_id=$id",("$id",input.OriginalId)))Guard.Require((long)linked.ExecuteScalar()! ==0,"Production linked to a fulfilled order cannot be reversed. Record an explained stock adjustment instead.");Guard.Require(original.Type is not "reversal" and not "date-review","A reversal cannot itself be reversed; record a new explained adjustment.");
        foreach(var old in ctx.Moves.Where(m=>m.OperationId==input.OriginalId).Reverse().ToList())ctx.Move(ctx.Lot(old.LotId),old.LocationId,-old.Quantity,"reversal",AllergenRules.Today(),input.Reason+"; reverses "+input.OriginalId);
        return ctx.NewMoves.ToList();
    },reverses:input.OriginalId);
}
