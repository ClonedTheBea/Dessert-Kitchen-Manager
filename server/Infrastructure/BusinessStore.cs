using System.Text.Json;
using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;

public sealed partial class Store
{
    public BusinessSettings DefaultBusiness() => new("business", 0, "My kitchen", AllergenRules.Today(), false, 0, "units",
        [new("electricity"), new("gas"), new("water")], [], [], [new("direct", "Direct"), new("uber", "Uber Eats"), new("deliveroo", "Deliveroo")], []);
    public BusinessSettings CurrentBusiness() => All<BusinessSettings>("business").FirstOrDefault() ?? DefaultBusiness();
    public List<BusinessRevision> BusinessHistory() => All<BusinessRevision>("business-version").OrderByDescending(x => x.Settings.Revision).ToList();
    public BusinessSettings BusinessAt(DateOnly date) => BusinessHistory().Where(x => x.Settings.EffectiveFrom <= date).OrderByDescending(x => x.Settings.EffectiveFrom).ThenByDescending(x => x.Settings.Revision).FirstOrDefault()?.Settings ?? DefaultBusiness() with { EffectiveFrom = date };
    public BusinessSettings SaveBusiness(BusinessSettings input)
    {
        BusinessRules.Validate(input); foreach (var p in input.Products) Guard.Require(Get<Recipe>("recipe", p.RecipeId).IsSellable, "Only sellable recipes have product plans.");
        var saved = input with { Revision = input.Revision + 1 }; var body = JsonSerializer.Serialize(saved, Json);
        using var db = Open(); using var tx = db.BeginTransaction();
        using var check = Command(db, tx, "SELECT body FROM documents WHERE kind='business' AND id='business'"); var existing = check.ExecuteScalar() as string;
        if (existing == body) return saved;
        var revision = existing == null ? 0 : JsonSerializer.Deserialize<BusinessSettings>(existing, Json)!.Revision;
        if (revision != input.Revision) throw new ConflictException("Business settings changed in another window. Reload before saving.");
        Execute(db, tx, "INSERT INTO documents VALUES('business','business',$r,$b) ON CONFLICT(kind,id) DO UPDATE SET revision=$r,body=$b", ("$r", saved.Revision), ("$b", body));
        Execute(db, tx, "INSERT INTO documents VALUES('business-version',$id,1,$b)", ("$id", saved.Revision.ToString()), ("$b", JsonSerializer.Serialize(new BusinessRevision(saved, Now()), Json)));
        Audit(db, tx, $"save:business:v{saved.Revision}", "business"); tx.Commit(); return saved;
    }
    RecipeVersion PublishedAt(string id, DateOnly date) => Versions(id).FirstOrDefault(v => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.Parse(v.RecordedAt), "GMT Standard Time").Date) <= date) ?? throw new ValidationException("No published recipe version exists on this date.");
    public List<Recipe> ProfitRecipes(DateOnly date) => All<Recipe>("recipe").Where(r => r.IsSellable).Select(r => Versions(r.Id).FirstOrDefault(v => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.Parse(v.RecordedAt), "GMT Standard Time").Date) <= date)?.Recipe).Where(r => r != null).Select(r => r!).ToList();
    public Scenario PlannerFromBusiness(ProfitabilityRequest input)
    {
        var model = Profitability(input); Guard.Require(model.MonthlyUnits > 0 && model.MonthlyNetSales > 0 && model.Warnings.All(w => !w.Contains("excluded", StringComparison.OrdinalIgnoreCase)), "Enter a complete positive sales forecast before creating a planner scenario.");
        var s = input.Settings ?? BusinessAt(input.AsOf); var gross = model.Products.Sum(p => p.GrossPrice * p.MonthlyUnits); var variable = model.Products.Sum(p => (p.Ingredients + p.Packaging + p.Energy + p.Labour + p.OtherVariable) * p.MonthlyUnits); var fees = model.Products.Sum(p => p.PlatformFees * p.MonthlyUnits);
        var scenario = new Scenario(Guid.NewGuid().ToString("N"), 1, $"Business forecast {input.AsOf:yyyy-MM-dd} · 1 unit/order", [new Expense("Business fixed costs at imported forecast volume", model.MonthlyFixedCosts)], [0, 1, 2, 3, 4, 5, 6], "09:00", "17:00", gross / model.MonthlyUnits, variable / model.MonthlyUnits, 0, 0, false, s.VatRegistered, s.VatRegistered ? (gross / model.MonthlyNetSales - 1) * 100 : 0, 0, model.MonthlyUnits / (7 * 52m / 12), model.MonthlyOwnerCompensation / (52m / 12), 1, 0, 12, 0, OtherChargePerOrder: fees / model.MonthlyUnits);
        // Freeze the forecast into a new planner scenario; existing scenarios are never overwritten.
        Costing.Model(scenario); Save("scenario", scenario.Id, 0, scenario); return scenario;
    }
    public ProductPlan DefaultProduct(Recipe r, BusinessSettings s) => new(r.Id, s.Channels.Select(c => new ProductChannel(c.Id, r.SellingPrice)).ToList(), InputRecoveryPercent: s.VatRegistered ? s.InputRecoveryPercent : 0);
    public ProfitabilityReport Profitability(ProfitabilityRequest input)
    {
        Guard.Require(input.AsOf != default, "Costing date is required."); var s = input.Settings ?? BusinessAt(input.AsOf); BusinessRules.Validate(s);
        var experiments = input.Experiments ?? []; Guard.Require(experiments.Count <= 500 && experiments.Select(e => e.RecipeId).Distinct().Count() == experiments.Count, "Use distinct recipe experiments.");
        foreach (var e in experiments) { Guard.Require(e.PortionFactor > 0 && e.PortionFactor <= 100, "Portion factor must be positive and at most 100."); Get<Recipe>("recipe", e.RecipeId); }
        var rows = new List<ProductEconomics>(); var weights = new List<decimal>(); var warnings = new List<string>(); decimal directStaff = 0, directOwner = 0;
        if (s.Revision == 0) warnings.Add("Business rates are not configured for this date. Zero rates are placeholders, not market tariffs or platform contracts.");
        var quoteList = Prices();
        foreach (var current in All<Recipe>("recipe").Where(r => r.IsSellable))
        {
            RecipeVersion version; try { version = PublishedAt(current.Id, input.AsOf); } catch (ValidationException) { warnings.Add($"{current.Name}: no recipe published by this date; excluded."); continue; }
            var recipe = version.Recipe; var p = s.Products.FirstOrDefault(p => p.RecipeId == recipe.Id) ?? DefaultProduct(recipe, s); var exp = experiments.FirstOrDefault(e => e.RecipeId == recipe.Id); var factor = exp?.PortionFactor ?? 1;
            var recovery = s.VatRegistered ? Math.Min(s.InputRecoveryPercent, p.InputRecoveryPercent) : 0;
            var sources = new HashSet<string>(); var productWarnings = new List<string>();
            if (p.VatTreatment == "unconfigured") productWarnings.Add("Product VAT treatment is unconfigured; output VAT is assumed zero for this estimate.");
            if (s.Channels.Any(c => c.Id != "direct" && c.CommissionPercent == 0)) productWarnings.Add("Check channel commissions against your contract; zero is not a verified platform rate.");
            if ((p.Equipment?.Count ?? 0) == 0) productWarnings.Add("No equipment use configured; production energy may be incomplete.");
            RecipeVersion Calculate(Recipe r, HashSet<string> path)
            {
                Guard.Require(path.Count < 40 && path.Add(r.Id), "Sub-recipe cycle or excessive depth."); sources.Add($"Recipe {r.Name} v{r.Revision}");
                Price PriceFor(string id)
                {
                    var price = quoteList.Where(q => q.IngredientId == id && q.EffectiveDate <= input.AsOf).OrderByDescending(q => q.EffectiveDate).ThenByDescending(q => q.RecordedAt).FirstOrDefault() ?? throw new ValidationException($"No supplier price for {Get<Ingredient>("ingredient", id).Name} on this date.");
                    sources.Add($"Price {price.Id} · {price.EffectiveDate:yyyy-MM-dd}"); if (price.IsIllustrative) productWarnings.Add("Includes illustrative supplier prices.");
                    // Reuse the existing recipe costing engine with explicitly modelled input VAT.
                    return price with { PackPrice = BusinessRules.Net(price.PackPrice, price.VatRate, price.PriceIncludesVat, recovery), VatRate = 0, PriceIncludesVat = true, RecoverVat = false };
                }
                var cost = Costing.Recipe(r, id => Get<Ingredient>("ingredient", id), PriceFor, id => Calculate(PublishedAt(id, input.AsOf).Recipe, new(path)));
                return new(r, cost, version.RecordedAt);
            }
            CostParts Split(RecipeVersion v, HashSet<string> path)
            {
                Guard.Require(path.Count < 40 && path.Add(v.Recipe.Id), "Invalid component cycle."); decimal ing = 0, pack = 0, lab = v.Recipe.LabourMinutes / 60 * v.Recipe.HourlyRate, minutes = v.Recipe.LabourMinutes;
                foreach (var line in v.Cost.Lines)
                {
                    if (line.Kind == "packaging") pack += line.Cost;
                    else if (line.Kind == "recipe")
                    {
                        var child = Calculate(PublishedAt(line.ReferenceId, input.AsOf).Recipe, []); var part = Split(child, new(path)); var scale = Units.Convert(line.Quantity, line.Unit, child.Recipe.YieldUnit) / child.Recipe.Yield * (1 + line.WastePercent / 100);
                        ing += part.Ingredients * scale; pack += part.Packaging * scale; lab += part.Labour * scale; minutes += part.LabourMinutes * scale;
                    }
                    else ing += line.Cost;
                }
                return new(ing, pack, lab, minutes);
            }
            CostParts parts;
            try { var changed = recipe with { Lines = exp?.Lines ?? recipe.Lines }; parts = Split(Calculate(changed, []), []); }
            catch (ValidationException e) { if (exp != null) throw; warnings.Add($"{recipe.Name}: {e.Message} Product excluded; allocation is incomplete."); continue; }
            var energy = BusinessRules.Energy(s, p, recovery) / recipe.Yield * factor;
            var minutesPer = (p.LabourBasis == "recipe" ? parts.LabourMinutes : p.LabourMinutesPerBatch) / recipe.Yield * factor;
            var labour = p.LabourBasis == "recipe" ? parts.Labour / recipe.Yield * factor : p.LabourBasis == "staff" ? minutesPer / 60 * s.StaffHourlyRate * (1 + s.EmployerPercent / 100) : 0;
            var owner = p.LabourBasis == "owner" ? minutesPer / 60 * s.OwnerHourlyRate : 0;
            var variable = s.Expenses.Where(e => e.Attribution == "variable").Sum(e => BusinessRules.Net(e.Amount, e.VatPercent, e.IncludesVat, recovery));
            foreach (var pc in p.Channels)
            {
                var c = s.Channels.Single(c => c.Id == pc.ChannelId); var net = s.VatRegistered && p.VatTreatment == "taxable" ? pc.Price / (1 + p.OutputVatPercent / 100) : pc.Price;
                var fee = ((c.CommissionBasis == "gross" ? pc.Price : net) * c.CommissionPercent / 100 + c.ChargePerUnit) * (1 + c.FeeVatPercent / 100 * (1 - recovery / 100));
                var ingredients = parts.Ingredients / recipe.Yield * factor; var packaging = parts.Packaging / recipe.Yield; var contribution = net - ingredients - packaging - energy - labour - variable - fee;
                rows.Add(new(recipe.Id, recipe.Revision, recipe.Name, c.Id, c.Name, pc.MonthlyUnits, pc.Price, pc.Price - net, net, ingredients, packaging, energy, labour, variable, fee, contribution, net == 0 ? 0 : contribution / net * 100, null, null, null, owner, null, sources.ToList(), productWarnings.Distinct().ToList()));
                weights.Add(pc.MonthlyUnits * (s.AllocationMethod == "revenue" ? net : s.AllocationMethod == "labour" ? minutesPer : 1)); directStaff += labour * pc.MonthlyUnits; directOwner += owner * pc.MonthlyUnits;
            }
        }
        var fixedCosts = new Dictionary<string, decimal>(); var globalRecovery = s.VatRegistered ? s.InputRecoveryPercent : 0;
        foreach (var e in s.Expenses.Where(e => e.Attribution == "overhead")) fixedCosts[$"{e.Name} ({e.Id})"] = BusinessRules.Monthly(e, globalRecovery);
        foreach (var t in s.Utilities) fixedCosts[$"{t.Kind} standing charge"] = BusinessRules.Net(t.StandingPenceDaily / 100, t.VatPercent, t.IncludesVat, globalRecovery) * 365 / 12;
        var staffBudget = s.StaffHoursWeekly * 52 / 12 * s.StaffHourlyRate * (1 + s.EmployerPercent / 100); fixedCosts["Staffing not already costed directly"] = Math.Max(0, staffBudget - directStaff);
        var fixedTotal = fixedCosts.Values.Sum(); var denominator = weights.Sum();
        if (denominator == 0) warnings.Add("No allocation basis: enter forecast sales volumes (and labour minutes for labour allocation). Per-product allocated profit is unavailable; fixed costs remain unallocated.");
        if (directStaff > staffBudget && staffBudget > 0) warnings.Add("Forecast direct labour exceeds the staffing budget; direct labour is retained and no additional fixed payroll is added.");
        var ownerTotal = Math.Max(s.OwnerHoursWeekly * 52 / 12 * s.OwnerHourlyRate, directOwner); var ownerRemainder = ownerTotal - directOwner;
        for (var i = 0; i < rows.Count; i++)
        {
            var r = rows[i]; decimal? allocated = denominator > 0 && r.MonthlyUnits > 0 ? fixedTotal * weights[i] / denominator / r.MonthlyUnits : null;
            var profit = r.Contribution - allocated; var after = profit - r.OwnerDirect - (denominator > 0 && r.MonthlyUnits > 0 ? ownerRemainder * weights[i] / denominator / r.MonthlyUnits : 0);
            rows[i] = r with { AllocatedOverheads = allocated, OperatingProfit = profit, ProfitMargin = r.NetSales == 0 ? null : profit / r.NetSales * 100, AfterOwner = after };
        }
        var units = rows.Sum(r => r.MonthlyUnits); var sales = rows.Sum(r => r.NetSales * r.MonthlyUnits); var contributionTotal = rows.Sum(r => r.Contribution * r.MonthlyUnits); var operating = contributionTotal - fixedTotal;
        // At a different volume, direct staff replaces fixed payroll until the staffing budget is covered.
        // Break-even therefore satisfies both pre- and post-payroll-coverage branches at the forecast mix.
        decimal? breakEven = null; if (units > 0 && contributionTotal > 0) { var contributionPer = contributionTotal / units; var labourPer = directStaff / units; var otherFixed = fixedTotal - fixedCosts["Staffing not already costed directly"]; breakEven = decimal.Ceiling(Math.Max(otherFixed / contributionPer, (otherFixed + staffBudget) / (contributionPer + labourPer))); }
        return new(input.AsOf, s.Revision, s.AllocationMethod, rows, units, sales, contributionTotal, fixedTotal, denominator == 0 ? fixedTotal : 0, operating, ownerTotal, operating - ownerTotal, breakEven, fixedCosts, warnings);
    }
    public ProfitScenario SaveProfitScenario(ProfitScenario input)
    {
        Guard.Text(input.Name, "Scenario name"); Guard.Text(input.Id, "Scenario ID"); Guard.Require(input.Revision == 0, "Saved pricing snapshots are immutable. Save a new scenario to retain changes.");
        var resolved = input.Input with { Settings = input.Input.Settings ?? BusinessAt(input.Input.AsOf) };
        var existing = All<ProfitScenario>("profit-scenario").FirstOrDefault(x => x.Id == input.Id);
        if (existing != null) { if (existing.Name == input.Name && JsonSerializer.Serialize(existing.Input, Json) == JsonSerializer.Serialize(resolved, Json)) return existing; throw new ConflictException("This scenario ID already holds a different snapshot."); }
        var result = Profitability(resolved); var saved = input with { Revision = 1, Input = resolved, Result = result, RecordedAt = Now() }; Save("profit-scenario", saved.Id, 0, saved); return saved;
    }
}
