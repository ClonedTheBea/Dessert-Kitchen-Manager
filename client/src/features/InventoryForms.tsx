import IngredientQuickAdd from "./IngredientQuickAdd";
import {
  useEffect,
  useState,
  useRef,
  type RefObject,
  type ReactNode,
} from "react";
import { api, money, number, today } from "../api";
import { SaveStatus, useAutoSave } from "../autoSave";
import { ErrorBox, Field, Num, Unit } from "../components/ui";
import type { State, Version } from "../types";
import type {
  Action,
  Count,
  DateReview,
  InventoryState,
  Location,
  Plan,
  Production,
  ProductionPreview,
  Purchase,
  PurchaseLine,
  Shopping,
  ShoppingRow,
} from "../inventoryTypes";

export const identity = () => crypto.randomUUID();
export function Text({
  label,
  value,
  change,
  type = "text",
}: {
  label: string;
  value: string;
  change: (s: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </Field>
  );
}
export function Numeric({
  label,
  value,
  change,
  min = 0,
}: {
  label: string;
  value: number;
  change: (n: number) => void;
  min?: number;
}) {
  return (
    <Field label={label}>
      <Num value={value} onChange={change} min={min} />
    </Field>
  );
}
export function Select({
  label,
  value,
  change,
  options,
}: {
  label: string;
  value: string;
  change: (s: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => change(e.target.value)}>
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function Place({
  locations,
  value,
  change,
  label = "Location",
}: {
  locations: Location[];
  value: string;
  change: (s: string) => void;
  label?: string;
}) {
  return (
    <Select
      label={label}
      value={value}
      change={change}
      options={locations.map((l) => ({
        id: l.id,
        name: `${l.name} · ${l.mode}`,
      }))}
    />
  );
}
export function Dates({
  value,
  change,
  prepared = false,
}: {
  value: DateReview;
  change: (v: DateReview) => void;
  prepared?: boolean;
}) {
  const source = value.reviewSource || "Product Checked";
  const dateType = value.dateType || (value.useBy ? "use-by" : "none");
  const update = (patch: Partial<DateReview>) => {
    const next = {
      ...value,
      dateType,
      reviewSource: source,
      reviewNotes: value.reviewNotes || "",
      ...patch,
    };
    next.dateEvidence = `${next.reviewSource}${next.reviewNotes ? ": " + next.reviewNotes : ""}`;
    change(next);
  };
  return (
    <div className="inventory-fields date-review-fields">
      <Select
        label="Date type"
        value={dateType}
        change={(dateType) => update({ dateType, dateReviewed: false })}
        options={[
          { id: "use-by", name: "Use-by" },
          { id: "best-before", name: "Best-before" },
          { id: "none", name: "Not applicable or not provided" },
        ]}
      />
      <Text
        label="Recorded date"
        type="date"
        value={value.useBy ?? ""}
        change={(useBy) =>
          update({ useBy: useBy || null, dateReviewed: false })
        }
      />
      <Select
        label="Review source"
        value={source}
        change={(reviewSource) => update({ reviewSource, dateReviewed: false })}
        options={[
          "Product Checked",
          "Manufacturer Label",
          "Supplier Documentation",
          ...(prepared ? ["Apiary Shelf-Life"] : []),
          "Other",
        ].map((name) => ({ id: name, name }))}
      />
      <Text
        label={
          source === "Apiary Shelf-Life"
            ? "Approved shelf-life procedure / record reference"
            : source === "Other" || dateType === "none"
              ? "Review notes (required)"
              : "Review notes (optional)"
        }
        value={value.reviewNotes || ""}
        change={(reviewNotes) => update({ reviewNotes, dateReviewed: false })}
      />
      {source === "Apiary Shelf-Life" && (
        <small>
          Use only an approved procedure for this prepared product. No shelf
          life is calculated or extended.
        </small>
      )}
      <label className="inventory-check">
        <input
          type="checkbox"
          checked={value.dateReviewed}
          onChange={(e) => update({ dateReviewed: e.target.checked })}
        />
        Dates / shelf life reviewed
      </label>
      <small>
        Leave unticked to review later. If a required date or evidence is
        missing, stock stays unavailable. No date means you must explain why a
        date is not required.
      </small>
    </div>
  );
}
export function DraftForm<T extends object>({
  kind,
  initial,
  children,
  done,
  label,
  id = "current",
  closeControl,
  cancel,
}: {
  closeControl?: RefObject<(() => Promise<void>) | null>;
  cancel?: () => void;
  kind: string;
  initial: T;
  children: (value: T, set: (v: T) => void) => ReactNode;
  done: (result?: unknown) => Promise<void>;
  label: string;
  id?: string;
}) {
  const [value, set] = useState(initial),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [posted, setPosted] = useState(false);
  const save = useAutoSave(value, set, `/drafts/inventory-${kind}/${id}`, true);
  const submitting = useRef(false);
  const starting = useRef(initial);
  const close = async () => {
    if (submitting.current || !save.ready) return;
    const changed = JSON.stringify({...value, operationId: ""}) !== JSON.stringify({...starting.current, operationId: ""});
    if (!posted && changed && !window.confirm("Discard this unconfirmed purchase draft? No stock has been received.")) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (!posted && changed) {
        if (!(await save.flush())) return;
        if (save.revision() > 0)
          await api(`/inventory/purchase/draft/${id}/discard`, {
            revision: save.revision(),
          });
        save.markPublished();
      }
      cancel?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (closeControl) closeControl.current = close;

  return (
    <section className="inventory-panel">
      <SaveStatus save={save} />
      <p className="muted">
        Draft edits are saved automatically. Stock changes only when you
        confirm.
      </p>
      <ErrorBox error={error} />
      <fieldset disabled={!save.ready || busy || posted}>
        {children(value, set)}
      </fieldset>
      <div className="actions">
        <button
          className="primary"
          disabled={!save.ready || busy || posted}
          onClick={async () => {
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setError("");
            try {
              save.reset(value, true);
              if (!(await save.flush())) return;
              const result = await api(`/inventory/confirm/${kind}/${id}`, {
                revision: save.revision(),
              });
              setPosted(true);
              save.markPublished();
              await done(result);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          {busy ? "Confirming…" : posted ? "Confirmed" : label}
        </button>
        {cancel && (
          <button
            className="secondary"
            disabled={busy || !save.ready}
            onClick={() => void close()}
          >
            Cancel
          </button>
        )}
        {posted && <p>Recorded. Close this form to start another operation.</p>}
      </div>
    </section>
  );
}
export function PurchaseForm({
  state,
  inventory,
  done,
  defaultLocation,
  initialIngredient,
  closeControl,
  cancel,
}: {
  state: State;
  inventory: InventoryState;
  done: () => Promise<void>;
  defaultLocation: string;
  initialIngredient?: string;
  closeControl?: RefObject<(() => Promise<void>) | null>;
  cancel?: () => void;
}) {
  const blank = (): PurchaseLine => ({
    ingredientId: "",
    packs: 1,
    packSize: 1,
    unit: "g",
    packPrice: 0,
    vatRate: 0,
    priceIncludesVat: true,
    recoverVat: false,
    packLabel: "pack",
    packsPerCase: 1,
    batchReference: "",
    useBy: null,
    dateReviewed: false,
    dateEvidence: "Product Checked",
    dateType: "none",
    reviewSource: "Product Checked",
    reviewNotes: "",
  });
  const quote = state.prices
    .filter(
      (p) =>
        p.ingredientId === initialIngredient &&
        p.effectiveDate <= today() &&
        state.suppliers.some((s) => s.id === p.supplierId && !s.archived),
    )
    .sort(
      (a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate) ||
        b.recordedAt.localeCompare(a.recordedAt),
    )[0];
  const initial: Purchase = {
    operationId: identity(),
    supplierId: quote?.supplierId ?? "",
    locationId: defaultLocation,
    date: today(),
    lines: [
      initialIngredient
        ? {
            ...blank(),
            ingredientId: initialIngredient,
            unit:
              quote?.unit ??
              state.ingredients.find((i) => i.id === initialIngredient)
                ?.baseUnit ??
              "g",
            packSize: quote?.packQuantity ?? 1,
            packPrice: quote?.packPrice ?? 0,
            vatRate: quote?.vatRate ?? 0,
            priceIncludesVat: quote?.priceIncludesVat ?? true,
            recoverVat: quote?.recoverVat ?? false,
          }
        : blank(),
    ],
    reference: "",
    notes: "",
  };
  const prefill = (line: PurchaseLine, supplier: string) => {
    const q = state.prices
      .filter(
        (p) =>
          p.ingredientId === line.ingredientId &&
          p.supplierId === supplier &&
          p.effectiveDate <= today(),
      )
      .sort(
        (a, b) =>
          b.effectiveDate.localeCompare(a.effectiveDate) ||
          b.recordedAt.localeCompare(a.recordedAt),
      )[0];
    return q
      ? {
          ...line,
          packSize: q.packQuantity,
          unit: q.unit,
          packPrice: q.packPrice,
          vatRate: q.vatRate,
          priceIncludesVat: q.priceIncludesVat,
          recoverVat: q.recoverVat,
        }
      : line;
  };
  return (
    <DraftForm
      closeControl={closeControl}
      cancel={cancel}
      kind="purchase"
      id={initialIngredient ? `ingredient-${initialIngredient}` : "current"}
      initial={initial}
      label="Confirm stock receipt"
      done={done}
    >
      {(v, set) => (
        <>
          <h3>1. Where did you shop?</h3>
          <div className="inventory-fields">
            <Select
              label="Supplier"
              value={v.supplierId}
              change={(supplierId) => set({ ...v, supplierId })}
              options={state.suppliers.filter((s) => !s.archived)}
            />
            <Text
              label="Purchase date"
              type="date"
              value={v.date}
              change={(date) => set({ ...v, date })}
            />
            <Place
              locations={inventory.locations}
              value={v.locationId}
              change={(locationId) => set({ ...v, locationId })}
            />
          </div>
          <h3>2. Add your shopping</h3>
          <p>
            Choose an item to prefill its latest price for this supplier, then
            check against your receipt.
          </p>
          {v.lines.map((l, i) => {
            const update = (line: PurchaseLine) =>
              set({
                ...v,
                lines: v.lines.map((old, j) => (i === j ? line : old)),
              });
            return (
              <section className="inventory-line basket-line" key={i}>
                <h3>Item {i + 1}</h3>
                <div className="inventory-fields">
                  <PurchaseIngredient
                    label="Ingredient or packaging"
                    value={l.ingredientId}
                    state={state}
                    supplier={v.supplierId}
                    change={(ingredientId, baseUnit) => {
                      const item = state.ingredients.find(
                        (x) => x.id === ingredientId,
                      );
                      update(
                        prefill(
                          {
                            ...l,
                            ingredientId,
                            unit: item?.baseUnit ?? baseUnit,
                          },
                          v.supplierId,
                        ),
                      );
                    }}
                  />
                  <Numeric
                    label={
                      l.packLabel === "case"
                        ? "Number of cases"
                        : "Number of packs"
                    }
                    value={l.packs}
                    change={(packs) => update({ ...l, packs })}
                  />
                  <Numeric
                    label="Quantity per pack"
                    value={l.packSize}
                    change={(packSize) => update({ ...l, packSize })}
                  />
                  <Field label="Pack unit">
                    <Unit
                      value={l.unit}
                      onChange={(unit) => update({ ...l, unit })}
                    />
                  </Field>
                  <Numeric
                    label="Actual price per pack (£)"
                    value={l.packPrice}
                    change={(packPrice) => update({ ...l, packPrice })}
                  />
                </div>
                <Text
                  label="Item notes"
                  value={l.notes || ""}
                  change={(notes) => update({ ...l, notes })}
                />
                <details>
                  <summary>
                    Batch reference & date review{" "}
                    {l.dateReviewed ? "· reviewed" : "· not reviewed"}
                  </summary>
                  <Text
                    label="Supplier batch / lot reference"
                    value={l.batchReference}
                    change={(batchReference) =>
                      update({ ...l, batchReference })
                    }
                  />
                  <Dates value={l} change={(d) => update({ ...l, ...d })} />
                </details>
                <details>
                  <summary>Cases, VAT & supplier quote</summary>
                  <div className="inventory-fields">
                    <Select
                      label="Buying as"
                      value={l.packLabel}
                      change={(packLabel) => update({ ...l, packLabel })}
                      options={[
                        { id: "pack", name: "Packs / individual units" },
                        { id: "case", name: "Cases" },
                      ]}
                    />
                    <Numeric
                      label="Packs per case"
                      value={l.packsPerCase}
                      change={(packsPerCase) => update({ ...l, packsPerCase })}
                    />
                    <Numeric
                      label="VAT rate (%)"
                      value={l.vatRate}
                      change={(vatRate) => update({ ...l, vatRate })}
                    />
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={l.priceIncludesVat}
                      onChange={(e) =>
                        update({ ...l, priceIncludesVat: e.target.checked })
                      }
                    />
                    Pack price includes VAT
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={l.recoverVat}
                      onChange={(e) =>
                        update({ ...l, recoverVat: e.target.checked })
                      }
                    />
                    VAT recoverable
                  </label>
                  <button
                    className="secondary"
                    onClick={() => update(prefill(l, v.supplierId))}
                  >
                    Use supplier quote — check actual receipt price
                  </button>
                </details>
                <button
                  className="text-button"
                  disabled={v.lines.length === 1}
                  onClick={() =>
                    set({ ...v, lines: v.lines.filter((_, j) => j !== i) })
                  }
                >
                  Remove line {i + 1}
                </button>
              </section>
            );
          })}
          <button
            className="secondary"
            onClick={() => set({ ...v, lines: [...v.lines, blank()] })}
          >
            Add purchase line
          </button>
          <details>
            <summary>Receipt reference & notes</summary>
            <Text
              label="Receipt reference"
              value={v.reference}
              change={(reference) => set({ ...v, reference })}
            />
            <Text
              label="Purchase notes"
              value={v.notes}
              change={(notes) => set({ ...v, notes })}
            />
          </details>
          <div className="confirmation-bar">
            <h3>3. Review your receipt</h3>
            <PurchaseTotals value={v} />
            <p>
              {v.lines.length} items. Confirming adds these quantities to stock
              once. {v.lines.filter((l) => !l.dateReviewed).length} items still
              need date review before they can be used in production.
            </p>
          </div>
        </>
      )}
    </DraftForm>
  );
}
function usePreview<T>(path: string, value: object) {
  const [result, setResult] = useState<T>(),
    [error, setError] = useState("");
  const key = JSON.stringify(value);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(
      () =>
        api<T>(path, JSON.parse(key))
          .then((r) => {
            if (active) {
              setResult(r);
              setError("");
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      300,
    );
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [path, key]);
  return { result, error };
}
function PurchaseTotals({ value }: { value: Purchase }) {
  const { result, error } = usePreview<{
    gross: number;
    stockValue: number;
    recoverableVat: number;
  }>("/inventory/purchase/preview", value);
  return (
    <div aria-live="polite">
      <ErrorBox error={error} />
      {result && (
        <p>
          Receipt total <b>{money(result.gross)}</b> · Stock value{" "}
          {money(result.stockValue)} · Recoverable VAT{" "}
          {money(result.recoverableVat)}
        </p>
      )}
    </div>
  );
}
export function RecipeChoice({
  state,
  value,
  change,
  simple = false,
}: {
  state: State;
  value: Plan;
  change: (p: Plan) => void;
  simple?: boolean;
}) {
  const [versions, setVersions] = useState<Version[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setVersions([]);
    if (value.recipeId)
      api<Version[]>(`/recipes/${value.recipeId}/versions`)
        .then((r) => {
          if (active) {
            setVersions(r);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [value.recipeId]);
  return (
    <>
      <Select
        label="Recipe"
        value={value.recipeId}
        change={(recipeId) => {
          const r = state.recipes.find((x) => x.recipe.id === recipeId)!.recipe;
          change({
            ...value,
            recipeId,
            version: r.revision,
            quantity: r.yield,
            heldRecipeIds: [],
          });
        }}
        options={state.recipes.map((r) => ({
          id: r.recipe.id,
          name: r.recipe.name,
        }))}
      />
      <Numeric
        label={`${simple ? "Quantity to make" : "Planned output"} (${versions.find((r) => r.recipe.revision === value.version)?.recipe.yieldUnit ?? "recipe units"})`}
        value={value.quantity}
        change={(quantity) => change({ ...value, quantity })}
      />
      {simple ? (
        <details className="recipe-version-choice">
          <summary>Recipe version · {value.version}</summary>{" "}
          <Select
            label="Recipe version"
            value={String(value.version)}
            change={(version) => change({ ...value, version: Number(version) })}
            options={versions.map((r) => ({
              id: String(r.recipe.revision),
              name: `Version ${r.recipe.revision}`,
            }))}
          />
          <p>
            New batches start with the latest published version. A resumed draft
            keeps your selected version.
          </p>
        </details>
      ) : (
        <>
          {" "}
          <Select
            label="Recipe version"
            value={String(value.version)}
            change={(version) => change({ ...value, version: Number(version) })}
            options={versions.map((r) => ({
              id: String(r.recipe.revision),
              name: `Version ${r.recipe.revision}`,
            }))}
          />
        </>
      )}
      <ErrorBox error={error} />
    </>
  );
}
export function ProductionForm({
  state,
  inventory,
  done,
  defaultLocation,
  resolveShortage,
}: {
  state: State;
  inventory: InventoryState;
  done: (result?: unknown) => Promise<void>;
  defaultLocation: string;
  resolveShortage: (kind: string, plan: Production) => Promise<void>;
}) {
  const r = state.recipes.find((v) => v.recipe.isSellable !== false)?.recipe;
  const initial: Production = {
    operationId: identity(),
    recipeId: r?.id ?? "",
    version: r?.revision ?? 1,
    plannedYield: r?.yield ?? 1,
    actualYield: r?.yield ?? 1,
    locationId: defaultLocation,
    destinationId: defaultLocation,
    date: today(),
    batchReference: `BATCH-${today()}-${identity().slice(0, 6)}`,
    heldRecipeIds: [],
    actualUsage: null,
    extraWastePercent: 0,
    labourCost: 0,
    otherCost: 0,
    mode: "made-ahead",
    useBy: null,
    dateReviewed: false,
    dateEvidence: "",
    operator: "Owner",
    notes: "",
  };
  return (
    <DraftForm
      kind="production"
      initial={initial}
      label="Confirm completed production"
      done={done}
    >
      {(v, set) => (
        <>
          <section className="workflow-step">
            <h3>1. What are you making?</h3>
            <div className="inventory-fields">
              <RecipeChoice
                simple
                state={state}
                value={{
                  recipeId: v.recipeId,
                  version: v.version,
                  quantity: v.plannedYield,
                }}
                change={(p) =>
                  set({
                    ...v,
                    recipeId: p.recipeId,
                    version: p.version,
                    plannedYield: p.quantity,
                    actualYield: p.quantity,
                    actualUsage: null,
                    heldRecipeIds: [],
                  })
                }
              />
            </div>
            <p>
              Making {number(v.actualYield)}{" "}
              {state.recipes.find((r) => r.recipe.id === v.recipeId)?.recipe
                .yieldUnit ?? "units"}{" "}
              · {inventory.locations.find((l) => l.id === v.locationId)?.name}
            </p>
          </section>
          <section className="workflow-step">
            <h3>2. Check your ingredients</h3>
            <ProductionCheck
              value={v}
              set={set}
              resolveShortage={(kind) => resolveShortage(kind, v)}
            />
          </section>
          <details>
            <summary>Adjust yield, costs, location or batch details</summary>
            <div className="inventory-fields">
              <Numeric
                label="Actual finished yield"
                value={v.actualYield}
                change={(actualYield) => set({ ...v, actualYield })}
              />
              <Place
                locations={inventory.locations}
                label="Consume from"
                value={v.locationId}
                change={(locationId) => set({ ...v, locationId })}
              />
              <Place
                locations={inventory.locations}
                label="Finished stock location"
                value={v.destinationId}
                change={(destinationId) => set({ ...v, destinationId })}
              />
              <Text
                label="Production date"
                type="date"
                value={v.date}
                change={(date) => set({ ...v, date })}
              />
              <Text
                label="Production batch reference"
                value={v.batchReference}
                change={(batchReference) => set({ ...v, batchReference })}
              />
              <Text
                label="Produced by"
                value={v.operator}
                change={(operator) => set({ ...v, operator })}
              />
              <Select
                label="Production mode"
                value={v.mode}
                change={(mode) => set({ ...v, mode })}
                options={[
                  { id: "made-ahead", name: "Made ahead — add finished stock" },
                  {
                    id: "made-to-order",
                    name: "Made to order — consume at preparation",
                  },
                ]}
              />
              <Numeric
                label="Extra production waste (%)"
                value={v.extraWastePercent}
                change={(extraWastePercent) =>
                  set({ ...v, extraWastePercent, actualUsage: null })
                }
              />
              <Numeric
                label="Actual labour cost (£)"
                value={v.labourCost}
                change={(labourCost) => set({ ...v, labourCost })}
              />
              <Numeric
                label="Other batch costs (£)"
                value={v.otherCost}
                change={(otherCost) => set({ ...v, otherCost })}
              />
            </div>
            <Text
              label="Production notes / explanation of differences"
              value={v.notes}
              change={(notes) => set({ ...v, notes })}
            />
          </details>
          <details>
            <summary>Use prepared components already in stock</summary>
            <p>
              Checked components use their prepared stock, of the exact recipe
              version required. Their original ingredients are not deducted
              again.
            </p>
            {state.recipes
              .filter((x) => x.recipe.id !== v.recipeId)
              .map((x) => (
                <label className="inventory-check" key={x.recipe.id}>
                  <input
                    type="checkbox"
                    checked={v.heldRecipeIds.includes(x.recipe.id)}
                    onChange={(e) =>
                      set({
                        ...v,
                        actualUsage: null,
                        heldRecipeIds: e.target.checked
                          ? [...v.heldRecipeIds, x.recipe.id]
                          : v.heldRecipeIds.filter((id) => id !== x.recipe.id),
                      })
                    }
                  />
                  {x.recipe.name}
                </label>
              ))}
          </details>
          <section className="workflow-step">
            <h3>3. Record storage dates</h3>
            {v.mode === "made-ahead" ? (
              <Dates prepared value={v} change={(d) => set({ ...v, ...d })} />
            ) : (
              <p>Made to order: no finished stock will be created.</p>
            )}
            <p>
              Confirming records {v.actualYield} completed recipe units and
              deducts the ingredients once. Unreviewed finished stock stays
              unavailable until its dates are reviewed.
            </p>
          </section>
        </>
      )}
    </DraftForm>
  );
}
function ProductionCheck({
  value: v,
  set,
  resolveShortage,
}: {
  value: Production;
  set: (v: Production) => void;
  resolveShortage: (kind: string) => Promise<void>;
}) {
  const { result: p, error } = usePreview<ProductionPreview>(
    "/inventory/production/preview",
    v,
  );
  return (
    <section className="inventory-line">
      <h3>Ingredients for this batch</h3>
      <ErrorBox error={error} />
      {!p && !error && <p>Checking usable stock…</p>}
      {p && (
        <>
          <p className={p.canProduce ? "" : "error"}>
            {p.canProduce
              ? "Usable stock covers the selected actual quantities."
              : "Stock shortage — receive usable stock before confirming, or record an explained actual usage change."}
          </p>
          {!p.canProduce && (
            <div className="shortage-help">
              <h4>What’s missing?</h4>
              <ul>
                {p.requirements
                  .filter((x) => x.shortage > 0)
                  .map((x) => (
                    <li key={x.requirement.key}>
                      {x.requirement.name}: need{" "}
                      {number(
                        v.actualUsage?.find((a) => a.key === x.requirement.key)
                          ?.quantity ?? x.requirement.quantity,
                      )}{" "}
                      {x.requirement.unit}, available {number(x.available)}{" "}
                      {x.requirement.unit}, missing{" "}
                      <strong>
                        {number(x.shortage)} {x.requirement.unit}
                      </strong>
                    </li>
                  ))}
              </ul>
              <div className="actions">
                <button
                  className="secondary"
                  onClick={() => resolveShortage("purchase")}
                >
                  Record Purchase
                </button>
                <button
                  className="secondary"
                  onClick={() => resolveShortage("adjustment")}
                >
                  Manage / adjust stock
                </button>
                <button
                  className="secondary"
                  onClick={() => resolveShortage("shopping")}
                >
                  Create shopping list
                </button>
              </div>
              <p>Your production draft is kept when you leave this screen.</p>
            </div>
          )}
          <div
            className="inventory-table"
            tabIndex={0}
            role="region"
            aria-label="Scrollable stock table"
          >
            <table>
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Planned</th>
                  <th>Usable</th>
                  <th>Shortfall</th>
                  {v.actualUsage && <th>Actual usage</th>}
                </tr>
              </thead>
              <tbody>
                {p.requirements.map(
                  ({ requirement: r, available, shortage }) => (
                    <tr key={r.key}>
                      <td>
                        {r.name}
                        {r.version && ` · v${r.version}`}
                        <small>{r.unit}</small>
                      </td>
                      <td>{number(r.quantity)}</td>
                      <td>{number(available)}</td>
                      <td>{number(shortage)}</td>
                      {v.actualUsage && (
                        <td>
                          {v.actualUsage ? (
                            <Num
                              aria-label={`Actual ${r.name}`}
                              value={
                                v.actualUsage.find((a) => a.key === r.key)
                                  ?.quantity ?? r.quantity
                              }
                              onChange={(quantity) =>
                                set({
                                  ...v,
                                  actualUsage: v.actualUsage!.map((a) =>
                                    a.key === r.key ? { ...a, quantity } : a,
                                  ),
                                })
                              }
                            />
                          ) : (
                            number(r.quantity)
                          )}
                        </td>
                      )}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Actual quantities, FIFO & cost details</summary>
            <button
              className="secondary"
              onClick={() =>
                set({
                  ...v,
                  actualUsage: v.actualUsage
                    ? null
                    : p.requirements.map((x) => ({
                        key: x.requirement.key,
                        quantity: x.requirement.quantity,
                      })),
                })
              }
            >
              {v.actualUsage
                ? "Use planned quantities"
                : "Adjust actual quantities"}
            </button>
            <p>
              Published estimate (including recipe labour):{" "}
              {money(p.estimatedRecipeCost)}. Allocated materials:{" "}
              {money(p.actualMaterialCost)}
              {!p.canProduce ? " (incomplete due to shortage)" : ""}. Actual
              labour and other costs are entered separately. Valuation:{" "}
              {p.valuationStatus ?? "known"}.
            </p>
            <details>
              <summary>Lots allocated by FIFO</summary>
              {p.allocations.map((a, i) => (
                <p key={i}>
                  {a.item} · {a.batchReference || a.lotId} ·{" "}
                  {number(a.quantity)} {a.unit} · {money(a.cost)}
                </p>
              ))}
            </details>
          </details>
        </>
      )}
    </section>
  );
}
export function ActionForm({
  kind,
  inventory,
  initial,
  done,
}: {
  kind: string;
  inventory: InventoryState;
  initial: Action;
  done: () => Promise<void>;
}) {
  return (
    <DraftForm
      kind={kind}
      initial={initial}
      label={`Confirm ${kind}`}
      done={done}
    >
      {(v, set) => (
        <>
          <div className="inventory-fields">
            <Select
              label="Stock lot"
              value={v.lotId}
              options={inventory.lots.map((l) => ({
                id: l.id,
                name: `${l.name} · ${l.batchReference || l.id.slice(0, 8)} (${l.unit})`,
              }))}
              change={(lotId) => set({ ...v, lotId })}
            />
            <Place
              locations={inventory.locations}
              value={v.locationId}
              change={(locationId) => set({ ...v, locationId })}
            />
            {kind === "transfer" && (
              <Place
                label="Destination"
                locations={inventory.locations}
                value={v.destinationId}
                change={(destinationId) => set({ ...v, destinationId })}
              />
            )}
            <Numeric
              label={
                kind === "adjustment"
                  ? "Signed quantity change in lot units"
                  : "Quantity in lot units"
              }
              min={kind === "adjustment" ? -1000000 : 0}
              value={v.quantity}
              change={(quantity) => set({ ...v, quantity })}
            />
            <Text
              label="Movement date"
              type="date"
              value={v.date}
              change={(date) => set({ ...v, date })}
            />
            {kind === "waste" ? (
              <Select
                label="Waste / consumption reason"
                value={v.reason}
                change={(reason) => set({ ...v, reason })}
                options={[
                  "expired",
                  "damaged",
                  "spoiled",
                  "production-error",
                  "quality-control-sample",
                  "personal-consumption",
                  "staff-consumption",
                  "other",
                ].map((id) => ({ id, name: id.replaceAll("-", " ") }))}
              />
            ) : (
              <Text
                label="Reason"
                value={v.reason}
                change={(reason) => set({ ...v, reason })}
              />
            )}
          </div>
          <Text
            label="Movement notes"
            value={v.notes}
            change={(notes) => set({ ...v, notes })}
          />
          <p>
            Available physical stock:{" "}
            {number(
              inventory.balances.find(
                (b) => b.lot.id === v.lotId && b.location.id === v.locationId,
              )?.quantity ?? 0,
            )}{" "}
            {inventory.lots.find((l) => l.id === v.lotId)?.unit}. The server
            rechecks before posting.
          </p>
        </>
      )}
    </DraftForm>
  );
}
export function CountForm({
  inventory,
  initial,
  done,
}: {
  inventory: InventoryState;
  initial: Count;
  done: () => Promise<void>;
}) {
  return (
    <DraftForm
      kind="stocktake"
      initial={initial}
      id={initial.snapshotId}
      label="Confirm reviewed stocktake"
      done={done}
    >
      {(v, set) => {
        const snapshot = inventory.stocktakes.find(
          (s) => s.id === v.snapshotId,
        );
        return (
          <>
            <p>
              Snapshot: {snapshot?.recordedAt}. Tick only counted lots. A
              movement during counting blocks the affected count; start a fresh
              stocktake.
            </p>
            {snapshot?.lines.map((line) => {
              const lot = inventory.lots.find((l) => l.id === line.lotId)!;
              const count = v.counts.find((c) => c.lotId === line.lotId);
              return (
                <div className="inventory-line" key={line.lotId}>
                  <label className="inventory-check">
                    <input
                      type="checkbox"
                      checked={!!count}
                      onChange={(e) =>
                        set({
                          ...v,
                          counts: e.target.checked
                            ? [
                                ...v.counts,
                                {
                                  lotId: line.lotId,
                                  quantity: line.quantity,
                                  reason: "",
                                },
                              ]
                            : v.counts.filter((c) => c.lotId !== line.lotId),
                        })
                      }
                    />
                    {lot.name} · {lot.batchReference || lot.id.slice(0, 8)}
                  </label>
                  <p>
                    Expected {number(line.quantity)} {lot.unit}
                  </p>
                  {count && (
                    <div className="inventory-fields">
                      <Numeric
                        label={`Physical count ${lot.name}`}
                        value={count.quantity}
                        change={(quantity) =>
                          set({
                            ...v,
                            counts: v.counts.map((c) =>
                              c.lotId === line.lotId ? { ...c, quantity } : c,
                            ),
                          })
                        }
                      />
                      <Text
                        label="Discrepancy explanation"
                        value={count.reason}
                        change={(reason) =>
                          set({
                            ...v,
                            counts: v.counts.map((c) =>
                              c.lotId === line.lotId ? { ...c, reason } : c,
                            ),
                          })
                        }
                      />
                      <p>
                        Difference: {number(count.quantity - line.quantity)}{" "}
                        {lot.unit}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
            <Text
              label="Stocktake notes"
              value={v.notes}
              change={(notes) => set({ ...v, notes })}
            />
          </>
        );
      }}
    </DraftForm>
  );
}
export function ShoppingForm({
  state,
  inventory,
  defaultLocation,
  initialPlan,
}: {
  state: State;
  inventory: InventoryState;
  defaultLocation: string;
  initialPlan?: Plan;
}) {
  const [v, set] = useState<Shopping>({
    locationId: defaultLocation,
    plans: initialPlan ? [initialPlan] : [],
    packOverrides: {},
    notes: "",
  });
  const draftId = initialPlan
    ? `production-${initialPlan.recipeId}-v${initialPlan.version}-${initialPlan.quantity}-${defaultLocation}`
    : "current";
  const save = useAutoSave(
    v,
    set,
    `/drafts/inventory-shopping/${draftId}`,
    true,
  );
  const { result: rows, error } = usePreview<ShoppingRow[]>(
    "/inventory/shopping",
    v,
  );
  return (
    <section className="inventory-panel shopping-print">
      <h2>Next production shopping list</h2>
      <SaveStatus save={save} />
      <fieldset disabled={!save.ready}>
        <Place
          locations={inventory.locations}
          value={v.locationId}
          change={(locationId) => set({ ...v, locationId })}
        />
        {v.plans.map((p, i) => (
          <div className="inventory-line inventory-fields" key={i}>
            <RecipeChoice
              state={state}
              value={p}
              change={(p) =>
                set({
                  ...v,
                  plans: v.plans.map((old, j) => (i === j ? p : old)),
                })
              }
            />
            <button
              className="secondary"
              onClick={() =>
                set({ ...v, plans: v.plans.filter((_, j) => j !== i) })
              }
            >
              Remove plan {i + 1}
            </button>
          </div>
        ))}
        <button
          className="secondary"
          onClick={() => {
            const r = state.recipes[0].recipe;
            set({
              ...v,
              plans: [
                ...v.plans,
                { recipeId: r.id, version: r.revision, quantity: r.yield },
              ],
            });
          }}
        >
          Add planned recipe
        </button>
        <Text
          label="Shopping notes"
          value={v.notes}
          change={(notes) => set({ ...v, notes })}
        />
        <p>
          No stock is reserved or deducted. Estimates use the latest effective
          supplier quote; illustrative quotes are labelled.
        </p>
        {v.plans.length > 0 && <ErrorBox error={error} />}
        <div
          className="inventory-table"
          tabIndex={0}
          role="region"
          aria-label="Scrollable stock table"
        >
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Needed</th>
                <th>Available</th>
                <th>To buy</th>
                <th>Pack size</th>
                <th>Buy packs</th>
                <th>Supplier / estimate</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.name}
                    <small>{r.unit}</small>
                  </td>
                  <td>
                    {number(r.required)} {r.unit}
                  </td>
                  <td>
                    {number(r.available)} {r.unit}
                  </td>
                  <td>
                    <b>
                      {number(r.shortfall)} {r.unit}
                    </b>
                  </td>
                  <td>
                    {r.packSize === null ? "No quote" : number(r.packSize)}
                  </td>
                  <td>
                    {r.selectedPacks !== null && (
                      <Num
                        aria-label={`Buy packs ${r.name}`}
                        value={r.selectedPacks}
                        onChange={(n) =>
                          set({
                            ...v,
                            packOverrides: { ...v.packOverrides, [r.key]: n },
                          })
                        }
                      />
                    )}
                    <small>
                      Suggested {r.suggestedPacks ?? "—"} · purchase{" "}
                      {r.purchaseQuantity ?? "—"} {r.unit}
                    </small>
                  </td>
                  <td>
                    {r.supplier}
                    <small>
                      {r.estimatedCost === null ? "—" : money(r.estimatedCost)}{" "}
                      {r.illustrative ? "· Illustrative" : ""}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions">
          <button
            disabled={!rows}
            className="secondary"
            onClick={() => window.print()}
          >
            Print shopping list
          </button>
          <button
            disabled={!rows}
            className="secondary"
            onClick={async () => {
              if (await save.flush())
                window.location.assign(
                  `/api/inventory/shopping/${draftId}/csv`,
                );
            }}
          >
            Export CSV
          </button>
        </div>
      </fieldset>
    </section>
  );
}

function PurchaseIngredient({
  state,
  supplier,
  value,
  change,
  label,
}: {
  state: State;
  supplier: string;
  value: string;
  change: (id: string, unit: string) => void;
  label: string;
}) {
  const [query, Q] = useState("");
  const [all, A] = useState(false);
  const [creating, C] = useState(false);
  const [items, I] = useState(state.ingredients);
  useEffect(() => {
    A(false);
    Q("");
  }, [supplier]);
  const selected = items.find((i) => i.id === value);
  const matches = items.filter(
    (i) =>
      !i.archived &&
      (all ||
        !supplier ||
        state.prices.some(
          (p) => p.supplierId === supplier && p.ingredientId === i.id,
        )) &&
      i.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="purchase-ingredient">
      <Text label={`Search ${label.toLowerCase()}`} value={query} change={Q} />
      {selected && (
        <p>
          Selected: <strong>{selected.name}</strong> · {selected.baseUnit}
        </p>
      )}
      <div className="purchase-search-results">
        {matches.slice(0, 12).map((i) => (
          <button
            className="secondary"
            key={i.id}
            onClick={() => {
              change(i.id, i.baseUnit);
              Q(i.name);
            }}
          >
            {i.name}
          </button>
        ))}
      </div>
      {!matches.length && <p>No matching items for this supplier.</p>}
      {matches.length > 12 && (
        <small>Type more of the name to narrow the results.</small>
      )}
      <button
        className="text-button"
        onClick={() => {
          A(!all);
          Q("");
        }}
      >
        {all ? "Back to supplier items" : "Add an item not listed"}
      </button>
      {all && (
        <>
          <p>
            Link an existing ingredient above, or create one. This purchase is a
            one-off supplier association; its price will not change supplier
            quotes.
          </p>
          <button className="secondary" onClick={() => C(true)}>
            Create new ingredient
          </button>
        </>
      )}
      {creating && (
        <IngredientQuickAdd
          oneOff
          state={state}
          close={() => C(false)}
          saved={async (item) => {
            const next = await api<State>("/state");
            I(next.ingredients);
            C(false);
            if (item) {
              change(item.id, item.baseUnit);
              Q(item.name);
            }
          }}
        />
      )}
    </div>
  );
}
