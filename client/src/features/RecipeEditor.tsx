import { Clock, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, date, money, number } from "../api";
import type { Cost, Recipe, State, Version } from "../types";
import { useAutoSave, SaveStatus } from "../autoSave";
import MethodEditor from "./MethodEditor";
import RecipeAllergens from "./RecipeAllergens";

import { ErrorBox, Field, Num, Tag, Unit, clone } from "../components/ui";
export default function RecipeEditor({
  recipe,
  methodOnly = false,
  initialSection = "recipe",
  state,
  close,
  saved,
}: {
  recipe: Recipe;
  methodOnly?: boolean;
  initialSection?: string;
  state: State;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [editorTab, setEditorTab] = useState(methodOnly ? "method" : "recipe");
  const [draft, setDraft] = useState(clone(recipe));
  const autosave = useAutoSave(
    draft,
    setDraft,
    `/drafts/recipe/${recipe.id || "new"}`,
    true,
  );
  const scaleRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (initialSection === "scale" && autosave.ready)
      scaleRef.current?.scrollIntoView({ block: "start" });
  }, [initialSection, autosave.ready]);
  const [cost, setCost] = useState<Cost>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [history, setHistory] = useState(false);
  const [scale, setScale] = useState(recipe.yield);
  const [substitution, setSubstitution] = useState(false);
  const update = <K extends keyof Recipe>(key: K, value: Recipe[K]) => {
    setDraft({ ...draft, [key]: value });
    setCost(undefined);
  };
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (draft.lines.length && draft.name)
        api<Cost>("/recipes/preview", draft)
          .then((c) => {
            if (active) setCost(c);
          })
          .catch(() => {
            if (active) setCost(undefined);
          });
    }, 400);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft]);
  const lineUpdate = (
    index: number,
    changes: Partial<Recipe["lines"][number]>,
  ) => {
    if (
      changes.referenceId &&
      changes.referenceId !== draft.lines[index].referenceId
    )
      setSubstitution(true);
    update(
      "lines",
      draft.lines.map((l, i) => (i === index ? { ...l, ...changes } : l)),
    );
  };
  const preview = async () => {
    setError("");
    setBusy(true);
    try {
      setCost(await api<Cost>("/recipes/preview", draft));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="recipe-editor-page">
      <div className="section-heading">
        <h1>{recipe.id ? recipe.name : "Create a recipe"}</h1>
      </div>
      <form
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            if (!(await autosave.flush())) return;
            await api(`/drafts/recipe/${recipe.id || "new"}/publish`, {
              revision: autosave.revision(),
            });
            await saved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="editor-save-bar">
          <SaveStatus save={autosave} />
          <button className="primary" disabled={busy || !autosave.ready}>
            {methodOnly ? "Publish method & return" : "Publish recipe version"}
          </button>
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              if (await autosave.flush()) close();
            }}
          >
            Return to recipe
          </button>
        </div>
        <p className="help">
          Edits save automatically to a working draft. Published versions and
          their cost snapshots stay unchanged until you publish. Dietary
          approval is optional and separate.
        </p>
        {!methodOnly && (
          <div className="editor-tabs" aria-label="Recipe editor sections">
            {["recipe", "method", "cost"].map((tab) => (
              <button
                key={tab}
                type="button"
                aria-pressed={editorTab === tab}
                onClick={() => setEditorTab(tab)}
              >
                {tab === "recipe"
                  ? "Recipe details"
                  : tab === "method"
                    ? "Method"
                    : "Cost & pricing"}
              </button>
            ))}
          </div>
        )}
        <fieldset disabled={!autosave.ready || busy} className="editor-fields">
          <div hidden={editorTab !== "method"}>
            <MethodEditor
              steps={draft.methodSteps ?? []}
              onChange={(steps) => update("methodSteps", steps)}
            />
          </div>
          <div className="editor-columns" hidden={editorTab === "method"}>
            <div hidden={editorTab !== "recipe"}>
              <div className="form-grid">
                <Field label="Recipe name">
                  <input
                    autoFocus
                    required
                    maxLength={200}
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                  />
                </Field>
                <Field label="Category">
                  <input
                    required
                    value={draft.category}
                    onChange={(e) => update("category", e.target.value)}
                    list="recipe-categories"
                  />
                  <datalist id="recipe-categories">
                    {[
                      "Cheesecakes",
                      "Brownies",
                      "Cookie dough",
                      "Waffles",
                      "Milkshakes",
                      "Sub-recipes",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Batch yield">
                  <Num
                    min={0.0001}
                    value={draft.yield}
                    onChange={(v) => update("yield", v)}
                  />
                </Field>
                <Field
                  label="Yield unit"
                  hint="Use each for portions; g or ml for bulk sub-recipes."
                >
                  <Unit
                    value={draft.yieldUnit}
                    onChange={(v) => update("yieldUnit", v)}
                  />
                </Field>
              </div>
              <Field label="Recipe type">
                <select
                  value={draft.isSellable === false ? "internal" : "sellable"}
                  onChange={(e) =>
                    update("isSellable", e.target.value === "sellable")
                  }
                >
                  <option value="sellable">Sellable finished product</option>
                  <option value="internal">Internal sub-recipe</option>
                </select>
              </Field>
              <Field label="Description">
                <textarea
                  rows={3}
                  value={draft.description}
                  onChange={(e) => update("description", e.target.value)}
                />
              </Field>
              <div className="section-heading compact">
                <h3>Ingredients & sub-recipes</h3>
                <button
                  className="text-button"
                  type="button"
                  onClick={() =>
                    update("lines", [
                      ...draft.lines,
                      {
                        kind: "ingredient",
                        referenceId:
                          state.ingredients.find((i) => !i.archived)?.id ?? "",
                        quantity: 1,
                        unit:
                          state.ingredients.find((i) => !i.archived)
                            ?.baseUnit ?? "g",
                        wastePercent: 0,
                      },
                    ])
                  }
                >
                  <Plus size={16} />
                  Add line
                </button>
              </div>
              <div className="recipe-lines">
                {draft.lines.map((line, index) => (
                  <div className="recipe-line" key={index}>
                    <Field label={`Line ${index + 1}`}>
                      <select
                        aria-label={`Line ${index + 1} ingredient or sub-recipe`}
                        value={`${line.kind}:${line.referenceId}`}
                        onChange={(e) => {
                          const [kind, referenceId] = e.target.value.split(":");
                          const unit =
                            kind === "ingredient"
                              ? state.ingredients.find(
                                  (i) => i.id === referenceId,
                                )!.baseUnit
                              : state.recipes.find(
                                  (v) => v.recipe.id === referenceId,
                                )!.recipe.yieldUnit;
                          lineUpdate(index, { kind, referenceId, unit });
                        }}
                      >
                        <optgroup label="Ingredients & packaging">
                          {state.ingredients
                            .filter(
                              (i) => !i.archived || i.id === line.referenceId,
                            )
                            .map((i) => (
                              <option key={i.id} value={`ingredient:${i.id}`}>
                                {i.name}
                                {i.archived ? " (archived)" : ""}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Reusable recipes">
                          {state.recipes
                            .filter((v) => v.recipe.id !== draft.id)
                            .map((v) => (
                              <option
                                key={v.recipe.id}
                                value={`recipe:${v.recipe.id}`}
                              >
                                {v.recipe.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </Field>
                    <Field label="Component role">
                      <select
                        value={line.role ?? "ingredient"}
                        onChange={(e) =>
                          lineUpdate(index, { role: e.target.value })
                        }
                      >
                        <option value="ingredient">Ingredient</option>
                        <option value="topping">Topping</option>
                        <option value="optional">Optional addition</option>
                        <option value="packaging">Packaging component</option>
                      </select>
                    </Field>
                    <Field label="Quantity">
                      <Num
                        min={0.0001}
                        value={line.quantity}
                        onChange={(v) => lineUpdate(index, { quantity: v })}
                      />
                    </Field>
                    <Field label="Unit">
                      <Unit
                        value={line.unit}
                        onChange={(v) => lineUpdate(index, { unit: v })}
                      />
                    </Field>
                    <Field label="Waste %">
                      <Num
                        max={100}
                        value={line.wastePercent}
                        onChange={(v) => lineUpdate(index, { wastePercent: v })}
                      />
                    </Field>
                    <button
                      className="icon-button remove"
                      type="button"
                      aria-label={`Remove line ${index + 1}`}
                      onClick={() =>
                        update(
                          "lines",
                          draft.lines.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              {draft.lines.length === 0 && (
                <p className="empty small">
                  Add ingredients to calculate the cost of your batch.
                </p>
              )}
              <p className="help">
                Wastage is an extra quantity allowance. Sub-recipes use their
                latest saved version; update a sub-recipe first to refresh its
                costs.
              </p>
              <details>
                <summary>Preparation time, storage & legacy notes</summary>
                <div className="form-grid three">
                  <Field label="Prep time (minutes)">
                    <Num
                      step="1"
                      value={draft.prepMinutes}
                      onChange={(v) => update("prepMinutes", v)}
                    />
                  </Field>
                  <Field label="Cook time (minutes)">
                    <Num
                      step="1"
                      value={draft.cookMinutes}
                      onChange={(v) => update("cookMinutes", v)}
                    />
                  </Field>
                  <Field label="Shelf life (days)">
                    <Num
                      step="1"
                      value={draft.shelfLifeDays}
                      onChange={(v) => update("shelfLifeDays", v)}
                    />
                  </Field>
                  <Field label="Portion size">
                    <Num
                      value={draft.portionSize}
                      onChange={(v) => update("portionSize", v)}
                    />
                  </Field>
                  <Field label="Portion size unit">
                    <Unit
                      value={draft.portionUnit}
                      onChange={(v) => update("portionUnit", v)}
                    />
                  </Field>
                </div>
                <Field label="Storage instructions">
                  <textarea
                    value={draft.storage}
                    onChange={(e) => update("storage", e.target.value)}
                  />
                </Field>
                <Field label="Allergen statement">
                  <textarea
                    value={draft.allergens}
                    onChange={(e) => update("allergens", e.target.value)}
                  />
                </Field>
                <p className="help">
                  Catalogue allergens:{" "}
                  {[
                    ...new Set(
                      draft.lines
                        .filter((l) => l.kind === "ingredient")
                        .map(
                          (l) =>
                            state.ingredients.find(
                              (i) => i.id === l.referenceId,
                            )?.allergens,
                        )
                        .filter(Boolean),
                    ),
                  ].join("; ") || "None recorded"}
                  . Verify sub-recipes, labels and cross-contact separately.
                </p>
              </details>
              {substitution && (
                <p className="review-warning">
                  Ingredient changed: costs and allergens have been
                  recalculated. Check quantities, texture, preparation controls
                  and dietary suitability before saving; a substitution is not
                  automatically suitable.
                </p>
              )}
              <RecipeAllergens draft={draft} original={recipe} state={state} />
              <details
                ref={scaleRef}
                className="scale-section"
                open={initialSection === "scale"}
              >
                <summary>Labour & batch scaling</summary>
                <div className="form-grid">
                  <Field label="Active labour per batch (minutes)">
                    <Num
                      value={draft.labourMinutes}
                      onChange={(v) => update("labourMinutes", v)}
                    />
                  </Field>
                  <Field label="Labour rate (£ / hour)">
                    <Num
                      value={draft.hourlyRate}
                      onChange={(v) => update("hourlyRate", v)}
                    />
                  </Field>
                </div>
                {recipe.id ? (
                  <div className="scale-row">
                    <Field label="Scale saved recipe to yield">
                      <Num min={0.0001} value={scale} onChange={setScale} />
                    </Field>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          !confirm(
                            "Scale from the last saved version? This replaces unsaved edits in this editor.",
                          )
                        )
                          return;
                        setBusy(true);
                        setError("");
                        try {
                          const v = await api<Version>(
                            `/recipes/${recipe.id}/scale`,
                            { yield: scale },
                          );
                          setDraft(v.recipe);
                          setCost(v.cost);
                        } catch (e) {
                          setError((e as Error).message);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Scale saved batch
                    </button>
                  </div>
                ) : (
                  <p className="help">
                    Save your first version to enable batch scaling.
                  </p>
                )}
                <p className="help">
                  Scaling changes quantities and labour proportionally. Review
                  labour and preparation time before saving.
                </p>
              </details>
            </div>
            <aside className="cost-panel" hidden={editorTab !== "cost"}>
              <span className="eyebrow">THE COST OF A GOOD RECIPE</span>
              <h3>
                {draft.isSellable === false
                  ? "Cost per yield unit"
                  : "Portion & pricing"}
              </h3>
              {draft.isSellable !== false && (
                <>
                  <Field label="Selling price per yield unit (£)">
                    <Num
                      value={draft.sellingPrice}
                      onChange={(v) => update("sellingPrice", v)}
                    />
                  </Field>
                  <Field label="Target recipe margin (%)">
                    <Num
                      max={99.99}
                      value={draft.targetMargin}
                      onChange={(v) => update("targetMargin", v)}
                    />
                  </Field>
                </>
              )}
              <button
                className="secondary full"
                type="button"
                disabled={busy}
                onClick={preview}
              >
                Calculate current costs
              </button>
              {cost ? (
                <>
                  <div className="cost-total">
                    <small>
                      COST PER{" "}
                      {draft.yieldUnit === "each"
                        ? "PORTION"
                        : draft.yieldUnit.toUpperCase()}
                    </small>
                    <strong>{money(cost.portionCost)}</strong>
                    <Tag sample={cost.isIllustrative} />
                  </div>
                  <dl className="breakdown">
                    <div>
                      <dt>Batch ingredients</dt>
                      <dd>{money(cost.ingredientCost)}</dd>
                    </div>
                    <div>
                      <dt>Batch packaging</dt>
                      <dd>{money(cost.packagingCost)}</dd>
                    </div>
                    <div>
                      <dt>Batch labour</dt>
                      <dd>{money(cost.labourCost)}</dd>
                    </div>
                    <div className="total">
                      <dt>Total batch cost</dt>
                      <dd>{money(cost.batchCost)}</dd>
                    </div>
                    {draft.isSellable !== false && (
                      <>
                        <div>
                          <dt>Suggested price</dt>
                          <dd>{money(cost.recommendedPrice)}</dd>
                        </div>
                        <div>
                          <dt>Contribution / unit</dt>
                          <dd>{money(cost.contribution)}</dd>
                        </div>
                        <div>
                          <dt>Recipe margin</dt>
                          <dd>{number(cost.marginPercent)}%</dd>
                        </div>
                      </>
                    )}
                  </dl>
                  <details>
                    <summary>Cost of each line</summary>
                    {cost.lines.map((l, i) => (
                      <div className="line-cost" key={i}>
                        <span>
                          {l.name}
                          <small>
                            {number(l.quantity)} {l.unit} + {l.wastePercent}%
                            waste
                          </small>
                        </span>
                        <strong>{money(l.cost)}</strong>
                      </div>
                    ))}
                  </details>
                </>
              ) : (
                <p className="help">
                  Calculate to preview the latest prices. Saving always
                  calculates and stores a new cost snapshot.
                </p>
              )}
              <p className="help">
                {draft.isSellable === false
                  ? "Internal components are costed per yield unit. Selling-price settings are retained and become available if you make this recipe sellable."
                  : "Recipe contribution excludes platform fees and sales VAT, which are modelled in the financial planner. The suggested price rounds up to the next penny."}
              </p>
            </aside>
          </div>
        </fieldset>
        <ErrorBox error={error} />
        <div className="form-actions spread">
          {recipe.id ? (
            <button
              className="text-button"
              type="button"
              onClick={async () => {
                setHistory(!history);
                try {
                  setVersions(
                    await api<Version[]>(`/recipes/${recipe.id}/versions`),
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Version history <Clock size={16} />
            </button>
          ) : (
            <span />
          )}
          <div className="actions">
            {recipe.id && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  if (
                    confirm(
                      "Create a separately costed variant from the current draft? The original recipe will remain unchanged.",
                    )
                  ) {
                    setDraft({
                      ...draft,
                      id: "",
                      revision: 0,
                      name: draft.name + " — variant",
                      variantOf: recipe.id,
                    });
                    setCost(undefined);
                  }
                }}
              >
                Create variant
              </button>
            )}
            <button
              type="button"
              className="secondary"
              onClick={async () => {
                if (await autosave.flush()) close();
              }}
            >
              Close · keep draft
            </button>
          </div>
        </div>
      </form>
      {history && (
        <section className="history">
          <h3>Saved versions · immutable cost snapshots</h3>
          {versions.map((v) => (
            <details key={v.recipe.revision}>
              <summary>
                Version {v.recipe.revision} · {date(v.recordedAt)} ·{" "}
                {money(v.cost.portionCost)} / {v.recipe.yieldUnit} ·{" "}
                {v.cost.isIllustrative ? "Illustrative" : "Entered costs"}
              </summary>
              <p>{v.recipe.description}</p>
              <ol className="method-read">
                {v.recipe.methodSteps?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              <p>
                Allergen snapshot:{" "}
                {v.allergenSnapshot
                  ? "Contains: " +
                    (v.allergenSnapshot.contains.join(", ") ||
                      "none declared") +
                    ". Unknown ingredients: " +
                    (v.allergenSnapshot.unknownIngredients.join(", ") || "none")
                  : "Not assessed in this legacy version — no safety inference."}
              </p>
              <p>
                Yield: {v.recipe.yield} {v.recipe.yieldUnit} · Batch:{" "}
                {money(v.cost.batchCost)}
              </p>
              {v.cost.lines.map((l, i) => (
                <div className="line-cost" key={i}>
                  <span>
                    {l.name} · {number(l.quantity)} {l.unit}
                    <small>Source: {l.sourceId}</small>
                  </span>
                  {money(l.cost)}
                </div>
              ))}
            </details>
          ))}
        </section>
      )}
    </section>
  );
}
