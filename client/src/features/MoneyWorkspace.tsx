import { useState } from "react";
import { flushEdits } from "../autoSave";
import type { State } from "../types";
import type { Notify } from "../components/ui";
import Planner from "./Planner";
import ProductProfitability from "./ProductProfitability";
import FinancialGlossary from "./FinancialGlossary";
import BusinessSettings from "./BusinessSettings";
export default function MoneyWorkspace(props: {
  state: State;
  refresh: () => Promise<void>;
  notify: Notify;
}) {
  const [tab, T] = useState("Financial planner");
  const [plannerId, P] = useState("");
  return (
    <>
      <nav className="section-nav" aria-label="Money workspace">
        {[
          "Financial planner",
          "Product profitability",
          "Business settings",
          "Glossary",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            aria-current={tab === t ? "page" : undefined}
            onClick={async () => {
              if (await flushEdits()) T(t);
            }}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Financial planner" && (
        <Planner {...props} initialId={plannerId} />
      )}{" "}
      {tab === "Product profitability" && (
        <ProductProfitability
          state={props.state}
          openPlanner={async (id) => {
            await props.refresh();
            P(id);
            T("Financial planner");
          }}
        />
      )}{" "}
      {tab === "Business settings" && <BusinessSettings />}
      {tab === "Glossary" && <FinancialGlossary />}
    </>
  );
}
