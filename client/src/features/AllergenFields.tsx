import { Field } from "../components/ui";
import type { AllergenProfile } from "../types";
import { today } from "../api";
export const allergens: Record<string, string> = {
  celery: "Celery",
  "cereals-gluten": "Cereals containing gluten",
  crustaceans: "Crustaceans",
  eggs: "Eggs",
  fish: "Fish",
  lupin: "Lupin",
  milk: "Milk",
  molluscs: "Molluscs",
  mustard: "Mustard",
  peanuts: "Peanuts",
  sesame: "Sesame",
  soya: "Soya",
  sulphites: "Sulphur dioxide / sulphites",
  "tree-nuts": "Tree nuts",
};
export const statusLabels: Record<string, string> = {
  contains: "Contains",
  risk: "May contain / cross-contact risk",
  unknown: "Unknown",
  unverified:
    "Not identified in declared ingredients · dietary suitability not verified",
  verified: "Verified under documented controls",
};
export const emptyProfile = (legacy = ""): AllergenProfile => ({
  contains: [],
  mayContain: [],
  verification: "unknown",
  supplierText: legacy,
  source: "",
  crossContactNotes: "",
  reviewer: "",
  verifiedOn: null,
});
export default function AllergenFields({
  value,
  onChange,
}: {
  value: AllergenProfile;
  onChange: (v: AllergenProfile) => void;
}) {
  const set = <K extends keyof AllergenProfile>(k: K, v: AllergenProfile[K]) =>
    onChange({ ...value, [k]: v });
  const toggle = (key: "contains" | "mayContain", id: string) =>
    set(
      key,
      value[key].includes(id)
        ? value[key].filter((x) => x !== id)
        : [...value[key], id],
    );
  return (
    <section className="allergen-fields">
      <h3>Allergen declarations</h3>
      <p className="help">
        Unticked allergens are not confirmed absent. Record all 14 from the
        supplier label, including the specific cereals or nuts in the original
        information below. Sulphites declarations depend on concentration;
        record the supplier’s declaration.
      </p>
      <div className="allergen-checks">
        <div className="allergen-check-head">
          <span>UK declarable allergen</span>
          <span>Contains</span>
          <span>May contain</span>
        </div>
        {Object.entries(allergens).map(([id, name]) => (
          <div key={id}>
            <span>
              {name}
              <small className="declaration-status">
                {value.contains.includes(id)
                  ? "Contains allergen"
                  : value.mayContain.includes(id)
                    ? "May contain allergen"
                    : value.verification === "verified"
                      ? "Not declared as an ingredient (source reviewed)"
                      : "Unknown / information not reviewed"}
              </small>
            </span>
            <input
              aria-label={`${name}: contains`}
              type="checkbox"
              checked={value.contains.includes(id)}
              onChange={() => toggle("contains", id)}
            />
            <input
              aria-label={`${name}: may contain`}
              type="checkbox"
              checked={value.mayContain.includes(id)}
              onChange={() => toggle("mayContain", id)}
            />
          </div>
        ))}
      </div>
      <Field label="Allergen information status">
        <select
          value={value.verification}
          onChange={(e) =>
            onChange({
              ...value,
              verification: e.target.value,
              verifiedPriceSource: null,
            })
          }
        >
          <option value="unknown">Unknown — not yet assessed</option>
          <option value="unverified">Recorded — awaiting verification</option>
          <option value="verified">
            All 14 checked against documented supplier information
          </option>
        </select>
      </Field>
      <button
        type="button"
        className="secondary"
        onClick={() =>
          onChange({
            ...value,
            verification: "verified",
            verifiedOn: today(),
            verifiedPriceSource: null,
          })
        }
      >
        Confirm current supplier information checked today
      </button>
      <p className="help">
        Use this confirmation only after checking all 14 allergens against the
        current supplier/product specification. Changing supplier or product
        reference requires fresh verification.
      </p>
      <Field label="Original supplier / manufacturer allergen information">
        <textarea
          rows={4}
          value={value.supplierText}
          onChange={(e) => set("supplierText", e.target.value)}
        />
      </Field>
      <Field label="Supplier / manufacturer name">
        <input
          value={value.supplierName ?? ""}
          onChange={(e) => set("supplierName", e.target.value)}
        />
      </Field>
      <Field label="Source verification notes">
        <textarea
          value={value.verificationNotes ?? ""}
          onChange={(e) => set("verificationNotes", e.target.value)}
        />
      </Field>
      <div className="form-grid">
        <Field label="Verification source / evidence reference">
          <input
            value={value.source}
            onChange={(e) => set("source", e.target.value)}
          />
        </Field>
        <Field label="Date verified">
          <input
            type="date"
            value={value.verifiedOn ?? ""}
            onChange={(e) => set("verifiedOn", e.target.value || null)}
          />
        </Field>
        <Field label="Verified by">
          <input
            value={value.reviewer}
            onChange={(e) => set("reviewer", e.target.value)}
          />
        </Field>
      </div>
      <Field label="Unresolved cross-contact risks">
        <textarea
          value={value.crossContactNotes}
          onChange={(e) => set("crossContactNotes", e.target.value)}
        />
      </Field>
      <p className="help">
        Unresolved risks block dietary approval. Supplier verification does not
        establish that a finished recipe is suitable: preparation controls
        require a separate recipe review.
      </p>
    </section>
  );
}
