import { useEffect, useState } from "react";
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
      <details open>
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
                      j === i ? { ...x, pencePerUnit: v } : x,
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
        <summary>Rent, insurance & other expenses</summary>
        <p className="help">
          Annual amounts are divided by 12. Mark costs already in recipes or
          batches as “Already attributed directly”; these are excluded from this
          forecast, not added again. Per-unit expenses apply once to each sold
          product. Do not also enter utility usage bills when modelling the same
          energy through equipment.
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
                  label="Expense category"
                  value={e.category}
                  onChange={(v) => put("category", v)}
                  options={[
                    "Rent",
                    "Business rates",
                    "Insurance",
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
        <summary>Staffing & owner time</summary>
        <p className="help">
          The monthly staffing budget is a floor: direct paid labour already
          included in forecast products is deducted before adding remaining
          payroll overhead. Owner time stays separate from operating profit.
          Weekly hours use 52 ÷ 12 weeks per month.
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
        <summary>Sales channels & commissions</summary>
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
              <div className="form-grid">
                <N
                  label={`${c.name} commission (%)`}
                  value={c.commissionPercent}
                  onChange={(v) => put("commissionPercent", v)}
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
        <summary>VAT & overhead allocation</summary>
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
          configured in Money → Product profitability. Recovery uses the lower
          of business and product limits. Set partial/exempt recovery
          explicitly; this app does not calculate a partial-exemption method.
          Existing financial planner scenarios keep their own saved assumptions
          and are never added to these expenses.
        </p>
      </details>
    </div>
  );
}
export function BusinessEditor({ initial }: { initial: Business }) {
  const [b, set] = useState(initial);
  const save = useAutoSave(b, set, "/business");
  const [history, H] = useState<{ settings: Business; recordedAt: string }[]>(
    [],
  );
  const [error, E] = useState("");
  return (
    <section className="panel">
      <h2>Business settings</h2>
      <p>
        Shared by the product profitability catalogue. Ordinary edits autosave;
        each revision is retained. A future effective date schedules new
        assumptions; older effective periods remain available.
      </p>
      <SaveStatus save={save} />
      <BusinessFields value={b} change={set} />
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
export default function BusinessSettings() {
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
      {b ? <BusinessEditor initial={b} /> : <p className="shell-caption">Loading business settings…</p>}
    </>
  );
}
