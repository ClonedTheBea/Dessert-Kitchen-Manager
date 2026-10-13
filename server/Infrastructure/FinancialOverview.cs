using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;
public record PriceSegment(string Key,string Name,decimal Amount,decimal Percent,decimal UnroundedAmount);
public record PriceBreakdown(ProductEconomics Row,List<string> Missing,List<PriceSegment> Segments,string? ChartMessage);
public record BreakdownRequest(ProfitabilityRequest Input,string RecipeId,string ChannelId);
public record SetupRequirement(string Message,string Action);
public record FinancialOverview(BusinessSettings Settings,FinancialModel? Model,List<string> Missing,Dictionary<string,decimal> RunningCosts,ProfitabilityReport Products,Scenario? Assumptions,decimal? KnownMonthlyCosts,decimal? KnownContribution,List<SetupRequirement> Requirements);
public sealed partial class Store
{
    public static bool CommissionKnown(SalesChannel c)=>c.CommissionConfigured??c.CommissionPercent!=0;
    public FinancialOverview Overview(DateOnly day)
    {
        var b=BusinessAt(day);var missing=new List<string>();var costs=new Dictionary<string,decimal>();var f=b.Forecast;
        if(f==null)missing.Add("Enter an average order value and direct cost per order in Forecast assumptions.");
        else if(!b.ForecastReviewed)missing.Add("Review your direct costs and sales estimates, then confirm the forecast in Forecast assumptions.");
        var shares=b.ForecastShares??[];
        if(shares.Values.Sum()!=100)missing.Add("Choose your selling-channel mix; the shares need to total 100%.");
        foreach(var c in b.Channels.Where(c=>shares.GetValueOrDefault(c.Id)>0&&!CommissionKnown(c)))missing.Add($"Enter {c.Name} commission, or explicitly enter 0 if there is none.");
        var recovery=b.VatRegistered?b.InputRecoveryPercent:0;
        foreach(var e in b.Expenses.Where(e=>e.Attribution=="overhead"))costs[e.Name]=costs.GetValueOrDefault(e.Name)+BusinessRules.Monthly(e,recovery);
        foreach(var t in b.Utilities)if(t.StandingPenceDaily!=0)costs[$"{t.Kind} standing charge"]=costs.GetValueOrDefault($"{t.Kind} standing charge")+BusinessRules.Net(t.StandingPenceDaily/100,t.VatPercent,t.IncludesVat,recovery)*365/12;
        var committedCosts=new Dictionary<string,decimal>(costs);
        var baseFixed=costs.Values.Sum();
        var payrollBudget=b.StaffHoursWeekly*52/12*b.StaffHourlyRate*(1+b.EmployerPercent/100);
        decimal? knownCosts=b.Expenses.Any(e=>e.Attribution=="overhead")||baseFixed!=0||payrollBudget!=0||b.ForecastReviewed ? baseFixed+payrollBudget : null;
        if(f==null&&payrollBudget!=0)costs["Staff budget"]=payrollBudget;
        FinancialModel? model=null;Scenario? composed=null;decimal? knownContribution=null;
        if(f!=null)
        {
            var orders=f.OpenDays.Count*f.TradingWeeks/12*f.OrdersPerEvening;
            costs["Staff not already in direct costs"]=costs.GetValueOrDefault("Staff not already in direct costs")+Math.Max(0,b.StaffHoursWeekly*52/12*b.StaffHourlyRate*(1+b.EmployerPercent/100)-b.DirectLabourPerOrder*orders);
            var gross=f.AverageBasket*(1-f.DiscountPercent/100);var net=b.VatRegistered?gross/(1+f.SalesVatPercent/100):gross;
            var fees=b.Channels.Sum(c=>shares.GetValueOrDefault(c.Id)/100*((c.CommissionBasis=="net"?net:gross)*c.CommissionPercent/100+c.ChargePerUnit*b.ItemsPerOrder)*(1+c.FeeVatPercent/100*(1-recovery/100)));
            var extra=b.Expenses.Where(e=>e.Attribution=="variable").Sum(e=>BusinessRules.Net(e.Amount,e.VatPercent,e.IncludesVat,recovery))*b.ItemsPerOrder;
            composed=f with{Expenses=costs.Select(c=>new Expense(c.Key,c.Value)).ToList(),StaffHoursWeekly=0,StaffHourlyRate=0,EmployerCostPercent=0,OwnerHoursWeekly=b.OwnerHoursWeekly,OwnerHourlyRate=b.OwnerHourlyRate,VatRegistered=b.VatRegistered,RecoverCommissionVat=false,CommissionPercent=0,CommissionVatPercent=0,Channels=null,OtherChargePerOrder=fees+extra+f.OtherChargePerOrder};
            try{
                var result=Costing.Model(composed);
                // At a different order volume, the remaining payroll budget changes too.
                var payroll=b.StaffHoursWeekly*52/12*b.StaffHourlyRate*(1+b.EmployerPercent/100);
                var contribution=net-f.VariableCost-composed.OtherChargePerOrder;
                decimal? Required(decimal target)=>contribution<=0?null:decimal.Ceiling(Math.Max((baseFixed+target)/contribution,(baseFixed+payroll+target)/(contribution+b.DirectLabourPerOrder)));
                var owner=b.OwnerHoursWeekly*52/12*b.OwnerHourlyRate;
                result=result with{RequiredOrders=new(){["Business expenses"]=Required(0),["Expenses + owner"]=Required(owner),["£500 profit after owner"]=Required(owner+500),["£1,000 profit after owner"]=Required(owner+1000),["£2,000 profit after owner"]=Required(owner+2000),["Custom profit after owner"]=Required(owner+f.TargetProfit),["Owner + capital recovery"]=Required(owner+f.InitialInvestment/f.RecoveryMonths)}};
                if(missing.Count==0){model=result;knownContribution=result.ContributionPerOrder;}
            }catch(ValidationException e){missing.Add(e.Message);}
        }
        if(model==null){costs=committedCosts;if(payrollBudget!=0)costs["Staff budget"]=costs.GetValueOrDefault("Staff budget")+payrollBudget;}
        return new(b,model,missing,costs,Profitability(new(day)),composed,model?.FixedCosts??knownCosts,knownContribution,missing.Select(m=>new SetupRequirement(m,m.Contains("commission")?"business:platforms":"business:forecast")).ToList());
    }
    public PriceBreakdown Breakdown(BreakdownRequest request)
    {
        var b=request.Input.Settings??BusinessAt(request.Input.AsOf);var report=Profitability(request.Input);
        var row=report.Products.FirstOrDefault(p=>p.RecipeId==request.RecipeId&&p.ChannelId==request.ChannelId)??throw new ValidationException("This product has no complete ingredient costing on the selected date. Check its recipe and supplier prices.");
        var recipe=PublishedAt(row.RecipeId,request.Input.AsOf).Recipe;var p=b.Products.FirstOrDefault(p=>p.RecipeId==row.RecipeId)??DefaultProduct(recipe,b);var c=b.Channels.Single(c=>c.Id==row.ChannelId);var missing=new List<string>();
        if(!CommissionKnown(c))missing.Add($"{c.Name} commission is not configured. Enter a rate or explicitly confirm zero in Business Settings.");
        if(b.VatRegistered&&p.VatTreatment=="unconfigured")missing.Add("Product VAT treatment has not been reviewed in Product pricing.");
        var uses=p.Equipment??[];
        if(p.EnergyConfirmed==false||(p.EnergyConfirmed==null&&!uses.Any(u=>u.Minutes>0)&&p.WaterLitresPerBatch==0))missing.Add("Production energy is unknown. Review equipment usage or confirm that no energy cost applies in Product pricing.");
        foreach(var use in uses.Where(u=>u.Minutes>0))
        {
            var e=b.Equipment.Single(e=>e.Id==use.EquipmentId);var t=b.Utilities.Single(t=>t.Kind==e.Fuel);
            if(!(t.RateConfigured??t.PencePerUnit!=0))missing.Add($"The {e.Fuel} unit price is missing in Business Settings.");
        }
        if(p.WaterLitresPerBatch>0){var t=b.Utilities.Single(t=>t.Kind=="water");if(!(t.RateConfigured??t.PencePerUnit!=0))missing.Add("The water unit price is missing in Business Settings.");}
        var segments=PriceChart(row,missing.Count==0,out var message);return new(row,missing,segments,message);
    }
    public static List<PriceSegment> PriceChart(ProductEconomics r,bool complete,out string? message)
    {
        message=!complete?"Complete the missing costs before showing a full selling-price chart.":r.Contribution<0?"Direct costs exceed the selling price. A negative remainder cannot be a doughnut segment.":Costing.Money(r.GrossPrice)<=0?"A zero selling price has no percentage breakdown.":null;
        if(message!=null)return [];
        (string Key,string Name,decimal Value)[] parts=[("ingredients","Ingredients",r.Ingredients),("packaging","Packaging",r.Packaging),("energy","Production energy",r.Energy),("other","Other direct costs",r.Labour+r.OtherVariable),("fees",r.Channel+" fees including unrecovered fee VAT",r.PlatformFees),("vat","Sales VAT",r.OutputVat),("contribution","Money left after direct costs",r.Contribution)];
        // Largest-remainder display apportionment keeps both penny and percentage totals exact.
        // The financial engine's unrounded values are returned alongside the display values.
        var cents=parts.Select(p=>decimal.Floor(p.Value*100)).ToArray();var target=Costing.Money(r.GrossPrice)*100;
        foreach(var i in Enumerable.Range(0,parts.Length).OrderByDescending(i=>parts[i].Value*100-cents[i]).Take((int)(target-cents.Sum())))cents[i]++;
        var basis=cents.Select(n=>decimal.Floor(n/target*10000)).ToArray();foreach(var i in Enumerable.Range(0,parts.Length).OrderByDescending(i=>cents[i]/target*10000-basis[i]).Take((int)(10000-basis.Sum())))basis[i]++;
        return Enumerable.Range(0,parts.Length).Where(i=>cents[i]>0).Select(i=>new PriceSegment(parts[i].Key,parts[i].Name,cents[i]/100,basis[i]/100,parts[i].Value)).ToList();
    }
}
