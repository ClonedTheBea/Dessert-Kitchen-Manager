namespace DessertKitchen.Domain;

public record Supplier(string Id, int Revision, string Name, string Contact = "", string Notes = "", bool Archived = false);
public record Ingredient(string Id, int Revision, string Name, string Category, string Description,
    string BaseUnit, string Brand, string Allergens, decimal MinimumStock, bool IsPackaging = false,
    bool Archived = false, AllergenProfile? AllergenInfo = null);
public record Price(string Id, string IngredientId, string SupplierId, decimal PackQuantity, string Unit,
    decimal PackPrice, decimal VatRate, bool PriceIncludesVat, bool RecoverVat, string ProductReference,
    DateOnly EffectiveDate, bool IsIllustrative, string RecordedAt = "");
public record RecipeLine(string Kind, string ReferenceId, decimal Quantity, string Unit, decimal WastePercent = 0, string Role = "ingredient");
public record Recipe(string Id, int Revision, string Name, string Category, string Description,
    decimal Yield, string YieldUnit, decimal PortionSize, string PortionUnit, int PrepMinutes, int CookMinutes,
    string Storage, int ShelfLifeDays, string Allergens, decimal LabourMinutes, decimal HourlyRate,
    decimal SellingPrice, decimal TargetMargin, List<RecipeLine> Lines,
    List<string>? MethodSteps = null, bool IsSellable = true, string? VariantOf = null);
public record CostLine(string Name, string Kind, string ReferenceId, decimal Quantity, string Unit,
    decimal WastePercent, decimal Cost, string SourceId, bool IsIllustrative);
public record RecipeCost(decimal IngredientCost, decimal PackagingCost, decimal LabourCost,
    decimal BatchCost, decimal PortionCost, decimal RecommendedPrice, decimal Contribution,
    decimal MarginPercent, bool IsIllustrative, List<CostLine> Lines);
public record RecipeVersion(Recipe Recipe, RecipeCost Cost, string RecordedAt, AllergenAssessment? AllergenSnapshot = null);
public record Expense(string Name, decimal MonthlyAmount);
public record Scenario(string Id, int Revision, string Name, List<Expense> Expenses, List<int> OpenDays,
    string ServiceStart, string ServiceEnd, decimal AverageBasket, decimal VariableCost,
    decimal CommissionPercent, decimal CommissionVatPercent, bool RecoverCommissionVat,
    bool VatRegistered, decimal SalesVatPercent, decimal DiscountPercent, decimal OrdersPerEvening,
    decimal OwnerHoursWeekly, decimal OwnerHourlyRate, decimal InitialInvestment, int RecoveryMonths,
    decimal TargetProfit, List<ChannelAssumption>? Channels = null, decimal StaffHoursWeekly = 0,
    decimal StaffHourlyRate = 0, decimal EmployerCostPercent = 0, decimal OtherChargePerOrder = 0, decimal TradingWeeks = 52);
public record ChannelAssumption(string Name, decimal SharePercent, decimal CommissionPercent, decimal VatPercent);
public record FinancialModel(decimal MonthlyOpenDays, decimal MonthlyOrders, decimal GrossSales,
    decimal SalesVat, decimal NetSales, decimal VariableCosts, decimal Commission, decimal CommissionVat,
    decimal Contribution, decimal ContributionPerOrder, decimal ContributionMarginPercent,
    decimal FixedCosts, decimal OperatingProfit, decimal OwnerCompensation, decimal AfterOwner,
    decimal MonthlyCapitalRecovery, decimal AfterCapitalRecovery,
    Dictionary<string, decimal?> RequiredOrders, string? Warning, decimal StaffingCosts = 0, decimal OtherCharges = 0);
public class ValidationException(string message) : Exception(message);
public class ConflictException(string message) : Exception(message);
public static class Guard
{
    public static void Require(bool condition, string message) { if (!condition) throw new ValidationException(message); }
    public static void Text(string text, string field, int max = 200) => Require(!string.IsNullOrWhiteSpace(text) && text.Length <= max, $"{field} is required (maximum {max} characters).");
    public static void Amount(decimal value, string field, decimal max = 1000000) => Require(value >= 0 && value <= max, $"{field} must be between 0 and {max}.");
}
