using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;

public sealed partial class Store
{
    public StockLot AddExistingStock(ExistingStockInput input, string actor="owner", WorkingDraft? draft=null) =>
        InventoryPost("existing-stock", input.OperationId, input, actor, ctx =>
        {
            StockDate(input.Date);
            ctx.Location(input.LocationId);
            Guard.Require(input.Kind is "ingredient" or "recipe", "Choose an ingredient or finished product.");
            Guard.Require(input.Quantity>0 && input.Quantity<=1000000, "Enter a positive stock quantity up to 1,000,000.");
            Guard.Text(input.Source, "Source of existing stock", 2000);
            Guard.Require(input.Notes.Length<=5000, "Notes are too long.");
            Guard.Require(input.PreparedOn==null || input.PreparedOn<=input.Date, "Preparation date cannot be later than the recorded date.");
            Guard.Require(input.UseBy==null || input.PreparedOn==null || input.UseBy>=input.PreparedOn, "Use-by cannot be before preparation.");
            ReviewDate(input.DateReviewed, input.DateEvidence);
            Guard.Require(input.ValuationStatus is "unknown" or "known" or "estimated", "Choose unknown, known or estimated cost.");
            Guard.Require(input.ValuationStatus=="unknown" ? input.TotalCost==null : input.TotalCost!=null, "Unknown cost must be blank; enter a total for known or estimated cost.");
            if(input.TotalCost!=null) Guard.Amount(input.TotalCost.Value, "Total stock cost");

            string name, unit;
            Ingredient? ingredient=null;
            if(input.Kind=="ingredient")
            {
                ingredient=Get<Ingredient>("ingredient",input.ItemId);
                Guard.Require(!ingredient.Archived,"Restore this ingredient before adding stock.");
                Guard.Require(input.RecipeVersion==null && input.PreparedOn==null,"Preparation and recipe version apply only to finished products.");
                name=ingredient.Name;unit=ingredient.BaseUnit;
            }
            else
            {
                // A version reference is optional and only recorded when the owner knows it.
                // A current recipe is not evidence of what went into a historical batch.
                var recipe=input.RecipeVersion is int version?RecipeAt(input.ItemId,version).Recipe:Get<Recipe>("recipe",input.ItemId);
                name=recipe.Name;unit=recipe.YieldUnit;
            }
            var quantity=Units.Convert(input.Quantity,input.Unit,unit);
            Guard.Require(quantity<=1000000000,"Converted quantity is too large.");
            var provenance=input.Kind=="ingredient"?"Opening stock":"Historical preparation";
            var lot=new StockLot(Guid.NewGuid().ToString("N"),input.Kind,input.ItemId,name,unit,input.RecipeVersion,
                input.OperationId,"EXISTING-"+input.OperationId[..Math.Min(8,input.OperationId.Length)],input.Date,input.UseBy,
                input.DateReviewed,input.DateEvidence,quantity,input.TotalCost/quantity,Now(),IngredientSnapshot:ingredient,
                ValuationStatus:input.ValuationStatus,Provenance:provenance,PreparedOn:input.PreparedOn);
            // No supplier purchase, recipe consumption or historical FIFO allocation is inferred.
            // Missing source/allergen evidence remains explicitly unverified.
            ctx.NewLots.Add(lot);
            ctx.Move(lot,input.LocationId,quantity,input.Kind=="ingredient"?"opening-stock":"historical-preparation",input.Date,input.Source+" · "+input.Notes);
            return lot;
        },draft);
}
