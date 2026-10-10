using DessertKitchen.Domain;
using Xunit;

namespace DessertKitchen.Tests;

public class DomainTests
{
    public static Scenario Baseline() => new("baseline", 1, "Baseline", [new("Rent", 625), new("Other", 750)], [4, 5, 6, 0], "18:00", "23:00", 21, 5, 30, 20, false, false, 0, 0, 20, 20, 12, 5000, 24, 1000);
    public static Price Cheese(decimal amount = 3.25m) => new("quote", "cheese", "supplier", 280, "g", amount, 0, true, false, "", new(2026, 1, 1), false);
    public static Recipe Recipe() => new("recipe", 1, "Cheesecake", "Cheesecakes", "", 5, "each", 0, "g", 0, 0, "", 0, "Milk", 0, 0, 5.95m, 70, [new("ingredient", "cheese", 375, "g")]);
    public static RecipeCost Calculate(Recipe r, Price? p = null) => Costing.Recipe(r,
        _ => new("cheese", 1, "Cream cheese", "Dairy", "", "g", "", "Milk", 0), _ => p ?? Cheese(), _ => throw new Exception("Unexpected sub-recipe"));

    [Theory]
    [InlineData(1, "kg", "g", 1000)] [InlineData(500, "g", "kg", .5)]
    [InlineData(2, "l", "ml", 2000)] [InlineData(750, "ml", "l", .75)] [InlineData(3, "each", "each", 3)]
    public void CompatibleUnits(decimal quantity, string from, string to, decimal expected) => Assert.Equal(expected, Units.Convert(quantity, from, to));
    [Theory] [InlineData("g", "ml")] [InlineData("each", "g")] [InlineData("cup", "ml")]
    public void RejectsIncompatibleUnits(string from, string to) => Assert.Throws<ValidationException>(() => Units.Convert(1, from, to));
    [Fact] public void CheeseExampleRetainsPrecision() => Assert.Equal(3.25m * 75m / 280m, Costing.IngredientCost(Cheese(), 75, "g", 0));
    [Fact] public void CheeseExampleRoundsTo87Pence() => Assert.Equal(.87m, Costing.Money(Costing.IngredientCost(Cheese(), 75, "g", 0)));
    [Fact] public void HalfPennyRoundsAwayFromZero() { Assert.Equal(1.01m, Costing.Money(1.005m)); Assert.Equal(-1.01m, Costing.Money(-1.005m)); }
    [Fact] public void WastageIsExtraQuantity() => Assert.Equal(Costing.IngredientCost(Cheese(), 75, "g", 0) * 1.1m, Costing.IngredientCost(Cheese(), 75, "g", 10));
    [Fact] public void VatInclusiveQuote() { var p = Cheese(12) with { VatRate = 20, RecoverVat = true }; Assert.Equal(10, Costing.UsablePackCost(p)); }
    [Fact] public void VatExclusiveQuote() { var p = Cheese(10) with { VatRate = 20, PriceIncludesVat = false }; Assert.Equal(12, Costing.UsablePackCost(p)); }
    [Fact] public void VatRecoverableExclusiveQuote() { var p = Cheese(10) with { VatRate = 20, PriceIncludesVat = false, RecoverVat = true }; Assert.Equal(10, Costing.UsablePackCost(p)); }
    [Fact] public void BatchAndPortionCost() { var c = Calculate(Recipe()); Assert.Equal(4.35m, c.BatchCost); Assert.Equal(.87m, c.PortionCost); Assert.Equal(2.91m, c.RecommendedPrice); }
    [Fact] public void LabourAddedOnce() { var c = Calculate(Recipe() with { LabourMinutes = 30, HourlyRate = 12 }); Assert.Equal(6, c.LabourCost); Assert.Equal(10.35m, c.BatchCost); }
    [Fact] public void ScalingPreservesPerPortionCost() { var r = Recipe(); var c = Calculate(r with { Yield = 100, Lines = [new("ingredient", "cheese", 7500, "g")] }); Assert.Equal(Calculate(r).PortionCost, c.PortionCost); Assert.Equal(87.05m, c.BatchCost); }
    [Fact] public void PackagingSeparated()
    {
        var r = Recipe() with { Lines = [new("ingredient", "pot", 5, "each")] };
        var c = Costing.Recipe(r, _ => new("pot", 1, "Pot", "Packaging", "", "each", "", "", 0, true),
            _ => Cheese(10) with { Unit = "each", PackQuantity = 50 }, _ => throw new Exception());
        Assert.Equal(1, c.PackagingCost); Assert.Equal(0, c.IngredientCost); Assert.Equal(.2m, c.PortionCost);
    }
    [Fact] public void IllustrativeFlagFlowsFromIngredients() => Assert.True(Calculate(Recipe(), Cheese() with { IsIllustrative = true }).IsIllustrative);
    [Fact] public void SubRecipePrecisionSurvivesLargeScaleReuse()
    {
        var childRecipe = Recipe() with { Id = "child", Yield = 1, Lines = [new("ingredient", "cheese", 1, "g")] };
        var childCost = Calculate(childRecipe, Cheese(.004m) with { PackQuantity = 1, IsIllustrative = true });
        Assert.Equal(0, childCost.BatchCost);
        var parent = Recipe() with { Lines = [new("recipe", "child", 1000, "each")] };
        var cost = Costing.Recipe(parent, _ => throw new Exception(), _ => throw new Exception(), _ => new(childRecipe, childCost, ""));
        Assert.Equal(4, cost.BatchCost); Assert.True(cost.IsIllustrative);
    }
    [Theory] [InlineData(0)] [InlineData(-1)] public void InvalidYieldRejected(decimal yield) => Assert.Throws<ValidationException>(() => Calculate(Recipe() with { Yield = yield }));
    [Fact] public void InvalidTargetRejected() => Assert.Throws<ValidationException>(() => Calculate(Recipe() with { TargetMargin = 100 }));
    [Fact] public void EmptyRecipeRejected() => Assert.Throws<ValidationException>(() => Calculate(Recipe() with { Lines = [] }));
    [Fact] public void UserBaselineContributionAndBreakEven()
    {
        var m = Costing.Model(Baseline()); Assert.Equal(8.44m, m.ContributionPerOrder); Assert.Equal(163m, m.RequiredOrders["Business expenses"]);
        Assert.Equal(1375m, m.FixedCosts); Assert.Equal(405m, m.RequiredOrders["Custom profit after owner"]);
        Assert.Equal(1040m, m.OwnerCompensation); Assert.Equal(1550.87m, m.OperatingProfit);
    }
    [Fact] public void RecoverableFeeVatRequiresRegistration() => Assert.Throws<ValidationException>(() => Costing.Model(Baseline() with { RecoverCommissionVat = true }));
    [Fact] public void SalesVatExtractedFromGross() { var m = Costing.Model(Baseline() with { VatRegistered = true, SalesVatPercent = 20, RecoverCommissionVat = true }); Assert.Equal(6.20m, m.ContributionPerOrder); Assert.Equal(0, m.CommissionVat); Assert.Equal(1213.33m, m.SalesVat); }
    [Fact] public void DiscountReducesSalesAndFees() { var m = Costing.Model(Baseline() with { DiscountPercent = 10 }); Assert.Equal(7.10m, m.ContributionPerOrder); }
    [Fact] public void NegativeContributionNeverReportsBreakEven() { var m = Costing.Model(Baseline() with { VariableCost = 30 }); Assert.All(m.RequiredOrders.Values, v => Assert.Null(v)); Assert.NotNull(m.Warning); }
    [Fact] public void EmptyOpeningDaysRejected() => Assert.Throws<ValidationException>(() => Costing.Model(Baseline() with { OpenDays = [] }));
    [Fact] public void ZeroInvestmentRecoveryPeriodRejected() => Assert.Throws<ValidationException>(() => Costing.Model(Baseline() with { RecoveryMonths = 0 }));
    [Fact] public void OwnerAndCapitalAreSeparate() { var m = Costing.Model(Baseline()); Assert.Equal(Costing.Money(m.OperatingProfit - m.OwnerCompensation), m.AfterOwner); Assert.Equal(208.33m, m.MonthlyCapitalRecovery); }
}
