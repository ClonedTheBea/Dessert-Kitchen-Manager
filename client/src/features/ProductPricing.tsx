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
}: {
  state: State;
  initialId?: string;
}) {
  const [ctx, C] = useState<ProfitContext>();
  const [current, B] = useState<Business>();
  const [id, I] = useState(initialId);
  const [mode, M] = useState("edit");
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
    M("edit");
    Q((n) => n + 1);
  };
  return (
    <>
      <section className="panel">
        <h2>Product pricing & saved price scenarios</h2>
        <p>
          Prices apply per product. Ingredient costs come directly from
          published recipes and supplier prices.
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
          <button
            className="secondary"
            onClick={async () => {
              if (await flushEdits()) {
                M(mode === "edit" ? "simulate" : "edit");
                Q((n) => n + 1);
              }
            }}
          >
            {mode === "edit"
              ? "Advanced pricing scenarios"
              : "Edit saved product pricing"}
          </button>
        )}
        <ErrorBox error={error} />
      </section>
      {recipe &&
        ctx &&
        current &&
        loadedSeq === seq &&
        (mode === "edit" ? (
          <ConfigureProduct
            key={`${id}-${seq}`}
            recipe={recipe}
            initial={current}
            done={done}
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
