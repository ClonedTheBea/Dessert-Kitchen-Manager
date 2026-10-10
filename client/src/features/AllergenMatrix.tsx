import { Modal } from "../components/ui";
import type { State } from "../types";
import { allergens, statusLabels } from "./AllergenFields";
export default function AllergenMatrix({
  state,
  close,
}: {
  state: State;
  close: () => void;
}) {
  return (
    <Modal title="Kitchen allergen matrix" close={close} wide>
      <div className="matrix-print">
        <h2>Kitchen allergen matrix · internal reference</h2>
        <p>
          Generated{" "}
          {new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}.
          Check current supplier specifications and controls before every use.
          Unknown and unverified entries are never confirmed suitable.
        </p>
        <div className="actions no-print">
          <button className="secondary" onClick={() => window.print()}>
            Print matrix
          </button>
          <a className="primary" href="/api/allergens/export">
            Export allergen CSV
          </a>
        </div>
        <p className="help">
          All declared optional components are included. For distance sales,
          allergen information must be available before purchase and when
          delivered. This internal matrix is not a customer label.{" "}
          <a
            href="https://www.gov.uk/food-allergies"
            target="_blank"
            rel="noreferrer"
          >
            UK takeaway allergen guidance
          </a>
          .
        </p>
        <div className="table-wrap allergen-matrix">
          <table>
            <thead>
              <tr>
                <th>Recipe / version</th>
                {Object.values(allergens).map((n) => (
                  <th key={n}>{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.recipes.map(({ recipe: r }) => (
                <tr key={r.id}>
                  <th>
                    {r.name} · v{r.revision}
                    <small>
                      {r.isSellable ? "Sellable" : "Internal"}
                      {r.variantOf ? " · Variant" : ""}
                      {state.recipeSafety[r.id]?.needsReview
                        ? " · Re-evaluate sources"
                        : ""}
                    </small>
                  </th>
                  {Object.keys(allergens).map((id) => {
                    const status =
                      state.recipeSafety[r.id]?.statuses[id] ?? "unknown";
                    return (
                      <td key={id}>
                        <span className={"safety-label " + status}>
                          {statusLabels[status]}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="help">
          Contains = unsuitable for that allergen restriction. May contain /
          cross-contact risk = unsuitable pending risk resolution. No relevant
          allergen identified = requires review, not a free-from claim. Verified
          = current explicit documented approval.
        </p>
      </div>
    </Modal>
  );
}
