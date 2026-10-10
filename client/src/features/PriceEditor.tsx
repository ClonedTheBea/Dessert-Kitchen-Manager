import { useState } from "react";
import { useAutoSave, SaveStatus } from "../autoSave";
import { api, date, money, number, today } from "../api";
import type { Ingredient, Price, State } from "../types";

import { ErrorBox, Field, Modal, Num, Tag, Unit } from "../components/ui";
export default function PriceEditor({
  ingredient,
  state,
  close,
  saved,
}: {
  ingredient: Ingredient;
  state: State;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const latest = state.prices
    .filter(
      (p) => p.ingredientId === ingredient.id && p.effectiveDate <= today(),
    )
    .sort(
      (a, b) =>
        b.effectiveDate.localeCompare(a.effectiveDate) ||
        b.recordedAt.localeCompare(a.recordedAt),
    )[0];
  const [draft, setDraft] = useState<Price>({
    id: "",
    ingredientId: ingredient.id,
    supplierId: state.suppliers.find((s) => !s.archived)?.id ?? "",
    packQuantity: 1,
    unit: ingredient.baseUnit,
    packPrice: 0,
    vatRate: 0,
    priceIncludesVat: true,
    recoverVat: false,
    productReference: "",
    effectiveDate: today(),
    isIllustrative: false,
    recordedAt: "",
    ...(latest
      ? {
          supplierId: latest.supplierId,
          packQuantity: latest.packQuantity,
          unit: latest.unit,
          packPrice: latest.packPrice,
          vatRate: latest.vatRate,
          priceIncludesVat: latest.priceIncludesVat,
          recoverVat: latest.recoverVat,
          productReference: latest.productReference,
        }
      : {}),
  });
  const autosave = useAutoSave(
    draft,
    setDraft,
    `/drafts/price/${ingredient.id}`,
    true,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof Price>(key: K, value: Price[K]) =>
    setDraft({ ...draft, [key]: value });
  return (
    <Modal title={`Prices · ${ingredient.name}`} close={close} wide>
      <p className="muted">
        Add a supplier quote. History is retained; existing recipe versions are
        never repriced automatically.
      </p>
      {ingredient.archived && (
        <p className="review-warning">
          Archived ingredient: price history is retained. Restore this
          ingredient to add prices.
        </p>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            if (!(await autosave.flush())) return;
            await api(`/drafts/price/${ingredient.id}/publish`, {
              revision: autosave.revision(),
            });
            autosave.markPublished();
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
          <button
            className="primary"
            disabled={!autosave.ready || busy || ingredient.archived}
          >
            Confirm new price
          </button>
        </div>
        <p className="help">
          Automatic saves retain a working quote. Confirm once to add it to
          immutable price history.
        </p>
        <fieldset
          className="editor-fields"
          disabled={!autosave.ready || busy || ingredient.archived}
        >
          <div className="form-grid three">
            <Field label="Supplier">
              <select
                value={draft.supplierId}
                onChange={(e) => update("supplierId", e.target.value)}
                required
              >
                {state.suppliers
                  .filter((s) => !s.archived)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Pack quantity">
              <Num
                min={0.0001}
                value={draft.packQuantity}
                onChange={(v) => update("packQuantity", v)}
              />
            </Field>
            <Field label="Pack unit">
              <Unit value={draft.unit} onChange={(v) => update("unit", v)} />
            </Field>
            <Field label="Pack price (£)">
              <Num
                value={draft.packPrice}
                onChange={(v) => update("packPrice", v)}
              />
            </Field>
          </div>
          <details>
            <summary>VAT, effective date & price source</summary>
            <div className="form-grid three">
              <Field label="VAT rate (%)">
                <Num
                  max={100}
                  value={draft.vatRate}
                  onChange={(v) => update("vatRate", v)}
                />
              </Field>
              <Field label="Effective date">
                <input
                  type="date"
                  required
                  value={draft.effectiveDate}
                  onChange={(e) => update("effectiveDate", e.target.value)}
                />
              </Field>
              <Field label="Supplier product reference">
                <input
                  value={draft.productReference}
                  onChange={(e) => update("productReference", e.target.value)}
                />
              </Field>
            </div>
            <div className="checkbox-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.priceIncludesVat}
                  onChange={(e) => update("priceIncludesVat", e.target.checked)}
                />
                Price includes VAT
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.recoverVat}
                  onChange={(e) => update("recoverVat", e.target.checked)}
                />
                Recover input VAT in costing
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.isIllustrative}
                  onChange={(e) => update("isIllustrative", e.target.checked)}
                />
                Illustrative price
              </label>
            </div>
            <p className="help">
              Leave VAT recovery off when not VAT registered. Only recover
              eligible input VAT. This is a costing assumption, not a VAT
              return.
            </p>
          </details>
        </fieldset>
        <ErrorBox error={error} />
      </form>
      <details>
        <summary>Price history</summary>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Scrollable table"
        >
          <table>
            <thead>
              <tr>
                <th>EFFECTIVE</th>
                <th>SUPPLIER</th>
                <th>PACK</th>
                <th>PRICE</th>
                <th>TREATMENT</th>
                <th>SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {state.prices
                .filter((p) => p.ingredientId === ingredient.id)
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      {date(p.effectiveDate)}
                      {p.effectiveDate > today() && <small>Future quote</small>}
                    </td>
                    <td>
                      {state.suppliers.find((s) => s.id === p.supplierId)?.name}
                      <small>{p.productReference}</small>
                    </td>
                    <td>
                      {number(p.packQuantity)} {p.unit}
                    </td>
                    <td>{money(p.packPrice)}</td>
                    <td>
                      {p.priceIncludesVat ? "Incl." : "Excl."} {p.vatRate}% VAT
                      <small>
                        {p.recoverVat
                          ? "VAT recovered in costing"
                          : "VAT included in cost"}
                      </small>
                    </td>
                    <td>
                      <Tag sample={p.isIllustrative} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </Modal>
  );
}
