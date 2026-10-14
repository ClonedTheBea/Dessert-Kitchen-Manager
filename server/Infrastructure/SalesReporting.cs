using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;
public sealed partial class Store {
 public object SalesReport(DateOnly from,DateOnly to){
  Guard.Require(from!=default&&to>=from&&to.DayNumber-from.DayNumber<=3660,"Choose a date range up to ten years.");var all=Orders().Where(o=>o.Status=="completed").ToList();
  DateOnly Day(SaleOrder o)=>DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTimeOffset.Parse(o.RecordedAt),"GMT Standard Time").Date);
  decimal Revenue(SaleOrder o)=>o.Total-o.Refunds;
  decimal? Fee(SaleOrder o)=>o.ReportedFees??o.ExpectedFees;
  decimal? Owed(SaleOrder o)=>o.Total-o.Refunds+o.Adjustments-o.OtherFees-Fee(o);
  var rows=all.Where(o=>Day(o)>=from&&Day(o)<=to).ToList();var day=AllergenRules.Today();var week=day.AddDays(-(((int)day.DayOfWeek+6)%7));var month=new DateOnly(day.Year,day.Month,1);
  var payouts=Payouts();var active=payouts.Where(p=>!payouts.Any(c=>c.Input.Corrects==p.Input.Id)).ToList();var platform=all.Where(o=>o.ChannelId!="direct").ToList();var groups=active.Where(p=>p.Input.ChannelId!="direct").GroupBy(p=>PayoutGroup(p.Input)).ToList();var matched=groups.SelectMany(g=>g.Last().Input.OrderIds).ToHashSet();var expected=TotalValue(platform.Where(o=>!matched.Contains(o.Id)).Select(Owed).Concat(groups.Select(g=>CurrentPayoutExpected(g.Last()))));var bank=active.Where(p=>p.Input.ChannelId!="direct").Sum(p=>p.Input.Actual);
  var products=rows.SelectMany(o=>o.Lines.Select(l=>new{o,l})).GroupBy(x=>string.IsNullOrEmpty(x.l.RecipeId)?"unmapped:"+x.l.Name:x.l.RecipeId).Select(g=>{
   var revenue=g.Sum(x=>x.l.Gross-x.l.Discount-(x.o.Total==0?0:x.o.Refunds*(x.l.Gross-x.l.Discount)/x.o.Total));
   var fees=TotalValue(g.Select(x=>Fee(x.o)==null?null:x.o.Total==0?Fee(x.o)/x.o.Lines.Count:Fee(x.o)*(x.l.Gross-x.l.Discount)/x.o.Total));
   var inventory=TotalValue(g.Select(x=>x.l.InventoryCost));var recipe=TotalValue(g.Select(x=>x.l.EstimatedRecipeCost));var cost=TotalValue(g.Select(x=>x.l.InventoryCost??x.l.EstimatedRecipeCost));
   var vat=TotalValue(g.Select(x=>x.l.OutputVat==null?null:x.o.Total==0?0:x.l.OutputVat*(1-x.o.Refunds/x.o.Total)));
   var other=g.Sum(x=>x.o.Total==0?x.o.OtherFees/x.o.Lines.Count:x.o.OtherFees*(x.l.Gross-x.l.Discount)/x.o.Total);
   var contribution=revenue-vat-cost-fees-other;
   return new{name=g.First().l.Name,units=g.Any(x=>x.l.Quantity==0)?(decimal?)null:g.Sum(x=>x.l.Quantity),revenue,inventoryCost=inventory,estimatedRecipeCost=recipe,costStatus=g.All(x=>x.l.InventoryCost!=null&&x.l.CostStatus=="known")?"Recorded batch costs":"Includes estimated or missing costs",fees,contribution,contributionPercent=revenue==0?null:contribution/revenue*100};
  }).OrderByDescending(p=>p.units).ToList();
  var forecast=Overview(day).Model;var thisMonth=all.Where(o=>Day(o)>=month&&Day(o)<=day).ToList();
  return new{from,to,orders=rows.Count,revenue=rows.Sum(Revenue),refunds=rows.Sum(o=>o.Refunds),averageOrder=rows.Count==0?0:rows.Average(o=>o.Total),today=all.Where(o=>Day(o)==day).Sum(Revenue),week=all.Where(o=>Day(o)>=week&&Day(o)<=day).Sum(Revenue),month=thisMonth.Sum(Revenue),expectedFees=TotalValue(rows.Select(o=>o.ExpectedFees)),reportedFees=TotalValue(rows.Select(o=>o.ReportedFees)),unknownFeeOrders=rows.Count(o=>Fee(o)==null),awaitingPayout=expected-bank,bankReceived=bank,products,daily=rows.GroupBy(Day).OrderBy(g=>g.Key).Select(g=>new{date=g.Key,sales=g.Sum(Revenue)}),channels=rows.GroupBy(o=>o.Channel).Select(g=>new{channel=g.Key,sales=g.Sum(Revenue),fees=TotalValue(g.Select(Fee)),orders=g.Count()}),comparison=new{actualOrders=thisMonth.Count,forecastOrders=forecast?.MonthlyOpenDays*(BusinessAt(day).Forecast?.OrdersPerEvening??0),actualNetRevenue=TotalValue(thisMonth.Select(o=>o.OutputVat==null?null:Revenue(o)-(o.Total==0?0:o.OutputVat*(1-o.Refunds/o.Total)))),forecastNetRevenue=forecast?.NetSales},reportedPayoutCommission=TotalValue(active.GroupBy(p=>PayoutGroup(p.Input)).Select(g=>g.Last().Input.Commission)),reconciledGroups=active.GroupBy(p=>PayoutGroup(p.Input)).Count(g=>CurrentPayoutExpected(g.Last())==g.Sum(p=>p.Input.Actual))};
 }
}
