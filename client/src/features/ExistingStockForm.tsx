import { today } from "../api";
import { Field, Num, Unit } from "../components/ui";
import type { State } from "../types";
import type { ExistingStock, InventoryState } from "../inventoryTypes";
import {
  DraftForm,
  Dates,
  identity,
  Place,
  Select,
  Text,
} from "./InventoryForms";

export default function ExistingStockForm({
  state,
  inventory,
  defaultLocation,
  done,
}: {
  state: State;
  inventory: InventoryState;
  defaultLocation: string;
  done: () => Promise<void>;
}) {
  const initial: ExistingStock = {
    operationId: identity(),
    kind: "ingredient",
    itemId: "",
    quantity: 1,
    unit: "g",
    locationId: defaultLocation,
    date: today(),
    source: "",
    preparedOn: null,
    useBy: null,
    dateReviewed: false,
    dateEvidence: "",
    totalCost: null,
    valuationStatus: "unknown",
    notes: "",
    recipeVersion: null,
  };
  return (
    <DraftForm
      kind="existing"
      initial={initial}
      label="Confirm existing stock"
      done={done}
    >
      {(v, set) => {
        const items =
          v.kind === "ingredient"
            ? state.ingredients
                .filter((i) => !i.archived)
                .map((i) => ({ id: i.id, name: i.name, unit: i.baseUnit }))
            : state.recipes.map((r) => ({
                id: r.recipe.id,
                name: r.recipe.name,
                unit: r.recipe.yieldUnit,
              }));
        return (
          <>
            <p>
              Add what you already have. This records{" "}
              {v.kind === "ingredient"
                ? "opening stock"
                : "historical preparation"}{" "}
              without creating purchases or consuming ingredients.
            </p>
            <div className="inventory-fields">
              <Select
                label="Stock type"
                value={v.kind}
                change={(kind) =>
                  set({
                    ...v,
                    kind,
                    itemId: "",
                    unit: kind === "ingredient" ? "g" : "each",
                    preparedOn: null,
                    recipeVersion: null,
                  })
                }
                options={[
                  { id: "ingredient", name: "Ingredient or packaging" },
                  { id: "recipe", name: "Already-prepared product" },
                ]}
              />
              <Select
                label="Item or product"
                value={v.itemId}
                change={(itemId) =>
                  set({
                    ...v,
                    itemId,
                    unit: items.find((i) => i.id === itemId)!.unit,
                    recipeVersion: null,
                  })
                }
                options={items}
              />
              <Field label="Quantity">
                <Num
                  min={0.0001}
                  value={v.quantity}
                  onChange={(quantity) => set({ ...v, quantity })}
                />
              </Field>
              <Field label="Unit">
                <Unit value={v.unit} onChange={(unit) => set({ ...v, unit })} />
              </Field>
              <Place
                locations={inventory.locations}
                value={v.locationId}
                change={(locationId) => set({ ...v, locationId })}
              />
              <Text
                label="Date recorded"
                type="date"
                value={v.date}
                change={(date) => set({ ...v, date })}
              />
              {v.kind === "recipe" && (
                <Text
                  label="Prepared on (if known)"
                  type="date"
                  value={v.preparedOn ?? ""}
                  change={(preparedOn) =>
                    set({ ...v, preparedOn: preparedOn || null })
                  }
                />
              )}
            </div>
            <Text
              label="Source of stock"
              value={v.source}
              change={(source) => set({ ...v, source })}
            />
            <p className="help">
              For example: flour already in my cupboard, or brownies baked
              yesterday. Do not guess a preparation date.
            </p>
            <Dates value={v} change={(dates) => set({ ...v, ...dates })} />
            <details>
              <summary>Optional cost & notes</summary>
              <Select
                label="Cost information"
                value={v.valuationStatus}
                change={(valuationStatus) =>
                  set({
                    ...v,
                    valuationStatus,
                    totalCost:
                      valuationStatus === "unknown" ? null : (v.totalCost ?? 0),
                  })
                }
                options={[
                  { id: "unknown", name: "Unknown — leave unvalued" },
                  { id: "known", name: "Known total cost" },
                  { id: "estimated", name: "Estimated total cost" },
                ]}
              />
              {v.valuationStatus !== "unknown" && (
                <Field label="Total cost for this quantity (£)">
                  <Num
                    value={v.totalCost ?? 0}
                    onChange={(totalCost) => set({ ...v, totalCost })}
                  />
                </Field>
              )}
              <Text
                label="Stock notes"
                value={v.notes}
                change={(notes) => set({ ...v, notes })}
              />
            </details>
            <p className="notice">
              Unreviewed or expired stock remains unavailable. Historical
              products have no ingredient-lot trace; current recipe information
              does not establish what went into them.{" "}
              {v.valuationStatus === "unknown"
                ? "Valuation will remain unknown, including costs of later batches using this stock."
                : ""}
            </p>
          </>
        );
      }}
    </DraftForm>
  );
}
