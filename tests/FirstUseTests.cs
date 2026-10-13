using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;
public partial class BusinessTests
{
 [Fact] public void FirstUseCostsAreAvailableWithoutSalesAndEmptyCostsStayUnknown()
 {
  var s=Kitchen();Assert.Null(s.Overview(Today).KnownMonthlyCosts);var b=s.SaveBusiness(s.DefaultBusiness() with{Expenses=[new("rent","Rent","Rent",625),new("insurance","Insurance","Insurance",240,"annual")]});var overview=s.Overview(Today);Assert.Null(overview.Model);Assert.Equal(645,overview.KnownMonthlyCosts);Assert.Contains(overview.Requirements,x=>x.Action=="business:forecast");Assert.Equal(20,overview.RunningCosts["Insurance"]);
  s.SaveBusiness(b with{Expenses=[new("rent","Rent","Rent",700)]});Assert.Equal(700,s.Overview(Today).KnownMonthlyCosts);
 }
 [Fact] public void NonRegisteredDefaultsAndExplicitVatRepairKeepValidationAndHistory()
 {
  var s=Kitchen();var recipe=s.Get<Recipe>("recipe","cake");var b=Settings(s);Assert.Equal(0,s.DefaultProduct(recipe,b).InputRecoveryPercent);Assert.Equal(40,s.DefaultProduct(recipe,b with{VatRegistered=true,InputRecoveryPercent=40}).InputRecoveryPercent);
  var saved=s.SaveBusiness(b);var failed=saved with{InputRecoveryPercent=100,Expenses=[new("rent","Rent","Rent",625)]};var e=Assert.Throws<ValidationException>(()=>s.SaveBusiness(failed));Assert.Contains("Input VAT recovery requires VAT registration",e.Message);Assert.Single(s.BusinessHistory());Assert.Empty(s.CurrentBusiness().Expenses);
  var repaired=s.SaveBusiness(failed with{InputRecoveryPercent=0});Assert.Equal(625,repaired.Expenses[0].Amount);Assert.Equal(100,repaired.Products[0].InputRecoveryPercent);Assert.Equal(2,s.BusinessHistory().Count);Assert.Equal(0,s.BusinessHistory().Last().Settings.InputRecoveryPercent);
 }
 [Fact] public void PartialRecipeBreakdownDoesNotNeedAnEntireBusinessForecast()
 {
  var s=Kitchen();var b=s.DefaultBusiness();var part=s.Breakdown(new(new(Today,b),"cake","direct"));Assert.Equal(1.2m,part.Row.Ingredients);Assert.Equal(.1m,part.Row.Packaging);Assert.Contains(part.Missing,x=>x.Contains("energy"));Assert.Contains(part.Missing,x=>x.Contains("commission"));Assert.DoesNotContain(part.Missing,x=>x.Contains("VAT treatment"));Assert.Empty(part.Segments);
  b=b with{VatRegistered=true,InputRecoveryPercent=0};Assert.Contains(s.Breakdown(new(new(Today,b),"cake","direct")).Missing,x=>x.Contains("VAT treatment"));
 }
}
