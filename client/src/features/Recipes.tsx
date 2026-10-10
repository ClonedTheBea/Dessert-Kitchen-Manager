import {
  ArrowUpRight,
  Clock,
  Cookie,
  Layers,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { money, number } from "../api";
import type { Recipe, State } from "../types";

import { Tag, clone, type Notify } from "../components/ui";
import { allergens, statusLabels } from "./AllergenFields";
import AllergenMatrix from "./AllergenMatrix";
import RecipeEditor from "./RecipeEditor";
import RecipeView from "./RecipeView";
export default function Recipes({
  state,
  refresh,
  notify,
}: {
  state: State;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [matrix, setMatrix] = useState(false);
  const [restriction, setRestriction] = useState("");
  const [suitability, setSuitability] = useState("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All recipes");
  const [editing, setEditing] = useState<Recipe>();
  const [viewing, setViewing] = useState<Recipe>();
  const [methodOnly, setMethodOnly] = useState(false);
  const blank: Recipe = {
    id: "",
    revision: 0,
    name: "",
    category: "Cheesecakes",
    description: "",
    yield: 5,
    yieldUnit: "each",
    portionSize: 0,
    portionUnit: "g",
    prepMinutes: 0,
    cookMinutes: 0,
    storage: "",
    shelfLifeDays: 0,
    allergens: "",
    labourMinutes: 0,
    hourlyRate: 0,
    sellingPrice: 5.95,
    targetMargin: 70,
    lines: [],
    methodSteps: [],
    isSellable: true,
  };
  const recipes = state.recipes.filter(
    (v) =>
      (!restriction ||
        suitability === "all" ||
        (suitability === "verified"
          ? state.recipeSafety[v.recipe.id]?.statuses[restriction] ===
            "verified"
          : suitability === "unsuitable"
            ? ["contains", "risk"].includes(
                state.recipeSafety[v.recipe.id]?.statuses[restriction],
              )
            : suitability === "no-contains"
              ? state.recipeSafety[v.recipe.id]?.statuses[restriction] !==
                "contains"
              : !["verified", "contains", "risk"].includes(
                  state.recipeSafety[v.recipe.id]?.statuses[restriction],
                ))) &&
      (category === "All recipes" || v.recipe.category === category) &&
      `${v.recipe.name} ${v.recipe.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">TEST. TASTE. REFINE.</div>
          <h1>Your recipe book</h1>
          <p>Every ingredient accounted for. Every portion with a purpose.</p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setMethodOnly(false);
            setEditing(blank);
          }}
        >
          <Plus size={18} />
          Create a recipe
        </button>
      </div>
      <div className="toolbar standalone">
        <div className="actions">
          <select
            aria-label="Filter recipes"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[
              "All recipes",
              ...new Set(state.recipes.map((r) => r.recipe.category)),
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <span className="muted">{recipes.length} recipes</span>
        </div>
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Search recipes"
            placeholder="Find a recipe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="allergen-filter panel">
        <label>
          Restriction
          <select
            aria-label="Allergen restriction"
            value={restriction}
            onChange={(e) => setRestriction(e.target.value)}
          >
            <option value="">No restriction selected</option>
            {Object.entries(allergens).map(([id, n]) => (
              <option key={id} value={id}>
                {n}
              </option>
            ))}
            <option value="gluten-free">Gluten-free</option>
          </select>
        </label>
        <label>
          Show
          <select
            aria-label="Suitability filter"
            value={suitability}
            onChange={(e) => setSuitability(e.target.value)}
            disabled={!restriction}
          >
            <option value="all">All statuses</option>
            <option value="no-contains">
              No declared ingredient containing this allergen
            </option>
            <option value="verified">Verified under documented controls</option>
            <option value="review">Requiring review / unknown</option>
            <option value="unsuitable">Contains / cross-contact risk</option>
          </select>
        </label>
        <button className="secondary" onClick={() => setMatrix(true)}>
          Allergen matrix & export
        </button>
        <p className="help">
          Ingredient filtering is not a suitability claim. Unknown records and
          cross-contact risks remain clearly identified.
        </p>
      </div>
      <div className="recipe-grid">
        {recipes.map(({ recipe: r, cost: c }) => (
          <button
            className="recipe-card"
            key={r.id}
            onClick={() => setViewing(clone(r))}
          >
            <div
              className={
                "recipe-card-art art-" +
                (r.category === "Brownies"
                  ? "brownie"
                  : r.category === "Cheesecakes"
                    ? "cheesecake"
                    : "other")
              }
            >
              <span className="recipe-initial">
                {r.isSellable === false ? (
                  <Layers size={48} strokeWidth={1.4} />
                ) : (
                  <Cookie size={48} strokeWidth={1.3} />
                )}
              </span>
              <Tag sample={c.isIllustrative} />
              <span className="version-label">v{r.revision}</span>
            </div>
            <div className="recipe-card-body">
              <span className="eyebrow">{r.category}</span>
              <h3>{r.name}</h3>
              <p className="help">
                {r.isSellable === false
                  ? "Internal component"
                  : "Sellable product"}
                {r.variantOf ? " · Separate variant" : ""}
              </p>
              {restriction && (
                <span
                  className={
                    "safety-label " +
                    state.recipeSafety[r.id]?.statuses[restriction]
                  }
                >
                  {
                    statusLabels[
                      state.recipeSafety[r.id]?.statuses[restriction] ??
                        "unknown"
                    ]
                  }
                </span>
              )}
              {state.recipeSafety[r.id]?.needsReview && (
                <p className="review-warning">
                  Allergen re-evaluation required
                </p>
              )}
              <p>
                <Layers size={14} /> {number(r.yield)}{" "}
                {r.yieldUnit === "each" ? "portions" : r.yieldUnit}{" "}
                <span>·</span>
                <Clock size={14} />
                {r.prepMinutes + r.cookMinutes} min
              </p>
              <div className="recipe-metrics">
                <div>
                  <small>
                    Cost / {r.yieldUnit === "each" ? "portion" : r.yieldUnit}
                  </small>
                  <strong>{money(c.portionCost)}</strong>
                </div>
                {r.isSellable !== false && (
                  <div>
                    <small>Selling price</small>
                    <strong>{money(r.sellingPrice)}</strong>
                  </div>
                )}
                <ArrowUpRight size={19} />
              </div>
            </div>
          </button>
        ))}
      </div>
      {recipes.length === 0 && (
        <div className="empty panel">
          No matching recipes. Create your first batch.
        </div>
      )}
      {matrix && (
        <AllergenMatrix state={state} close={() => setMatrix(false)} />
      )}
      {editing && (
        <RecipeEditor
          methodOnly={methodOnly}
          recipe={editing}
          state={state}
          close={() => {
            setEditing(undefined);
            void refresh().catch(() =>
              notify(
                "Could not refresh allergen reviews. Reload before relying on the catalogue.",
              ),
            );
          }}
          saved={async () => {
            await refresh();
            setEditing(undefined);
            const next = await (await fetch("/api/state")).json();
            setViewing(
              methodOnly
                ? next.recipes.find(
                    (v: { recipe: Recipe }) => v.recipe.id === editing.id,
                  )?.recipe
                : undefined,
            );
            notify("Recipe version saved with its cost snapshot.");
          }}
        />
      )}
      {viewing && !editing && (
        <RecipeView
          recipe={
            state.recipes.find((v) => v.recipe.id === viewing.id)?.recipe ??
            viewing
          }
          state={state}
          close={() => {
            setViewing(undefined);
            void refresh();
          }}
          edit={(method) => {
            setMethodOnly(!!method);
            setEditing(viewing);
          }}
        />
      )}
    </>
  );
}
