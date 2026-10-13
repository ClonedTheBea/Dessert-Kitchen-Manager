import { PricePanel } from "./MoneyWorkspace";
import { useEffect, useState } from "react";
import { api, today } from "../api";
import { flushEdits } from "../autoSave";
import type { State } from "../types";
import type { Business, ProfitContext } from "../businessTypes";
import { ErrorBox } from "../components/ui";
import { ConfigureProduct, Simulator } from "./ProductProfitability";
export default function ProductPricing({
  state,
  initialId = "",
  initialMode = "test",
  openSettings,
}: {
  state: State;
  initialId?: string;
  initialMode?: string;
  openSettings: (action?: string) => void;
}) {
  const [ctx, C] = useState<ProfitContext>();
  const [current, B] = useState<Business>();
  const [id, I] = useState(initialId);
  const [mode, M] = useState(initialMode);
  const [advanced, ShowAdvanced] = useState(initialMode === "edit");
  const [seq, Q] = useState(0);
  const [loadedSeq, L] = useState(-1);
  const [error, E] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api<ProfitContext>("/profitability/context"),
      api<Business>("/business"),
    ])
      .then(([c, b]) => {
        if (active) {
          C(c);
          B(b);
          L(seq);
          E("");
        }
      })
      .catch((e) => E(e.message));
    return () => {
      active = false;
    };
  }, [seq]);
  const recipe = ctx?.recipes.find((r) => r.id === id);
  const done = () => {
    I("");
    M("test");
    Q((n) => n + 1);
  };
  return (
    <>
      <section className="panel">
        <h2>Cost a dessert</h2>
        <p>
          Choose a saved recipe, try a selling price and compare channels.
          Ingredient costs are already filled in from your recipes and supplier
          prices.
        </p>
        <label>
          Choose a product
          <select
            value={id}
            onChange={async (e) => {
              const v = e.target.value;
              if (await flushEdits()) {
                I(v);
                Q((n) => n + 1);
              }
            }}
          >
            <option value="">Choose a product</option>
            {ctx?.recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {recipe && (
          <div className="actions pricing-actions">
            {[
              ["test", "Try a price"],
              ["edit", "Edit saved product pricing"],
              ["simulate", "Advanced pricing scenarios"],
            ]
              .filter(([m]) => m !== mode)
              .map(([m, label]) => (
                <button
                  key={m}
                  className="secondary"
                  onClick={async () => {
                    if (await flushEdits()) {
                      M(m);
                      Q((n) => n + 1);
                    }
                  }}
                >
                  {label}
                </button>
              ))}
          </div>
        )}
        <ErrorBox error={error} />
      </section>
      {recipe &&
        ctx &&
        current &&
        loadedSeq === seq &&
        (mode === "test" ? (
          <section className="panel">
            <PricePanel
              key={`${id}-${seq}`}
              id={id}
              data={{ settings: ctx.settings }}
              state={state}
              close={done}
              inline
              quick
              settings={(action) => {
                if (action?.startsWith("pricing:")) {
                  ShowAdvanced(true);
                  M("edit");
                  Q((n) => n + 1);
                } else openSettings(action);
              }}
            />
          </section>
        ) : mode === "edit" ? (
          <ConfigureProduct
            key={`${id}-${seq}`}
            recipe={recipe}
            initial={current}
            done={done}
            advancedOpen={advanced}
          />
        ) : (
          <Simulator
            key={`${id}-${seq}`}
            context={ctx}
            recipe={recipe}
            state={state}
            asOf={today()}
            done={done}
          />
        ))}
    </>
  );
}
