import { useEffect, useState } from "react";
import { api, today } from "../api";
import type { Business } from "../businessTypes";
import { ErrorBox, Modal } from "../components/ui";
import { N, S, T } from "./BusinessSettings";

export default function RunningCostsEditor({
  close,
  saved,
  openSettings,
}: {
  close: () => void;
  saved: () => Promise<void>;
  openSettings: (action?: string) => void;
}) {
  const [draft, D] = useState<Business>();
  const [error, E] = useState("");
  const [busy, B] = useState(false);
  const [committed, C] = useState(false);
  useEffect(() => {
    api<Business>("/business")
      .then(D)
      .catch((e) => E(e.message));
  }, []);
  return (
    <Modal
      title="Edit running costs"
      close={() => {
        if (!busy) close();
      }}
    >
      <p>
        Changes are saved together when you choose Save running costs. Cancel or
        close discards unsaved edits.
      </p>
      <ErrorBox error={error} />
      {!draft && !error && <p role="status">Loading running costs…</p>}
      {draft && (
        <>
          {draft.effectiveFrom > today() && (
            <p role="status">
              These settings take effect on {draft.effectiveFrom}. Today's
              overview will continue to use the earlier rates until then.
            </p>
          )}
          <p className="help">Yearly bills are spread across 12 months. Existing VAT and allocation settings are retained.</p>
          <fieldset className="running-cost-fields" disabled={busy || committed}>
            {draft.expenses.map(
              (e, index) =>
                e.attribution === "overhead" && (
                  <div className="running-cost-row" key={e.id}>
                    <div className="form-grid">
                      <T
                        label="Cost name"
                        value={e.name}
                        onChange={(v) =>
                          D({
                            ...draft,
                            expenses: draft.expenses.map((x, i) =>
                              i === index ? { ...x, name: v } : x,
                            ),
                          })
                        }
                      />
                      <N
                        label="Amount (£)"
                        value={e.amount}
                        onChange={(v) =>
                          D({
                            ...draft,
                            expenses: draft.expenses.map((x, i) =>
                              i === index ? { ...x, amount: v } : x,
                            ),
                          })
                        }
                      />
                      <S
                        label="Paid"
                        value={e.period}
                        options={[
                          ["monthly", "Monthly"],
                          ["annual", "Yearly"],
                        ]}
                        onChange={(v) =>
                          D({
                            ...draft,
                            expenses: draft.expenses.map((x, i) =>
                              i === index ? { ...x, period: v } : x,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                ),
            )}
            <button
              className="secondary"
              onClick={() =>
                D({
                  ...draft,
                  expenses: [
                    ...draft.expenses,
                    {
                      id: crypto.randomUUID(),
                      name: "New running cost",
                      amount: 0,
                      period: "monthly",
                      category: "Other",
                      attribution: "overhead",
                      vatPercent: 0,
                      includesVat: true,
                    },
                  ],
                })
              }
            >
              + Add running cost
            </button>
            <details>
              <summary>Standing charges and staffing</summary>
              <p>
                These also contribute to running costs. Staffing already
                included in direct costs is deducted by the existing forecast.
              </p>
              {draft.utilities.map((t, index) => (
                <N
                  key={t.kind}
                  label={`${t.kind} standing charge (p/day)`}
                  value={t.standingPenceDaily}
                  onChange={(v) =>
                    D({
                      ...draft,
                      utilities: draft.utilities.map((x, i) =>
                        i === index ? { ...x, standingPenceDaily: v } : x,
                      ),
                    })
                  }
                />
              ))}
              <N
                label="Staff hours per week"
                value={draft.staffHoursWeekly}
                onChange={(v) => D({ ...draft, staffHoursWeekly: v })}
              />
              <N
                label="Staff hourly pay (£)"
                value={draft.staffHourlyRate}
                onChange={(v) => D({ ...draft, staffHourlyRate: v })}
              />
              <N
                label="Employer costs (%)"
                value={draft.employerPercent}
                onChange={(v) => D({ ...draft, employerPercent: v })}
              />
            </details>
          </fieldset>
          <p className="help">
            Only add bills not already included in recipes or production costs.
            Full VAT, attribution and scheduling controls remain in Business
            Settings.
          </p>
          <div className="actions">
            <button
              disabled={busy}
              onClick={async () => {
                B(true);
                E("");
                try {
                  if (!committed) {
                    D(await api<Business>("/business", draft));
                    C(true);
                  }
                  await saved();
                } catch (e) {
                  E((e as Error).message);
                } finally {
                  B(false);
                }
              }}
            >
              {busy
                ? "Saving…"
                : committed
                  ? "Refresh saved costs"
                  : "Save running costs"}
            </button>
            <button disabled={busy} className="secondary" onClick={close}>
              {committed ? "Close" : "Cancel"}
            </button>
          </div>
          <button
            disabled={busy}
            className="text-button"
            onClick={() => {
              close();
              openSettings("business:expenses");
            }}
          >
            Discard unsaved edits and open full Business Settings
          </button>
        </>
      )}
    </Modal>
  );
}
