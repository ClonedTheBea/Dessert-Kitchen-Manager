using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;
public class BusinessTests
{
    static DateOnly Today=>AllergenRules.Today();
    static Store Kitchen()
    {
        var s=new Store(Path.Combine(Path.GetTempPath(),"kitchen-business",Guid.NewGuid().ToString("N"),"test.db"));
        s.Save("supplier","supplier",0,new Supplier("supplier",1,"Supplier"));
        s.Save("ingredient","flour",0,new Ingredient("flour",1,"Flour","Dry","","g","","",0));
        s.Save("ingredient","pot",0,new Ingredient("pot",1,"Pot","Packaging","","each","","",0,true));
        s.AddPrice(new("price","flour","supplier",1000,"g",12,20,true,false,"",Today,false,Store.Now()));
        s.AddPrice(new("pack","pot","supplier",50,"each",5,0,true,false,"",Today,false,Store.Now()));
        var r=DomainTests.Recipe() with{Id="cake",Name="Test cake",Revision=1,Yield=1,SellingPrice=6,Lines=[new("ingredient","flour",100,"g"),new("ingredient","pot",1,"each")]};
        s.Save("recipe",r.Id,0,r,new(r,s.Calculate(r),Store.Now()));return s;
    }
    static BusinessSettings Settings(Store s)=>s.DefaultBusiness() with{Products=[new("cake",[new("direct",6,100),new("uber",6,100),new("deliveroo",6,100)],VatTreatment:"zero")],Channels=[new("direct","Direct"),new("uber","Uber Eats",30,20),new("deliveroo","Deliveroo",25,20)]};
    static ProductEconomics Row(ProfitabilityReport r,string channel="direct")=>r.Products.Single(p=>p.ChannelId==channel);
    static void Close(decimal expected,decimal actual)=>Assert.InRange(actual,expected-.000000000001m,expected+.000000000001m);
    [Theory][InlineData(false,0,0,1.2,2.16,2.54)][InlineData(true,100,20,1,1.8,2.1)][InlineData(true,50,20,1.1,1.98,1.82)]
    public void VatAndPlatformCostsAreSeparated(bool registered,decimal recovery,decimal vat,decimal ingredient,decimal fee,decimal contribution)
    {
        var s=Kitchen();var b=Settings(s);b=b with{VatRegistered=registered,InputRecoveryPercent=recovery,Products=[b.Products[0] with{VatTreatment=vat==0?"zero":"taxable",OutputVatPercent=vat}]};var r=Row(s.Profitability(new(Today,b)),"uber");
        Close(ingredient,r.Ingredients);Close(fee,r.PlatformFees);Close(contribution,r.Contribution);Close(registered?1:0,r.OutputVat);
        Close(r.GrossPrice,r.OutputVat+r.Ingredients+r.Packaging+r.Energy+r.Labour+r.OtherVariable+r.PlatformFees+r.AllocatedOverheads!.Value+r.OperatingProfit!.Value);
    }
    [Fact] public void ProductRecoveryLimitAndNetCommissionBasisAreApplied()
    {
        var s=Kitchen();var b=Settings(s);b=b with{VatRegistered=true,InputRecoveryPercent=100,Channels=b.Channels.Select(c=>c with{CommissionBasis="net"}).ToList(),Products=[b.Products[0] with{VatTreatment="taxable",OutputVatPercent=20,InputRecoveryPercent=0}]};var row=Row(s.Profitability(new(Today,b)),"uber");Close(1.2m,row.Ingredients);Close(1.8m,row.PlatformFees);
    }
    [Fact] public void TariffsWaterAnnualExpensesAndStandingChargesUsePreciseMonthlyEquivalents()
    {
        var s=Kitchen();var b=Settings(s);b=b with{Utilities=[new("electricity",30,60),new("gas",10),new("water",200)],Equipment=[new("oven","Oven","electricity",2,50),new("hob","Hob","gas",1,100)],Expenses=[new("insurance","Insurance","Insurance",1200,"annual")],Products=[b.Products[0] with{Equipment=[new("oven",30),new("hob",60)],WaterLitresPerBatch=100}]};var report=s.Profitability(new(Today,b));Close(.45m,Row(report).Energy);Close(118.25m,report.MonthlyFixedCosts);Close(100,BusinessRules.Monthly(b.Expenses[0],0));
    }
    [Theory][InlineData("units")][InlineData("revenue")][InlineData("labour")]
    public void AllocationReconcilesToFixedCosts(string method)
    {
        var s=Kitchen();var b=Settings(s);b=b with{AllocationMethod=method,Expenses=[new("rent","Rent","Rent",300)],StaffHourlyRate=12,Products=[b.Products[0] with{LabourBasis="staff",LabourMinutesPerBatch=5,Channels=[new("direct",6,100),new("uber",9,200),new("deliveroo",7,0)]}]};var r=s.Profitability(new(Today,b));Close(r.MonthlyFixedCosts,r.Products.Sum(p=>(p.AllocatedOverheads??0)*p.MonthlyUnits));Assert.Null(Row(r,"deliveroo").AllocatedOverheads);Assert.Null(Row(r,"deliveroo").OperatingProfit);Close(r.MonthlyOperatingProfit,r.Products.Sum(p=>(p.OperatingProfit??0)*p.MonthlyUnits));if(method=="revenue")Close(.75m,Row(r).AllocatedOverheads!.Value);else Close(1,Row(r).AllocatedOverheads!.Value);
    }
    [Fact] public void ZeroVolumeAndZeroLabourDoNotInventAllocatedProfit()
    {
        var s=Kitchen();var b=Settings(s) with{AllocationMethod="labour",Expenses=[new("rent","Rent","Rent",100)]};var r=s.Profitability(new(Today,b));Assert.All(r.Products,p=>Assert.Null(p.OperatingProfit));Assert.Equal(100,r.UnallocatedOverheads);
        b=b with{Products=[b.Products[0] with{Channels=[new("direct",6,0)]}]};r=s.Profitability(new(Today,b));Assert.Null(r.BreakEvenUnits);Assert.Equal(-100,r.MonthlyOperatingProfit);
    }
    [Fact] public void DirectExpensesAndPaidLabourAreNotDoubleCountedAndOwnerIsSeparate()
    {
        var s=Kitchen();var b=Settings(s) with{Expenses=[new("already","Recipe energy already included","Utilities",100,"monthly","direct")],StaffHoursWeekly=10,StaffHourlyRate=12,OwnerHoursWeekly=2,OwnerHourlyRate=10};b=b with{Products=[b.Products[0] with{LabourBasis="staff",LabourMinutesPerBatch=5,Channels=[new("direct",6,100)]}]};var r=s.Profitability(new(Today,b));Close(420,r.MonthlyFixedCosts);Close(1,Row(r).Labour);Close(520,r.MonthlyFixedCosts+r.Products.Sum(p=>p.Labour*p.MonthlyUnits));Close(2*52m/12*10,r.MonthlyOwnerCompensation);Close(r.MonthlyOperatingProfit-r.MonthlyOwnerCompensation,r.MonthlyAfterOwner);
        b=b with{Products=[b.Products[0] with{Channels=[new("direct",6,1000)]}]};r=s.Profitability(new(Today,b));Close(0,r.MonthlyFixedCosts);Assert.Contains(r.Warnings,w=>w.Contains("exceeds"));
    }
    [Fact] public void BreakEvenAccountsForPayrollFloorAtChangedVolume()
    {
        var s=Kitchen();var b=Settings(s) with{StaffHoursWeekly=10,StaffHourlyRate=12};b=b with{Products=[b.Products[0] with{LabourBasis="staff",LabourMinutesPerBatch=5,Channels=[new("direct",6,1000)]}]};var r=s.Profitability(new(Today,b));Assert.Equal(111,r.BreakEvenUnits); // 520 / (6 - 1.2 - .1)
        var count=r.BreakEvenUnits!.Value;b=b with{Products=[b.Products[0] with{Channels=[new("direct",6,count)]}]};Assert.True(s.Profitability(new(Today,b)).MonthlyOperatingProfit>=0);b=b with{Products=[b.Products[0] with{Channels=[new("direct",6,count-1)]}]};Assert.True(s.Profitability(new(Today,b)).MonthlyOperatingProfit<0);
    }
    [Fact] public void HistoricalSettingsAreEffectiveDatedAuditedAndConflictProtected()
    {
        var s=Kitchen();var first=s.SaveBusiness(Settings(s));var second=s.SaveBusiness(first with{EffectiveFrom=Today.AddDays(10),Utilities=[new("electricity",50),new("gas"),new("water")]});Assert.Equal(first.Revision,s.BusinessAt(Today).Revision);Assert.Equal(second.Revision,s.BusinessAt(Today.AddDays(10)).Revision);Assert.Equal(2,s.BusinessHistory().Count);Assert.Equal(second,s.SaveBusiness(first with{EffectiveFrom=Today.AddDays(10),Utilities=second.Utilities}));Assert.Equal(2,s.BusinessHistory().Count);Assert.Throws<ConflictException>(()=>s.SaveBusiness(first with{Name="Stale change"}));
    }
    [Fact] public void SimulationAndSavedSnapshotsNeverMutateRealRecipesPricesOrInventory()
    {
        var s=Kitchen();var b=Settings(s);var original=JsonSerializer.Serialize(s.All<Recipe>("recipe"));var quotes=JsonSerializer.Serialize(s.Prices());var input=new ProfitabilityRequest(Today,b,[new("cake",2,[new("ingredient","flour",50,"g"),new("ingredient","pot",1,"each")])]);var simulated=s.Profitability(input);Close(1.2m,Row(simulated).Ingredients);Close(.1m,Row(simulated).Packaging);
        var saved=s.SaveProfitScenario(new("scenario",0,"Alternative",input,simulated,""));s.AddPrice(new("new-price","flour","supplier",1000,"g",24,20,true,false,"",Today,false,Store.Now()));Close(2.4m,Row(s.Profitability(input)).Ingredients);Close(1.2m,Row(s.Get<ProfitScenario>("profit-scenario",saved.Id).Result).Ingredients);Assert.Equal(original,JsonSerializer.Serialize(s.All<Recipe>("recipe")));Assert.Empty(s.StockMovements());Assert.Empty(s.BusinessHistory());Assert.Equal(2,JsonSerializer.Deserialize<List<Price>>(quotes)!.Count);
    }
    [Fact] public void IngredientSubstitutionUsesExistingQuotesAndRejectsInvalidSimulation()
    {
        var s=Kitchen();var b=Settings(s);var r=s.Profitability(new(Today,b,[new("cake",1,[new("ingredient","pot",3,"each")])]));Close(0,Row(r).Ingredients);Close(.3m,Row(r).Packaging);Assert.Throws<ValidationException>(()=>s.Profitability(new(Today,b,[new("cake",1,[new("ingredient","pot",3,"g")])])));
    }
    [Fact] public void NestedRecipesSeparatePackagingAndLabourWithoutRoundingAwaySmallCosts()
    {
        var s=Kitchen();var child=s.Get<Recipe>("recipe","cake") with{IsSellable=false,Revision=2,LabourMinutes=1,HourlyRate=12};s.Save("recipe","cake",1,child,new(child,s.Calculate(child),Store.Now()));var parent=child with{Id="parent",Revision=1,Name="Parent",IsSellable=true,LabourMinutes=0,Lines=[new("recipe","cake",3,"each")]};s.Save("recipe","parent",0,parent,new(parent,s.Calculate(parent),Store.Now()));var b=Settings(s) with{Products=[new("parent",[new("direct",10,1)])]};var row=Row(s.Profitability(new(Today,b)));Close(3.6m,row.Ingredients);Close(.3m,row.Packaging);Close(.6m,row.Labour);
    }
    [Fact] public void BusinessForecastCreatesANewPlannerScenarioWithEquivalentTotals()
    {
        var s=Kitchen();var b=Settings(s) with{Expenses=[new("rent","Rent","Rent",100)],StaffHoursWeekly=5,StaffHourlyRate=12,OwnerHoursWeekly=2,OwnerHourlyRate=10};var input=new ProfitabilityRequest(Today,b);var r=s.Profitability(input);var saved=s.PlannerFromBusiness(input);var m=Costing.Model(saved);Assert.Equal(Costing.Money(r.MonthlyOperatingProfit),m.OperatingProfit);Assert.Equal(Costing.Money(r.MonthlyAfterOwner),m.AfterOwner);Assert.Single(s.All<Scenario>("scenario"));Assert.Empty(s.BusinessHistory());
    }
    [Fact] public async Task EndpointsRequireAuthenticationAndActualBatchCostsRemainUnknown()
    {
        using var f=new KitchenFactory();using var c=f.CreateClient();c.DefaultRequestHeaders.Add("X-Kitchen-Request","1");Assert.Equal(HttpStatusCode.Unauthorized,(await c.GetAsync("/api/business")).StatusCode);(await c.PostAsJsonAsync("/api/auth/setup",new{password="business-test-password"})).EnsureSuccessStatusCode();var s=new Store(f.DatabasePath);var prod=new ProductionInput(Guid.NewGuid().ToString(),"lemon-pot",1,4,4,"home","home",Today,"batch");foreach(var r in s.Requirements("lemon-pot",1,4))s.AddExistingStock(new(Guid.NewGuid().ToString(),"ingredient",r.ItemId,r.Quantity*31,r.Unit,"home",Today,"Cupboard",DateReviewed:true,DateEvidence:"Test"));for(var i=0;i<31;i++){prod=prod with{OperationId=Guid.NewGuid().ToString()};s.Produce(prod);}
        var context=await c.GetFromJsonAsync<JsonElement>("/api/profitability/context");Assert.Equal(30,context.GetProperty("actualBatches").GetArrayLength());Assert.Equal(prod.OperationId,context.GetProperty("actualBatches")[0].GetProperty("id").GetString());Assert.Equal(JsonValueKind.Null,context.GetProperty("actualBatches")[0].GetProperty("result").GetProperty("batchCost").ValueKind);Assert.False(context.GetProperty("report").TryGetProperty("actualOperatingProfit",out _));
    }
    [Fact] public void InvalidVatOrDoubleAttributionIsRejectedAndHistorySurvivesBackup()
    {
        var s=Kitchen();var b=Settings(s);Assert.Throws<ValidationException>(()=>s.SaveBusiness(b with{InputRecoveryPercent=100}));Assert.Throws<ValidationException>(()=>s.SaveBusiness(b with{Expenses=[new("v","Variable","Other",1,"annual","variable")]}));s.SaveBusiness(b);var path=Path.Combine(Path.GetTempPath(),Guid.NewGuid()+".db");File.WriteAllBytes(path,s.Backup());Store.Restore(path,path+".restore");var restored=new Store(path+".restore");Assert.Equal(JsonSerializer.Serialize(s.BusinessHistory()),JsonSerializer.Serialize(restored.BusinessHistory()));
    }
    [Fact] public void PricingSnapshotsAreImmutableAndRetriesRetainTheOriginalResult()
    {
        var s=Kitchen();var input=new ProfitabilityRequest(Today,Settings(s));var request=new ProfitScenario("frozen",0,"Frozen",input,s.Profitability(input),"");var saved=s.SaveProfitScenario(request);s.AddPrice(new("later","flour","supplier",1000,"g",30,0,true,false,"",Today,false,Store.Now()));Assert.Equal(JsonSerializer.Serialize(saved),JsonSerializer.Serialize(s.SaveProfitScenario(request)));Assert.Throws<ValidationException>(()=>s.SaveProfitScenario(saved with{Name="Overwrite"}));Assert.Throws<ConflictException>(()=>s.SaveProfitScenario(request with{Name="Changed payload"}));Assert.Single(s.All<ProfitScenario>("profit-scenario"));
    }
    [Fact] public void OwnerDirectTimeIsNotPaidLabourOrAnAdditionalDuplicateAllowance()
    {
        var s=Kitchen();var b=Settings(s) with{OwnerHoursWeekly=1,OwnerHourlyRate=12};b=b with{Products=[b.Products[0] with{LabourBasis="owner",LabourMinutesPerBatch=30,Channels=[new("direct",10,100)]}]};var r=s.Profitability(new(Today,b));Close(0,Row(r).Labour);Close(6,Row(r).OwnerDirect);Close(600,r.MonthlyOwnerCompensation);Close(r.MonthlyAfterOwner,Row(r).AfterOwner!.Value*100);
    }
    [Fact] public void NonPositiveContributionHasNoBreakEvenAndProfitCanBeNegative()
    {
        var s=Kitchen();var b=Settings(s);b=b with{Products=[b.Products[0] with{Channels=[new("uber",1,100)]}]};var r=s.Profitability(new(Today,b));Assert.True(Row(r,"uber").Contribution<0);Assert.Null(r.BreakEvenUnits);Assert.True(r.MonthlyOperatingProfit<0);
    }

}
