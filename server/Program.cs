using System.Net;
using System.Text.Json;
using System.Security.Claims;
using System.Threading.RateLimiting;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
var dataPath = builder.Configuration["DatabasePath"] ?? Path.Combine(builder.Environment.ContentRootPath, "..", "data", "kitchen.db");
Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(dataPath))!);
// This lock is also taken by the offline restore command; a running app can never be restored underneath.
using var processLock = new FileStream(dataPath + ".lock", FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
if (args.Length == 2 && args[0] == "--restore")
{
    Store.Restore(args[1], dataPath);
    Console.WriteLine("Backup verified and restored. The previous database was preserved beside the database file."); return;
}
builder.Services.AddSingleton(new Store(dataPath));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.Cookie.Name = "dessert-kitchen-owner"; o.Cookie.HttpOnly = true; o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest; o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.Events.OnRedirectToLogin = c => { c.Response.StatusCode = 401; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = c => { c.Response.StatusCode = 403; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.AddFixedWindowLimiter("login", p => { p.PermitLimit = 10; p.Window = TimeSpan.FromMinutes(1); p.QueueLimit = 0; });
});
builder.WebHost.ConfigureKestrel(o => o.Limits.MaxRequestBodySize = 1024 * 1024);
var app = builder.Build();
var store = app.Services.GetRequiredService<Store>();
Seed.Run(store);
var writeLock = new object();
app.Use(async (context, next) =>
{
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "same-origin";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
    if (context.Request.Path.StartsWithSegments("/api"))
    {
        context.Response.Headers.CacheControl = "no-store";
        if (context.Request.Method is not ("GET" or "HEAD"))
        {
            var origin = context.Request.Headers.Origin.ToString();
            if (context.Request.Headers["X-Kitchen-Request"] != "1" ||
                (!string.IsNullOrEmpty(origin) && origin != $"{context.Request.Scheme}://{context.Request.Host}"))
            { context.Response.StatusCode = 403; await context.Response.WriteAsJsonAsync(new { error = "Use the application from its own address to make changes." }); return; }
        }
    }
    try { await next(); }
    catch (ValidationException e) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = e.Message }); }
    catch (ConflictException e) { context.Response.StatusCode = 409; await context.Response.WriteAsJsonAsync(new { error = e.Message }); }
    catch (Exception e)
    {
        app.Logger.LogError(e, "Request failed: {Method} {Path}", context.Request.Method, context.Request.Path);
        try
        {
            var logDirectory = Path.Combine(Path.GetDirectoryName(Path.GetFullPath(dataPath))!, "logs");
            Directory.CreateDirectory(logDirectory);
            lock (writeLock) File.AppendAllText(Path.Combine(logDirectory, $"errors-{DateTime.UtcNow:yyyy-MM-dd}.log"),
                $"{DateTimeOffset.UtcNow:O} {context.TraceIdentifier} {context.Request.Method} {context.Request.Path}\n{e}\n\n");
        }
        catch (Exception loggingError) { app.Logger.LogWarning(loggingError, "Could not persist the error log; see console output."); }
        context.Response.StatusCode = 500; await context.Response.WriteAsJsonAsync(new { error = "The operation failed. Your saved records have been retained. Check the server log." });
    }
});
app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
app.MapGet("/api/auth", (HttpContext ctx) => new { configured = store.HasOwner(), authenticated = ctx.User.Identity?.IsAuthenticated == true });
app.MapPost("/api/auth/setup", async (PasswordRequest input, HttpContext ctx) =>
{
    if (ctx.Connection.RemoteIpAddress is not null && !IPAddress.IsLoopback(ctx.Connection.RemoteIpAddress)) return Results.Json(new { error = "First-run setup must be completed on this computer." }, statusCode: 403);
    lock (writeLock) store.CreateOwner(input.Password ?? "");
    await SignIn(ctx); return Results.Ok(new { ok = true });
}).RequireRateLimiting("login");
app.MapPost("/api/auth/login", async (PasswordRequest input, HttpContext ctx) =>
{
    if (!store.Verify(input.Password ?? "")) return Results.Json(new { error = "Incorrect password." }, statusCode: 401);
    await SignIn(ctx); return Results.Ok(new { ok = true });
}).RequireRateLimiting("login");
var api = app.MapGroup("/api").RequireAuthorization();
api.MapInventory(store,writeLock);
api.MapGet("/drafts/{kind}/{id}",(string kind,string id)=>Results.Json(store.Draft(kind,id)));
api.MapPost("/drafts/{kind}/{id}",(string kind,string id,DraftInput input)=>{lock(writeLock)return store.SaveDraft(kind,id,input);});
api.MapPost("/drafts/{kind}/{id}/publish",(string kind,string id,PublishRequest request)=>
{
    lock(writeLock)
    {
        var d=store.Draft(kind,id)??throw new ValidationException("Save the working draft first.");
        if(d.Revision!=request.Revision)throw new ConflictException("The working draft changed. Reload before publishing.");
        if(d.Result!=null)return Results.Json(d.Result);
        if(kind=="recipe")
        {
            var input=d.Body.Deserialize<Recipe>(Store.Json)!;
            var saved=input with{Id=Id(input.Id),Revision=input.Revision+1};
            if(!string.IsNullOrWhiteSpace(saved.VariantOf)){Guard.Require(saved.VariantOf!=saved.Id,"A recipe cannot be its own variant source.");store.Get<Recipe>("recipe",saved.VariantOf);}
            var v=new RecipeVersion(saved,store.Calculate(saved),Store.Now(),store.Assess(saved));
            store.Save("recipe",saved.Id,input.Revision,saved,v,d);return Results.Json(v);
        }
        if(kind=="ingredient-setup")return Results.Json(store.CreateIngredientSetup(d.Body.Deserialize<IngredientSetup>(Store.Json)!,d));
        if(kind=="ingredient")return Results.Json(SaveIngredient(d.Body.Deserialize<Ingredient>(Store.Json)!,d));
        if(kind=="price")
        {
            var p=d.Body.Deserialize<Price>(Store.Json)! with{Id=Guid.NewGuid().ToString("N"),RecordedAt=Store.Now()};
            store.AddPrice(p,d);return Results.Json(p);
        }
        throw new ValidationException("Use the explicit dietary review action for approvals.");
    }
});
api.MapPost("/auth/logout", async (HttpContext ctx) => { await ctx.SignOutAsync(); return Results.Ok(); });
api.MapGet("/state", () => new {
    suppliers = store.All<Supplier>("supplier"), ingredients = store.All<Ingredient>("ingredient").Select(store.EffectiveIngredient), prices = store.Prices(),
    unitCosts = store.Prices().ToDictionary(p => p.Id, p => {
        var dimension = Units.Definition(p.Unit).Dimension;
        var unit = dimension == "mass" ? "g" : dimension == "volume" ? "ml" : "each";
        var bulkUnit = dimension == "mass" ? "kg" : dimension == "volume" ? "l" : "each";
        return new { unit, cost = Costing.IngredientCost(p, 1, unit, 0), bulkUnit, bulkCost = Costing.IngredientCost(p, 1, bulkUnit, 0) };
    }),
    recipes = store.All<Recipe>("recipe").Select(r => store.Latest(r.Id)), scenarios = store.All<Scenario>("scenario"),
    allergenCatalogue = AllergenRules.Catalogue,
    recipeSafety = store.All<Recipe>("recipe").ToDictionary(r=>r.Id,r=>store.Safety(r)),
    pricePolicy = "Latest effective supplier quote; future-dated quotes are excluded. Saved recipes retain their price snapshot."
});
api.MapPost("/suppliers", (Supplier input) =>
{
    Guard.Text(input.Name, "Supplier name"); Guard.Require(input.Contact.Length <= 500 && input.Notes.Length <= 5000, "Supplier details are too long.");
    var saved = input with { Id = Id(input.Id), Revision = input.Revision + 1 };
    lock (writeLock) store.Save("supplier", saved.Id, input.Revision, saved); return saved;
});
api.MapPost("/ingredients", (Ingredient input) => SaveIngredient(input));
api.MapPost("/prices/preview", (Price input) =>
{
    Guard.Require(input.PackQuantity>0&&input.PackQuantity<=1000000,"Pack quantity must be positive.");
    Guard.Amount(input.PackPrice,"Pack price");Guard.Amount(input.VatRate,"VAT rate",100);
    Units.Definition(input.Unit);
    var unit=input.Unit=="kg"?"g":input.Unit=="l"?"ml":input.Unit;
    return new { unit, cost=Costing.IngredientCost(input,1,unit,0) };
});
api.MapPost("/prices", (Price input) =>
{
    var saved = input with { Id = Guid.NewGuid().ToString("N"), RecordedAt = Store.Now() };
    lock (writeLock) store.AddPrice(saved); return saved;
});
api.MapPost("/recipes/preview", (Recipe input) => { lock (writeLock) return store.Calculate(input); });
api.MapPost("/recipes", (Recipe input) =>
{
    lock (writeLock)
    {
        var saved = input with { Id = Id(input.Id), Revision = input.Revision + 1 };
        if(!string.IsNullOrWhiteSpace(saved.VariantOf)) { Guard.Require(saved.VariantOf!=saved.Id,"A recipe cannot be its own variant source.");store.Get<Recipe>("recipe",saved.VariantOf); }
        var version = new RecipeVersion(saved, store.Calculate(saved), Store.Now(),store.Assess(saved));
        store.Save("recipe", saved.Id, input.Revision, saved, version); return version;
    }
});
api.MapGet("/recipes/{id}/versions", (string id) => store.Versions(id));
api.MapPost("/recipes/allergens/preview", (Recipe input)=> { lock(writeLock) return store.Assess(input); });
api.MapPost("/recipes/{id}/reviews",(string id,DietaryReview input)=> { lock(writeLock) return store.AddReview(id,input); });
api.MapGet("/allergens/export",()=>Results.File(System.Text.Encoding.UTF8.GetBytes(store.AllergenCsv()),"text/csv; charset=utf-8","kitchen-allergen-matrix.csv"));
api.MapGet("/records/{kind}/{id}/dependencies",(string kind,string id)=>store.Dependencies(kind,id));
api.MapPost("/records/{kind}/{id}/manage",(string kind,string id,ManagementRequest input)=>
{
    lock(writeLock)
    {
        Guard.Require(kind is "ingredient" or "supplier","Choose an ingredient or supplier.");
        Guard.Require(input.Action is "archive" or "restore" or "delete","Choose archive, restore or delete.");
        if(input.Action=="delete") store.DeleteUnused(kind,id,input.Revision);
        else if(kind=="ingredient") { var item=store.Get<Ingredient>(kind,id); store.Save(kind,id,input.Revision,item with {Revision=input.Revision+1,Archived=input.Action=="archive"}); }
        else { var item=store.Get<Supplier>(kind,id); store.Save(kind,id,input.Revision,item with {Revision=input.Revision+1,Archived=input.Action=="archive"}); }
        return Results.Ok(new {ok=true});
    }
});
api.MapPost("/recipes/{id}/scale", (string id, ScaleRequest request) =>
{
    Guard.Require(request.Yield > 0 && request.Yield <= 1000000, "Scaled yield must be positive and no more than 1,000,000.");
    var original = store.Get<Recipe>("recipe", id); var factor = request.Yield / original.Yield;
    var recipe = original with { Yield = request.Yield, Lines = original.Lines.Select(l => l with { Quantity = l.Quantity * factor }).ToList(), LabourMinutes = original.LabourMinutes * factor };
    lock (writeLock) return new RecipeVersion(recipe, store.Calculate(recipe), Store.Now());
});
api.MapPost("/scenarios/preview", (Scenario input) => Costing.Model(input));
api.MapPost("/scenarios/compare",(ComparisonRequest input)=> {
    var other=store.Get<Scenario>("scenario",input.OtherId); var a=Costing.Model(input.Current);var b=Costing.Model(other);
    var differences=new Dictionary<string,decimal?> { ["grossSales"]=a.GrossSales-b.GrossSales,["contribution"]=a.Contribution-b.Contribution,["fixedCosts"]=a.FixedCosts-b.FixedCosts,["operatingProfit"]=a.OperatingProfit-b.OperatingProfit,["ownerCompensation"]=a.OwnerCompensation-b.OwnerCompensation,["afterCapitalRecovery"]=a.AfterCapitalRecovery-b.AfterCapitalRecovery };
    foreach(var key in new[]{"Business expenses","Expenses + owner"}) differences[key]=a.RequiredOrders[key]-b.RequiredOrders[key];
    return new {scenario=other,model=b,differences};
});
api.MapPost("/scenarios", (Scenario input) =>
{
    Costing.Model(input); var saved = input with { Id = Id(input.Id), Revision = input.Revision + 1 };
    lock (writeLock) store.Save("scenario", saved.Id, input.Revision, saved); return saved;
});
api.MapGet("/backup", () => { lock (writeLock) return Results.File(store.Backup(), "application/vnd.sqlite3", $"dessert-kitchen-{DateTime.UtcNow:yyyy-MM-dd-HHmmss}.db"); });
app.UseDefaultFiles(); app.UseStaticFiles();
app.MapFallbackToFile("index.html");
app.Run();

Ingredient SaveIngredient(Ingredient input,WorkingDraft? draft=null)
{
    Guard.Text(input.Name, "Ingredient name"); Guard.Text(input.Category, "Category"); Units.Definition(input.BaseUnit);
    Guard.Amount(input.MinimumStock, "Minimum stock");
    AllergenRules.Validate(input.AllergenInfo);
    var saved = input with { Id = Id(input.Id), Revision = input.Revision + 1 };
    lock (writeLock)
    {
        if (input.Revision > 0)
        {
            var old = store.Get<Ingredient>("ingredient", input.Id);
            Guard.Require(old.BaseUnit == saved.BaseUnit && old.IsPackaging == saved.IsPackaging, "Base unit and stock type cannot change after creation. Create a new item for a different unit or type.");
        }
        if(saved.AllergenInfo is { Verification:"verified" } info)
        {
            var source=store.PriceSource(saved.Id);
            // A carried-over verification for a different product source cannot be silently rebound.
            saved=saved with {AllergenInfo=info.VerifiedPriceSource!=null && info.VerifiedPriceSource!=source
                ? info with {Verification="unverified"} : info with {VerifiedPriceSource=source}};
        }
        store.Save("ingredient", saved.Id, input.Revision, saved,draft:draft);
    }
    return saved;
}

static string Id(string? id) => string.IsNullOrWhiteSpace(id) ? Guid.NewGuid().ToString("N") : id;
static Task SignIn(HttpContext ctx) => ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "owner"), new Claim(ClaimTypes.Name, "Kitchen owner")], CookieAuthenticationDefaults.AuthenticationScheme)));
public record PasswordRequest(string? Password);
public record ScaleRequest(decimal Yield);
public record ManagementRequest(string Action,int Revision);
public record ComparisonRequest(Scenario Current,string OtherId);
public record PublishRequest(int Revision);
public partial class Program { }
