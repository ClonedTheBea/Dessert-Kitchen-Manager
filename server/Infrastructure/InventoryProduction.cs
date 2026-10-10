using System.Text.Json;
using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;
public sealed partial class Store
{
    public RecipeVersion RecipeAt(string id,int version)=>Versions(id).FirstOrDefault(v=>v.Recipe.Revision==version)??throw new ValidationException("Select an existing published recipe version.");
    public List<StockRequirement> Requirements(string id,int version,decimal yield,List<string>? held=null,decimal extraWaste=0)
    {
        Guard.Require(yield>0&&yield<=1000000,"Planned yield must be positive, at most 1,000,000.");Guard.Amount(extraWaste,"Extra production waste %",100);var rows=new List<StockRequirement>();
        void Resolve(RecipeVersion v,decimal output,HashSet<string> path)
        {
            Guard.Require(path.Count<40&&path.Add(v.Recipe.Id),"Invalid nested recipe cycle.");var factor=output/v.Recipe.Yield;
            for(int i=0;i<v.Recipe.Lines.Count;i++)
            {
                var line=v.Recipe.Lines[i];var quantity=line.Quantity*factor*(1+line.WastePercent/100);
                if(line.Kind=="ingredient")
                {var ingredient=Get<Ingredient>("ingredient",line.ReferenceId);rows.Add(new("ingredient:"+ingredient.Id,"ingredient",ingredient.Id,null,ingredient.Name,ingredient.BaseUnit,Units.Convert(quantity,line.Unit,ingredient.BaseUnit)));}
                else
                {
                    var source=v.Cost.Lines[i].SourceId;var marker=source.LastIndexOf(":v",StringComparison.Ordinal);Guard.Require(marker>=0&&int.TryParse(source[(marker+2)..],out _),"This historical sub-recipe has no version reference. Publish a reviewed version first.");
                    var child=RecipeAt(line.ReferenceId,int.Parse(source[(marker+2)..]));var amount=Units.Convert(quantity,line.Unit,child.Recipe.YieldUnit);
                    if(held?.Contains(child.Recipe.Id)==true)rows.Add(new($"recipe:{child.Recipe.Id}:v{child.Recipe.Revision}","recipe",child.Recipe.Id,child.Recipe.Revision,child.Recipe.Name,child.Recipe.YieldUnit,amount));
                    else Resolve(child,amount,new(path));
                }
            }
        }
        Resolve(RecipeAt(id,version),yield,[]);return rows.GroupBy(r=>r.Key).Select(g=>g.First() with{Quantity=g.Sum(r=>r.Quantity)*(1+extraWaste/100)}).ToList();
    }
    static bool Matches(StockLot lot,StockRequirement r)=>lot.Kind==r.Kind&&lot.ItemId==r.ItemId&&lot.RecipeVersion==r.Version;
    List<StockAllocation> Allocate(InventoryContext ctx,List<StockRequirement> rows,string location,DateOnly date,List<ActualUsage>? usage,bool post,string notes,out bool enough)
    {
        ctx.Location(location);enough=true;var allocations=new List<StockAllocation>();
        Guard.Require(usage==null || usage.Count==rows.Count && usage.Select(x=>x.Key).Distinct().Count()==rows.Count && usage.All(a=>rows.Any(r=>r.Key==a.Key)),"Actual usage must include each planned component once. Create a recipe variant for substitutions.");
        foreach(var row in rows)
        {
            var actual=usage?.Single(u=>u.Key==row.Key);var remaining=actual?.Quantity??row.Quantity;Guard.Amount(remaining,"Actual component quantity");
            foreach(var lot in ctx.Lots.Where(l=>Matches(l,row)&&Usable(l,date)&&(string.IsNullOrWhiteSpace(actual?.LotId)||l.Id==actual.LotId)).OrderBy(l=>l.RecordedAt).ThenBy(l=>l.Id))
            {
                var available=ctx.Balance(lot.Id,location)-(!post?allocations.Where(a=>a.LotId==lot.Id).Sum(a=>a.Quantity):0);var quantity=Math.Min(remaining,available);if(quantity<=0)continue;
                allocations.Add(new(lot.Id,lot.BatchReference,lot.Name,lot.Unit,quantity,lot.UnitCost,quantity*lot.UnitCost));
                if(post)ctx.Move(lot,location,-quantity,"production-consumption",date,notes);remaining-=quantity;if(remaining==0)break;
            }
            if(remaining>0){enough=false;if(post)throw new ValidationException($"Shortage: {remaining} {row.Unit} {row.Name}. Nothing was posted. Receive usable stock or reduce actual usage with an explanation.");}
        }return allocations;
    }
    static decimal ExpectedCost(RecipeVersion v,decimal yield,decimal waste)=>(v.Cost.Lines.Sum(l=>l.Cost)*(1+waste/100)+v.Recipe.LabourMinutes/60*v.Recipe.HourlyRate)*yield/v.Recipe.Yield;
    ProductionPreview ProductionPreview(ProductionInput input,InventoryContext ctx)
    {
        StockDate(input.Date);var rows=Requirements(input.RecipeId,input.Version,input.PlannedYield,input.HeldRecipeIds,input.ExtraWastePercent);
        var requirements=rows.Select(r=>{var available=ctx.Lots.Where(l=>Matches(l,r)&&Usable(l,input.Date)).Sum(l=>ctx.Balance(l.Id,input.LocationId));return new RequirementAvailability(r,available,Math.Max(0,r.Quantity-available));}).ToList();
        var allocations=Allocate(ctx,rows,input.LocationId,input.Date,input.ActualUsage,false,input.Notes,out var enough);
        return new(requirements,allocations,ExpectedCost(RecipeAt(input.RecipeId,input.Version),input.PlannedYield,input.ExtraWastePercent),allocations.Sum(a=>a.Cost),enough);
    }
    public ProductionPreview PreviewProduction(ProductionInput input){using var db=Open();using var tx=db.BeginTransaction();return ProductionPreview(input,new(db,tx,input.OperationId,"owner"));}
    public ProductionResult Produce(ProductionInput input,string actor="owner",WorkingDraft? draft=null)=>InventoryPost("production",input.OperationId,input,actor,ctx=>
    {
        StockDate(input.Date);Guard.Text(input.Operator,"Producer");Guard.Text(input.BatchReference,"Production batch reference");Guard.Require(input.ActualYield>0&&input.ActualYield<=1000000,"Actual yield must be positive.");Guard.Amount(input.LabourCost,"Actual labour cost");Guard.Amount(input.OtherCost,"Other production cost");Guard.Require(input.Mode is "made-ahead" or "made-to-order","Select made-ahead or made-to-order.");ReviewDate(input.DateReviewed,input.DateEvidence);
        var root=RecipeAt(input.RecipeId,input.Version);var rows=Requirements(input.RecipeId,input.Version,input.PlannedYield,input.HeldRecipeIds,input.ExtraWastePercent);
        var from=ctx.Location(input.LocationId);var destination=ctx.Location(input.DestinationId);Guard.Require(from.Mode==destination.Mode,"Production cannot move testing ingredients into commercial stock.");
        if(input.ActualYield!=input.PlannedYield || input.ActualUsage?.Any(a=>rows.Any(r=>r.Key==a.Key&&r.Quantity!=a.Quantity))==true)Guard.Text(input.Notes,"Explanation for actual yield / usage differences",5000);
        var allocations=Allocate(ctx,rows,input.LocationId,input.Date,input.ActualUsage,true,input.Notes,out _);var material=allocations.Sum(a=>a.Cost);var total=material+input.LabourCost+input.OtherCost;
        // Snapshot the assessed published composition and the actual lot references. No new dietary approval is inferred.
        var assessment=root.AllergenSnapshot;string? lotId=null;
        if(input.Mode=="made-ahead")
        {
            lotId=Guid.NewGuid().ToString("N");var lot=new StockLot(lotId,"recipe",root.Recipe.Id,root.Recipe.Name,root.Recipe.YieldUnit,root.Recipe.Revision,input.OperationId,input.BatchReference,input.Date,input.UseBy,input.DateReviewed,input.DateEvidence,input.ActualYield,total/input.ActualYield,Now(),assessment);
            ctx.NewLots.Add(lot);ctx.Move(lot,input.DestinationId,input.ActualYield,"production-output",input.Date,input.Notes);
        }
        return new ProductionResult(input.BatchReference,root.Recipe.Id,root.Recipe.Revision,input.PlannedYield,input.ActualYield,root.Recipe.YieldUnit,input.Mode,ExpectedCost(root,input.PlannedYield,input.ExtraWastePercent),material,input.LabourCost,input.OtherCost,total,total/input.ActualYield,lotId,allocations,assessment,input.Operator,input.Notes);
    },draft);
    public StocktakeSnapshot StartStocktake(StocktakeStart input)
    {
        using var db=Open();using var tx=db.BeginTransaction();var ctx=new InventoryContext(db,tx,"","owner");ctx.Location(input.LocationId);
        var lines=ctx.Lots.Where(l=>string.IsNullOrWhiteSpace(input.Category)||(l.Kind=="ingredient"?Get<Ingredient>("ingredient",l.ItemId).Category:Get<Recipe>("recipe",l.ItemId).Category)==input.Category)
            .Where(l=>ctx.Moves.Any(m=>m.LotId==l.Id&&m.LocationId==input.LocationId)).Select(l=>new CountSnapshotLine(l.Id,ctx.Balance(l.Id,input.LocationId),ctx.Moves.Where(m=>m.LotId==l.Id&&m.LocationId==input.LocationId).Max(m=>m.Sequence))).ToList();
        var snapshot=new StocktakeSnapshot(Guid.NewGuid().ToString("N"),input.LocationId,input.Category,Now(),lines);Execute(db,tx,"INSERT INTO inventory_stocktakes VALUES($id,$body)",("$id",snapshot.Id),("$body",JsonSerializer.Serialize(snapshot,Json)));Audit(db,tx,"inventory:stocktake-start",snapshot.Id);tx.Commit();return snapshot;
    }
    public List<StockMovement> FinaliseStocktake(StocktakeInput input,string actor="owner",WorkingDraft? draft=null)=>InventoryPost("stocktake",input.OperationId,input,actor,ctx=>
    {
        using var db=Open();var snapshot=InventoryRows<StocktakeSnapshot>(db,null,"inventory_stocktakes").SingleOrDefault(s=>s.Id==input.SnapshotId)??throw new ValidationException("Stocktake snapshot not found.");
        Guard.Require(!StockOperations().Any(o=>o.Type=="stocktake"&&o.Body.GetProperty("snapshotId").GetString()==snapshot.Id),"This stocktake was already finalised. Start another stocktake.");
        Guard.Require(input.Counts is {Count:>0}&&input.Counts.Select(c=>c.LotId).Distinct().Count()==input.Counts.Count,"Count one or more distinct lots.");
        foreach(var count in input.Counts)
        {
            Guard.Amount(count.Quantity,"Physical count");var line=snapshot.Lines.SingleOrDefault(l=>l.LotId==count.LotId)??throw new ValidationException("Only lots in this stocktake snapshot can be counted.");
            var latest=ctx.Moves.Where(m=>m.LotId==line.LotId&&m.LocationId==snapshot.LocationId).Max(m=>m.Sequence);
            if(latest!=line.LastSequence)throw new ConflictException("Stock moved during counting for "+ctx.Lot(line.LotId).Name+". Start a fresh stocktake for affected lots; no counts were posted.");
            var delta=count.Quantity-line.Quantity;if(delta!=0){Guard.Text(count.Reason,"Discrepancy explanation",2000);ctx.Move(ctx.Lot(line.LotId),snapshot.LocationId,delta,"stocktake-correction",AllergenRules.Today(),count.Reason+" "+input.Notes);}
        }return ctx.NewMoves.ToList();
    },draft);
    public List<ShoppingRow> Shopping(ShoppingInput input)
    {
        Guard.Require(input.Plans is {Count:>0 and <=100},"Add at least one planned recipe.");using var db=Open();using var tx=db.BeginTransaction();var ctx=new InventoryContext(db,tx,"","owner");ctx.Location(input.LocationId);
        var requirements=input.Plans.SelectMany(p=>Requirements(p.RecipeId,p.Version,p.Quantity,p.HeldRecipeIds)).GroupBy(r=>r.Key).Select(g=>g.First() with{Quantity=g.Sum(r=>r.Quantity)});
        var result=new List<ShoppingRow>();foreach(var row in requirements)
        {
            var available=ctx.Lots.Where(l=>Matches(l,row)&&Usable(l,AllergenRules.Today())).Sum(l=>ctx.Balance(l.Id,input.LocationId));var shortfall=Math.Max(0,row.Quantity-available);
            Price? quote=null;if(row.Kind=="ingredient")quote=Prices().Where(p=>p.IngredientId==row.ItemId&&p.EffectiveDate<=AllergenRules.Today()&&!Get<Supplier>("supplier",p.SupplierId).Archived).OrderByDescending(p=>p.EffectiveDate).ThenByDescending(p=>p.RecordedAt).FirstOrDefault();
            decimal? pack=quote==null?null:Units.Convert(quote.PackQuantity,quote.Unit,row.Unit);decimal? suggested=pack==null?null:decimal.Ceiling(shortfall/pack.Value);var selected=input.PackOverrides?.GetValueOrDefault(row.Key,suggested??0)??suggested;
            if(selected!=null)Guard.Require(selected>=0&&selected<=1000000&&selected==decimal.Truncate(selected.Value),"Shopping pack counts must be non-negative whole packs.");
            result.Add(new(row.Key,row.ItemId,row.Name,row.Unit,row.Quantity,available,shortfall,pack,suggested,selected,selected*pack,quote==null?(row.Kind=="recipe"?"Produce this prepared component":"No current supplier quote"):Get<Supplier>("supplier",quote.SupplierId).Name,quote==null?null:selected*Costing.UsablePackCost(quote),quote?.IsIllustrative??false));
        }return result;
    }
    public string ShoppingCsv(ShoppingInput input)
    {
        static string Cell(object? value){var s=Convert.ToString(value,System.Globalization.CultureInfo.InvariantCulture)??"";return "\""+(s.Length>0&&"=+-@\t\r".Contains(s[0])?"'":"")+s.Replace("\"","\"\"")+"\"";}
        var rows=new List<string>{"Item,Unit,Required,Usable stock,Shortfall,Pack size,Suggested packs,Selected packs,Purchase quantity,Supplier,Estimated cost,Illustrative"};
        rows.AddRange(Shopping(input).Select(r=>string.Join(",",new object?[]{r.Name,r.Unit,r.Required,r.Available,r.Shortfall,r.PackSize,r.SuggestedPacks,r.SelectedPacks,r.PurchaseQuantity,r.Supplier,r.EstimatedCost,r.Illustrative}.Select(Cell))));return "\uFEFF"+string.Join("\r\n",rows);
    }
}
