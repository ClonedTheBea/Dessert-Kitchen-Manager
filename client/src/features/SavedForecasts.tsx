import { useState } from "react";
import { api, today } from "../api";
import { flushEdits } from "../autoSave";
import type { Model, Scenario, State } from "../types";
import { ErrorBox } from "../components/ui";
import ScenarioComparison from "./ScenarioComparison";
import { ActualCostComparison } from "./Inventory";
export default function SavedForecasts({ state }: { state: State }) {
  const [snapshot, S] = useState<{
    assumptions: Scenario | null;
    model: Model | null;
    missing: string[];
  }>();
  const [error, E] = useState("");
  const [name, N] = useState("My forecast");
  const [saved, B] = useState(state.scenarios);
  const [message, M] = useState("");
  return (
    <details>
      <summary>Advanced: compare forecasts & actual production costs</summary>
      <p>
        Prepare a snapshot of your active settings to compare or save. Saved
        scenarios are historical records; they do not control the live forecast.
      </p>
      <button
        className="secondary"
        onClick={async () => {
          if (!(await flushEdits())) return;
          try {
            S(await api("/financial/overview?date=" + today()));
            E("");
          } catch (e) {
            E((e as Error).message);
          }
        }}
      >
        Prepare current forecast
      </button>
      <ErrorBox error={error} />
      {snapshot?.assumptions && (
        <>
          {snapshot.model ? (
            <>
              <label>
                Snapshot name
                <input value={name} onChange={(e) => N(e.target.value)} />
              </label>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    const s = await api<Scenario>("/scenarios", {
                      ...snapshot.assumptions,
                      id: crypto.randomUUID(),
                      revision: 0,
                      name,
                    });
                    B([...saved, s]);
                    M("Forecast snapshot saved. Active settings unchanged.");
                  } catch (e) {
                    E((e as Error).message);
                  }
                }}
              >
                Save forecast snapshot
              </button>
              <p role="status">{message}</p>
              <ScenarioComparison
                draft={snapshot.assumptions}
                model={snapshot.model}
                scenarios={saved}
              />
            </>
          ) : (
            <p>{snapshot.missing.join(" ")}</p>
          )}
          <ActualCostComparison
            variableCost={snapshot.assumptions.variableCost}
          />
        </>
      )}
    </details>
  );
}
