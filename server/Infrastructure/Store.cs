using System.Security.Cryptography;
using System.Text.Json;
using DessertKitchen.Domain;
using Microsoft.Data.Sqlite;

namespace DessertKitchen.Infrastructure;

public sealed partial class Store
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    readonly string path;
    public Store(string path)
    {
        this.path = Path.GetFullPath(path);
        Directory.CreateDirectory(Path.GetDirectoryName(this.path)!);
        using var db = Open();
        Execute(db, null, "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
        bool backedUp = false;
        foreach (var file in Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "Migrations"), "*.sql").Order())
        {
            var version = int.Parse(Path.GetFileName(file).Split('_')[0]);
            using var check = Command(db, null, "SELECT count(*) FROM schema_migrations WHERE version=$v", ("$v", version));
            if ((long)check.ExecuteScalar()! > 0) continue;
            if(version > 1 && !backedUp)
            {
                using var populated=Command(db,null,"SELECT count(*) FROM documents");
                if((long)populated.ExecuteScalar()!>0)
                {
                    var directory=Path.Combine(Path.GetDirectoryName(this.path)!,"backups"); Directory.CreateDirectory(directory);
                    File.WriteAllBytes(Path.Combine(directory,$"before-migration-{version}-{DateTime.UtcNow:yyyyMMdd-HHmmssfff}.db"),Backup());
                }
                backedUp=true;
            }
            using var tx = db.BeginTransaction();
            Execute(db, tx, File.ReadAllText(file));
            Execute(db, tx, "INSERT INTO schema_migrations VALUES($v,$at)", ("$v", version), ("$at", Now()));
            tx.Commit();
        }
    }
    public static string Now() => DateTimeOffset.UtcNow.ToString("O");
    public SqliteConnection Open()
    {
        var db = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = path, ForeignKeys = true, DefaultTimeout = 15 }.ToString());
        db.Open(); return db;
    }
    static SqliteCommand Command(SqliteConnection db, SqliteTransaction? tx, string sql, params (string Key, object Value)[] args)
    {
        var cmd = db.CreateCommand(); cmd.Transaction = tx; cmd.CommandText = sql;
        foreach (var (key, value) in args) cmd.Parameters.AddWithValue(key, value);
        return cmd;
    }
    static void Execute(SqliteConnection db, SqliteTransaction? tx, string sql, params (string Key, object Value)[] args)
    { using var cmd = Command(db, tx, sql, args); cmd.ExecuteNonQuery(); }
    public List<T> All<T>(string kind)
    {
        using var db = Open(); using var cmd = Command(db, null, "SELECT body FROM documents WHERE kind=$kind ORDER BY rowid", ("$kind", kind));
        using var reader = cmd.ExecuteReader(); var list = new List<T>();
        while (reader.Read()) list.Add(JsonSerializer.Deserialize<T>(reader.GetString(0), Json)!);
        return list;
    }
    public T Get<T>(string kind, string id) => All<T>(kind).FirstOrDefault(x => JsonSerializer.SerializeToElement(x, Json).GetProperty("id").GetString() == id)
        ?? throw new ValidationException($"The {kind} record no longer exists.");
    public void Save<T>(string kind, string id, int expectedRevision, T value, RecipeVersion? version = null, WorkingDraft? draft = null)
    {
        using var db = Open(); using var tx = db.BeginTransaction();
        using var check = Command(db, tx, "SELECT revision FROM documents WHERE kind=$kind AND id=$id", ("$kind", kind), ("$id", id));
        var existing = check.ExecuteScalar();
        if(existing is long revision && revision==expectedRevision+1 && version==null)
        {
            using var retry=Command(db,tx,"SELECT body FROM documents WHERE kind=$kind AND id=$id",("$kind",kind),("$id",id));
            if((string?)retry.ExecuteScalar()==JsonSerializer.Serialize(value,Json))return;
        }
        if ((existing == null && expectedRevision != 0) || (existing != null && (long)existing != expectedRevision))
            throw new ConflictException("This record changed in another window. Reload it before saving.");
        Execute(db, tx, "INSERT INTO documents VALUES($kind,$id,$revision,$body) ON CONFLICT(kind,id) DO UPDATE SET revision=$revision,body=$body",
            ("$kind", kind), ("$id", id), ("$revision", expectedRevision + 1), ("$body", JsonSerializer.Serialize(value, Json)));
        if (version != null) Execute(db, tx, "INSERT INTO recipe_versions VALUES($id,$v,$at,$body)",
            ("$id", id), ("$v", expectedRevision + 1), ("$at", version.RecordedAt), ("$body", JsonSerializer.Serialize(version, Json)));
        CompleteDraft(db,tx,draft,(object?)version??value!);
        Audit(db, tx, $"save:{kind}:v{expectedRevision + 1}", id); tx.Commit();
    }
    static void Audit(SqliteConnection db, SqliteTransaction tx, string action, string id) => Execute(db, tx,
        "INSERT INTO audit(occurred_at,action,entity_id) VALUES($at,$action,$id)", ("$at", Now()), ("$action", action), ("$id", id));
    public void AddPrice(Price p,WorkingDraft? draft=null)
    {
        var ingredient = Get<Ingredient>("ingredient", p.IngredientId); var supplier=Get<Supplier>("supplier", p.SupplierId);
        Guard.Require(!ingredient.Archived && !supplier.Archived,"Restore the archived ingredient or supplier before adding a new price.");
        Guard.Require(p.PackQuantity > 0 && p.PackQuantity <= 1000000, "Pack quantity must be positive.");
        Units.Convert(p.PackQuantity, p.Unit, ingredient.BaseUnit);
        Guard.Amount(p.PackPrice, "Pack price"); Guard.Amount(p.VatRate, "VAT rate", 100);
        Guard.Require(p.EffectiveDate != default, "Price effective date is required.");
        using var db = Open(); using var tx = db.BeginTransaction();
        Execute(db, tx, "INSERT INTO prices VALUES($id,$ingredient,$at,$body)", ("$id", p.Id), ("$ingredient", p.IngredientId),
            ("$at", p.RecordedAt), ("$body", JsonSerializer.Serialize(p, Json)));
        CompleteDraft(db,tx,draft,p);
        Audit(db, tx, "add:price", p.Id); tx.Commit();
    }
    public List<Price> Prices()
    {
        using var db = Open(); using var cmd = Command(db, null, "SELECT body FROM prices ORDER BY recorded_at DESC");
        using var reader = cmd.ExecuteReader(); var list = new List<Price>();
        while (reader.Read()) list.Add(JsonSerializer.Deserialize<Price>(reader.GetString(0), Json)!); return list;
    }
    public Price CurrentPrice(string id) => Prices().Where(x => x.IngredientId == id && x.EffectiveDate <= DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeBySystemTimeZoneId(DateTime.UtcNow, "GMT Standard Time")))
        .OrderByDescending(x => x.EffectiveDate).ThenByDescending(x => x.RecordedAt).FirstOrDefault()
        ?? throw new ValidationException($"Add a current supplier price for {Get<Ingredient>("ingredient", id).Name} first.");
    public List<RecipeVersion> Versions(string id)
    {
        using var db = Open(); using var cmd = Command(db, null, "SELECT body FROM recipe_versions WHERE recipe_id=$id ORDER BY version DESC", ("$id", id));
        using var reader = cmd.ExecuteReader(); var list = new List<RecipeVersion>();
        while (reader.Read()) list.Add(JsonSerializer.Deserialize<RecipeVersion>(reader.GetString(0), Json)!); return list;
    }
    public RecipeVersion Latest(string id) => Versions(id).FirstOrDefault() ?? throw new ValidationException("Sub-recipe not found.");
    public RecipeCost Calculate(Recipe recipe)
    {
        var original=All<Recipe>("recipe").FirstOrDefault(r=>r.Id==recipe.Id);
        foreach(var line in recipe.Lines.Where(l=>l.Kind=="ingredient"))
            Guard.Require(!Get<Ingredient>("ingredient",line.ReferenceId).Archived || original?.Lines.Any(l=>l.Kind=="ingredient" && l.ReferenceId==line.ReferenceId)==true,"Archived ingredients cannot be added to a new recipe. Restore the ingredient first.");
        void Visit(string id, HashSet<string> chain)
        {
            Guard.Require(chain.Count < 40 && chain.Add(id), "Sub-recipes form a cycle or exceed 40 nesting levels.");
            var r = id == recipe.Id ? recipe : Get<Recipe>("recipe", id);
            foreach (var line in r.Lines.Where(x => x.Kind == "recipe")) Visit(line.ReferenceId, new(chain));
        }
        Visit(recipe.Id, []);
        return Costing.Recipe(recipe, id => Get<Ingredient>("ingredient", id), CurrentPrice, Latest);
    }
    public bool HasOwner() { using var db = Open(); using var cmd = Command(db, null, "SELECT count(*) FROM owner"); return (long)cmd.ExecuteScalar()! != 0; }
    public void CreateOwner(string password)
    {
        Guard.Require(password.Length >= 12 && password.Length <= 200, "Choose a password with 12–200 characters.");
        var salt = RandomNumberGenerator.GetBytes(32); var hash = Hash(password, salt);
        using var db = Open(); using var tx = db.BeginTransaction();
        using var check = Command(db, tx, "SELECT count(*) FROM owner");
        if ((long)check.ExecuteScalar()! != 0) throw new ConflictException("An owner account already exists.");
        Execute(db, tx, "INSERT INTO owner VALUES(1,$salt,$hash)", ("$salt", Convert.ToBase64String(salt)), ("$hash", Convert.ToBase64String(hash)));
        Audit(db, tx, "owner:created", "1"); tx.Commit();
    }
    static byte[] Hash(string password, byte[] salt) => Rfc2898DeriveBytes.Pbkdf2(password, salt, 600000, HashAlgorithmName.SHA256, 32);
    public bool Verify(string password)
    {
        if (password.Length > 200) return false;
        using var db = Open(); using var cmd = Command(db, null, "SELECT salt,hash FROM owner WHERE id=1"); using var reader = cmd.ExecuteReader();
        if (!reader.Read()) return false;
        return CryptographicOperations.FixedTimeEquals(Hash(password, Convert.FromBase64String(reader.GetString(0))), Convert.FromBase64String(reader.GetString(1)));
    }
    public byte[] Backup()
    {
        var temp = Path.GetTempFileName();
        try
        {
            using (var source = Open()) using (var dest = new SqliteConnection($"Data Source={temp};Pooling=False"))
            { dest.Open(); source.BackupDatabase(dest); }
            return File.ReadAllBytes(temp);
        }
        finally { File.Delete(temp); }
    }
    public static void Restore(string sourcePath, string destinationPath)
    {
        Guard.Require(File.Exists(sourcePath), "Backup file not found.");
        Guard.Require(Path.GetFullPath(sourcePath) != Path.GetFullPath(destinationPath), "Choose a different backup file.");
        using var source = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = sourcePath, Mode = SqliteOpenMode.ReadOnly, Pooling = false }.ToString()); source.Open();
        using var check = Command(source, null, "PRAGMA integrity_check"); Guard.Require((string?)check.ExecuteScalar() == "ok", "Backup integrity check failed.");
        using var schema = Command(source, null, "SELECT max(version) FROM schema_migrations"); var version=Convert.ToInt32(schema.ExecuteScalar()); Guard.Require(version is 1 or 2 or 3 or 4 or 5, "Unsupported backup schema version.");
        if(version>=5)foreach(var table in new[]{"sales_orders","sales_events","sales_production_links","sales_payouts","sales_imports"}){using var checkTable=Command(source,null,$"SELECT count(*) FROM {table}");checkTable.ExecuteScalar();}
        if(version>=4)foreach(var table in new[]{"inventory_locations","inventory_operations","inventory_lots","inventory_movements","inventory_stocktakes"}){using var checkTable=Command(source,null,$"SELECT count(*) FROM {table}");checkTable.ExecuteScalar();}
        if(version>=3){using var drafts=Command(source,null,"SELECT count(*) FROM working_drafts");drafts.ExecuteScalar();}
        foreach (var table in new[] { "documents", "prices", "recipe_versions", "owner", "audit" })
        { using var validate = Command(source, null, $"SELECT count(*) FROM {table}"); validate.ExecuteScalar(); }
        if(version>=2)
        {
            foreach(var table in new[]{"record_dependencies","dietary_reviews"}) {using var validate=Command(source,null,$"SELECT count(*) FROM {table}");validate.ExecuteScalar();}
            using var fk=Command(source,null,"PRAGMA foreign_key_check");using var violations=fk.ExecuteReader();Guard.Require(!violations.Read(),"Backup contains broken record references.");
        }
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(destinationPath))!);
        if (File.Exists(destinationPath)) File.Copy(destinationPath, destinationPath + ".before-restore-" + DateTime.UtcNow.ToString("yyyyMMddHHmmssfff"));
        using var destination = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = destinationPath, Pooling = false }.ToString()); destination.Open();
        source.BackupDatabase(destination);
    }
}
