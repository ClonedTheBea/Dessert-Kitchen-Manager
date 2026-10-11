import { useEffect, useState } from "react";
import { api, today, unitPrice } from "../api";
import { SaveStatus, useAutoSave } from "../autoSave";
import { ErrorBox, Field, Modal, Num, Unit } from "../components/ui";
import type { Ingredient, Price, State } from "../types";
type Setup = {
  ingredient: Ingredient;
  price: Price | null;
  newSupplierName: string;
};
export default function IngredientQuickAdd({
  state,
  close,
  saved,
}: {
  state: State;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const blankPrice: Price = {
    id: "",
    ingredientId: "",
    supplierId: "",
    packQuantity: 1,
    unit: "g",
    packPrice: 0,
    vatRate: 0,
    priceIncludesVat: true,
    recoverVat: false,
    productReference: "",
    effectiveDate: today(),
    isIllustrative: false,
    recordedAt: "",
  };
  const [value, set] = useState<Setup>({
    ingredient: {
      id: "",
      revision: 0,
      name: "",
      category: "Dairy",
      description: "",
      baseUnit: "g",
      brand: "",
      allergens: "",
      minimumStock: 0,
      isPackaging: false,
    },
    price: blankPrice,
    newSupplierName: "",
  });
  const save = useAutoSave(value, set, "/drafts/ingredient-setup/new", true);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const item = value.ingredient,
    p = value.price;
  const update = (changes: Partial<Ingredient>) =>
    set({ ...value, ingredient: { ...item, ...changes } });
  const quote = (changes: Partial<Price>) =>
    set({ ...value, price: { ...p!, ...changes } });
  const [preview, setPreview] = useState<{ unit: string; cost: number }>(),
    [previewError, setPreviewError] = useState("");
  useEffect(() => {
    let active = true;
    setPreview(undefined);
    setPreviewError("");
    if (!p) return;
    const timer = setTimeout(
      () =>
        api<{ unit: string; cost: number }>("/prices/preview", p)
          .then((v) => {
            if (active) setPreview(v);
          })
          .catch((e) => {
            if (active) setPreviewError(e.message);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [p]);
  return (
    <Modal title="Add ingredient & price" close={close}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!(await save.flush())) return;
            await api("/drafts/ingredient-setup/new/publish", {
              revision: save.revision(),
            });
            save.markPublished();
            await saved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <SaveStatus save={save} />
        <fieldset disabled={!save.ready || busy} className="editor-fields">
          <div className="form-grid">
            <Field label="Ingredient name">
              <input
                autoFocus
                required
                value={item.name}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <Field label="Category">
              <input
                required
                value={item.category}
                onChange={(e) => update({ category: e.target.value })}
              />
            </Field>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={!!p}
              onChange={(e) =>
                set({
                  ...value,
                  price: e.target.checked
                    ? { ...blankPrice, unit: item.baseUnit }
                    : null,
                })
              }
            />
            Add a supplier price now
          </label>
          {p ? (
            <>
              <div className="form-grid">
                <Field label="Supplier">
                  <select
                    required
                    value={p.supplierId}
                    onChange={(e) =>
                      set({
                        ...value,
                        newSupplierName: "",
                        price: { ...p, supplierId: e.target.value },
                      })
                    }
                  >
                    <option value="">Choose a supplier…</option>
                    {state.suppliers
                      .filter((s) => !s.archived)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    <option value="new">+ New supplier</option>
                  </select>
                </Field>
                {p.supplierId === "new" && (
                  <Field label="New supplier name">
                    <input
                      required
                      value={value.newSupplierName}
                      onChange={(e) =>
                        set({ ...value, newSupplierName: e.target.value })
                      }
                    />
                  </Field>
                )}
                <Field label="Pack size">
                  <Num
                    min={0.0001}
                    value={p.packQuantity}
                    onChange={(packQuantity) => quote({ packQuantity })}
                  />
                </Field>
                <Field label="Unit">
                  <Unit
                    value={p.unit}
                    onChange={(unit) =>
                      set({
                        ...value,
                        ingredient: {
                          ...item,
                          baseUnit:
                            unit === "kg" ? "g" : unit === "l" ? "ml" : unit,
                        },
                        price: { ...p, unit },
                      })
                    }
                  />
                </Field>
                <Field label="Purchase price (£)">
                  <Num
                    value={p.packPrice}
                    onChange={(packPrice) => quote({ packPrice })}
                  />
                </Field>
              </div>
              <p className="notice">
                {preview
                  ? `${unitPrice(preview.cost, preview.unit)} after VAT treatment`
                  : previewError || "Calculating unit cost…"}
                . This creates a price quote; receive actual stock under Stock →
                Purchases.
              </p>
              <details>
                <summary>VAT, effective date & price source</summary>
                <div className="form-grid">
                  <Field label="VAT rate (%)">
                    <Num
                      value={p.vatRate}
                      max={100}
                      onChange={(vatRate) => quote({ vatRate })}
                    />
                  </Field>
                  <Field label="Effective date">
                    <input
                      required
                      type="date"
                      value={p.effectiveDate}
                      onChange={(e) => quote({ effectiveDate: e.target.value })}
                    />
                  </Field>
                  <Field label="Supplier product reference">
                    <input
                      value={p.productReference}
                      onChange={(e) =>
                        quote({ productReference: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.priceIncludesVat}
                    onChange={(e) =>
                      quote({ priceIncludesVat: e.target.checked })
                    }
                  />
                  Price includes VAT
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.recoverVat}
                    onChange={(e) => quote({ recoverVat: e.target.checked })}
                  />
                  Recover input VAT in costing
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={p.isIllustrative}
                    onChange={(e) =>
                      quote({ isIllustrative: e.target.checked })
                    }
                  />
                  Illustrative price
                </label>
                <p>
                  Unit cost uses the same VAT calculation as published recipe
                  costing.
                </p>
              </details>
            </>
          ) : (
            <Field label="Base unit">
              <Unit
                value={item.baseUnit}
                onChange={(baseUnit) => update({ baseUnit })}
              />
            </Field>
          )}
          <details>
            <summary>Packaging, stock limits & notes</summary>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={item.isPackaging}
                onChange={(e) => update({ isPackaging: e.target.checked })}
              />
              This is a packaging item
            </label>
            <Field label={`Minimum stock (${item.baseUnit})`}>
              <Num
                value={item.minimumStock}
                onChange={(minimumStock) => update({ minimumStock })}
              />
            </Field>
            <Field label="Brand">
              <input
                value={item.brand}
                onChange={(e) => update({ brand: e.target.value })}
              />
            </Field>
            <Field label="Description">
              <textarea
                value={item.description}
                onChange={(e) => update({ description: e.target.value })}
              />
            </Field>
            <Field label="Allergens">
              <input
                value={item.allergens}
                onChange={(e) => update({ allergens: e.target.value })}
              />
            </Field>
            <p>
              Allergen evidence can be reviewed in the ingredient editor.
              Unreviewed information never creates a dietary claim.
            </p>
          </details>
        </fieldset>
        <ErrorBox error={error} />
        <div className="form-actions">
          <button className="primary" disabled={busy || !save.ready}>
            {busy ? "Adding…" : p ? "Add ingredient & price" : "Add ingredient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
