import { useState } from "react";
import type { State } from "../types";
import type { Page } from "../components/ui";
import type { Overview } from "./MoneyWorkspace";
export default function GettingStarted({
  state,
  overview,
  hasStock,
  navigate,
}: {
  state: State;
  overview?: Overview;
  hasStock: boolean;
  navigate: (p: Page, action?: string) => void;
}) {
  const [dismissed, D] = useState(
    () => localStorage.getItem("kitchen-start-dismissed") === "yes",
  );
  const setDismissed = (value: boolean) => {
    D(value);
    localStorage.setItem("kitchen-start-dismissed", value ? "yes" : "no");
  };
  const recipes = state.recipes.filter((v) => v.recipe.isSellable !== false);
  if (dismissed)
    return (
      <button
        className="secondary onboarding-return"
        onClick={() => setDismissed(false)}
      >
        Show getting started
      </button>
    );
  const steps: [boolean, string, string, Page, string][] = [
    [
      recipes.length > 0,
      "Choose a dessert",
      `${recipes.length} published sellable recipes already available.`,
      recipes.length ? "Settings" : "Recipes",
      recipes.length ? "pricing:" : "",
    ],
    [
      state.prices.some((p) => !p.isIllustrative),
      "Review ingredient prices",
      state.prices.length
        ? `${state.prices.length} quotes already saved; illustrative prices are estimates.`
        : "Add a supplier price to cost your first ingredient.",
      "Ingredients",
      "",
    ],
    [
      overview?.knownMonthlyCosts != null,
      "Add your regular bills",
      "Start with rent or insurance; sales forecasts can wait.",
      "Settings",
      "business:expenses",
    ],
    [
      overview?.model != null,
      "Estimate your earnings",
      "Optional: expected orders, selling costs and platform fees.",
      "Settings",
      "business:forecast",
    ],
    [
      hasStock,
      "Record stock when ready",
      "Optional: purchases, ingredients you already have or finished batches.",
      "Inventory",
      "stock",
    ],
  ];
  return (
    <section className="panel getting-started" aria-label="Getting started">
      <div className="section-heading">
        <div>
          <h2>What would you like to do?</h2>
          <p>Start with one answer. Use what you have already saved.</p>
        </div>
        <button className="text-button" onClick={() => setDismissed(true)}>
          Hide getting started
        </button>
      </div>
      <div className="start-choices">
        <button
          className="secondary"
          onClick={() =>
            navigate(
              recipes.length ? "Settings" : "Recipes",
              recipes.length ? "pricing:" : "",
            )
          }
        >
          <strong>Cost a dessert</strong>
          <span>
            {recipes.length
              ? `Choose from ${recipes.length} saved recipes and try a price.`
              : "Add your first recipe to see its making cost."}
          </span>
        </button>
        <button
          className="secondary"
          onClick={() => navigate("Settings", "business:expenses")}
        >
          <strong>Plan my business</strong>
          <span>Enter a regular bill, then estimate earnings when ready.</span>
        </button>
        <button
          className="secondary"
          onClick={() => navigate("Inventory", "stock")}
        >
          <strong>Manage stock</strong>
          <span>Record ingredients, purchases or finished batches.</span>
        </button>
      </div>
      <details>
        <summary>Optional setup checklist</summary>
        <p>
          These are suggestions, not steps you must complete before using the
          app.
        </p>
        <ul className="setup-checklist">
          {steps.map(([done, title, note, page, action]) => (
            <li key={title}>
              <span>{done ? "✓ Available" : "○ Optional"}</span>
              <div>
                <strong>{title}</strong>
                <p>{note}</p>
              </div>
              <button
                className="text-button"
                onClick={() => navigate(page, action)}
              >
                {done ? "Review" : "Start"} {title.toLowerCase()}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
