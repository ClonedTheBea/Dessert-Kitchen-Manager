import type { Business } from "../businessTypes";
import type { Scenario, State } from "../types";
import { N, T, S, C } from "./BusinessSettings";
import { money } from "../api";
export const emptyForecast: Scenario = {
  id: "active-forecast",
  revision: 0,
  name: "Business forecast",
  expenses: [],
  openDays: [4, 5, 6],
  serviceStart: "17:00",
  serviceEnd: "22:00",
  tradingWeeks: 52,
  averageBasket: 0,
  variableCost: 0,
  commissionPercent: 0,
  commissionVatPercent: 0,
  recoverCommissionVat: false,
  vatRegistered: false,
  salesVatPercent: 0,
  discountPercent: 0,
  ordersPerEvening: 0,
  ownerHoursWeekly: 0,
  ownerHourlyRate: 0,
  initialInvestment: 0,
  recoveryMonths: 12,
  targetProfit: 0,
};
export default function ForecastSettings({
  b,
  set,
  state,
}: {
  b: Business;
  set: (b: Business) => void;
  state: State;
}) {
  const f = b.forecast ?? emptyForecast;
  const update = <K extends keyof Scenario>(k: K, v: Scenario[K]) =>
    set({ ...b, forecast: { ...f, [k]: v } });
  return (
    <>
      <details>
        <summary>Opening hours</summary>
        <div className="day-picker">
          {[
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
          ].map((name, i) => (
            <C
              key={name}
              label={name}
              value={f.openDays.includes(i)}
              onChange={(on) =>
                update(
                  "openDays",
                  on ? [...f.openDays, i] : f.openDays.filter((d) => d !== i),
                )
              }
            />
          ))}
        </div>
        <div className="form-grid">
          <T
            label="Opening time"
            type="time"
            value={f.serviceStart}
            onChange={(v) => update("serviceStart", v)}
          />
          <T
            label="Closing time"
            type="time"
            value={f.serviceEnd}
            onChange={(v) => update("serviceEnd", v)}
          />
          <N
            label="Planned trading weeks / year"
            value={f.tradingWeeks ?? 52}
            onChange={(v) => update("tradingWeeks", v)}
          />
          <N
            label="Expected orders per evening"
            value={f.ordersPerEvening}
            onChange={(v) => update("ordersPerEvening", v)}
          />
        </div>
      </details>
      <details>
        <summary>Forecast assumptions</summary>
        <p>
          An order is a whole customer basket. Product quantities are separate.
          Enter a reviewed average direct cost per order, including ingredients,
          packaging, production energy and paid direct labour. Platform fees and
          other per-unit business expenses are added automatically; do not
          include them twice.
        </p>
        <div className="form-grid">
          <N
            label="Average order value (£ including sales VAT)"
            value={f.averageBasket}
            onChange={(v) => update("averageBasket", v)}
          />
          <N
            label="Average direct cost per order (£ after recoverable VAT)"
            value={f.variableCost}
            onChange={(v) => update("variableCost", v)}
          />
          <N
            label="Average products per order"
            value={b.itemsPerOrder ?? 1}
            onChange={(itemsPerOrder) => set({ ...b, itemsPerOrder })}
          />
          <N
            label="Paid staff cost already included per order (£)"
            value={b.directLabourPerOrder ?? 0}
            onChange={(directLabourPerOrder) =>
              set({ ...b, directLabourPerOrder })
            }
          />
          <N
            label="Target monthly earnings after owner compensation (£)"
            value={f.targetProfit}
            onChange={(v) => update("targetProfit", v)}
          />
        </div>
        <p>Expected order share by channel — total must be 100%.</p>
        <div className="form-grid">
          {b.channels.map((c) => (
            <N
              key={c.id}
              label={`${c.name} order share (%)`}
              value={b.forecastShares?.[c.id] ?? 0}
              onChange={(v) =>
                set({
                  ...b,
                  forecastShares: { ...b.forecastShares, [c.id]: v },
                })
              }
            />
          ))}
        </div>
        <C
          label="I have reviewed the forecast, including direct costs and regular expenses"
          value={b.forecastReviewed ?? false}
          onChange={(forecastReviewed) =>
            set({ ...b, forecast: f, forecastReviewed })
          }
        />
        <details>
          <summary>Advanced forecast options</summary>
          <div className="form-grid">
            {(
              [
                ["salesVatPercent", "Average output VAT on orders (%)"],
                ["discountPercent", "Average discount (%)"],
                ["otherChargePerOrder", "Other direct charge per order (£)"],
                ["initialInvestment", "Initial investment (£)"],
                ["recoveryMonths", "Investment recovery months"],
              ] as [keyof Scenario, string][]
            ).map(([k, label]) => (
              <N
                key={k}
                label={label}
                value={Number(f[k] ?? 0)}
                onChange={(v) => update(k, v as never)}
              />
            ))}
          </div>
          <p>
            VAT registration and input recovery are controlled by the business
            VAT settings. Actual after-tax results are unavailable.
          </p>
        </details>
      </details>
      <details>
        <summary>Saved financial scenarios</summary>
        <p>
          Historical scenarios remain unchanged. You can reuse their sales
          assumptions; current business costs, staffing, VAT registration and
          channel contracts remain authoritative. Named business revisions also
          retain each saved configuration.
        </p>
        {state.scenarios.map((s) => (
          <details key={s.id}>
            <summary>{s.name}</summary>
            <p>
              {money(s.averageBasket)} average order · {s.ordersPerEvening}{" "}
              orders/evening · {s.openDays.length} evenings/week. Historical
              monthly expenses:{" "}
              {money(s.expenses.reduce((n, e) => n + e.monthlyAmount, 0))}.
            </p>
            <button
              className="secondary"
              onClick={() =>
                set({
                  ...b,
                  forecast: structuredClone(s),
                  forecastReviewed: false,
                })
              }
            >
              Use sales assumptions from {s.name}
            </button>
            <dl className="breakdown">
              <div><dt>Trading hours</dt><dd>{s.serviceStart}–{s.serviceEnd} · {s.tradingWeeks ?? 52} weeks/year</dd></div>
              <div><dt>Direct cost per order</dt><dd>{money(s.variableCost)}</dd></div>
              <div><dt>Paid staff budget</dt><dd>{s.staffHoursWeekly ?? 0} hours/week at {money(s.staffHourlyRate ?? 0)}/hour</dd></div>
              <div><dt>Owner allowance</dt><dd>{s.ownerHoursWeekly} hours/week at {money(s.ownerHourlyRate)}/hour</dd></div>
              <div><dt>Historical VAT registration</dt><dd>{s.vatRegistered ? "Registered" : "Not registered"}</dd></div>
              {s.expenses.map((e,i)=><div key={i}><dt>{e.name}</dt><dd>{money(e.monthlyAmount)}/month</dd></div>)}
            </dl>
          </details>
        ))}
      </details>
    </>
  );
}
