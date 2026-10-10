import { ArrowRight, CircleHelp, Plus, Search } from "lucide-react";
import { useState } from "react";
import { money, number, today } from "../api";
import type { Ingredient, State } from "../types";

import { Tag, type Notify } from "../components/ui";
import IngredientQuickAdd from "./IngredientQuickAdd";
import IngredientEditor from "./IngredientEditor";
import PriceEditor from "./PriceEditor";
import RecordManagement from "./RecordManagement";
import Suppliers from "./Suppliers";
export default function Ingredients({
  state,
  initialAction = "",
  refresh,
  notify,
}: {
  state: State;
  initialAction?: string;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [managing, setManaging] = useState<Ingredient>();
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All items");
  const [editing, setEditing] = useState<Ingredient>();
  const [creating, setCreating] = useState(initialAction === "ingredient");
  const [pricing, setPricing] = useState<Ingredient>();
  const [suppliers, setSuppliers] = useState(initialAction === "suppliers");
  const rows = state.ingredients.filter(
    (i) =>
      (showArchived || !i.archived) &&
      (filter !== "Packaging" || i.isPackaging) &&
      (filter !== "Ingredients" || !i.isPackaging) &&
      `${i.name} ${i.category} ${i.brand}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const current = (id: string) =>
    state.prices
      .filter((p) => p.ingredientId === id && p.effectiveDate <= today())
      .sort(
        (a, b) =>
          b.effectiveDate.localeCompare(a.effectiveDate) ||
          b.recordedAt.localeCompare(a.recordedAt),
      )[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">THE BUILDING BLOCKS</div>
          <h1>Ingredients & packaging</h1>
          <p>Know what goes in. Know what it costs.</p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setCreating(true)}>
            <Plus size={18} />
            Add ingredient
          </button>
        </div>
      </div>
      <div className="notice">
        <CircleHelp size={20} />
        <div>
          Supplier prices are <strong>quotes, not purchases or stock.</strong>{" "}
          The latest effective quote is used for new costings. Previous recipe
          versions keep their original prices.
        </div>
      </div>
      <label className="checkbox shell-caption">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Include archived ingredients
      </label>
      <section className="panel">
        <div className="toolbar">
          <div className="segmented">
            {["All items", "Ingredients", "Packaging"].map((f) => (
              <button
                key={f}
                className={filter === f ? "selected" : ""}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="search">
            <Search size={17} />
            <input
              aria-label="Search ingredients"
              placeholder="Search ingredients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Scrollable table"
        >
          <table>
            <thead>
              <tr>
                <th>INGREDIENT</th>
                <th>CATEGORY</th>
                <th>LATEST PACK PRICE</th>
                <th>SUPPLIER</th>
                <th>SOURCE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const p = current(i.id);
                return (
                  <tr key={i.id}>
                    <td>
                      <button
                        className="table-link"
                        onClick={() => setEditing(i)}
                      >
                        {i.name}
                        {i.archived && " · Archived"}
                      </button>
                      <small>
                        {i.brand ||
                          (i.isPackaging
                            ? "Packaging"
                            : `Base unit: ${i.baseUnit}`)}
                      </small>
                    </td>
                    <td>{i.category}</td>
                    <td>
                      {p ? (
                        <>
                          {money(p.packPrice)}
                          <small>
                            {number(p.packQuantity)} {p.unit} ·{" "}
                            {p.priceIncludesVat ? "VAT included" : "ex VAT"}
                          </small>
                          <small>
                            Cost: £{state.unitCosts[p.id].cost.toFixed(6)} /{" "}
                            {state.unitCosts[p.id].unit}
                            {state.unitCosts[p.id].unit !== "each" && (
                              <>
                                {" "}
                                · {money(state.unitCosts[p.id].bulkCost)} /{" "}
                                {state.unitCosts[p.id].bulkUnit}
                              </>
                            )}
                          </small>
                        </>
                      ) : (
                        <span className="muted">No current price</span>
                      )}
                    </td>
                    <td>
                      {state.suppliers.find((s) => s.id === p?.supplierId)
                        ?.name ?? "—"}
                    </td>
                    <td>{p ? <Tag sample={p.isIllustrative} /> : "—"}</td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setPricing(i)}
                      >
                        Update price <ArrowRight size={15} />
                      </button>
                      <br />
                      <button
                        className="text-button"
                        onClick={() => setManaging(i)}
                      >
                        Manage record
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="empty">No ingredients match your search.</div>
          )}
        </div>
        <div className="panel-foot">
          {rows.length} items · All prices in GBP · Stock is managed in the
          Stock workspace
        </div>
      </section>
      {creating && (
        <IngredientQuickAdd
          state={state}
          close={() => setCreating(false)}
          saved={async () => {
            await refresh();
            setCreating(false);
            notify("Ingredient and initial price added.");
          }}
        />
      )}
      {managing && (
        <RecordManagement
          kind="ingredient"
          record={managing}
          close={() => setManaging(undefined)}
          saved={async () => {
            await refresh();
            notify("Ingredient record updated. History preserved.");
          }}
        />
      )}
      {editing && (
        <IngredientEditor
          ingredient={editing}
          close={() => setEditing(undefined)}
          saved={async () => {
            await refresh();
            setEditing(undefined);
            notify("Ingredient saved.");
          }}
        />
      )}
      {pricing && (
        <PriceEditor
          ingredient={pricing}
          state={state}
          close={() => setPricing(undefined)}
          saved={async () => {
            await refresh();
            notify("Supplier quote added. Saved recipe costs are unchanged.");
          }}
        />
      )}
      {suppliers && (
        <Suppliers
          state={state}
          refresh={refresh}
          notify={notify}
          close={() => setSuppliers(false)}
        />
      )}
    </>
  );
}
