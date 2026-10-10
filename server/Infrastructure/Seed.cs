using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;

public static class Seed
{
    public static void Run(Store store)
    {
        if (store.All<Supplier>("supplier").Count > 0) return;
        store.Save("supplier", "sample-supplier", 0, new Supplier("sample-supplier", 1, "Example grocery supplier", "", "Illustrative prices — replace with your supplier quotes."));
        var items = new (string Id, string Name, string Category, decimal Quantity, string Unit, decimal Price, string Allergens)[] {
            ("cream-cheese", "Cream cheese", "Dairy", 280, "g", 3.25m, "Milk"),
            ("cream", "Double cream", "Dairy", 600, "ml", 2.80m, "Milk"),
            ("biscuits", "Digestive biscuits", "Bakery", 400, "g", 1.50m, "Wheat, milk"),
            ("butter", "Unsalted butter", "Dairy", 250, "g", 2.25m, "Milk"),
            ("sugar", "Caster sugar", "Baking", 1000, "g", 1.65m, ""),
            ("lemon", "Lemon juice", "Fruit", 250, "ml", 1.20m, ""),
            ("biscoff", "Biscoff spread", "Toppings", 400, "g", 3.20m, "Wheat, soya"),
            ("strawberry", "Strawberry compote", "Fruit", 500, "g", 3.50m, ""),
            ("chocolate", "Dark chocolate", "Baking", 500, "g", 4.50m, "Soya; check milk traces"),
            ("flour", "Plain flour", "Baking", 1500, "g", 1.50m, "Wheat"),
            ("eggs", "Eggs", "Dairy", 12, "each", 3.00m, "Egg"),
            ("oreo", "Oreo biscuits", "Toppings", 154, "g", 1.25m, "Wheat, soya"),
            ("milk", "Whole milk", "Dairy", 2000, "ml", 1.65m, "Milk"),
            ("ice-cream", "Vanilla ice cream", "Frozen", 1000, "ml", 3.00m, "Milk"),
            ("pot", "Dessert pot & lid", "Packaging", 50, "each", 8.00m, ""),
            ("box", "Dessert box", "Packaging", 50, "each", 10.00m, ""),
            ("cup", "Shake cup & lid", "Packaging", 50, "each", 9.00m, "")
        };
        foreach (var i in items)
        {
            store.Save("ingredient", i.Id, 0, new Ingredient(i.Id, 1, i.Name, i.Category, "Illustrative starting ingredient; verify supplier specifications and allergens.", i.Unit, "", i.Allergens, 0, i.Category == "Packaging"));
            store.AddPrice(new(Guid.NewGuid().ToString("N"), i.Id, "sample-supplier", i.Quantity, i.Unit, i.Price, 0, true, false, "", new DateOnly(2026, 1, 1), true, Store.Now()));
        }
        RecipeLine L(string id, decimal q, string unit) => new("ingredient", id, q, unit);
        void R(string id, string name, string category, decimal yield, decimal sell, params RecipeLine[] lines)
        {
            var r = new Recipe(id, 1, name, category, "Illustrative test recipe — adapt quantities, allergens and process before food production.", yield, "each", 0, "g", 20, 0, "Set verified storage instructions before production.", 0, "Verify all supplier labels and cross-contact risks.", 0, 0, sell, 70, lines.ToList());
            r=r with { IsSellable=category!="Sub-recipes",MethodSteps=[] };
            store.Save("recipe", id, 0, r, new(r, store.Calculate(r), Store.Now(),store.Assess(r)));
        }
        R("cheesecake-base", "Cheesecake biscuit base", "Sub-recipes", 5, 0, L("biscuits", 150, "g"), L("butter", 60, "g"));
        RecipeLine Base() => new("recipe", "cheesecake-base", 5, "each");
        R("lemon-pot", "Lemon cheesecake pot", "Cheesecakes", 5, 5.95m, Base(), L("cream-cheese", 375, "g"), L("cream", 200, "ml"), L("sugar", 75, "g"), L("lemon", 50, "ml"), L("pot", 5, "each"));
        R("biscoff-pot", "Biscoff cheesecake pot", "Cheesecakes", 5, 6.50m, Base(), L("cream-cheese", 375, "g"), L("cream", 200, "ml"), L("biscoff", 150, "g"), L("pot", 5, "each"));
        R("strawberry-pot", "Strawberry cheesecake pot", "Cheesecakes", 5, 6.25m, Base(), L("cream-cheese", 375, "g"), L("cream", 200, "ml"), L("sugar", 75, "g"), L("strawberry", 150, "g"), L("pot", 5, "each"));
        R("brownie", "Classic chocolate brownie", "Brownies", 12, 4.50m, L("chocolate", 250, "g"), L("butter", 200, "g"), L("sugar", 250, "g"), L("eggs", 4, "each"), L("flour", 125, "g"), L("box", 12, "each"));
        R("oreo-brownie", "Oreo brownie", "Brownies", 12, 4.95m, L("chocolate", 250, "g"), L("butter", 200, "g"), L("sugar", 250, "g"), L("eggs", 4, "each"), L("flour", 125, "g"), L("oreo", 154, "g"), L("box", 12, "each"));
        R("cookie-dough", "Chocolate chip cookie dough", "Cookie dough", 5, 6.50m, L("flour", 250, "g"), L("butter", 125, "g"), L("sugar", 150, "g"), L("chocolate", 100, "g"), L("eggs", 1, "each"), L("box", 5, "each"));
        R("waffle", "Belgian waffle", "Waffles", 5, 6.95m, L("flour", 250, "g"), L("milk", 300, "ml"), L("eggs", 2, "each"), L("butter", 75, "g"), L("sugar", 50, "g"), L("box", 5, "each"));
        R("milkshake", "Chocolate milkshake", "Milkshakes", 5, 5.50m, L("milk", 1000, "ml"), L("ice-cream", 750, "ml"), L("chocolate", 100, "g"), L("cup", 5, "each"));
        var scenario = new Scenario("baseline", 1, "Opening plan", [new("Premises rent", 625), new("Other fixed costs", 750)], [4, 5, 6, 0], "18:00", "23:00", 21, 5, 30, 20, false, false, 0, 0, 20, 20, 12, 5000, 24, 1000);
        store.Save("scenario", scenario.Id, 0, scenario);
    }
}
