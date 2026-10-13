import { useEffect, useState } from "react";
import { api, money, number, today } from "../api";
import type { Model, State } from "../types";
import type { Business, ProductResult, ProfitReport } from "../businessTypes";
import { productPlan } from "../businessTypes";
import { ErrorBox, Modal, type Notify } from "../components/ui";
import FinancialGlossary from "./FinancialGlossary";
import { N } from "./BusinessSettings";
type Overview = {
  settings: Business;
  model: Model | null;
  missing: string[];
  runningCosts: Record<string, number>;
  products: ProfitReport;
};
type Breakdown = {
  row: ProductResult;
  missing: string[];
  segments: { key: string; name: string; amount: number; percent: number }[];
  chartMessage: string | null;
};
const colors: Record<string, string> = {
  ingredients: "var(--chart-1)",
  packaging: "var(--chart-2)",
  energy: "var(--chart-3)",
  other: "var(--chart-4)",
  fees: "var(--chart-5)",
  vat: "var(--chart-6)",
  contribution: "var(--chart-7)",
};
function Bars({
  title,
  rows,
  unit = "£ / month",
}: {
  title: string;
  rows: [string, number][];
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return (
    <section className="panel">
      <h2>{title}</h2>
      <p className="help">{unit}</p>
      <div className="finance-bars">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div>
              <span>{k}</span>
              <strong>{unit.startsWith("£") ? money(v) : number(v)}</strong>
            </div>
            <div className="bar-track">
              <span
                style={{
                  width: `${(Math.abs(v) / max) * 100}%`,
                  background: v < 0 ? "var(--danger)" : "var(--chart-1)",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
function PricePanel({
  id,
  data,
  state,
  close,
  settings,
}: {
  id: string;
  data: Overview;
  state: State;
  close: () => void;
  settings: (action?: string) => void;
}) {
  const [channel, C] = useState(data.settings.channels[0]?.id ?? "");
  const [result, R] = useState<Breakdown>();
  const [error, E] = useState("");
  const [trial, T] = useState(false);
  const [price, P] = useState(0);
  useEffect(() => {
    let active = true;
    R(undefined);
    E("");
    let b = data.settings;
    if (trial) {
      b = structuredClone(b);
      const recipe = state.recipes.find((v) => v.recipe.id === id)?.recipe;
      if (recipe) {
        const p = productPlan(recipe, b);
        b.products = [
          ...b.products.filter((x) => x.recipeId !== id),
          {
            ...p,
            channels: p.channels.map((c) =>
              c.channelId === channel ? { ...c, price } : c,
            ),
          },
        ];
      }
    }
    api<Breakdown>("/financial/breakdown", {
      input: { asOf: today(), settings: b, experiments: [] },
      recipeId: id,
      channelId: channel,
    })
      .then((v) => {
        if (active) R(v);
      })
      .catch((e) => {
        if (active) E(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, channel, trial, price, data, state]);
  let offset = 0;
  const r = result?.row;
  const shownContribution = result?.segments.length
    ? (result.segments.find((s) => s.key === "contribution")?.amount ?? 0)
    : r?.contribution;
  return (
    <Modal title="Price Breakdown" close={close}>
      <div className="price-breakdown-panel">
        <div className="eyebrow">WHERE DOES THE MONEY GO?</div>
        <h3>
          {r?.name ??
            state.recipes.find((v) => v.recipe.id === id)?.recipe.name}
        </h3>
        <p className="price-heading">
          {r ? money(r.grossPrice) : "…"} <small>per product · estimated</small>
        </p>
        <label>
          Sales channel
          <select
            aria-label="Sales channel"
            value={channel}
            onChange={(e) => {
              C(e.target.value);
              T(false);
            }}
          >
            {data.settings.channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <ErrorBox error={error} />
        {result ? (
          <>
            <ul className="setup-list">
              {result.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {result.missing.some(
              (m) => m.includes("commission") || m.includes("unit price"),
            ) && (
              <button
                className="secondary"
                onClick={() =>
                  settings(
                    result.missing.some((m) => m.includes("commission"))
                      ? "business:platforms"
                      : "business:utilities",
                  )
                }
              >
                Review business rates in Settings
              </button>
            )}
            {result.missing.length > 0 && (
              <button
                className="secondary"
                onClick={() => settings("pricing:" + id)}
              >
                Complete costs in Settings
              </button>
            )}
            {result.chartMessage ? (
              <p role="status">{result.chartMessage}</p>
            ) : (
              <div className="price-doughnut">
                <svg
                  viewBox="0 0 220 220"
                  role="img"
                  aria-label={`Selling price ${money(r!.grossPrice)} divided into direct costs, sales VAT and contribution`}
                >
                  <circle
                    cx="110"
                    cy="110"
                    r="80"
                    fill="none"
                    stroke="var(--surface-soft)"
                    strokeWidth="28"
                  />
                  {result.segments.map((s) => {
                    const start = offset;
                    offset += s.percent;
                    return (
                      <circle
                        key={s.key}
                        cx="110"
                        cy="110"
                        r="80"
                        fill="none"
                        stroke={colors[s.key]}
                        strokeWidth="28"
                        pathLength="100"
                        strokeDasharray={`${s.percent} ${100 - s.percent}`}
                        strokeDashoffset={-start}
                        transform="rotate(-90 110 110)"
                      />
                    );
                  })}
                  <text x="110" y="107" textAnchor="middle">
                    {money(shownContribution)}
                  </text>
                  <text
                    x="110"
                    y="129"
                    textAnchor="middle"
                    className="doughnut-caption"
                  >
                    left after direct costs
                  </text>
                </svg>
              </div>
            )}
            <dl className="breakdown price-legend">
              {(result.segments.length
                ? result.segments.map((s) => [
                    s.key,
                    s.name,
                    s.amount,
                    `${s.percent.toFixed(2)}%`,
                  ])
                : [
                    ["ingredients", "Ingredients", r!.ingredients, ""],
                    ["packaging", "Packaging", r!.packaging, ""],
                    [
                      "energy",
                      "Energy (estimate, review above)",
                      result.missing.some(m=>m.includes("energy")||m.includes("unit price")) ? null : r!.energy,
                      "",
                    ],
                    [
                      "other",
                      "Other direct costs",
                      r!.labour + r!.otherVariable,
                      "",
                    ],
                    [
                      "fees",
                      "Platform fees (review above)",
                      result.missing.some(m=>m.includes("commission")) ? null : r!.platformFees,
                      "",
                    ],
                    ["vat", "Sales VAT", result.missing.some(m=>m.includes("VAT treatment")) ? null : r!.outputVat, ""],
                  ]
              ).map(([key, name, value, percent]) => (
                <div key={String(key)}>
                  <dt>
                    <i style={{ background: colors[String(key)] }} />
                    {name}
                  </dt>
                  <dd>
                    {money(value == null ? null : Number(value))} <small>{percent}</small>
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              <strong>
                {result.missing.length
                  ? "Contribution incomplete"
                  : `${money(shownContribution)} money left after direct costs`}
              </strong>
            </p>
            <p>
              Money remaining after direct selling costs, before monthly
              business expenses.
            </p>
            <p className="help">
              Displayed pennies and percentages are apportioned to total the
              selling price and 100%. Calculations retain unrounded values.
            </p>
            {r!.warnings.map((w) => (
              <p className="help" key={w}>
                {w}
              </p>
            ))}
            <details>
              <summary>After monthly expenses</summary>
              <p>
                {result.missing.length
                  ? "Complete costs first."
                  : `${money(r!.allocatedOverheads)} estimated overhead allocation per product; ${money(r!.operatingProfit)} estimated operating profit per product.`}{" "}
                Allocation uses {data.settings.allocationMethod} and saved
                product sales volumes. This is not realised profit. Owner
                compensation stays separate.
              </p>
            </details>
            {!trial && (
              <button
                className="secondary"
                onClick={() => {
                  P(r!.grossPrice);
                  T(true);
                }}
              >
                Try a Different Price
              </button>
            )}
            <button
              className="secondary"
              onClick={() => settings("pricing:" + id)}
            >
              Edit saved product pricing in Settings
            </button>
          </>
        ) : (
          <p>{error ? "Check this recipe and its supplier prices to complete the breakdown." : "Loading breakdown…"}</p>
        )}
        {trial && (
          <section className="temporary-price">
            <h3>Temporary price test</h3>
            <p>Only this view changes. Nothing is saved.</p>
            <N label="Trial selling price (£)" value={price} onChange={P} />
            <button className="secondary" onClick={() => T(false)}>
              Reset price test
            </button>
          </section>
        )}
      </div>
    </Modal>
  );
}
export default function MoneyWorkspace({
  state,
  openSettings,
}: {
  state: State;
  refresh: () => Promise<void>;
  notify: Notify;
  openSettings: (action?: string) => void;
}) {
  const [data, D] = useState<Overview>();
  const [error, E] = useState("");
  const [search, S] = useState("");
  const [selected, P] = useState("");
  const [glossary, G] = useState(false);
  useEffect(() => {
    api<Overview>("/financial/overview")
      .then(D)
      .catch((e) => E(e.message));
  }, []);
  const m = data?.model;
  const be = m?.requiredOrders["Business expenses"];
  const tradingEvenings =
    ((data?.settings.forecast?.openDays.length ?? 0) *
      (data?.settings.forecast?.tradingWeeks ?? 52)) /
    12;
  const evening =
    m && be != null && tradingEvenings > 0
      ? Math.ceil(be / tradingEvenings)
      : null;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">UNDERSTAND YOUR KITCHEN</div>
          <h1>Financial Overview</h1>
          <p>Saved assumptions, made clear. All figures are forecasts.</p>
        </div>
        <button className="secondary" onClick={() => openSettings()}>
          Business Settings
        </button>
      </div>
      <ErrorBox error={error} />
      {data ? (
        <>
          <div className="planner-quick-results financial-cards">
            {[
              [
                "Projected monthly running costs",
                m ? money(m.fixedCosts) : "Setup needed",
                "per month",
              ],
              [
                "Average contribution per order",
                m ? money(m.contributionPerOrder) : "Setup needed",
                "before monthly expenses",
              ],
              [
                "Orders needed to break even",
                m
                  ? evening == null
                    ? "Not achievable"
                    : number(evening)
                  : "Setup needed",
                "per trading evening",
              ],
              [
                "Projected monthly operating profit",
                m ? money(m.operatingProfit) : "Setup needed",
                "per month · before owner compensation and tax",
              ],
            ].map(([title, value, note]) => (
              <section className="panel" key={title}>
                <h2>{title}</h2>
                <strong className="financial-value">{value}</strong>
                <p>{note}</p>
              </section>
            ))}
          </div>
          {data.missing.length > 0 && (
            <section className="panel">
              <h2>Finish your forecast setup</h2>
              <ul>
                {data.missing.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <button className="secondary" onClick={() => openSettings()}>
                Review Business Settings
              </button>
            </section>
          )}
          <section className="panel dessert-search">
            <h2>What happens to each pound?</h2>
            <label>
              Search desserts…
              <input
                type="search"
                placeholder="Search desserts…"
                value={search}
                onChange={(e) => S(e.target.value)}
              />
            </label>
            <div className="dessert-results">
              {state.recipes
                .filter(
                  (v) =>
                    v.recipe.isSellable !== false &&
                    v.recipe.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((v) => (
                  <button
                    className="secondary"
                    key={v.recipe.id}
                    onClick={() => P(v.recipe.id)}
                  >
                    {v.recipe.name}
                    <span>Price Breakdown →</span>
                  </button>
                ))}
            </div>
          </section>
          {m && (
            <>
              <div className="finance-chart-grid">
                <Bars
                  title="Monthly running costs"
                  rows={Object.entries(data.runningCosts).filter(
                    ([, v]) => v !== 0,
                  )}
                />
                <Bars
                  title="Revenue versus costs"
                  rows={[
                    ["Net sales", m.netSales],
                    [
                      "Direct costs and fees",
                      m.variableCosts +
                        m.otherCharges +
                        m.commission +
                        m.commissionVat,
                    ],
                    ["Monthly running costs", m.fixedCosts],
                  ]}
                />
                <Bars
                  title="Projected operating result"
                  rows={[
                    ["Operating profit", m.operatingProfit],
                    ["Owner compensation", m.ownerCompensation],
                    ["After owner compensation", m.afterOwner],
                  ]}
                />
                <Bars
                  title="Break-even per trading evening"
                  unit="orders / trading evening"
                  rows={[
                    [
                      "Expected orders",
                      data.settings.forecast?.ordersPerEvening ?? 0,
                    ],
                    ...(evening == null
                      ? []
                      : [["To break even", evening] as [string, number]]),
                  ]}
                />
              </div>
              <section className="panel">
                <h2>How many orders?</h2>
                <p>
                  {number(m.monthlyOpenDays)} trading evenings per average
                  month. Each order contributes {money(m.contributionPerOrder)}{" "}
                  before monthly business expenses.
                </p>
                <dl className="breakdown">
                  {Object.entries(m.requiredOrders).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        {v == null
                          ? "Not achievable"
                          : `${number(v)} / month · ${number(Math.ceil(v / tradingEvenings))} / evening`}
                      </dd>
                    </div>
                  ))}
                </dl>
                {m.warning && <p>{m.warning}</p>}
              </section>
            </>
          )}
          <p className="shell-caption">
            Actual recorded operating profit and profit after tax are
            unavailable. Forecast orders are customer baskets; product sales
            volumes are individual units.
          </p>
          {selected && (
            <PricePanel
              id={selected}
              data={data}
              state={state}
              close={() => P("")}
              settings={openSettings}
            />
          )}
        </>
      ) : (
        <p className="shell-caption">Loading financial overview…</p>
      )}
      <button className="secondary" onClick={() => G(!glossary)}>
        Financial glossary
      </button>
      {glossary && <FinancialGlossary />}
    </>
  );
}
