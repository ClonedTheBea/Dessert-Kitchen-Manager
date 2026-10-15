using System.Text.Json;
using DessertKitchen.Domain;
using DessertKitchen.Infrastructure;
using Xunit;
namespace DessertKitchen.Tests;
public class StockReviewTests
{
    [Fact] public void PurchaseDiscardRetainsAuditRejectsStaleEditsAndDoesNotReceiveStock()
    {
        var s=Kitchen();var purchase=Purchase(Line());
        var draft=s.SaveDraft("inventory-purchase","current",new(0,JsonSerializer.SerializeToElement(purchase,Store.Json),Id()));
        Assert.Throws<ConflictException>(()=>s.DiscardPurchaseDraft("current",0));
        s.DiscardPurchaseDraft("current",draft.Revision);s.DiscardPurchaseDraft("current",draft.Revision);
        var closed=s.Draft("inventory-purchase","current")!;
        Assert.True(closed.Result!.Value.GetProperty("discarded").GetBoolean());
        Assert.Equal(draft.Body.GetRawText(),closed.Body.GetRawText());
        Assert.Throws<ConflictException>(()=>s.SaveDraft("inventory-purchase","current",new(draft.Revision,draft.Body,Id())));
        Assert.Empty(s.StockOperations());Assert.Empty(s.StockLots());
        var next=s.SaveDraft("inventory-purchase","current",new(closed.Revision,JsonSerializer.SerializeToElement(Purchase(Line()),Store.Json),Id()));
        Assert.Null(next.Result);
    }
    [Fact] public void PopulatedCurrentBackupOpensAndReadsWithoutChangingAnyTable()
    {
        var source=Environment.GetEnvironmentVariable("KITCHEN_PRESERVATION_SOURCE");
        if(string.IsNullOrEmpty(source)) return;
        var path=Path.Combine(Path.GetTempPath(),"sprint31-preservation",Guid.NewGuid().ToString("N"),"copy.db");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);File.Copy(source,path);
        Dictionary<string,string> Snapshot()
        {
            using var db=new Microsoft.Data.Sqlite.SqliteConnection("Data Source="+path);db.Open();
            using var cmd=db.CreateCommand();cmd.CommandText="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
            using var r=cmd.ExecuteReader();var names=new List<string>();while(r.Read())names.Add(r.GetString(0));r.Close();
            var result=new Dictionary<string,string>();
            foreach(var name in names){cmd.CommandText="SELECT * FROM \""+name+"\" ORDER BY rowid";using var rows=cmd.ExecuteReader();var values=new List<object[]>();while(rows.Read()){var v=new object[rows.FieldCount];rows.GetValues(v);values.Add(v);}result[name]=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(values)));}
            return result;
        }
        var before=Snapshot();var store=new Store(path);store.StockLots();store.StockOperations();store.SalesCatalogue();store.InventoryState();store.Orders();store.Payouts();
        var after=Snapshot();Assert.Equal(before.Keys,after.Keys);foreach(var pair in before)Assert.Equal(pair.Value,after[pair.Key]);
    }
    static string Id()=>Guid.NewGuid().ToString("N");
    static DateOnly Today=>AllergenRules.Today();
    static Store Kitchen(){var s=new Store(Path.Combine(Path.GetTempPath(),"kitchen-review-tests",Id(),"test.db"));Seed.Run(s);return s;}
    static PurchaseLine Line(bool reviewed=false)=>new("cream-cheese",1,280,"g",3.25m,UseBy:Today.AddDays(4),DateReviewed:reviewed,DateEvidence:"Product Checked",DateType:"use-by",ReviewSource:"Product Checked");
    static PurchaseInput Purchase(params PurchaseLine[] lines)=>new(Id(),"sample-supplier","home",Today,lines.ToList());
    static LotDateReview Review(StockLot l)=>new(Id(),l.Id,l.UseBy,true,l.DateEvidence,l.DateType,l.ReviewSource,l.ReviewNotes);
    [Fact] public void ReceiptKeepsReviewExplicitAndDateTypeSourceAndQuotesIntact(){var s=Kitchen();var quotes=JsonSerializer.Serialize(s.All<Price>("price"));var input=Purchase(Line(true),Line() with{DateType="best-before"});var lots=s.Receive(input);Assert.True(lots[0].DateReviewed);Assert.False(lots[1].DateReviewed);Assert.Equal("best-before",lots[1].DateType);Assert.Equal("Product Checked",lots[1].ReviewSource);s.Receive(input);Assert.Equal(2,s.StockLots().Count);Assert.Equal(quotes,JsonSerializer.Serialize(s.All<Price>("price")));}
    [Fact] public void MissingDatesOtherNotesAndApiaryOnPurchasedGoodsAreRejected(){var s=Kitchen();foreach(var line in new[]{Line(true) with{UseBy=null},Line(true) with{DateType="none",UseBy=null},Line(true) with{ReviewSource="Other"},Line(true) with{ReviewSource="Apiary Shelf-Life",ReviewNotes="Procedure A"},Line(true) with{UseBy=Today.AddDays(-1)}})Assert.Throws<ValidationException>(()=>s.Receive(Purchase(line)));Assert.Empty(s.StockLots());}
    [Fact] public void BulkIsAtomicIdempotentAndAuditsEveryLot(){var s=Kitchen();var lots=s.Receive(Purchase(Line(),Line() with{DateType="best-before"}));var input=new BulkDateReview(Id(),lots.Select(Review).ToList());s.ReviewLots(input);s.ReviewLots(input);Assert.All(s.StockLots(),l=>Assert.True(l.DateReviewed));Assert.Equal(2,s.StockOperations().Count(o=>o.Type=="date-review"));Assert.Equal(2,s.StockMovements().Count);Assert.Equal(lots.Select(l=>l.UseBy),s.StockLots().Select(l=>l.UseBy));using var db=s.Open();using var cmd=db.CreateCommand();cmd.CommandText="SELECT count(*) FROM audit WHERE action='inventory:date-review'";Assert.Equal(2L,cmd.ExecuteScalar());}
    [Fact] public void BulkRejectsExpiredMissingAndStaleDatesWithoutPartialReview(){var s=Kitchen();var lots=s.Receive(Purchase(Line(),Line() with{UseBy=Today.AddDays(-1)},Line() with{UseBy=null}));foreach(var bad in lots.Skip(1)){Assert.Throws<ValidationException>(()=>s.ReviewLots(new(Id(),[Review(lots[0]),Review(bad)])));Assert.All(s.StockLots(),l=>Assert.False(l.DateReviewed));}Assert.Throws<ValidationException>(()=>s.ReviewLots(new(Id(),[Review(lots[0]) with{UseBy=Today.AddDays(10)}])));Assert.DoesNotContain(s.StockOperations(),o=>o.Type=="date-review");}
    [Fact] public void ReviewCannotRemoveExtendOrReclassifyRecordedDate(){var s=Kitchen();var l=s.Receive(Purchase(Line()))[0];foreach(var r in new[]{Review(l) with{DateReviewed=false,DateEvidence=""},Review(l) with{UseBy=null},Review(l) with{UseBy=Today.AddDays(9)},Review(l) with{DateType="best-before"},new LotDateReview(Id(),l.Id,Today.AddDays(9),true,"legacy evidence"),new LotDateReview(Id(),l.Id,l.UseBy,true,"legacy evidence")})Assert.Throws<ValidationException>(()=>s.ReviewLot(r));Assert.False(s.StockLots()[0].DateReviewed);}
    [Fact] public void PreparedProcedureNeedsReferenceAndIsRetained(){var s=Kitchen();var l=s.AddExistingStock(new(Id(),"recipe","brownie",2,"each","home",Today,"Prepared at home",UseBy:Today.AddDays(1)));var r=new LotDateReview(Id(),l.Id,l.UseBy,true,"Apiary Shelf-Life: SOP brownie 1","use-by","Apiary Shelf-Life","");Assert.Throws<ValidationException>(()=>s.ReviewLot(r));s.ReviewLot(r with{ReviewNotes="SOP brownie 1"});Assert.Equal("SOP brownie 1",s.StockLots()[0].ReviewNotes);Assert.Equal("Apiary Shelf-Life",s.StockLots()[0].ReviewSource);}
}
