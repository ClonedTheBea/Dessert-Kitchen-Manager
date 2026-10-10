import { useEffect, useState } from "react";
import { Cookie, Layers } from "lucide-react";
import { api, money, number } from "../api";
import type { Recipe, State, Version } from "../types";
import { Modal } from "../components/ui";
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
  edit: (method?: boolean) => void;
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
  return (
    <Modal title={r.name} close={close} wide>
      <article className="recipe-reader">
        <div className="actions spread">
          <p>
            Version {r.revision} ·{" "}
            {r.isSellable === false ? "Internal recipe" : "Sellable product"}
            {historical ? " · Historical version" : ""}
          </p>
          <button className="secondary" onClick={() => edit()}>
            Edit recipe / resume draft
          </button>
        </div>
        <RecipeArt recipe={r} />
        <p className="preserve-text">{r.description}</p>
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
        <h2>Ingredients & sub-recipes</h2>
        <p>
          Yield: {number(r.yield)} {r.yieldUnit} · Batch cost{" "}
          {money(v.cost.batchCost)} · Cost / {r.yieldUnit}{" "}
          {money(v.cost.portionCost)}
        </p>
        <ul>
          {v.cost.lines.map((l, i) => (
            <li key={i}>
              {number(l.quantity)} {l.unit} {l.name}
              {l.wastePercent ? ` (+ ${l.wastePercent}% waste allowance)` : ""}
            </li>
          ))}
        </ul>
        {r.storage && (
          <>
            <h3>Storage</h3>
            <p className="preserve-text">{r.storage}</p>
          </>
        )}
        {!historical ? (
          <RecipeAllergens draft={r} original={r} state={state} />
        ) : (
          <p>
            Historical version: allergen information is not a current
            suitability claim.
          </p>
        )}
        <h3>Version history</h3>
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
        {error && <p role="alert">{error}</p>}
      </article>
    </Modal>
  );
}
