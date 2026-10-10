import { useState } from "react";
import { api } from "../api";
import { useAutoSave, SaveStatus } from "../autoSave";
import type { Ingredient } from "../types";
import AllergenFields, { emptyProfile } from "./AllergenFields";

import { ErrorBox, Field, Modal, Num, Unit, clone } from "../components/ui";
export default function IngredientEditor({
  ingredient,
  close,
  saved,
}: {
  ingredient: Ingredient;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(clone(ingredient));
  const creating = ingredient.revision === 0;
  const autosave = useAutoSave(
    draft,
    setDraft,
    creating ? "/drafts/ingredient/new" : "/ingredients",
    creating,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof Ingredient>(key: K, value: Ingredient[K]) =>
    setDraft({ ...draft, [key]: value });
  return (
    <Modal
      title={ingredient.id ? "Edit ingredient" : "Add an ingredient"}
      close={async () => {
        if (await autosave.flush()) {
          if (creating) close();
          else await saved();
        }
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setBusy(true);
          setError("");
          try {
            if (!(await autosave.flush())) return;
            if (creating)
              await api("/drafts/ingredient/new/publish", {
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
          <button className="primary" disabled={!autosave.ready}>
            {creating ? "Finalise ingredient" : "Done"}
          </button>
        </div>
        {creating && (
          <p className="help">
            New ingredient details save as a draft. Choose its base unit and
            stock type before finalising.
          </p>
        )}
        <fieldset className="editor-fields" disabled={!autosave.ready}>
          <div className="form-grid">
            <Field label="Ingredient name">
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
                list="categories"
              />
              <datalist id="categories">
                {[
                  "Dairy",
                  "Baking",
                  "Fruit",
                  "Toppings",
                  "Frozen",
                  "Packaging",
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </datalist>
            </Field>
            <Field
              label="Base unit"
              hint="Fixed after creation to preserve history."
            >
              <Unit
                value={draft.baseUnit}
                onChange={(v) => update("baseUnit", v)}
                disabled={!!draft.id}
              />
            </Field>
            <Field label="Brand">
              <input
                value={draft.brand}
                onChange={(e) => update("brand", e.target.value)}
              />
            </Field>
            <Field
              label="Allergens"
              hint="Legacy notes are retained here. Use structured allergen declarations below for assessment."
            >
              <input
                value={draft.allergens}
                onChange={(e) => update("allergens", e.target.value)}
              />
            </Field>
            <Field
              label={`Minimum stock (${draft.baseUnit})`}
              hint="Saved now for the inventory sprint."
            >
              <Num
                value={draft.minimumStock}
                onChange={(v) => update("minimumStock", v)}
              />
            </Field>
          </div>
          <Field label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => update("description", e.target.value)}
            />
          </Field>
          <details>
            <summary>Structured allergens & supplier verification</summary>
            <AllergenFields
              value={draft.allergenInfo ?? emptyProfile(draft.allergens)}
              onChange={(v) => update("allergenInfo", v)}
            />
          </details>
          <label className="checkbox">
            <input
              type="checkbox"
              disabled={!!draft.id}
              checked={draft.isPackaging}
              onChange={(e) => update("isPackaging", e.target.checked)}
            />
            This is a packaging item
          </label>
        </fieldset>
        <ErrorBox error={error} />
        <div className="form-actions">
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              if (await autosave.flush()) {
                if (creating) close();
                else await saved();
              }
            }}
          >
            Done
          </button>
          <button disabled={busy} className="primary">
            {busy ? "Saving…" : "Save ingredient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
