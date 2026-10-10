import { Plus, X } from "lucide-react";
import { Field, Num } from "../components/ui";
import type { Scenario } from "../types";
export default function PlannerAssumptions({
  draft,
  update,
}: {
  draft: Scenario;
  update: <K extends keyof Scenario>(key: K, value: Scenario[K]) => void;
}) {
  const numeric = (key: keyof Scenario, label: string, max?: number) => (
    <Field label={label}>
      <Num
        value={(draft[key] as number) ?? 0}
        max={max}
        onChange={(v) => update(key, v as never)}
      />
    </Field>
  );
  return (
    <section className="panel assumptions planner-sections">
      <h2>Editable assumptions</h2>
      <p className="help">
        Open one section at a time. Results update automatically; changes are
        saved automatically to this scenario.
      </p>
      <Field label="Scenario name">
        <input
          value={draft.name}
          onChange={(e) => update("name", e.target.value)}
        />
      </Field>
      <details>
        <summary>
          Business operating costs{" "}
          <small>{draft.expenses.length} monthly expenses</small>
        </summary>
        <p className="help">
          Include rent, utilities, insurance, software, cleaning, marketing,
          maintenance, business rates and other regular overheads. Add only the
          costs that apply.
        </p>
        {draft.expenses.map((x, i) => (
          <div className="expense-row" key={i}>
            <input
              aria-label={`Expense ${i + 1} name`}
              value={x.name}
              onChange={(e) =>
                update(
                  "expenses",
                  draft.expenses.map((v, j) =>
                    i === j ? { ...v, name: e.target.value } : v,
                  ),
                )
              }
            />
            <Num
              aria-label={`Expense ${i + 1} amount`}
              value={x.monthlyAmount}
              onChange={(n) =>
                update(
                  "expenses",
                  draft.expenses.map((v, j) =>
                    i === j ? { ...v, monthlyAmount: n } : v,
                  ),
                )
              }
            />
            <button
              className="icon-button"
              aria-label={`Remove expense ${i + 1}`}
              onClick={() =>
                update(
                  "expenses",
                  draft.expenses.filter((_, j) => i !== j),
                )
              }
            >
              <X size={16} />
            </button>
          </div>
        ))}
        <button
          className="text-button"
          onClick={() =>
            update("expenses", [
              ...draft.expenses,
              { name: "New expense", monthlyAmount: 0 },
            ])
          }
        >
          <Plus size={16} />
          Add expense
        </button>
      </details>
      <details open>
        <summary>
          Sales assumptions{" "}
          <small>{draft.openDays.length} trading evenings / week</small>
        </summary>
        <div className="form-grid">
          {numeric("averageBasket", "Average order value (£)")}
          {numeric("ordersPerEvening", "Orders per evening")}
          {numeric("variableCost", "Product & packaging cost per order (£)")}
        </div>
        <p className="help">
          Enter product costs after any recoverable input VAT. Channel shares
          below represent expected shares of customer sales, assuming the same
          average order value across channels.
        </p>
        <div className="day-picker">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <button
              key={day}
              className={draft.openDays.includes(i) ? "selected" : ""}
              aria-pressed={draft.openDays.includes(i)}
              onClick={() =>
                update(
                  "openDays",
                  draft.openDays.includes(i)
                    ? draft.openDays.filter((d) => d !== i)
                    : [...draft.openDays, i],
                )
              }
            >
              {day}
            </button>
          ))}
        </div>
        <div className="form-grid">
          <Field label="Service starts">
            <input
              type="time"
              value={draft.serviceStart}
              onChange={(e) => update("serviceStart", e.target.value)}
            />
          </Field>
          <Field label="Service ends">
            <input
              type="time"
              value={draft.serviceEnd}
              onChange={(e) => update("serviceEnd", e.target.value)}
            />
          </Field>
        </div>
      </details>
      <details>
        <summary>
          Delivery platform costs{" "}
          <small>
            {draft.channels?.length
              ? "Individual channel rates"
              : "Blended commission assumption"}
          </small>
        </summary>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!draft.channels?.length}
            onChange={(e) =>
              update(
                "channels",
                e.target.checked
                  ? [
                      {
                        name: "Uber Eats",
                        sharePercent: 50,
                        commissionPercent: draft.commissionPercent,
                        vatPercent: draft.commissionVatPercent,
                      },
                      {
                        name: "Deliveroo",
                        sharePercent: 50,
                        commissionPercent: draft.commissionPercent,
                        vatPercent: draft.commissionVatPercent,
                      },
                    ]
                  : null,
              )
            }
          />
          Model sales-channel mix
        </label>
        {draft.channels?.length ? (
          <>
            <p className="help">
              Shares must total 100%. Rates are your contractual assumptions,
              not published platform tariffs. A Direct channel can use 0%
              commission.
            </p>
            {draft.channels.map((c, i) => (
              <fieldset className="channel-row" key={i}>
                <legend>Channel {i + 1}</legend>
                <div className="form-grid">
                  <Field label={`Channel ${i + 1} name`}>
                    <input
                      value={c.name}
                      onChange={(e) =>
                        update(
                          "channels",
                          draft.channels!.map((v, j) =>
                            j === i ? { ...v, name: e.target.value } : v,
                          ),
                        )
                      }
                    />
                  </Field>
                  {(
                    ["sharePercent", "commissionPercent", "vatPercent"] as const
                  ).map((k) => (
                    <Field
                      key={k}
                      label={`Channel ${i + 1} ${{ sharePercent: "sales share (%)", commissionPercent: "commission (%)", vatPercent: "VAT on commission (%)" }[k]}`}
                    >
                      <Num
                        max={100}
                        value={c[k]}
                        onChange={(n) =>
                          update(
                            "channels",
                            draft.channels!.map((v, j) =>
                              i === j ? { ...v, [k]: n } : v,
                            ),
                          )
                        }
                      />
                    </Field>
                  ))}
                </div>
                <button
                  className="text-button"
                  onClick={() =>
                    update(
                      "channels",
                      draft.channels!.filter((_, j) => i !== j),
                    )
                  }
                >
                  Remove channel {i + 1}
                </button>
              </fieldset>
            ))}
            <button
              className="text-button"
              onClick={() =>
                update("channels", [
                  ...draft.channels!,
                  {
                    name: "Direct",
                    sharePercent: 0,
                    commissionPercent: 0,
                    vatPercent: 0,
                  },
                ])
              }
            >
              Add sales channel
            </button>
          </>
        ) : (
          <div className="form-grid">
            {numeric(
              "commissionPercent",
              "Blended platform commission (%)",
              100,
            )}
            {numeric("commissionVatPercent", "VAT on commission (%)", 100)}
          </div>
        )}
        <div className="form-grid">
          {numeric(
            "discountPercent",
            "Customer discounts & promotions (%)",
            100,
          )}
          {numeric(
            "otherChargePerOrder",
            "Other variable charges per order (£)",
          )}
        </div>
        <p className="help">
          Commission is applied to discounted gross sales. Other charges are an
          all-in expense after any eligible VAT recovery.
        </p>
      </details>
      <details>
        <summary>
          Staffing and owner time{" "}
          <small>{draft.staffHoursWeekly ?? 0} paid staff hours / week</small>
        </summary>
        <h3>Paid staff</h3>
        <div className="form-grid">
          {numeric("staffHoursWeekly", "Paid staff hours per week")}
          {numeric("staffHourlyRate", "Staff hourly wage (£)")}
          {numeric("employerCostPercent", "Employer cost allowance (%)", 100)}
        </div>
        <p className="help">
          A configurable allowance for employer costs, not a payroll/NI
          calculation. Staffing is added to fixed costs. Do not also include
          these wages in overheads or per-order costs.
        </p>
        <h3>Owner compensation</h3>
        <div className="form-grid">
          {numeric("ownerHoursWeekly", "Owner hours per week", 168)}
          {numeric("ownerHourlyRate", "Target owner compensation (£ / hour)")}
        </div>
        <p className="help">
          Owner compensation is shown separately from operating profit. It is
          not automatically treated as a deductible business expense.
        </p>
      </details>
      <details>
        <summary>
          Tax assumptions{" "}
          <small>
            {draft.vatRegistered ? "VAT registered" : "Not VAT registered"}
          </small>
        </summary>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={draft.vatRegistered}
            onChange={(e) => {
              update("vatRegistered", e.target.checked);
            }}
          />
          VAT registered
        </label>
        {numeric("salesVatPercent", "Assumed blended sales VAT (%)", 100)}
        <label className="checkbox">
          <input
            type="checkbox"
            disabled={!draft.vatRegistered}
            checked={draft.recoverCommissionVat}
            onChange={(e) => update("recoverCommissionVat", e.target.checked)}
          />
          Recover eligible VAT on platform commissions
        </label>
        <p className="help">
          The blended rate is an assumption, not a classification for every
          product. Input VAT recovery for ingredients is reflected in the cost
          you enter. Detailed tax estimates are not implemented in this sprint.
        </p>
      </details>
      <details>
        <summary>Advanced · Profit targets & capital recovery</summary>
        <div className="form-grid">
          {numeric("targetProfit", "Target monthly profit after owner pay (£)")}
          {numeric("initialInvestment", "Initial investment (£)")}
          {numeric("recoveryMonths", "Capital recovery period (months)", 600)}
        </div>
        <p className="help">
          Capital recovery is an allocation towards recovering your investment;
          it is not a cash-flow forecast or tax depreciation.
        </p>
      </details>
    </section>
  );
}
