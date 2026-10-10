import { useEffect, useState } from "react";
import { Cookie, Layers } from "lucide-react";
import { api, money, number } from "../api";
import type { Recipe, State, Version } from "../types";
import RecipeAllergens from "./RecipeAllergens";
export function RecipeArt({ recipe }: { recipe: Recipe }) {
  return (
    <div
      className={
        "recipe-hero art-" +
        (recipe.category === "Brownies"
          ? "brownie"
          : recipe.category === "Cheesecakes"
            ? "cheesecake"
            : "other")
      }
      role="img"
      aria-label={`${recipe.name} · category illustration`}
    >
      <span>
        {recipe.isSellable === false ? (
          <Layers size={64} />
        ) : (
          <Cookie size={64} />
        )}
      </span>
      <small>Recipe illustration</small>
    </div>
  );
}
export default function RecipeView({
  recipe,
  state,
  close,
  edit,
}: {
  recipe: Recipe;
  state: State;
  close: () => void;
  edit: (method?: boolean, section?: string) => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selected, setSelected] = useState(recipe.revision);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Version[]>(`/recipes/${recipe.id}/versions`)
      .then(setVersions)
      .catch((e) => setError(e.message));
  }, [recipe.id]);
  const v =
    versions.find((v) => v.recipe.revision === selected) ??
    state.recipes.find((v) => v.recipe.id === recipe.id)!;
  const r = v.recipe;
  const historical = r.revision !== recipe.revision;
  const [costOpen, setCostOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <article className="recipe-page recipe-reader">
      <button className="text-button back-link" onClick={close}>
        ← Back to recipes
      </button>
      <div className="recipe-title">
        <RecipeArt recipe={r} />
        <div>
          <div className="eyebrow">
            {r.category} · Version {r.revision}
            {historical ? " · Historical" : ""}
          </div>
          <h1>{r.name}</h1>
          <p className="preserve-text">{r.description}</p>
        </div>
      </div>
      <div className="reader-stats">
        <span>
          Batch yield{" "}
          <strong>
            {number(r.yield)} {r.yieldUnit}
          </strong>
        </span>
        <span>
          Portion cost <strong>{money(v.cost.portionCost)}</strong>
        </span>
        <span>
          Prep <strong>{r.prepMinutes} min</strong>
        </span>
        <span>
          Cook <strong>{r.cookMinutes} min</strong>
        </span>
      </div>
      <div className="actions">
        <button
          className="primary"
          onClick={() => edit()}
          disabled={historical}
        >
          Edit Recipe
        </button>
        <button
          className="secondary"
          onClick={() => edit(false, "scale")}
          disabled={historical}
        >
          Scale Recipe
        </button>
        <button
          className="secondary"
          onClick={() => setCostOpen(!costOpen)}
          aria-expanded={costOpen}
        >
          View Cost
        </button>
        <button
          className="secondary"
          onClick={() => setHistoryOpen(!historyOpen)}
          aria-expanded={historyOpen}
        >
          View History
        </button>
      </div>
      {historical && (
        <p className="notice">
          Select the latest version in View History to edit or scale this
          recipe.
        </p>
      )}
      <div className="reader-grid">
        <section>
          <h2>Ingredients & sub-recipes</h2>
          <ul>
            {v.cost.lines.map((l, i) => (
              <li key={i}>
                {number(l.quantity)} {l.unit} {l.name}
                {l.wastePercent
                  ? ` (+ ${l.wastePercent}% waste allowance)`
                  : ""}
              </li>
            ))}
          </ul>
          <h3>Storage instructions</h3>
          <p className="preserve-text">
            {r.storage || "No storage instructions recorded."}
          </p>
        </section>
        <section>
          <div className="section-heading">
            <h2>Preparation method</h2>
            {!historical && (
              <button className="secondary" onClick={() => edit(true)}>
                {r.methodSteps?.length ? "Edit Method" : "Add Method"}
              </button>
            )}
          </div>
          {r.methodSteps?.length ? (
            <ol className="method-read">
              {r.methodSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          ) : (
            <p>
              No preparation method yet. Add numbered steps to use this recipe
              while baking. Existing notes remain in the description.
            </p>
          )}
        </section>
      </div>
      {costOpen && (
        <section className="workflow-step">
          <h2>Published recipe cost</h2>
          <p>
            Batch {money(v.cost.batchCost)} · Per {r.yieldUnit}{" "}
            {money(v.cost.portionCost)} ·{" "}
            {v.cost.isIllustrative
              ? "Includes illustrative prices"
              : "Entered prices"}
          </p>
          {v.cost.lines.map((l, i) => (
            <div className="line-cost" key={i}>
              <span>{l.name}</span>
              <strong>{money(l.cost)}</strong>
            </div>
          ))}
        </section>
      )}
      {historyOpen && (
        <section className="workflow-step">
          <h2>Version history</h2>
          <label>
            View published version{" "}
            <select
              aria-label="View published version"
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {versions.map((v) => (
                <option key={v.recipe.revision} value={v.recipe.revision}>
                  Version {v.recipe.revision}
                </option>
              ))}
            </select>
          </label>
        </section>
      )}
      <details>
        <summary>Allergen information & dietary reviews</summary>
        {!historical ? (
          <RecipeAllergens draft={r} original={r} state={state} initiallyOpen />
        ) : (
          <p>
            Historical version: allergen information is not a current
            suitability claim.
          </p>
        )}
      </details>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
