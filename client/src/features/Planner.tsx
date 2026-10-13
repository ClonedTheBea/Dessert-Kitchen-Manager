import { Term } from "./FinancialGlossary";
import { ChartNoAxesCombined, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useAutoSave, SaveStatus } from "../autoSave";
import { api, money, number } from "../api";
import type { Model, Scenario, State } from "../types";
import PlannerAssumptions from "./PlannerAssumptions";
import { ActualCostComparison } from "./Inventory";
import ScenarioComparison from "./ScenarioComparison";

import { ErrorBox, clone, type Notify } from "../components/ui";
export default function Planner({
  state,
  initialId,
  refresh,
  notify: _notify,
}: {
  state: State;
  initialId?: string;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [draft, setDraft] = useState(
    clone(
      state.scenarios.find((s) => s.id === initialId) ?? state.scenarios[0],
    ),
  );
  const autosave = useAutoSave(draft, setDraft, "/scenarios");
  const [model, setModel] = useState<Model>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api<Model>("/scenarios/preview", draft)
        .then((m) => {
          if (active) {
            setModel(m);
            setError("");
          }
        })
        .catch((e) => {
          if (active) {
            setError(e.message);
            setModel(undefined);
          }
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [draft]);
  const update = <K extends keyof Scenario>(key: K, value: Scenario[K]) => {
    setDraft({
      ...draft,
      [key]: value,
      ...(key === "vatRegistered" && !value
        ? { recoverCommissionVat: false }
        : {}),
    });
    setModel(undefined);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">KNOW YOUR SWEET SPOT</div>
          <h1>Make the numbers work.</h1>
          <p>Explore what it takes to make your kitchen work for you.</p>
        </div>
        <span className="tag sample">Estimates, not recorded results</span>
      </div>
      <div className="planner-toolbar">
        <div className="actions">
          <select
            aria-label="Saved scenario"
            value={draft.id}
            onChange={async (e) => {
              const id = e.target.value;
              if (!(await autosave.flush())) return;
              await refresh();
              autosave.reset(clone(state.scenarios.find((s) => s.id === id)!));
              setModel(undefined);
            }}
          >
            <option value="" disabled>
              Unsaved scenario
            </option>
            {[...state.scenarios.filter((s) => s.id !== draft.id), draft].map(
              (s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ),
            )}
          </select>
          <button
            className="secondary"
            onClick={async () => {
              if (!(await autosave.flush())) return;
              autosave.reset(
                {
                  ...clone(draft),
                  id: "",
                  revision: 0,
                  name: draft.name + " — alternative",
                },
                true,
              );
            }}
          >
            <Plus size={16} />
            Duplicate scenario
          </button>
        </div>
      </div>
      <SaveStatus save={autosave} />
      <ErrorBox error={error} />
      {model && (
        <section
          className="planner-quick-results"
          aria-label="Financial results"
        >
          <div>
            <small>How much does it cost to run?</small>
            <strong>{money(model.fixedCosts)}</strong>
            <span>Fixed operating costs / month, including staff</span>
          </div>
          <div>
            <small>How much do I make per order?</small>
            <strong>{money(model.contributionPerOrder)}</strong>
            <span>
              <Term name="Contribution" /> after variable costs and fees
            </span>
          </div>
          <div>
            <small>How many orders must I sell?</small>
            <strong>
              {model.requiredOrders["Business expenses"] === null
                ? "Not achievable"
                : Math.ceil(
                    model.requiredOrders["Business expenses"]! /
                      model.monthlyOpenDays,
                  )}
            </strong>
            <span>
              Break-even orders / evening ·{" "}
              {model.requiredOrders["Business expenses"] ?? "—"} / month
            </span>
          </div>
          <div>
            <small>How much profit could I make?</small>
            <strong>{money(model.operatingProfit)}</strong>
            <span>
              Operating profit / month, before owner pay and capital recovery
            </span>
          </div>
        </section>
      )}
      <div className="planner-grid">
        <PlannerAssumptions draft={draft} update={update} />
        <div className="forecast-column">
          {model ? (
            <>
              <div className="forecast-hero">
                <span className="eyebrow">
                  PROJECTED MONTHLY OPERATING PROFIT
                </span>
                <strong>{money(model.operatingProfit)}</strong>
                <p>Before owner compensation and capital recovery</p>
                <div>
                  <span>{number(model.monthlyOrders)} orders / month</span>
                  <span>
                    {money(model.contributionPerOrder)} contribution / order
                  </span>
                </div>
              </div>
              {model.warning && (
                <div className="error" role="alert">
                  {model.warning}
                </div>
              )}
              <details className="panel results-detail">
                <summary>Show the full monthly breakdown</summary>
                <div className="section-heading">
                  <h2>Financial results · monthly breakdown</h2>
                  <span className="tag sample">Monthly estimate</span>
                </div>
                <dl className="breakdown large">
                  {[
                    ["Gross customer sales", model.grossSales],
                    ["Less sales VAT", -model.salesVat],
                    ["Net sales", model.netSales],
                    ["Ingredients & packaging", -model.variableCosts],
                    ["Platform commission", -model.commission],
                    ["Unrecovered VAT on fees", -model.commissionVat],
                    ["Contribution", model.contribution],
                    ["Other per-order charges", -model.otherCharges],
                    [
                      "Fixed overheads",
                      -(model.fixedCosts - model.staffingCosts),
                    ],
                    ["Paid staff & employer allowance", -model.staffingCosts],
                    ["Operating profit", model.operatingProfit],
                    ["Owner compensation target", -model.ownerCompensation],
                    ["After owner compensation", model.afterOwner],
                    [
                      "Capital recovery allocation",
                      -model.monthlyCapitalRecovery,
                    ],
                    [
                      "After owner & capital allocation",
                      model.afterCapitalRecovery,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className={
                        [
                          "Net sales",
                          "Contribution",
                          "Operating profit",
                          "After owner & capital allocation",
                        ].includes(label as string)
                          ? "total"
                          : ""
                      }
                    >
                      <dt>{label}</dt>
                      <dd>{money(value as number)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="help">
                  Owner compensation and capital recovery are planning
                  allocations. This forecast is not a cash flow statement; it
                  excludes payment timing, tax and working capital.
                </p>
              </details>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <h2>How many orders?</h2>
                    <p>Required per month at your current contribution.</p>
                  </div>
                  <ChartNoAxesCombined size={21} />
                </div>
                <div className="target-bars">
                  {Object.entries(model.requiredOrders).map(
                    ([label, count]) => (
                      <div key={label}>
                        <div>
                          <span>
                            {label} {label.includes("profit") ? "/ month" : ""}
                          </span>
                          <strong>
                            {count === null
                              ? "Not achievable"
                              : `${number(count)} orders / month`}
                          </strong>
                        </div>
                        <div className="bar-track">
                          <span
                            style={{
                              width: `${count === null ? 0 : Math.min(100, (count / Math.max(...Object.values(model.requiredOrders).filter((x): x is number => x !== null), 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ),
                  )}
                </div>
                <p className="help">
                  Contribution margin: {number(model.contributionMarginPercent)}
                  %. Average month: 52 ÷ 12 weeks, or{" "}
                  {number(model.monthlyOpenDays)} opening days. Orders round up
                  to whole orders.
                </p>
              </section>
            </>
          ) : (
            <section className="panel">
              <p>Updating forecast… Check any validation messages above.</p>
            </section>
          )}
          <details className="money-advanced">
            <summary>Compare scenarios & actual production costs</summary>
            <ActualCostComparison variableCost={draft.variableCost} />
            <ScenarioComparison
              draft={draft}
              scenarios={state.scenarios}
              model={model}
            />
          </details>
        </div>
      </div>
    </>
  );
}
