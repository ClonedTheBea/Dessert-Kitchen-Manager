namespace DessertKitchen.Domain;
public record LotDateReview(string OperationId,string LotId,DateOnly? UseBy,bool DateReviewed,string DateEvidence);
public record StockLocation(string Id,string Name,string Mode="testing");
public record StockLot(string Id,string Kind,string ItemId,string Name,string Unit,int? RecipeVersion,
 string OperationId,string BatchReference,DateOnly ReceivedOn,DateOnly? UseBy,bool DateReviewed,string DateEvidence,
 decimal InitialQuantity,decimal UnitCost,string RecordedAt,AllergenAssessment? AllergenSnapshot=null,Ingredient? IngredientSnapshot=null,Supplier? SupplierSnapshot=null);
public record StockMovement(long Sequence,string OperationId,string LotId,string LocationId,string Type,
 decimal Quantity,string Unit,decimal Value,DateOnly OccurredOn,string RecordedAt,string Actor,string Notes);
public record StockOperation(string Id,string Type,string RecordedAt,string Actor,System.Text.Json.JsonElement Body,System.Text.Json.JsonElement Result,string? Reverses=null);
public record StockBalance(StockLot Lot,StockLocation Location,decimal Quantity,decimal Usable,decimal Value,string Status,bool AllergenReviewRequired);
public record PurchaseLine(string IngredientId,decimal Packs,decimal PackSize,string Unit,decimal PackPrice,
 decimal VatRate=0,bool PriceIncludesVat=true,bool RecoverVat=false,string PackLabel="pack",decimal PacksPerCase=1,
 string BatchReference="",DateOnly? UseBy=null,bool DateReviewed=false,string DateEvidence="");
public record PurchaseInput(string OperationId,string SupplierId,string LocationId,DateOnly Date,List<PurchaseLine> Lines,string Reference="",string Notes="");
public record StockActionInput(string OperationId,string LotId,string LocationId,decimal Quantity,string Reason,string Notes="",string? DestinationId=null,DateOnly? Date=null);
public record ReverseInput(string OperationId,string OriginalId,string Reason);
public record ProductionInput(string OperationId,string RecipeId,int Version,decimal PlannedYield,decimal ActualYield,
 string LocationId,string DestinationId,DateOnly Date,string BatchReference,List<string>? HeldRecipeIds=null,
 List<ActualUsage>? ActualUsage=null,decimal ExtraWastePercent=0,decimal LabourCost=0,decimal OtherCost=0,
 string Mode="made-ahead",DateOnly? UseBy=null,bool DateReviewed=false,string DateEvidence="",string Operator="Owner",string Notes="");
public record ActualUsage(string Key,decimal Quantity,string? LotId=null);
public record StockRequirement(string Key,string Kind,string ItemId,int? Version,string Name,string Unit,decimal Quantity);
public record RequirementAvailability(StockRequirement Requirement,decimal Available,decimal Shortage);
public record StockAllocation(string LotId,string BatchReference,string Item,string Unit,decimal Quantity,decimal UnitCost,decimal Cost);
public record ProductionPreview(List<RequirementAvailability> Requirements,List<StockAllocation> Allocations,decimal EstimatedRecipeCost,decimal ActualMaterialCost,bool CanProduce);
public record ProductionResult(string BatchId,string RecipeId,int Version,decimal PlannedYield,decimal ActualYield,string Unit,string Mode,
 decimal EstimatedRecipeCost,decimal MaterialCost,decimal LabourCost,decimal OtherCost,decimal BatchCost,decimal UnitCost,
 string? FinishedLotId,List<StockAllocation> Allocations,AllergenAssessment? AllergenSnapshot,string Operator,string Notes);
public record CountSnapshotLine(string LotId,decimal Quantity,long LastSequence);
public record StocktakeSnapshot(string Id,string LocationId,string Category,string RecordedAt,List<CountSnapshotLine> Lines);
public record StocktakeStart(string LocationId,string Category="");
public record PhysicalCount(string LotId,decimal Quantity,string Reason="");
public record StocktakeInput(string OperationId,string SnapshotId,List<PhysicalCount> Counts,string Notes="");
public record PlannedRecipe(string RecipeId,int Version,decimal Quantity,List<string>? HeldRecipeIds=null);
public record ShoppingInput(string LocationId,List<PlannedRecipe> Plans,Dictionary<string,decimal>? PackOverrides=null,string Notes="");
public record ShoppingRow(string Key,string ItemId,string Name,string Unit,decimal Required,decimal Available,decimal Shortfall,
 decimal? PackSize,decimal? SuggestedPacks,decimal? SelectedPacks,decimal? PurchaseQuantity,string Supplier,decimal? EstimatedCost,bool Illustrative);
