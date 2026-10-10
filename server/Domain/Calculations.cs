namespace DessertKitchen.Domain;

public static class Units
{
    public static (string Dimension, decimal Factor) Definition(string unit) => unit switch
    {
        "g" => ("mass", 1m), "kg" => ("mass", 1000m),
        "ml" => ("volume", 1m), "l" => ("volume", 1000m), "each" => ("count", 1m),
        _ => throw new ValidationException("Use g, kg, ml, l or each.")
    };
    public static decimal Convert(decimal quantity, string from, string to)
    {
        var a = Definition(from); var b = Definition(to);
        Guard.Require(a.Dimension == b.Dimension, $"Cannot convert {from} to {to}; choose compatible units.");
        return quantity * a.Factor / b.Factor;
    }
}

public static class Costing
{
    public static decimal Money(decimal amount) => decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
    public static decimal PurchaseGross(Price p) => p.PriceIncludesVat ? p.PackPrice : p.PackPrice * (1 + p.VatRate / 100);
    public static decimal UsablePackCost(Price p) => p.RecoverVat ? PurchaseGross(p) / (1 + p.VatRate / 100) : PurchaseGross(p);
    public static decimal IngredientCost(Price p, decimal quantity, string unit, decimal waste) =>
        UsablePackCost(p) * Units.Convert(quantity, unit, p.Unit) / p.PackQuantity * (1 + waste / 100);

    public static RecipeCost Recipe(Recipe recipe, Func<string, Ingredient> ingredient, Func<string, Price> price,
        Func<string, RecipeVersion> subrecipe)
    {
        Guard.Text(recipe.Name, "Recipe name"); Guard.Text(recipe.Category, "Category");
        Guard.Require(recipe.MethodSteps == null || (recipe.MethodSteps.Count <= 100 && recipe.MethodSteps.All(s => !string.IsNullOrWhiteSpace(s) && s.Length <= 20000)), "Use up to 100 non-empty preparation steps, each at most 20,000 characters.");
        Guard.Require(recipe.Yield > 0 && recipe.Yield <= 1000000, "Batch yield must be positive."); Units.Definition(recipe.YieldUnit);
        Guard.Amount(recipe.PortionSize, "Portion size"); Units.Definition(recipe.PortionUnit);
        Guard.Amount(recipe.PrepMinutes, "Preparation time", 100000); Guard.Amount(recipe.CookMinutes, "Cooking time", 100000);
        Guard.Amount(recipe.ShelfLifeDays, "Shelf life", 3650); Guard.Amount(recipe.LabourMinutes, "Labour minutes", 100000);
        Guard.Amount(recipe.HourlyRate, "Hourly rate", 10000); Guard.Amount(recipe.SellingPrice, "Selling price");
        Guard.Require(recipe.TargetMargin >= 0 && recipe.TargetMargin < 100, "Target margin must be at least 0 and less than 100%.");
        Guard.Require(recipe.Lines is { Count: > 0 and <= 200 }, "Add between 1 and 200 recipe lines.");
        var lines = new List<CostLine>();
        decimal ingredients = 0, packaging = 0;
        foreach (var line in recipe.Lines)
        {
            Guard.Require(line.Quantity > 0 && line.Quantity <= 1000000, "Line quantities must be positive.");
            Guard.Amount(line.WastePercent, "Wastage allowance", 100);
            Guard.Require(line.Role is "ingredient" or "topping" or "optional" or "packaging", "Choose a valid recipe-line role.");
            decimal cost; string name, source; bool illustrative; bool pack = false;
            if (line.Kind == "ingredient")
            {
                var item = ingredient(line.ReferenceId); var quote = price(line.ReferenceId);
                Units.Convert(line.Quantity, line.Unit, item.BaseUnit);
                cost = IngredientCost(quote, line.Quantity, line.Unit, line.WastePercent);
                name = item.Name; source = quote.Id; illustrative = quote.IsIllustrative; pack = item.IsPackaging;
            }
            else
            {
                Guard.Require(line.Kind == "recipe", "Unknown recipe line type.");
                Guard.Require(line.ReferenceId != recipe.Id, "A recipe cannot contain itself.");
                var child = subrecipe(line.ReferenceId);
                // Use unrounded component amounts when composing sub-recipes; rounding a batch before reuse accumulates errors.
                var preciseChildBatch = child.Cost.Lines.Sum(x => x.Cost) + child.Recipe.LabourMinutes / 60 * child.Recipe.HourlyRate;
                cost = preciseChildBatch / child.Recipe.Yield * Units.Convert(line.Quantity, line.Unit, child.Recipe.YieldUnit) * (1 + line.WastePercent / 100);
                name = child.Recipe.Name; source = $"{child.Recipe.Id}:v{child.Recipe.Revision}"; illustrative = child.Cost.IsIllustrative;
            }
            if (pack) packaging += cost; else ingredients += cost;
            lines.Add(new(name, pack ? "packaging" : line.Kind, line.ReferenceId, line.Quantity, line.Unit, line.WastePercent, cost, source, illustrative));
        }
        var labour = recipe.LabourMinutes / 60 * recipe.HourlyRate;
        var batch = ingredients + packaging + labour;
        var portion = batch / recipe.Yield;
        var contribution = recipe.SellingPrice - portion;
        return new(Money(ingredients), Money(packaging), Money(labour), Money(batch), Money(portion),
            decimal.Ceiling(portion / (1 - recipe.TargetMargin / 100) * 100) / 100,
            Money(contribution), recipe.SellingPrice == 0 ? 0 : Money(contribution / recipe.SellingPrice * 100),
            lines.Any(x => x.IsIllustrative), lines);
    }

    public static FinancialModel Model(Scenario s)
    {
        Guard.Text(s.Name, "Scenario name");
        Guard.Require(s.Expenses is { Count: <= 50 }, "Maximum 50 fixed expenses.");
        foreach (var expense in s.Expenses) { Guard.Text(expense.Name, "Expense name"); Guard.Amount(expense.MonthlyAmount, "Fixed expense"); }
        Guard.Require(s.OpenDays is { Count: > 0 and <= 7 } && s.OpenDays.Distinct().Count() == s.OpenDays.Count && s.OpenDays.All(x => x >= 0 && x < 7), "Choose distinct opening days.");
        Guard.Require(TimeOnly.TryParse(s.ServiceStart, out _) && TimeOnly.TryParse(s.ServiceEnd, out _), "Enter valid service times.");
        Guard.Require(s.AverageBasket > 0 && s.AverageBasket <= 1000000, "Average basket must be positive.");
        Guard.Amount(s.VariableCost, "Variable cost"); Guard.Amount(s.CommissionPercent, "Commission", 100);
        Guard.Amount(s.CommissionVatPercent, "Commission VAT", 100); Guard.Amount(s.SalesVatPercent, "Sales VAT", 100);
        Guard.Amount(s.DiscountPercent, "Discount", 100); Guard.Amount(s.OrdersPerEvening, "Orders per evening", 10000);
        Guard.Amount(s.OwnerHoursWeekly, "Owner hours", 168); Guard.Amount(s.OwnerHourlyRate, "Owner hourly rate", 10000);
        Guard.Amount(s.InitialInvestment, "Initial investment", 100000000); Guard.Amount(s.TargetProfit, "Target profit");
        Guard.Require(s.RecoveryMonths is > 0 and <= 600, "Recovery period must be 1–600 months.");
        Guard.Require(!s.RecoverCommissionVat || s.VatRegistered, "Only model recovered commission VAT when VAT registered.");
        Guard.Amount(s.StaffHoursWeekly,"Paid staff hours",10000); Guard.Amount(s.StaffHourlyRate,"Staff hourly wage",10000);
        Guard.Amount(s.EmployerCostPercent,"Employer cost allowance",100); Guard.Amount(s.OtherChargePerOrder,"Other charges per order");
        if(s.Channels is {Count:>0})
        {
            Guard.Require(s.Channels.Count<=20 && s.Channels.Sum(c=>c.SharePercent)==100,"Sales-channel shares must total 100%.");
            foreach(var c in s.Channels) { Guard.Text(c.Name,"Channel name"); Guard.Amount(c.SharePercent,"Channel share",100); Guard.Amount(c.CommissionPercent,"Channel commission",100); Guard.Amount(c.VatPercent,"Channel fee VAT",100); }
        }
        var days = s.OpenDays.Count * 52m / 12;
        var orders = days * s.OrdersPerEvening;
        var grossPer = s.AverageBasket * (1 - s.DiscountPercent / 100);
        var netPer = s.VatRegistered ? grossPer / (1 + s.SalesVatPercent / 100) : grossPer;
        var feePer = s.Channels is {Count:>0} ? s.Channels.Sum(c=>grossPer*c.SharePercent/100*c.CommissionPercent/100) : grossPer * s.CommissionPercent / 100;
        var feeVatPer = s.RecoverCommissionVat ? 0 : s.Channels is {Count:>0} ? s.Channels.Sum(c=>grossPer*c.SharePercent/100*c.CommissionPercent/100*c.VatPercent/100) : feePer * s.CommissionVatPercent / 100;
        var contributionPer = netPer - s.VariableCost - feePer - feeVatPer - s.OtherChargePerOrder;
        var staffing = s.StaffHoursWeekly * 52m / 12 * s.StaffHourlyRate * (1+s.EmployerCostPercent/100);
        var fixedCosts = s.Expenses.Sum(x => x.MonthlyAmount) + staffing;
        var owner = s.OwnerHoursWeekly * 52m / 12 * s.OwnerHourlyRate;
        var capital = s.InitialInvestment / s.RecoveryMonths;
        var contribution = contributionPer * orders;
        var profit = contribution - fixedCosts;
        decimal? Required(decimal target) => contributionPer <= 0 ? null : decimal.Ceiling(target / contributionPer);
        return new(Money(days), Money(orders), Money(grossPer * orders), Money((grossPer - netPer) * orders), Money(netPer * orders),
            Money(s.VariableCost * orders), Money(feePer * orders), Money(feeVatPer * orders), Money(contribution), Money(contributionPer),
            netPer == 0 ? 0 : Money(contributionPer / netPer * 100), Money(fixedCosts), Money(profit), Money(owner), Money(profit - owner),
            Money(capital), Money(profit - owner - capital), new() {
                ["Business expenses"] = Required(fixedCosts), ["Expenses + owner"] = Required(fixedCosts + owner),
                ["£500 profit after owner"] = Required(fixedCosts + owner + 500), ["£1,000 profit after owner"] = Required(fixedCosts + owner + 1000),
                ["£2,000 profit after owner"] = Required(fixedCosts + owner + 2000),
                ["Custom profit after owner"] = Required(fixedCosts + owner + s.TargetProfit),
                ["Owner + capital recovery"] = Required(fixedCosts + owner + capital)
            }, contributionPer <= 0 ? "Each order has zero or negative contribution. Break-even is not achievable with these assumptions." : null, Money(staffing), Money(s.OtherChargePerOrder*orders));
    }
}
