import { useEffect, useState } from "react";
import { api, money, today, number } from "../api";
import { ErrorBox } from "../components/ui";
import { T } from "./BusinessSettings";
export default function SalesReport() {
  const [from, F] = useState(today().slice(0, 8) + "01"),
    [to, Till] = useState(today()),
    [data, D] = useState<any>(),
    [error, E] = useState("");
  useEffect(() => {
    let active = true;
    api<any>("/sales/report?from=" + from + "&to=" + to)
      .then((x) => {
        if (active) {
          D(x);
          E("");
        }
      })
      .catch((e) => {
        if (active) E(e.message);
      });
    return () => {
      active = false;
    };
  }, [from, to]);
  return (
    <div className="sales-report">
      <div className="page-heading">
        <div>
          <h1>Sales</h1>
          <p>Recorded completed orders, separate from financial forecasts.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        <div className="form-grid">
          <T label="Sales from" type="date" value={from} onChange={F} />
          <T label="Sales to" type="date" value={to} onChange={Till} />
        </div>
        <p>
          Sales are grouped by the original order date in UK time, including
          refunds recorded to date. Draft and cancelled orders are excluded.
          Fulfilment does not mean payment has reached the bank.
        </p>
      </section>
      {data && (
        <>
          <div className="financial-cards planner-quick-results">
            {[
              ["Sales today", money(data.today)],
              ["Sales this week", money(data.week)],
              ["Sales this month", money(data.month)],
              ["Completed orders in range", number(data.orders)],
              ["Sales in range", money(data.revenue)],
              ["Average order before refunds", money(data.averageOrder)],
              [
                "Awaiting platform payout — all time",
                money(data.awaitingPayout),
              ],
              ["Platform bank receipts — all time", money(data.bankReceived)],
            ].map(([title, value]) => (
              <section className="panel" key={title}>
                <h2>{title}</h2>
                <strong className="financial-value">{value}</strong>
              </section>
            ))}
          </div>
          <section className="panel">
            <h2>Daily sales</h2>
            {!data.daily.length && <p>No completed sales in this period.</p>}
            <div className="finance-bars">
              {data.daily.map((r: any) => (
                <div key={r.date}>
                  <div>
                    <span>{r.date}</span>
                    <strong>{money(r.sales)}</strong>
                  </div>
                  <div className="bar-track">
                    <span
                      style={{
                        width: `${(Math.max(0, r.sales) / Math.max(1, ...data.daily.map((x: any) => x.sales))) * 100}%`,
                        background: "var(--chart-1)",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Platform fees & receipts</h2>
            <p>
              Expected fees {money(data.expectedFees)} · reported order fees{" "}
              {money(data.reportedFees)} · {data.unknownFeeOrders} orders have
              unknown fees.
            </p>
            <p>
              Explicitly reported payout commission — all time:{" "}
              {money(data.reportedPayoutCommission)}.
            </p>
            <p>
              {data.reconciledGroups} settlement groups reconcile. Reported fees
              are not confirmed bank deductions until their payout is matched.
              Awaiting payout uses matched report totals where available, otherwise order estimates, less recorded bank receipts. Later refunds remain visible as differences. See
              Payouts for the reconciled balance.
            </p>
            {data.channels.map((c: any) => (
              <p key={c.channel}>
                {c.channel}: {c.orders} orders · sales {money(c.sales)} · fees{" "}
                {money(c.fees)}
              </p>
            ))}
          </section>
          <section className="panel">
            <h2>Best-selling desserts</h2>
            <p>
              Units are fulfilled units, including subsequently refunded
              products. Refunds and fees are allocated proportionally to each
              product's discounted sale value. Contribution is an estimate after
              known/estimated product costs and fee charges, before overheads,
              owner pay, tax and recoverable input VAT adjustments; missing VAT
              or costs leaves it unknown. Energy and other costs may be
              incomplete in recipe estimates. This is not actual operating
              profit.
            </p>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Scrollable sales details"
            >
              <table>
                <thead>
                  <tr>
                    <th>Dessert</th>
                    <th>Units</th>
                    <th>Revenue after refunds</th>
                    <th>Recorded inventory cost</th>
                    <th>Recipe estimate</th>
                    <th>Fees</th>
                    <th>Contribution estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p: any) => (
                    <tr key={p.name}>
                      <td>
                        {p.name}
                        <small>{p.costStatus}</small>
                      </td>
                      <td>{p.units == null ? "Unknown" : number(p.units)}</td>
                      <td>{money(p.revenue)}</td>
                      <td>{money(p.inventoryCost)}</td>
                      <td>{money(p.estimatedRecipeCost)}</td>
                      <td>{money(p.fees)}</td>
                      <td>
                        {money(p.contribution)} ·{" "}
                        {p.contributionPercent == null
                          ? "Unknown"
                          : number(p.contributionPercent) + "%"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <h2>This month versus forecast</h2>
            <p>
              Month to date compared with the full average-month forecast. This
              does not change your assumptions.
            </p>
            <p>
              Completed orders: {number(data.comparison.actualOrders)} ·
              forecast{" "}
              {data.comparison.forecastOrders == null
                ? "Not configured"
                : number(data.comparison.forecastOrders)}
            </p>
            <p>
              Recorded net sales after refunds:{" "}
              {money(data.comparison.actualNetRevenue)} · forecast net sales{" "}
              {money(data.comparison.forecastNetRevenue)}
            </p>
            <p>
              Imported tax details may be unknown. Unmatched payout differences
              remain unresolved rather than becoming profit or expenses.
            </p>
          </section>
        </>
      )}
    </div>
  );
}
