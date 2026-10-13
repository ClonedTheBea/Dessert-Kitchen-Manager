import SavedForecasts from "./SavedForecasts";
import type { State } from "../types";
import ForecastSettings from "./ForecastSettings";
import { useEffect, useState, useRef } from "react";
import { api, money, number } from "../api";
import { SaveStatus, useAutoSave } from "../autoSave";
import { ErrorBox, Field, Num } from "../components/ui";
import type { Business } from "../businessTypes";
import { Term } from "./FinancialGlossary";
export function N({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <Num value={value} onChange={onChange} />
    </Field>
  );
}
export function T({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (n: string) => void;
  type?: string;
}) {
  return (
    <Field label={label}>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}
export function S({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (n: string) => void;
  options: [string, string][];
}) {
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, n]) => (
          <option key={v} value={v}>
            {n}
          </option>
        ))}
      </select>
    </Field>
  );
}
export function C({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="checkbox">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
export function BusinessFields({
  value: b,
  change: set,
  simulation = false,
}: {
  value: Business;
  change: (b: Business) => void;
  simulation?: boolean;
}) {
  const field = <K extends keyof Business>(k: K, v: Business[K]) =>
    set({ ...b, [k]: v });
  return (
    <div className="business-fields">
      {!simulation && (
        <div className="form-grid">
          <T
            label="Business configuration name"
            value={b.name}
            onChange={(v) => field("name", v)}
          />
          <T
            label="Rates effective from"
            type="date"
            value={b.effectiveFrom}
            onChange={(v) => field("effectiveFrom", v)}
          />
        </div>
      )}
      <details>
        <summary>Premises and regular costs</summary>
        <p className="help">
          Add your regular bills as monthly or yearly amounts. Yearly bills are
          spread across 12 months. Only add costs that are not already included
          in your recipes or production costs.
        </p>
        {b.expenses.map((e, i) => {
          const put = (k: string, v: unknown) =>
            field(
              "expenses",
              b.expenses.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
            );
          return (
            <fieldset key={e.id}>
              <legend>Expense {i + 1}</legend>
              <div className="form-grid">
                <T
                  label="Expense name"
                  value={e.name}
                  onChange={(v) => put("name", v)}
                />
                <S
                  label="Expense period"
                  value={e.period}
                  onChange={(v) => put("period", v)}
                  options={
                    e.attribution === "variable"
                      ? [["unit", "Per sold unit"]]
                      : [
                          ["monthly", "Monthly"],
                          ["annual", "Annual"],
                        ]
                  }
                />
                <N
                  label="Expense amount (£)"
                  value={e.amount}
                  onChange={(v) => put("amount", v)}
                />
              </div>
              <details>
                <summary>Advanced expense options</summary>
                <div className="form-grid">
                  {" "}
                  <S
                    label="Expense category"
                    value={e.category}
                    onChange={(v) => put("category", v)}
                    options={[
                      "Rent",
                      "Business rates",
                      "Insurance",
                      "Internet",
                      "Marketing",
                      "Subscriptions",
                      "Utilities",
                      "Other",
                    ].map((v) => [v, v])}
                  />
                  <S
                    label="Attribution"
                    value={e.attribution}
                    onChange={(v) =>
                      field(
                        "expenses",
                        b.expenses.map((x, j) =>
                          j === i
                            ? {
                                ...x,
                                attribution: v,
                                period: v === "variable" ? "unit" : "monthly",
                              }
                            : x,
                        ),
                      )
                    }
                    options={[
                      ["overhead", "Fixed overhead"],
                      ["direct", "Already attributed directly — exclude"],
                      ["variable", "Other variable cost per sold unit"],
                    ]}
                  />
                  <N
                    label="Expense VAT (%)"
                    value={e.vatPercent}
                    onChange={(v) => put("vatPercent", v)}
                  />
                  <C
                    label="Expense includes VAT"
                    value={e.includesVat}
                    onChange={(v) => put("includesVat", v)}
                  />
                </div>
              </details>
              <p>
                {e.attribution === "direct"
                  ? "Excluded from additional costs"
                  : `${money(e.amount / (e.period === "annual" ? 12 : 1))} ${e.period === "unit" ? "per unit" : "per month"} before VAT recovery adjustment`}
              </p>
              <button
                className="secondary"
                onClick={() =>
                  field(
                    "expenses",
                    b.expenses.filter((x) => x.id !== e.id),
                  )
                }
              >
                Remove expense
              </button>
            </fieldset>
          );
        })}
        <button
          className="secondary"
          onClick={() =>
            field("expenses", [
              ...b.expenses,
              {
                id: crypto.randomUUID(),
                name: "New expense",
                category: "Other",
                amount: 0,
                period: "monthly",
                attribution: "overhead",
                vatPercent: 0,
                includesVat: true,
              },
            ])
          }
        >
          Add expense
        </button>
      </details>
      <details>
        <summary>Utilities & equipment</summary>
        <p className="help">
          <Term name="Energy" /> is added to products only for configured
          equipment use. Enter consumption excluding any amounts already in
          other direct recipe costs. Standing charges use 365 ÷ 12 days per
          average month.
        </p>
        {b.utilities.map((u, i) => (
          <fieldset key={u.kind}>
            <legend>{u.kind[0].toUpperCase() + u.kind.slice(1)}</legend>
            <div className="form-grid">
              <N
                label={`${u.kind} unit rate (${u.kind === "water" ? "p/m³" : "p/kWh"})`}
                value={u.pencePerUnit}
                onChange={(v) =>
                  field(
                    "utilities",
                    b.utilities.map((x, j) =>
                      j === i
                        ? { ...x, pencePerUnit: v, rateConfigured: true }
                        : x,
                    ),
                  )
                }
              />
              <N
                label={`${u.kind} standing charge (p/day)`}
                value={u.standingPenceDaily}
                onChange={(v) =>
                  field(
                    "utilities",
                    b.utilities.map((x, j) =>
                      j === i ? { ...x, standingPenceDaily: v } : x,
                    ),
                  )
                }
              />
            </div>
            <details>
              <summary>Advanced utility VAT options</summary>
              <div className="form-grid">
                {" "}
                <N
                  label={`${u.kind} VAT (%)`}
                  value={u.vatPercent}
                  onChange={(v) =>
                    field(
                      "utilities",
                      b.utilities.map((x, j) =>
                        j === i ? { ...x, vatPercent: v } : x,
                      ),
                    )
                  }
                />
                <C
                  label={`${u.kind} rates include VAT`}
                  value={u.includesVat}
                  onChange={(v) =>
                    field(
                      "utilities",
                      b.utilities.map((x, j) =>
                        j === i ? { ...x, includesVat: v } : x,
                      ),
                    )
                  }
                />
              </div>
            </details>
            <p className="help">
              {u.pencePerUnit}p per {u.kind === "water" ? "m³" : "kWh"} (
              {money(u.pencePerUnit / 100)} per unit).{" "}
              {!(u.rateConfigured ?? u.pencePerUnit !== 0) &&
                "Unit rate not yet confirmed."}
            </p>
          </fieldset>
        ))}
        {b.equipment.map((e, i) => (
          <fieldset key={e.id}>
            <legend>Equipment {i + 1}</legend>
            <div className="form-grid">
              <T
                label="Equipment name"
                value={e.name}
                onChange={(v) =>
                  field(
                    "equipment",
                    b.equipment.map((x, j) =>
                      j === i ? { ...x, name: v } : x,
                    ),
                  )
                }
              />
              <S
                label="Fuel"
                value={e.fuel}
                onChange={(v) =>
                  field(
                    "equipment",
                    b.equipment.map((x, j) =>
                      j === i ? { ...x, fuel: v } : x,
                    ),
                  )
                }
                options={[
                  ["electricity", "Electricity"],
                  ["gas", "Gas"],
                ]}
              />
              <N
                label="Rated consumption (kW)"
                value={e.kw}
                onChange={(v) =>
                  field(
                    "equipment",
                    b.equipment.map((x, j) => (j === i ? { ...x, kw: v } : x)),
                  )
                }
              />
              <N
                label="Average load (%)"
                value={e.loadPercent}
                onChange={(v) =>
                  field(
                    "equipment",
                    b.equipment.map((x, j) =>
                      j === i ? { ...x, loadPercent: v } : x,
                    ),
                  )
                }
              />
            </div>
            <button
              className="secondary"
              onClick={() =>
                set({
                  ...b,
                  equipment: b.equipment.filter((x) => x.id !== e.id),
                  products: b.products.map((p) => ({
                    ...p,
                    equipment:
                      p.equipment?.filter((x) => x.equipmentId !== e.id) ?? [],
                  })),
                })
              }
            >
              Remove equipment
            </button>
          </fieldset>
        ))}
        <button
          className="secondary"
          onClick={() =>
            field("equipment", [
              ...b.equipment,
              {
                id: crypto.randomUUID(),
                name: "New equipment",
                fuel: "electricity",
                kw: 0,
                loadPercent: 100,
              },
            ])
          }
        >
          Add equipment
        </button>
      </details>
      <details>
        <summary>Staff and labour</summary>
        <p className="help">
          Enter the total paid staff time you budget for each week. Paid labour
          already included in direct costs is deducted so it is not counted
          twice. Owner time stays separate. Weekly pay assumes 52 weeks a year;
          trading weeks affect sales, not this annual staffing budget.
        </p>
        <div className="form-grid">
          <N
            label="Total staff hours / week"
            value={b.staffHoursWeekly}
            onChange={(v) => field("staffHoursWeekly", v)}
          />
          <N
            label="Staff hourly rate (£)"
            value={b.staffHourlyRate}
            onChange={(v) => field("staffHourlyRate", v)}
          />
          <N
            label="Employer cost allowance (%)"
            value={b.employerPercent}
            onChange={(v) => field("employerPercent", v)}
          />
          <N
            label="Owner hours / week"
            value={b.ownerHoursWeekly}
            onChange={(v) => field("ownerHoursWeekly", v)}
          />
          <N
            label="Owner hourly allowance (£)"
            value={b.ownerHourlyRate}
            onChange={(v) => field("ownerHourlyRate", v)}
          />
        </div>
        <p>
          <Term name="Owner compensation" />
        </p>
      </details>
      <details>
        <summary>Selling platforms</summary>
        <p className="help">
          Enter your own contract assumptions. Zero defaults are unconfigured,
          not advertised platform rates. Prices entered per product are customer
          prices including any output VAT. Fixed fees here are per sold unit,
          not per basket.
        </p>
        {b.channels.map((c, i) => {
          const put = (k: string, v: unknown) =>
            field(
              "channels",
              b.channels.map((x, j) => (j === i ? { ...x, [k]: v } : x)),
            );
          return (
            <fieldset key={c.id}>
              <legend>{c.name}</legend>
              <p className="help">
                {(c.commissionConfigured ?? c.commissionPercent !== 0)
                  ? `Commission confirmed: ${c.commissionPercent}%`
                  : "Commission not yet configured"}
              </p>
              <C
                label={`${c.name} commission confirmed (including zero)`}
                value={c.commissionConfigured ?? c.commissionPercent !== 0}
                onChange={(v) => put("commissionConfigured", v)}
              />
              <div className="form-grid">
                <N
                  label={`${c.name} commission (%)`}
                  value={c.commissionPercent}
                  onChange={(v) =>
                    field(
                      "channels",
                      b.channels.map((x, j) =>
                        j === i
                          ? {
                              ...x,
                              commissionPercent: v,
                              commissionConfigured: true,
                            }
                          : x,
                      ),
                    )
                  }
                />
                <N
                  label={`${c.name} fee VAT (%)`}
                  value={c.feeVatPercent}
                  onChange={(v) => put("feeVatPercent", v)}
                />
                <N
                  label={`${c.name} fixed fee / unit (£ excl. VAT)`}
                  value={c.chargePerUnit}
                  onChange={(v) => put("chargePerUnit", v)}
                />
                <S
                  label={`${c.name} commission basis`}
                  value={c.commissionBasis}
                  onChange={(v) => put("commissionBasis", v)}
                  options={[
                    ["gross", "Gross customer price"],
                    ["net", "Net sales excluding output VAT"],
                  ]}
                />
              </div>
            </fieldset>
          );
        })}
      </details>
      <details>
        <summary>Advanced: VAT & overhead allocation</summary>
        <C
          label="Business is VAT registered"
          value={b.vatRegistered}
          onChange={(v) =>
            set({
              ...b,
              vatRegistered: v,
              inputRecoveryPercent: v ? b.inputRecoveryPercent : 0,
            })
          }
        />
        <div className="form-grid">
          <N
            label="Business input VAT recovery (%)"
            value={b.inputRecoveryPercent}
            onChange={(v) => field("inputRecoveryPercent", v)}
          />
          <S
            label="Fixed-cost allocation method"
            value={b.allocationMethod}
            onChange={(v) => field("allocationMethod", v)}
            options={[
              ["units", "Forecast units"],
              ["revenue", "Forecast net sales revenue"],
              ["labour", "Forecast direct labour minutes"],
            ]}
          />
        </div>
        <p>
          <Term name="Input VAT" /> · <Term name="Output VAT" /> ·{" "}
          <Term name="Fixed-cost allocation" />
        </p>
        <p className="help">
          Product-specific output treatment and input recovery limits are
          configured in Settings → Product pricing. Recovery uses the lower of
          business and product limits. Set partial/exempt recovery explicitly;
          this app does not calculate a partial-exemption method. Historical
          scenarios remain available for reference; the current forecast uses
          these business settings.
        </p>
      </details>
    </div>
  );
}
export function BusinessEditor({
  initial,
  state,
  initialGroup = "",
}: {
  initial: Business;
  state: State;
  initialGroup?: string;
}) {
  const [b, set] = useState(initial);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!initialGroup) return;
    const summary = [...(root.current?.querySelectorAll("summary") ?? [])].find(
      (s) => s.textContent === initialGroup,
    );
    if (summary?.parentElement instanceof HTMLDetailsElement) {
      summary.parentElement.open = true;
      summary.scrollIntoView({ block: "start" });
    }
  }, [initialGroup]);
  const save = useAutoSave(b, set, "/business");
  const [history, H] = useState<{ settings: Business; recordedAt: string }[]>(
    [],
  );
  const [error, E] = useState("");
  return (
    <section ref={root} className="panel">
      <h2>Business settings</h2>
      <p>
        These settings feed Financial Overview and Price Breakdown. Ordinary
        edits autosave; each revision is retained. A future effective date
        schedules new assumptions; older effective periods remain available.
      </p>
      <SaveStatus save={save} />
      <BusinessFields value={b} change={set} />
      <ForecastSettings b={b} set={set} state={state} />
      <SavedForecasts state={state} />
      <details>
        <summary
          onClick={() =>
            api<typeof history>("/business/history")
              .then(H)
              .catch((e) => E(e.message))
          }
        >
          Effective-date history
        </summary>
        <ErrorBox error={error} />
        {history.map((h) => (
          <details key={h.settings.revision}>
            <summary>
              Revision {h.settings.revision} · effective{" "}
              {h.settings.effectiveFrom} · {h.settings.name}
            </summary>
            <p>
              Recorded {h.recordedAt}. Electricity{" "}
              {number(h.settings.utilities[0].pencePerUnit)}p/kWh.
            </p>
            <fieldset disabled>
              <BusinessFields value={h.settings} change={() => {}} />
            </fieldset>
          </details>
        ))}
      </details>
    </section>
  );
}
export default function BusinessSettings({
  state,
  initialGroup,
}: {
  state: State;
  initialGroup?: string;
}) {
  const [b, B] = useState<Business>();
  const [e, E] = useState("");
  useEffect(() => {
    api<Business>("/business")
      .then(B)
      .catch((e) => E(e.message));
  }, []);
  return (
    <>
      <ErrorBox error={e} />
      {b ? (
        <BusinessEditor initial={b} state={state} initialGroup={initialGroup} />
      ) : (
        <p className="shell-caption">Loading business settings…</p>
      )}
    </>
  );
}
