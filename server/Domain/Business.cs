namespace DessertKitchen.Domain;

public record UtilityTariff(string Kind, decimal PencePerUnit = 0, decimal StandingPenceDaily = 0, decimal VatPercent = 0, bool IncludesVat = true, bool? RateConfigured = null);
public record KitchenEquipment(string Id, string Name, string Fuel = "electricity", decimal Kw = 0, decimal LoadPercent = 100);
public record BusinessExpense(string Id, string Name, string Category, decimal Amount = 0, string Period = "monthly", string Attribution = "overhead", decimal VatPercent = 0, bool IncludesVat = true);
public record SalesChannel(string Id, string Name, decimal CommissionPercent = 0, decimal FeeVatPercent = 0, decimal ChargePerUnit = 0, string CommissionBasis = "gross", bool? CommissionConfigured = null);
public record EquipmentUse(string EquipmentId, decimal Minutes);
public record ProductChannel(string ChannelId, decimal Price, decimal MonthlyUnits = 0);
public record ProductPlan(string RecipeId, List<ProductChannel> Channels, decimal OutputVatPercent = 0, string VatTreatment = "unconfigured", decimal InputRecoveryPercent = 100, List<EquipmentUse>? Equipment = null, decimal WaterLitresPerBatch = 0, string LabourBasis = "recipe", decimal LabourMinutesPerBatch = 0, bool? EnergyConfirmed = null);
public record BusinessSettings(string Id, int Revision, string Name, DateOnly EffectiveFrom, bool VatRegistered, decimal InputRecoveryPercent, string AllocationMethod, List<UtilityTariff> Utilities, List<KitchenEquipment> Equipment, List<BusinessExpense> Expenses, List<SalesChannel> Channels, List<ProductPlan> Products, decimal StaffHoursWeekly = 0, decimal StaffHourlyRate = 0, decimal EmployerPercent = 0, decimal OwnerHoursWeekly = 0, decimal OwnerHourlyRate = 0, Scenario? Forecast = null, Dictionary<string,decimal>? ForecastShares = null, bool ForecastReviewed = false, decimal ItemsPerOrder = 1, decimal DirectLabourPerOrder = 0);
public record BusinessRevision(BusinessSettings Settings, string RecordedAt);
public record RecipeExperiment(string RecipeId, decimal PortionFactor = 1, List<RecipeLine>? Lines = null);
public record ProfitabilityRequest(DateOnly AsOf, BusinessSettings? Settings = null, List<RecipeExperiment>? Experiments = null);
public record CostParts(decimal Ingredients, decimal Packaging, decimal Labour, decimal LabourMinutes);
public record ProductEconomics(string RecipeId, int RecipeVersion, string Name, string ChannelId, string Channel, decimal MonthlyUnits, decimal GrossPrice, decimal OutputVat, decimal NetSales, decimal Ingredients, decimal Packaging, decimal Energy, decimal Labour, decimal OtherVariable, decimal PlatformFees, decimal Contribution, decimal ContributionMargin, decimal? AllocatedOverheads, decimal? OperatingProfit, decimal? ProfitMargin, decimal OwnerDirect, decimal? AfterOwner, List<string> Sources, List<string> Warnings);
public record ProfitabilityReport(DateOnly AsOf, int SettingsRevision, string AllocationMethod, List<ProductEconomics> Products, decimal MonthlyUnits, decimal MonthlyNetSales, decimal MonthlyContribution, decimal MonthlyFixedCosts, decimal UnallocatedOverheads, decimal MonthlyOperatingProfit, decimal MonthlyOwnerCompensation, decimal MonthlyAfterOwner, decimal? BreakEvenUnits, Dictionary<string, decimal> FixedBreakdown, List<string> Warnings);
public record ProfitScenario(string Id, int Revision, string Name, ProfitabilityRequest Input, ProfitabilityReport Result, string RecordedAt);

public static class BusinessRules
{
    public static decimal Net(decimal amount, decimal vat, bool includesVat, decimal recovery) { var net = includesVat ? amount / (1 + vat / 100) : amount; return net + net * vat / 100 * (1 - recovery / 100); }
    public static decimal Monthly(BusinessExpense e, decimal recovery) => Net(e.Amount, e.VatPercent, e.IncludesVat, recovery) / (e.Period == "annual" ? 12 : 1);
    public static void Validate(BusinessSettings s)
    {
        Guard.Amount(s.ItemsPerOrder,"Products per order",1000);Guard.Require(s.ItemsPerOrder>0,"Products per order must be positive.");Guard.Amount(s.DirectLabourPerOrder,"Direct paid labour per order");
        if(s.ForecastShares!=null){foreach(var share in s.ForecastShares){Guard.Require(s.Channels.Any(c=>c.Id==share.Key),"Unknown forecast channel.");Guard.Amount(share.Value,"Forecast sales share",100);}}
        if(s.Forecast!=null){Costing.Model(s.Forecast with{Expenses=[],Channels=null,CommissionPercent=0,CommissionVatPercent=0,RecoverCommissionVat=false,StaffHoursWeekly=0,StaffHourlyRate=0,EmployerCostPercent=0,OwnerHoursWeekly=0,OwnerHourlyRate=0});Guard.Require(s.Forecast.TradingWeeks>0&&s.Forecast.TradingWeeks<=52,"Planned trading weeks must be greater than zero and at most 52.");Guard.Require(s.DirectLabourPerOrder<=s.Forecast.VariableCost,"Direct paid labour is part of the per-order direct cost, not an extra cost.");}
        Guard.Require(s.Id == "business", "Invalid business settings identity."); Guard.Text(s.Name, "Business settings name"); Guard.Require(s.EffectiveFrom != default, "Effective date is required.");
        Guard.Require(s.AllocationMethod is "units" or "revenue" or "labour", "Choose units, net revenue or direct labour minutes allocation.");
        Guard.Amount(s.InputRecoveryPercent, "Input VAT recovery", 100); Guard.Require(s.VatRegistered || s.InputRecoveryPercent == 0, "Input VAT recovery requires VAT registration.");
        Guard.Amount(s.StaffHoursWeekly, "Staff hours", 10000); Guard.Amount(s.StaffHourlyRate, "Staff rate", 10000); Guard.Amount(s.EmployerPercent, "Employer costs", 100); Guard.Amount(s.OwnerHoursWeekly, "Owner hours", 168); Guard.Amount(s.OwnerHourlyRate, "Owner rate", 10000);
        Guard.Require(s.Utilities.Count == 3 && s.Utilities.Select(x => x.Kind).Distinct().Count() == 3 && s.Utilities.All(x => x.Kind is "electricity" or "gas" or "water"), "Include electricity, gas and water tariffs once each.");
        foreach (var u in s.Utilities) { Guard.Amount(u.PencePerUnit, "Utility pence per unit", 100000); Guard.Amount(u.StandingPenceDaily, "Standing charge", 100000); Guard.Amount(u.VatPercent, "Utility VAT", 100); }
        Guard.Require(s.Equipment.Count <= 100 && s.Equipment.Select(x => x.Id).Distinct().Count() == s.Equipment.Count, "Use up to 100 uniquely identified equipment items.");
        foreach (var e in s.Equipment) { Guard.Text(e.Id, "Equipment ID"); Guard.Text(e.Name, "Equipment name"); Guard.Require(e.Fuel is "electricity" or "gas", "Equipment uses electricity or gas."); Guard.Amount(e.Kw, "Equipment kW", 10000); Guard.Amount(e.LoadPercent, "Equipment load", 100); }
        Guard.Require(s.Expenses.Count <= 100 && s.Expenses.Select(x => x.Id).Distinct().Count() == s.Expenses.Count, "Use up to 100 distinct expenses.");
        foreach (var e in s.Expenses) { Guard.Text(e.Id, "Expense ID"); Guard.Text(e.Name, "Expense name"); Guard.Require(e.Period is "monthly" or "annual" or "unit", "Choose monthly, annual or per unit."); Guard.Require(e.Attribution is "overhead" or "direct" or "variable", "Choose cost attribution."); Guard.Require(e.Attribution == "variable" ? e.Period == "unit" : e.Period != "unit", "Variable expenses are per unit; other expenses are monthly or annual."); Guard.Amount(e.Amount, "Expense"); Guard.Amount(e.VatPercent, "Expense VAT", 100); }
        Guard.Require(s.Channels.Count > 0 && s.Channels.Count <= 20 && s.Channels.Select(c => c.Id).Distinct().Count() == s.Channels.Count, "Use distinct sales channels.");
        foreach (var c in s.Channels) { Guard.Text(c.Id, "Channel ID"); Guard.Text(c.Name, "Channel name"); Guard.Amount(c.CommissionPercent, "Commission", 100); Guard.Amount(c.FeeVatPercent, "Fee VAT", 100); Guard.Amount(c.ChargePerUnit, "Channel charge"); Guard.Require(c.CommissionBasis is "gross" or "net", "Choose gross or net commission basis."); }
        Guard.Require(s.Products.Count <= 500 && s.Products.Select(p => p.RecipeId).Distinct().Count() == s.Products.Count, "Use distinct product plans.");
        foreach (var p in s.Products)
        {
            Guard.Text(p.RecipeId, "Recipe ID"); Guard.Amount(p.OutputVatPercent, "Output VAT", 100); Guard.Amount(p.InputRecoveryPercent, "Product input VAT recovery", 100); Guard.Require(p.VatTreatment is "unconfigured" or "taxable" or "zero" or "exempt" or "outside", "Choose a VAT treatment."); Guard.Require(p.VatTreatment == "taxable" || p.OutputVatPercent == 0, "Only taxable treatment takes a non-zero output VAT rate."); Guard.Require(p.LabourBasis is "recipe" or "staff" or "owner", "Choose recipe, staff or owner labour."); Guard.Amount(p.LabourMinutesPerBatch, "Batch labour minutes", 100000); Guard.Amount(p.WaterLitresPerBatch, "Water litres", 1000000);
            Guard.Require(p.Channels.Count > 0 && p.Channels.Select(x => x.ChannelId).Distinct().Count() == p.Channels.Count, "Use each product channel once."); foreach (var c in p.Channels) { Guard.Require(s.Channels.Any(x => x.Id == c.ChannelId), "Product channel no longer exists."); Guard.Amount(c.Price, "Selling price"); Guard.Amount(c.MonthlyUnits, "Monthly units"); }
            Guard.Require(p.Equipment == null || p.Equipment.Count <= 100, "Too many equipment uses."); foreach (var u in p.Equipment ?? []) { Guard.Require(s.Equipment.Any(e => e.Id == u.EquipmentId), "Product equipment no longer exists."); Guard.Amount(u.Minutes, "Equipment minutes", 100000); }
        }
    }
    public static decimal Energy(BusinessSettings s, ProductPlan p, decimal recovery)
    {
        decimal cost = 0; foreach (var use in p.Equipment ?? []) { var e = s.Equipment.Single(e => e.Id == use.EquipmentId); var t = s.Utilities.Single(t => t.Kind == e.Fuel); cost += e.Kw * e.LoadPercent / 100 * use.Minutes / 60 * Net(t.PencePerUnit / 100, t.VatPercent, t.IncludesVat, recovery); }
        var water = s.Utilities.Single(t => t.Kind == "water"); return cost + p.WaterLitresPerBatch / 1000 * Net(water.PencePerUnit / 100, water.VatPercent, water.IncludesVat, recovery);
    }
}
