using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
namespace DessertKitchen;
public static class BusinessEndpoints
{
    public static void MapBusiness(this RouteGroupBuilder api, Store store, object gate)
    {
        api.MapGet("/business", () => store.CurrentBusiness());
        api.MapGet("/business/history", () => store.BusinessHistory());
        api.MapPost("/business", (BusinessSettings input) => { lock (gate) return store.SaveBusiness(input); });
        api.MapGet("/profitability/context", (DateOnly? date) =>
        {
            lock (gate)
            {
                var day = date ?? AllergenRules.Today();
                var settings = store.BusinessAt(day);
                var recipes = store.ProfitRecipes(day);
                var operations = store.StockOperations(); // Newest first, from the inventory service.
                var reversed = operations.Where(o => o.Reverses != null).Select(o => o.Reverses).ToHashSet();
                return new { settings, recipes, report = store.Profitability(new(day)), scenarios = store.All<ProfitScenario>("profit-scenario"), actualBatches = operations.Where(o => o.Type == "production" && !reversed.Contains(o.Id)).Take(30) };
            }
        });
        api.MapPost("/profitability/preview", (ProfitabilityRequest input) => { lock (gate) return store.Profitability(input); });
        api.MapPost("/profitability/planner-scenario", (ProfitabilityRequest input) => { lock (gate) return store.PlannerFromBusiness(input); });
        api.MapPost("/profitability/scenarios", (ProfitScenario input) => { lock (gate) return store.SaveProfitScenario(input); });
    }
}
