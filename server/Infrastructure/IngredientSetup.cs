using System.Text.Json;
using DessertKitchen.Domain;
namespace DessertKitchen.Infrastructure;
public record IngredientSetup(Ingredient Ingredient,Price? Price,string NewSupplierName="");
public sealed partial class Store
{
    // A convenience transaction for one frontend task; uses the existing catalogue,
    // quote history, validation rules, dependency triggers and draft receipt.
    public object CreateIngredientSetup(IngredientSetup input,WorkingDraft draft)
    {
        var item=input.Ingredient;
        Guard.Require(item.Revision==0&&string.IsNullOrEmpty(item.Id),"Use the ingredient editor to update an existing record.");
        Guard.Text(item.Name,"Ingredient name");Guard.Text(item.Category,"Category");Units.Definition(item.BaseUnit);Guard.Amount(item.MinimumStock,"Minimum stock");AllergenRules.Validate(item.AllergenInfo);
        item=item with{Id=Guid.NewGuid().ToString("N"),Revision=1};
        Supplier? supplier=null;var price=input.Price;
        if(price!=null)
        {
            if(!string.IsNullOrWhiteSpace(input.NewSupplierName)){Guard.Text(input.NewSupplierName,"Supplier name");supplier=new(Guid.NewGuid().ToString("N"),1,input.NewSupplierName);}
            else {supplier=Get<Supplier>("supplier",price.SupplierId);Guard.Require(!supplier.Archived,"Restore the supplier before adding a price.");}
            Guard.Require(price.PackQuantity>0&&price.PackQuantity<=1000000,"Pack quantity must be positive.");Units.Convert(price.PackQuantity,price.Unit,item.BaseUnit);Guard.Amount(price.PackPrice,"Pack price");Guard.Amount(price.VatRate,"VAT rate",100);Guard.Require(price.EffectiveDate!=default,"Price effective date is required.");
            price=price with{Id=Guid.NewGuid().ToString("N"),IngredientId=item.Id,SupplierId=supplier.Id,RecordedAt=Now()};
        }
        using var db=Open();using var tx=db.BeginTransaction();
        if(supplier!=null&&!string.IsNullOrWhiteSpace(input.NewSupplierName)){Execute(db,tx,"INSERT INTO documents VALUES('supplier',$id,1,$body)",("$id",supplier.Id),("$body",JsonSerializer.Serialize(supplier,Json)));Audit(db,tx,"save:supplier",supplier.Id);}
        Execute(db,tx,"INSERT INTO documents VALUES('ingredient',$id,1,$body)",("$id",item.Id),("$body",JsonSerializer.Serialize(item,Json)));Audit(db,tx,"save:ingredient",item.Id);
        if(price!=null){Execute(db,tx,"INSERT INTO prices VALUES($id,$ingredient,$at,$body)",("$id",price.Id),("$ingredient",item.Id),("$at",price.RecordedAt),("$body",JsonSerializer.Serialize(price,Json)));Audit(db,tx,"add:price",price.Id);}
        var result=new{ingredient=item,price,supplier};CompleteDraft(db,tx,draft,result);tx.Commit();return result;
    }
}
