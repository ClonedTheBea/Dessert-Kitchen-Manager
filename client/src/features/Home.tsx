import GettingStarted from "./GettingStarted";
import type { Overview } from "./MoneyWorkspace";
import {
  ChefHat,
  Plus,
  ShoppingBasket,
  Package,
  ChartNoAxesCombined,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api, money, number } from "../api";
import type { State, Model } from "../types";
import type { InventoryState, ProductionResult } from "../inventoryTypes";
import { ErrorBox, type Page } from "../components/ui";
export default function Home({
  state,
  navigate,
}: {
  state: State;
  navigate: (p: Page, action?: string) => void;
}) {
  const [overview, O] = useState<Overview>();
  const [stock, setStock] = useState<InventoryState>(),
    [model, setModel] = useState<Model>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api<InventoryState>("/inventory/state"),
      api<Overview>("/financial/overview"),
    ])
      .then(([s, m]) => {
        if (active) {
          setStock(s);
          O(m);
          setModel(m.model ?? undefined);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [state]);
  const attention =
    stock?.balances.filter(
      (b) =>
        b.usable === 0 ||
        b.status === "Use-by approaching" ||
        b.allergenReviewRequired,
    ) ?? [];
  const low = state.ingredients
    .filter((i) => !i.archived && i.minimumStock > 0)
    .map((i) => ({
      item: i,
      available:
        stock?.balances
          .filter((b) => b.lot.itemId === i.id && b.lot.kind === "ingredient")
          .reduce((n, b) => n + b.usable, 0) ?? 0,
    }))
    .filter((r) => r.available < r.item.minimumStock);
  const production =
    stock?.operations
      .filter(
        (o) =>
          o.type === "production" &&
          !stock.operations.some((r) => r.reverses === o.id),
      )
      .slice(0, 3) ?? [];
  const tasks = [
    {label:"New Order",note:"Add desserts to a basket",page:"Financial planner",action:"new-order",icon:ShoppingBasket},
    {
      label: "Add ingredient",
      note: "Supplier and price together",
      page: "Ingredients",
      action: "ingredient",
      icon: Plus,
    },
    {
      label: "Record purchase",
      note: "Put your shopping into stock",
      page: "Inventory",
      action: "purchase",
      icon: ShoppingBasket,
    },
    {
      label: "Make a batch",
      note: "From recipe to finished dessert",
      page: "Inventory",
      action: "production",
      icon: ChefHat,
    },
    {
      label: "Check stock",
      note: "See what’s ready and what’s low",
      page: "Inventory",
      action: "stock",
      icon: Package,
    },
    {
      label: "View profitability",
      note: "Understand the cost of an order",
      page: "Financial planner",
      action: "",
      icon: ChartNoAxesCombined,
    },
  ];
  return (
    <>
      <header className="home-hero">
        <div>
          <div className="eyebrow">YOUR KITCHEN, YOUR WAY</div>
          <h1>What’s cooking today?</h1>
          <p>Your recipes, ingredients and next batch, all in one place.</p>
        </div>
        <div className="hero-mark">
          <ChefHat size={52} />
        </div>
      </header>
      <ErrorBox error={error} />
      <GettingStarted
        state={state}
        overview={overview}
        hasStock={!!stock?.balances.length}
        navigate={navigate}
      />
      <div className="task-grid">
        {tasks.map(({ label, note, page, action, icon: Icon }) => (
          <button
            className="task-card"
            key={label}
            onClick={() => navigate(page as Page, action)}
          >
            <Icon size={24} />
            <strong>{label}</strong>
            <small>{note}</small>
          </button>
        ))}
      </div>
      <div className="home-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>On your kitchen list</h2>
            <button
              className="text-button"
              onClick={() => navigate("Inventory", "stock")}
            >
              View stock
            </button>
          </div>
          {!stock ? (
            <p>Checking your kitchen…</p>
          ) : attention.length ? (
            attention.slice(0, 4).map((b) => (
              <div className="activity-item" key={b.lot.id + b.location.id}>
                <strong>{b.lot.name}</strong>
                <p>
                  {number(b.quantity)} {b.lot.unit} · {b.location.name}
                </p>
                <small>
                  {b.status}
                  {b.lot.useBy && ` · ${b.lot.useBy}`}
                  {b.allergenReviewRequired && " · Allergen review needed"}
                </small>
              </div>
            ))
          ) : (
            <p>No batches need date or allergen attention.</p>
          )}
          {stock &&
            low.slice(0, 3).map(({ item, available }) => (
              <div className="activity-item" key={item.id}>
                <strong>{item.name} · running low</strong>
                <p>
                  {number(available)} {item.baseUnit} usable · minimum{" "}
                  {number(item.minimumStock)} {item.baseUnit}
                </p>
              </div>
            ))}
          <div className="activity-item">
            <strong>Plan your next shop</strong>
            <p>Choose what you want to make and check what you need to buy.</p>
            <button
              className="secondary"
              onClick={() => navigate("Inventory", "shopping")}
            >
              Make a shopping list
            </button>
          </div>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Your business at a glance</h2>
            <span className="tag sample">Planning estimate</span>
          </div>
          {model ? (
            <>
              <div className="home-metrics">
                <div>
                  <small>Monthly running costs</small>
                  <strong>{money(model.fixedCosts)}</strong>
                </div>
                <div>
                  <small>Contribution per order</small>
                  <strong>{money(model.contributionPerOrder)}</strong>
                </div>
                <div>
                  <small>Break-even / evening</small>
                  <strong>
                    {model.requiredOrders["Business expenses"] === null
                      ? "Not achievable"
                      : number(
                          Math.ceil(
                            model.requiredOrders["Business expenses"]! /
                              model.monthlyOpenDays,
                          ),
                        )}{" "}
                    orders
                  </strong>
                </div>
                <div>
                  <small>Monthly operating profit</small>
                  <strong>{money(model.operatingProfit)}</strong>
                </div>
              </div>
              <p>
                Current business settings. Before owner compensation and capital
                recovery.
              </p>
              <button
                className="secondary"
                onClick={() => navigate("Financial planner")}
              >
                Explore the numbers
              </button>
            </>
          ) : (
            <>
              <p>
                {overview?.knownMonthlyCosts != null
                  ? `${money(overview.knownMonthlyCosts)} in known monthly commitments. Add sales assumptions when you want to estimate earnings.`
                  : "Start with a regular bill to see your known monthly commitments."}
              </p>
              <button
                className="secondary"
                onClick={() => navigate("Settings", "business:expenses")}
              >
                Enter regular bills
              </button>
            </>
          )}
        </section>
        <section className="panel">
          <h2>Recent batches</h2>
          {production.length ? (
            production.map((o) => {
              const r = o.result as ProductionResult;
              return (
                <div className="activity-item" key={o.id}>
                  <strong>
                    {state.recipes.find((v) => v.recipe.id === r.recipeId)
                      ?.recipe.name ?? r.batchId}
                  </strong>
                  <p>
                    {r.actualYield} {r.unit} · {r.batchId} ·{" "}
                    {money(r.batchCost)} · {r.valuationStatus ?? "known"} cost
                  </p>
                  <small>
                    {
                      stock?.locations.find((l) => l.id === o.body.locationId)
                        ?.name
                    }{" "}
                    · {o.recordedAt.slice(0, 10)}
                  </small>
                </div>
              );
            })
          ) : (
            <p>
              Your completed batches will appear here. Ready for a kitchen
              experiment?
            </p>
          )}
          <button
            className="text-button"
            onClick={() => navigate("Inventory", "production")}
          >
            Make a batch
          </button>
        </section>
        <section className="panel">
          <h2>Recently in your kitchen</h2>
          {stock?.operations.slice(0, 4).map((o) => (
            <div className="activity-item" key={o.id}>
              <strong>
                {(
                  {
                    purchase: "Purchase received",
                    production: "Batch completed",
                    waste: "Waste or sample recorded",
                    "date-review": "Dates reviewed",
                  } as Record<string, string>
                )[o.type] ?? o.type.replaceAll("-", " ")}
              </strong>
              <p>
                {String(
                  o.body.reference ||
                    o.body.batchReference ||
                    o.body.reason ||
                    "Kitchen record",
                )}{" "}
                · {o.recordedAt.slice(0, 10)}
              </p>
            </div>
          ))}
          {stock && !stock.operations.length && (
            <p>
              Receive a purchase or make your first batch to start your kitchen
              history.
            </p>
          )}
          <p>
            {state.recipes.length} recipes ·{" "}
            {state.ingredients.filter((i) => !i.archived).length} ingredients
            and packaging items
          </p>
        </section>
      </div>
    </>
  );
}
