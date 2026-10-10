import { useEffect, useState } from "react";
import { api, money, number } from "../api";
import { ErrorBox } from "../components/ui";
import type { Model, Scenario } from "../types";
export default function ScenarioComparison({
  draft,
  scenarios,
  model,
}: {
  draft: Scenario;
  scenarios: Scenario[];
  model?: Model;
}) {
  const [id, setId] = useState("");
  const [data, setData] = useState<{
    scenario: Scenario;
    model: Model;
    differences: Record<string, number | null>;
  }>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setData(undefined);
    if (id)
      api<typeof data>("/scenarios/compare", { current: draft, otherId: id })
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [id, draft]);
  const rows = [
    ["grossSales", "Revenue (gross)"],
    ["contribution", "Contribution"],
    ["fixedCosts", "Fixed costs incl. staff"],
    ["operatingProfit", "Operating profit"],
    ["ownerCompensation", "Owner compensation"],
    ["afterCapitalRecovery", "After owner & capital"],
  ] as const;
  return (
    <section className="panel">
      <h2>Compare a saved scenario</h2>
      <p className="help">
        Current edits are compared with the saved version selected below.
        Neither scenario is changed by comparing.
      </p>
      <select
        aria-label="Compare scenario"
        value={id}
        onChange={(e) => setId(e.target.value)}
      >
        <option value="">Choose a saved scenario…</option>
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ErrorBox error={error} />
      {data && model && (
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Scrollable table"
        >
          <table className="comparison">
            <thead>
              <tr>
                <th>MONTHLY</th>
                <th>Current edits</th>
                <th>{data.scenario.name}</th>
                <th>Change vs saved</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([k, label]) => (
                <tr key={k}>
                  <td>{label}</td>
                  <td>{money(model[k])}</td>
                  <td>{money(data.model[k])}</td>
                  <td>{money(data.differences[k] ?? 0)}</td>
                </tr>
              ))}
              {["Business expenses", "Expenses + owner"].map((k) => (
                <tr key={k}>
                  <td>
                    {k === "Business expenses"
                      ? "Business break-even orders"
                      : "Break-even incl. owner"}
                  </td>
                  <td>{model.requiredOrders[k] ?? "Not achievable"}</td>
                  <td>{data.model.requiredOrders[k] ?? "Not achievable"}</td>
                  <td>
                    {data.differences[k] === null
                      ? "Not comparable"
                      : number(data.differences[k] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
