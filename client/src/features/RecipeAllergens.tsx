import { useEffect, useState } from "react";
import { useAutoSave, SaveStatus } from "../autoSave";
import IngredientEditor from "./IngredientEditor";
import { api, date, today } from "../api";
import { ErrorBox, Field } from "../components/ui";
import type {
  AllergenAssessment,
  DietaryReview,
  Recipe,
  RecipeSafety,
  State,
  Ingredient,
} from "../types";
import { allergens, statusLabels } from "./AllergenFields";
export default function RecipeAllergens({
  draft,
  original,
  state,
}: {
  draft: Recipe;
  original: Recipe;
  state: State;
}) {
  const [editingIngredient, setEditingIngredient] = useState<Ingredient>();
  const [localState, setLocalState] = useState(state);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const [assessment, setAssessment] = useState<AllergenAssessment>();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [safety, setSafety] = useState<RecipeSafety | undefined>(
    state.recipeSafety[original.id],
  );
  const [review, setReview] = useState<DietaryReview>({
    id: "",
    recipeId: original.id,
    target: "milk",
    approved: false,
    fingerprint: "",
    reviewer: "",
    reviewedOn: today(),
    supplierVerification: "",
    controls: "",
    evidence: "",
    notes: "",
    glutenPpm: null,
    recordedAt: "",
  });
  const autosave = useAutoSave(
    review,
    setReview,
    `/drafts/review/${original.id || "new"}`,
    true,
  );
  useEffect(() => {
    if (autosave.status === "Draft saved · not published" && original.id)
      void api<State>("/state")
        .then((s) => setSafety(s.recipeSafety[original.id]))
        .catch(() => {});
  }, [autosave.status, original.id]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  useEffect(() => {
    let active = true;
    setAssessment(undefined);
    const timer = setTimeout(() => {
      api<AllergenAssessment>("/recipes/allergens/preview", draft)
        .then((a) => {
          if (active) {
            setAssessment(a);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft, evidenceRevision]);
  const status = (id: string) => {
    const a = assessment;
    if (!a) return "unknown";
    const key = id === "gluten-free" ? "cereals-gluten" : id;
    if (a.contains.includes(key)) return "contains";
    if (a.mayContain.includes(key) || a.crossContactNotes.length) return "risk";
    if (a.unknownIngredients.length) return "unknown";
    return !dirty && safety?.assessment.fingerprint === a.fingerprint
      ? safety.statuses[id]
      : "unverified";
  };
  const save = async (approved: boolean) => {
    if (!assessment) return;
    if (
      approved &&
      !confirm(
        "Approve this exact saved recipe under the documented controls? This records your explicit review; it is not an independent safety certification.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      if (!(await autosave.flush())) return;
      await api(`/recipes/${original.id}/reviews`, {
        ...review,
        approved,
        fingerprint: assessment.fingerprint,
      });
      const next = await api<State>("/state");
      setSafety(next.recipeSafety[original.id]);
      setMessage(
        approved
          ? "Documented review approved."
          : "Review saved without approval; public claim withheld.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const text = (
    key:
      "reviewer" | "supplierVerification" | "controls" | "evidence" | "notes",
    label: string,
  ) => (
    <Field label={label}>
      <textarea
        rows={key === "reviewer" ? 1 : 2}
        value={review[key]}
        onChange={(e) => setReview({ ...review, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <details className="recipe-allergens" open>
      <summary>Allergens & dietary review</summary>
      <p className="help">
        You can save and publish recipes while dietary approval is pending.
        Supplier declarations describe ingredients; a free-from claim requires a
        separate documented approval.
      </p>
      <p className="help">
        Assessment includes every listed ingredient, sub-recipe, topping,
        optional addition and packaging component. Optional additions are
        included conservatively; use a separately assessed variant to omit one.
      </p>
      {safety?.needsReview && (
        <p className="review-warning">
          Review required: source information changed or this recipe has not yet
          had an allergen snapshot recorded.
        </p>
      )}
      {assessment && (
        <>
          <div className="allergen-status-grid">
            {Object.entries(allergens).map(([id, name]) => (
              <div key={id}>
                <strong>{name}</strong>
                <span className={"safety-label " + status(id)}>
                  {status(id) === "unverified"
                    ? `${name} is not identified among the declared ingredients. Cross-contact suitability has not been verified.`
                    : statusLabels[status(id)]}
                </span>
              </div>
            ))}
          </div>
          {assessment.unknownIngredients.length > 0 && (
            <p className="review-warning">
              Unknown: {assessment.unknownIngredients.join(", ")}
            </p>
          )}
          {assessment.unverifiedIngredients.length > 0 && (
            <p className="help">
              Supplier information awaiting verification:{" "}
              {assessment.unverifiedIngredients.join(", ")}
            </p>
          )}
          {assessment.crossContactNotes.map((n, i) => (
            <p className="review-warning" key={i}>
              {n}
            </p>
          ))}
        </>
      )}
      <details>
        <summary>Update ingredient supplier evidence</summary>
        <p>
          Review the original declaration, supplier/manufacturer, source, date
          and reviewer. Checking a source is not a free-from approval.
        </p>
        {Object.keys(assessment?.dependencies ?? {})
          .filter((k) => k.startsWith("ingredient:"))
          .map((k) => {
            const item = localState.ingredients.find(
              (i) => i.id === k.slice(11),
            );
            return (
              item && (
                <button
                  type="button"
                  className="secondary"
                  key={k}
                  onClick={() => setEditingIngredient(item)}
                >
                  Review source: {item.name}
                </button>
              )
            );
          })}
      </details>
      {editingIngredient && (
        <IngredientEditor
          ingredient={editingIngredient}
          close={() => setEditingIngredient(undefined)}
          saved={async () => {
            const next = await api<State>("/state");
            setLocalState(next);
            setSafety(next.recipeSafety[original.id]);
            setEvidenceRevision((v) => v + 1);
            setEditingIngredient(undefined);
          }}
        />
      )}
      <details>
        <summary>Document a suitability review</summary>
        <SaveStatus save={autosave} />
        <fieldset className="editor-fields" disabled={!autosave.ready}>
          <p className="help">
            Approval is optional. Return to the recipe at any time; review notes
            save as a draft and never approve a claim automatically.
          </p>
          <p className="help">
            Save recipe changes before reviewing. Any later recipe,
            nested-recipe or ingredient change invalidates approval. Evidence
            references and review records are retained; supporting files are
            stored by you.
          </p>
          <Field label="Review allergen / dietary claim">
            <select
              value={review.target}
              onChange={(e) => setReview({ ...review, target: e.target.value })}
            >
              {Object.entries(allergens).map(([id, name]) => (
                <option key={id} value={id}>
                  {name} restriction
                </option>
              ))}
              <option value="gluten-free">Gluten-free claim</option>
            </select>
          </Field>
          <p className="safety-label">
            Current status: {statusLabels[status(review.target)]}
          </p>
          <p className="review-warning">
            Before approval:{" "}
            {[
              dirty ? "Publish the recipe draft first" : null,
              assessment?.unknownIngredients.length
                ? "Review unknown sources: " +
                  assessment.unknownIngredients.join(", ")
                : null,
              assessment?.unverifiedIngredients.length
                ? "Verify supplier sources: " +
                  assessment.unverifiedIngredients.join(", ")
                : null,
              ["contains", "risk"].includes(status(review.target))
                ? "Resolve declared presence / cross-contact risks"
                : null,
              !review.reviewer ? "Enter reviewer" : null,
              !review.supplierVerification
                ? "Record supplier verification"
                : null,
              !review.controls ? "Document preparation controls" : null,
              !review.evidence ? "Provide supporting evidence" : null,
              review.target === "gluten-free" &&
              (review.glutenPpm === null ||
                review.glutenPpm > 20 ||
                review.glutenPpm < 0)
                ? "Provide evidence of 0–20 ppm in food as sold"
                : null,
            ]
              .filter(Boolean)
              .join("; ") ||
              "Check that all evidence covers this exact recipe and current controls."}
          </p>
          {text("reviewer", "Reviewer / approver")}
          <Field label="Date reviewed">
            <input
              type="date"
              value={review.reviewedOn}
              onChange={(e) =>
                setReview({ ...review, reviewedOn: e.target.value })
              }
            />
          </Field>
          {text("supplierVerification", "Supplier verification record")}
          {text("controls", "Preparation and cross-contact controls")}
          {text("evidence", "Supporting evidence / document references")}
          {text("notes", "Review notes")}
          {review.target === "gluten-free" && (
            <>
              <Field label="Documented gluten level in food as sold (ppm)">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={review.glutenPpm ?? ""}
                  onChange={(e) =>
                    setReview({
                      ...review,
                      glutenPpm:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </Field>
              <p className="help">
                The UK gluten-free threshold is no more than 20 mg/kg (20 ppm).
                Evidence and preparation controls must cover the finished food.
                This does not establish wheat-allergy suitability.{" "}
                <a
                  href="https://www.gov.uk/government/publications/food-allergen-labelling-and-information-requirements-technical-guidance/food-allergen-labelling-and-information-requirements-technical-guidance"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the food allergen guidance
                </a>
                .
              </p>
            </>
          )}
          <div className="actions wrap">
            <button
              type="button"
              className="secondary"
              disabled={
                busy || dirty || !original.id || !assessment || !autosave.ready
              }
              onClick={() => save(false)}
            >
              Save review without approval
            </button>
            <button
              type="button"
              className="primary"
              disabled={
                busy || dirty || !original.id || !assessment || !autosave.ready
              }
              onClick={() => save(true)}
            >
              Approve documented controls
            </button>
          </div>
          {dirty && (
            <p className="review-warning">
              Save this recipe version before recording a review.
            </p>
          )}
          <p className="help">
            Public claim eligibility is controlled by the server. No public menu
            is being published.
          </p>
        </fieldset>
      </details>
      {safety?.reviews.length ? (
        <details>
          <summary>Review history ({safety.reviews.length})</summary>
          {safety.reviews.map((r) => (
            <article className="review-history" key={r.id}>
              <strong>
                {r.target === "gluten-free"
                  ? "Gluten-free"
                  : allergens[r.target]}{" "}
                · {r.approved ? "Approved at review" : "Not approved"}
              </strong>
              <p>
                {r.reviewer} · {date(r.reviewedOn)} ·{" "}
                {r.fingerprint === assessment?.fingerprint
                  ? "Matches current assessment"
                  : "Superseded — not valid for this assessment"}
              </p>
              <p>{r.controls}</p>
              <p>Evidence: {r.evidence}</p>
              <p>{r.notes}</p>
            </article>
          ))}
        </details>
      ) : null}
      <ErrorBox error={error} />
      {message && <p role="status">{message}</p>}
    </details>
  );
}
