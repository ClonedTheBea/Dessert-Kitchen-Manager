using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace DessertKitchen.Tests;

public class KitchenFactory : WebApplicationFactory<Program>
{
    public string DatabasePath { get; } = Path.Combine(Path.GetTempPath(), "dessert-kitchen-tests", Guid.NewGuid().ToString("N"), "test.db");
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseSetting("DatabasePath", DatabasePath).UseSetting("AllowedHosts", "localhost");
}

public class IntegrationTests
{
    static async Task<HttpClient> Login(KitchenFactory factory)
    {
        var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Kitchen-Request", "1");
        var result = await client.PostAsJsonAsync("/api/auth/setup", new { password = "test-kitchen-password" }); result.EnsureSuccessStatusCode(); return client;
    }
    [Fact] public async Task AuthenticationAndOriginProtection()
    {
        using var factory = new KitchenFactory(); using var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/state")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await anonymous.PostAsJsonAsync("/api/auth/setup", new { password = "test-kitchen-password" })).StatusCode);
        using var client = await Login(factory);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/state")).StatusCode);
        client.DefaultRequestHeaders.Add("Origin", "https://attacker.example");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/scenarios/preview", DomainTests.Baseline())).StatusCode);
    }
    [Fact] public async Task LoginPersistsAndWrongPasswordFails()
    {
        using var factory = new KitchenFactory(); using var owner = await Login(factory);
        using var client = factory.CreateClient(); client.DefaultRequestHeaders.Add("X-Kitchen-Request", "1");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { password = "incorrect" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", new { password = "test-kitchen-password" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/auth/setup", new { password = "different-password" })).StatusCode);
    }
    [Fact] public async Task QuoteChangesNeverRewriteRecipeVersions()
    {
        using var factory = new KitchenFactory(); using var client = await Login(factory);
        var old = (await client.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))![0];
        var quote = DomainTests.Cheese(10) with { IngredientId = "cream-cheese", SupplierId = "sample-supplier", EffectiveDate = new(2026, 1, 2) };
        (await client.PostAsJsonAsync("/api/prices", quote)).EnsureSuccessStatusCode();
        var previewResponse = await client.PostAsJsonAsync("/api/recipes/preview", old.Recipe); previewResponse.EnsureSuccessStatusCode();
        var preview = (await previewResponse.Content.ReadFromJsonAsync<RecipeCost>())!;
        Assert.True(preview.BatchCost > old.Cost.BatchCost);
        var saved = await client.PostAsJsonAsync("/api/recipes", old.Recipe); saved.EnsureSuccessStatusCode();
        var versions = (await client.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))!;
        Assert.Equal(2, versions.Count); Assert.Equal(old.Cost.BatchCost, versions[1].Cost.BatchCost);
        Assert.Equal(2, versions[0].Recipe.Revision);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/recipes", old.Recipe)).StatusCode);
        Assert.Equal(2, (await client.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/lemon-pot/versions"))!.Count);
    }
    [Fact] public async Task RecipeScalingAndCycles()
    {
        using var factory = new KitchenFactory(); using var client = await Login(factory);
        var scaled = await client.PostAsJsonAsync("/api/recipes/lemon-pot/scale", new { yield = 20 }); scaled.EnsureSuccessStatusCode();
        var recipe = (await scaled.Content.ReadFromJsonAsync<RecipeVersion>())!.Recipe;
        Assert.Equal(20, recipe.Yield); Assert.Equal(1500, recipe.Lines.Single(l => l.ReferenceId == "cream-cheese").Quantity);
        var baseRecipe = (await client.GetFromJsonAsync<List<RecipeVersion>>("/api/recipes/cheesecake-base/versions"))![0].Recipe;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/recipes", baseRecipe with { Lines = [new("recipe", "lemon-pot", 1, "each")] })).StatusCode);
    }
    [Fact] public async Task SupplierIngredientAndScenarioPersistence()
    {
        using var factory = new KitchenFactory(); using var client = await Login(factory);
        var supplier = await client.PostAsJsonAsync("/api/suppliers", new Supplier("", 0, "Real test supplier")); supplier.EnsureSuccessStatusCode();
        var savedSupplier = (await supplier.Content.ReadFromJsonAsync<Supplier>())!;
        var ingredient = await client.PostAsJsonAsync("/api/ingredients", new Ingredient("", 0, "New ingredient", "Baking", "", "g", "", "", 50)); ingredient.EnsureSuccessStatusCode();
        var savedIngredient = (await ingredient.Content.ReadFromJsonAsync<Ingredient>())!;
        var p = DomainTests.Cheese() with { IngredientId = savedIngredient.Id, SupplierId = savedSupplier.Id };
        (await client.PostAsJsonAsync("/api/prices", p)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/prices", p with { Unit = "ml" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/ingredients", savedIngredient with { BaseUnit = "kg" })).StatusCode);
        var scenario = DomainTests.Baseline() with { Id = "", Revision = 0, Name = "Alternative", Expenses = [new("Rent", 700)] };
        (await client.PostAsJsonAsync("/api/scenarios", scenario)).EnsureSuccessStatusCode();
        // A separate connection proves records came from SQLite, not a process-memory collection.
        var reopened = new Store(factory.DatabasePath);
        Assert.Contains(reopened.All<Supplier>("supplier"), x => x.Name == savedSupplier.Name);
        Assert.Contains(reopened.All<Ingredient>("ingredient"), x => x.Id == savedIngredient.Id);
        Assert.Contains(reopened.All<Scenario>("scenario"), x => x.Name == "Alternative" && x.Expenses[0].MonthlyAmount == 700);
    }
    [Fact] public async Task BackupCanBeVerifiedAndRestored()
    {
        using var factory = new KitchenFactory(); using var client = await Login(factory);
        var backup = await client.GetByteArrayAsync("/api/backup");
        var file = Path.Combine(Path.GetDirectoryName(factory.DatabasePath)!, "backup.db"); await File.WriteAllBytesAsync(file, backup);
        var destination = Path.Combine(Path.GetDirectoryName(factory.DatabasePath)!, "restored.db");
        Store.Restore(file, destination); var restored = new Store(destination);
        Assert.Equal(9, restored.All<Recipe>("recipe").Count); Assert.True(restored.Verify("test-kitchen-password"));
        Assert.Equal(17, restored.Prices().Count);
    }
    [Fact] public void MigrationsAreRepeatableAndFutureQuotesExcluded()
    {
        var path = Path.Combine(Path.GetTempPath(), "dessert-kitchen-tests", Guid.NewGuid().ToString("N"), "test.db");
        var store = new Store(path); Seed.Run(store); var count = store.Prices().Count;
        var again = new Store(path); Seed.Run(again); Assert.Equal(count, again.Prices().Count);
        again.AddPrice(DomainTests.Cheese(100) with { Id = "future", IngredientId = "cream-cheese", SupplierId = "sample-supplier", EffectiveDate = new(2099, 1, 1), RecordedAt = Store.Now() });
        Assert.Equal(3.25m, again.CurrentPrice("cream-cheese").PackPrice);
    }
}
