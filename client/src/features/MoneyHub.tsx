import { useState } from "react";
import MoneyWorkspace from "./MoneyWorkspace";
import SalesReport from "./SalesReport";
import SalesImports from "./SalesImports";
import SalesWorkspace from "./SalesWorkspace";
export default function MoneyHub(
  props: React.ComponentProps<typeof MoneyWorkspace>,
) {
  const [tab, T] = useState(
    props.initialAction === "new-order" ? "orders" : "forecast",
  );
  return (
    <>
      <nav className="money-tabs" aria-label="Money workspace">
        {[
          ["forecast", "Financial Overview"],
          ["orders", "Orders"],
          ["sales", "Sales"],
          ["imports", "Import Sales"],
          ["payouts", "Payouts"],
        ].map(([id, name]) => (
          <button
            className={tab === id ? "active" : "secondary"}
            key={id}
            aria-pressed={tab === id}
            onClick={() => T(id)}
          >
            {name}
          </button>
        ))}
      </nav>
      {tab === "forecast" ? (
        <MoneyWorkspace {...props} />
      ) : tab === "orders" ? (
        <SalesWorkspace initialNew={props.initialAction === "new-order"} />
      ) : tab === "sales" ? (
        <SalesReport />
      ) : (
        <SalesImports key={tab} payouts={tab === "payouts"} />
      )}
    </>
  );
}
