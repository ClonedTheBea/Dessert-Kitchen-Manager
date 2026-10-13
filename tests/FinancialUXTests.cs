using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;
public partial class BusinessTests
{
 [Fact] public void PriceChartExampleReconcilesEveryPennyAndPercent()
 {
  var s=Kitchen();var row=Row(s.Profitability(new(Today,Settings(s)))) with{GrossPrice=5.95m,Ingredients=1.41m,Packaging=.16m,PlatformFees=2.142m,Contribution=2.238m,Channel="Deliveroo"};
  var parts=Store.PriceChart(row,true,out var message);Assert.Null(message);Assert.Equal(5.95m,parts.Sum(p=>p.Amount));Assert.Equal(100,parts.Sum(p=>p.Percent));Assert.Equal(2.14m,parts.Single(p=>p.Key=="fees").Amount);Assert.Equal(2.24m,parts.Single(p=>p.Key=="contribution").Amount);Assert.DoesNotContain(parts,p=>p.Key=="overheads");
 }
 [Theory][InlineData(0)][InlineData(50)][InlineData(100)] public void TaxedChartsReconcileWithFractionalPennyCosts(decimal recovery)
 {
  var s=Kitchen();var b=Settings(s) with{VatRegistered=true,InputRecoveryPercent=recovery};b=b with{Products=[b.Products[0] with{VatTreatment="taxable",OutputVatPercent=20,Channels=[new("uber",5.95m,100)]}]};var row=Row(s.Profitability(new(Today,b)),"uber");var parts=Store.PriceChart(row,true,out var message);Assert.Null(message);Assert.Equal(5.95m,parts.Sum(x=>x.Amount));Assert.Equal(100,parts.Sum(x=>x.Percent));Assert.Contains(parts,x=>x.Key=="vat");Close(row.GrossPrice,parts.Sum(x=>x.UnroundedAmount));
 }
 [Fact] public void IncompleteNegativeAndSubPennyPricesCannotProduceMisleadingDoughnuts()
 {
  var s=Kitchen();var row=Row(s.Profitability(new(Today,Settings(s))));Assert.Empty(Store.PriceChart(row,false,out var missing));Assert.Contains("missing",missing!);Assert.Empty(Store.PriceChart(row with{Contribution=-1},true,out var negative));Assert.Contains("exceed",negative!);Assert.Empty(Store.PriceChart(row with{GrossPrice=.001m},true,out _));
 }
 [Fact] public void MissingZeroAndConfirmedZeroAreDifferentAndViewsAreReadOnly()
 {
  var s=Kitchen();var b=Settings(s);var unknown=s.Breakdown(new(new(Today,b),"cake","direct"));Assert.Contains(unknown.Missing,x=>x.Contains("commission"));Assert.Contains(unknown.Missing,x=>x.Contains("energy"));Assert.Empty(unknown.Segments);
  b=b with{Channels=b.Channels.Select(c=>c with{CommissionConfigured=true}).ToList(),Products=[b.Products[0] with{EnergyConfirmed=true}]};var before=s.CurrentBusiness();var history=s.BusinessHistory().Count;var complete=s.Breakdown(new(new(Today,b),"cake","direct"));Assert.Empty(complete.Missing);Assert.NotEmpty(complete.Segments);Assert.Equal(System.Text.Json.JsonSerializer.Serialize(before),System.Text.Json.JsonSerializer.Serialize(s.CurrentBusiness()));Assert.Equal(history,s.BusinessHistory().Count);
  b=b with{Equipment=[new("oven","Oven")],Products=[b.Products[0] with{Equipment=[new("oven",30)]}]};Assert.Contains(s.Breakdown(new(new(Today,b),"cake","direct")).Missing,x=>x.Contains("unit price"));
 }
 [Fact] public void OverviewUsesCentralCostsRatesAndTradingWeeksPreservingHistoricalScenarios()
 {
  var s=Kitchen();var f=DomainTests.Baseline() with{TradingWeeks=48,OpenDays=[4,5,6],AverageBasket=20,VariableCost=5,OrdersPerEvening=10};var b=Settings(s) with{Forecast=f,ForecastReviewed=true,ForecastShares=new(){["direct"]=100},Channels=[new("direct","Direct",CommissionConfigured:true)],Expenses=[new("rent","Rent","Rent",625),new("insurance","Insurance","Insurance",540,"annual"),new("direct","Already in recipes","Utilities",500,"monthly","direct")],Utilities=[new("electricity",22,RateConfigured:true),new("gas"),new("water")]};
  b=b with{Products=[]};s.SaveBusiness(b);var result=s.Overview(Today);Assert.Empty(result.Missing);Assert.Equal(670,result.Model!.FixedCosts);Assert.Equal(12,result.Model.MonthlyOpenDays);Assert.Equal(1130,result.Model.OperatingProfit);Assert.Equal(45,result.RunningCosts["Insurance"]);Assert.Equal(1375,f.Expenses.Sum(e=>e.MonthlyAmount));
  var saved=s.CurrentBusiness();s.SaveBusiness(saved with{Channels=[new("direct","Direct",CommissionConfigured:false)]});Assert.Null(s.Overview(Today).Model);Assert.Equal(2,s.BusinessHistory().Count);
  s.SaveBusiness(s.CurrentBusiness() with{Channels=[new("direct","Direct",CommissionConfigured:true)],Expenses=[new("named","Staff not already in direct costs","Other",10),new("named2","electricity standing charge","Other",20)],Utilities=[new("electricity",22,12),new("gas"),new("water")]});Assert.Equal(33.65m,s.Overview(Today).Model!.FixedCosts);
 }
 [Fact] public void OverviewBreakEvenRecalculatesPayrollFloorAtLowerVolume()
 {
  var s=Kitchen();var b=Settings(s) with{Products=[],Forecast=DomainTests.Baseline() with{AverageBasket=10,VariableCost=4,OrdersPerEvening=100,Expenses=[]},ForecastReviewed=true,ForecastShares=new(){["direct"]=100},Channels=[new("direct","Direct",CommissionConfigured:true)],StaffHoursWeekly=10,StaffHourlyRate=12,DirectLabourPerOrder=2};s.SaveBusiness(b);var m=s.Overview(Today).Model!;Assert.Equal(0,m.FixedCosts);Assert.Equal(65,m.RequiredOrders["Business expenses"]); // £520 / (£6 contribution + £2 labour already paid)
 }
}
