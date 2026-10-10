import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  ChefHat,
  CircleHelp,
  Cookie,
  Layers,
  Plus,
  Scale,
  Wheat,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, money, number } from "../api";
import type { Model, State } from "../types";

import { ErrorBox, Stat, type Page } from "../components/ui";
export default function Overview({
  state,
  navigate,
}: {
  state: State;
  navigate: (p: Page) => void;
}) {
  const [model, setModel] = useState<Model>();
  const [error, setError] = useState("");
  const scenario = state.scenarios[0];
  const products = state.recipes.filter((x) => x.recipe.isSellable !== false);
  useEffect(() => {
    if (scenario)
      api<Model>("/scenarios/preview", scenario)
        .then(setModel)
        .catch((e) => setError(e.message));
  }, [scenario]);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LET’S MAKE SOMETHING GOOD</div>
          <h1>Your kitchen, at a glance.</h1>
          <p>A clear view of your recipes, costs and what comes next.</p>
        </div>
        <button className="primary" onClick={() => navigate("Recipes")}>
          <Plus size={18} />
          Create a recipe
        </button>
      </div>
      <div className="notice">
        <span className="notice-icon">
          <Layers size={18} />
        </span>
        <div>
          <strong>A space to plan, test and refine.</strong> Your starting
          recipes use illustrative prices. Add your own supplier costs to make
          them yours.
        </div>
        <span className="tag sample">Planning data</span>
      </div>
      <ErrorBox error={error} />
      <div className="stats-grid">
        <Stat
          title="Recipes in your kitchen"
          value={String(products.length)}
          note={`${state.recipes.length - products.length} reusable sub-recipe${state.recipes.length - products.length === 1 ? "" : "s"}`}
          icon={<BookOpen size={18} />}
        />
        <Stat
          title="Ingredients & packaging"
          value={String(state.ingredients.length)}
          note={`${state.suppliers.length} supplier${state.suppliers.length === 1 ? "" : "s"} in your catalogue`}
          icon={<Wheat size={18} />}
        />
        <Stat
          title="Contribution per order"
          value={model ? money(model.contributionPerOrder) : "—"}
          note="Planning estimate · before fixed costs"
          icon={<ChartNoAxesCombined size={18} />}
        />
        <Stat
          title="Break-even orders / month"
          value={
            model
              ? String(
                  model.requiredOrders["Business expenses"] ?? "Unachievable",
                )
              : "—"
          }
          note="To cover fixed business expenses"
          icon={<Scale size={18} />}
        />
      </div>
      <div className="overview-grid">
        <section className="panel recipe-overview">
          <div className="section-heading">
            <div>
              <h2>From the recipe book</h2>
              <p>Small batches. Big possibilities.</p>
            </div>
            <button className="text-button" onClick={() => navigate("Recipes")}>
              All recipes <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RECIPE</th>
                  <th>COST / PORTION</th>
                  <th>SELLING PRICE</th>
                  <th>MARGIN</th>
                </tr>
              </thead>
              <tbody>
                {products.slice(0, 5).map(({ recipe: r, cost: c }) => (
                  <tr key={r.id} onClick={() => navigate("Recipes")}>
                    <td>
                      <div className="recipe-name">
                        <span
                          className={
                            "product-icon " +
                            (r.category === "Brownies" ? "chocolate" : "")
                          }
                        >
                          <Cookie size={22} />
                        </span>
                        <div>
                          <button
                            className="table-link"
                            onClick={() => navigate("Recipes")}
                          >
                            {r.name}
                          </button>
                          <small>
                            {r.category} <span>·</span>{" "}
                            {c.isIllustrative
                              ? "Illustrative"
                              : "Entered costs"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>{money(c.portionCost)}</td>
                    <td>{money(r.sellingPrice)}</td>
                    <td>
                      <span className="margin-pill">
                        {number(c.marginPercent)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel-foot">
            <CircleHelp size={15} />
            Recipe margin excludes platform fees and sales VAT. See the planner
            for order contribution.
          </div>
        </section>
        <section className="plan-card">
          <span className="eyebrow">THE BIGGER PICTURE</span>
          <h2>
            A plan that
            <br />
            adds up.
          </h2>
          <p>
            Find the sweet spot between
            <br />
            your costs and your ambition.
          </p>
          <div className="plan-number">
            <small>MONTHLY FIXED COSTS</small>
            <strong>{model ? money(model.fixedCosts) : "—"}</strong>
          </div>
          <div className="plan-detail">
            <span>Average basket</span>
            <strong>{scenario ? money(scenario.averageBasket) : "—"}</strong>
          </div>
          <div className="plan-detail">
            <span>Evenings per week</span>
            <strong>{scenario?.openDays.length ?? "—"}</strong>
          </div>
          <button onClick={() => navigate("Financial planner")}>
            Explore your financial plan <ArrowRight size={18} />
          </button>
          <span className="plan-caption">
            Editable assumptions. No recorded sales.
          </span>
        </section>
      </div>
      <div className="bottom-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Your next ingredients for success</h2>
              <p>Turn your first test batch into a business-ready recipe.</p>
            </div>
            <span className="soft-icon">
              <ChefHat size={22} />
            </span>
          </div>
          <div className="steps">
            <button onClick={() => navigate("Ingredients")}>
              <span>01</span>
              <div>
                <strong>Make the costs yours</strong>
                <small>Add supplier quotes and pack sizes.</small>
              </div>
              <ArrowUpRight size={18} />
            </button>
            <button onClick={() => navigate("Recipes")}>
              <span>02</span>
              <div>
                <strong>Perfect your first batch</strong>
                <small>Enter your cheesecake or brownie recipe.</small>
              </div>
              <ArrowUpRight size={18} />
            </button>
            <button onClick={() => navigate("Financial planner")}>
              <span>03</span>
              <div>
                <strong>Test the numbers</strong>
                <small>Explore prices, owner pay and break-even.</small>
              </div>
              <ArrowUpRight size={18} />
            </button>
          </div>
        </section>
        <section className="insight-card">
          <span className="soft-icon">
            <CircleHelp size={23} />
          </span>
          <span className="eyebrow">KITCHEN NOTES</span>
          <h3>Contribution isn’t profit.</h3>
          <p>
            Contribution is what’s left from an order after its variable costs
            and platform fees. It pays the fixed bills first; what remains is
            operating profit.
          </p>
          <button
            className="text-button"
            onClick={() => navigate("Financial planner")}
          >
            See your breakdown <ArrowRight size={16} />
          </button>
        </section>
      </div>
    </>
  );
}
