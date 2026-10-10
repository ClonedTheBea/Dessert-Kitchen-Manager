import { useEffect, useState } from "react";

import { flushEdits } from "../autoSave";

import { api, money, number, today } from "../api";

import { ErrorBox, Modal } from "../components/ui";

import type { State } from "../types";

import type {
  Action,
  Balance,
  Count,
  InventoryState,
  Lot,
  Operation,
  ProductionResult,
  Snapshot,
} from "../inventoryTypes";

import {
  ActionForm,
  CountForm,
  Dates,
  identity,
  Place,
  ProductionForm,
  PurchaseForm,
  Select,
  ShoppingForm,
  Text,
} from "./InventoryForms";

import "./inventory.css";

const tabs = [
  "Overview",

  "Purchases",

  "Stock on Hand",

  "Production",

  "Finished Products",

  "Stocktake",

  "Waste",

  "Shopping Lists",

  "Movement History",
];

export default function Inventory({ state }: { state: State }) {
  const [stock, setStock] = useState<InventoryState>(),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [location, setLocation] = useState("home"),
    [query, setQuery] = useState(""),
    [sort, setSort] = useState("name"),
    [attention, setAttention] = useState(false),
    [form, setForm] = useState(""),
    [action, setAction] = useState<Action>(),
    [count, setCount] = useState<Count>(),
    [trace, setTrace] = useState<Lot>(),
    [review, setReview] = useState<Lot>(),
    [operation, setOperation] = useState<Operation>(),
    [category, setCategory] = useState("");

  const refresh = async () => {
    setStock(await api<InventoryState>("/inventory/state"));
  };

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setError("");

    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!stock)
    return (
      <>
        <h1>Inventory</h1>

        <ErrorBox error={error} />

        <p>Loading inventory…</p>

        <button onClick={() => run(refresh)}>Retry</button>
      </>
    );

  const loc = stock.locations.find((l) => l.id === location)!;

  const summary = stock.summaries.find((s) => s.locationId === location)!;

  const balances = stock.balances.filter((b) => b.location.id === location);

  const movements = stock.movements.filter((m) => m.locationId === location);

  const ops = stock.operations.filter(
    (o) =>
      o.body.locationId === location ||
      movements.some((m) => m.operationId === o.id),
  );

  const filtered = balances

    .filter(
      (b) =>
        (tab !== "Finished Products" || b.lot.kind === "recipe") &&
        (!attention ||
          (b.status !== "Available" &&
            b.status !== "Reviewed · no recorded use-by") ||
          b.allergenReviewRequired) &&
        `${b.lot.name} ${b.lot.batchReference} ${b.status}`

          .toLowerCase()

          .includes(query.toLowerCase()),
    )

    .sort((a, b) =>
      sort === "expiry"
        ? (a.lot.useBy ?? "9999").localeCompare(b.lot.useBy ?? "9999")
        : sort === "value"
          ? b.value - a.value
          : a.lot.name.localeCompare(b.lot.name),
    );

  const low = state.ingredients.filter(
    (i) =>
      !i.archived &&
      balances

        .filter((b) => b.lot.itemId === i.id && b.lot.kind === "ingredient")

        .reduce((s, b) => s + b.usable, 0) < i.minimumStock,
  );

  const openAction = (kind: string, b?: Balance) => {
    setAction({
      operationId: identity(),

      lotId: b?.lot.id ?? "",

      locationId: b?.location.id ?? location,

      quantity: 1,

      reason: kind === "waste" ? "quality-control-sample" : "",

      notes: "",

      destinationId: "",

      date: today(),
    });

    setForm(kind);
  };

  const productionOps = ops.filter((o) => o.type === "production");

  const reversed = new Set(
    stock.operations.map((o) => o.reverses).filter(Boolean),
  );

  const resume = (s: Snapshot) => {
    setCount({
      operationId: identity(),

      snapshotId: s.id,

      counts: [],

      notes: "",
    });

    setForm("stocktake");
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">FROM DELIVERY TO DESSERT</div>

          <h1>Inventory</h1>

          <p>Purchase, prepare, count and trace your kitchen stock.</p>
        </div>

        <span className="tag">
          {loc.mode === "testing" ? "Home testing stock" : "Commercial stock"}
        </span>
      </div>

      <ErrorBox error={error} />

      <div className="inventory-toolbar">
        <Place
          locations={stock.locations}

          value={location}

          change={setLocation}
        />

        <button className="secondary" onClick={() => run(refresh)}>
          Refresh stock
        </button>

        <button className="secondary" onClick={() => setForm("location")}>
          Add location
        </button>
      </div>

      <nav className="inventory-tabs" aria-label="Inventory views">
        {tabs.map((t) => (
          <button
            key={t}

            className={tab === t ? "active" : ""}

            onClick={async () => {
              if (await flushEdits()) {
                setTab(t);

                setQuery("");

                setAttention(false);
              }
            }}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" && (
        <>
          <div className="inventory-stats">
            <Summary
              title="Physical stock value"

              value={money(summary.physicalValue)}
            />

            <Summary title="Low-stock ingredients" value={String(low.length)} />

            <Summary
              title="Batches needing attention"

              value={String(
                balances.filter(
                  (b) =>
                    b.usable === 0 ||
                    b.status === "Use-by approaching" ||
                    b.allergenReviewRequired,
                ).length,
              )}
            />

            <Summary
              title="Waste and consumption"

              value={money(summary.wasteValue)}
            />
          </div>

          <p className="muted">{stock.valuationMethod}</p>

          <div className="inventory-columns">
            <section className="inventory-panel">
              <h2>Stock needing attention</h2>

              {low.map((i) => (
                <p key={i.id}>
                  {i.name} · below minimum {number(i.minimumStock)} {i.baseUnit}
                </p>
              ))}

              {balances

                .filter(
                  (b) =>
                    b.usable === 0 ||
                    b.status === "Use-by approaching" ||
                    b.allergenReviewRequired,
                )

                .map((b) => (
                  <p key={b.lot.id}>
                    <b>{b.lot.name}</b> · {number(b.quantity)} {b.lot.unit} ·{" "}
                    {b.status}
                    {b.lot.useBy && ` (${b.lot.useBy})`}
                    {b.allergenReviewRequired &&
                      " · Allergen information changed; review required"}
                  </p>
                ))}

              {!low.length &&
                !balances.some(
                  (b) =>
                    b.usable === 0 ||
                    b.status === "Use-by approaching" ||
                    b.allergenReviewRequired,
                ) && (
                  <p>
                    No stock alerts. Receive your first purchase when ready.
                  </p>
                )}
            </section>

            <section className="inventory-panel">
              <h2>Recent activity</h2>

              {ops.slice(0, 6).map((o) => (
                <p key={o.id}>
                  <button className="secondary" onClick={() => setOperation(o)}>
                    {o.type} · {o.recordedAt.slice(0, 10)}
                  </button>
                </p>
              ))}

              {!ops.length && (
                <p>
                  No stock movements yet. Existing ingredients are available
                  under Purchases; no demonstration quantities have been added.
                </p>
              )}

              <p>
                {
                  balances.filter(
                    (b) => b.lot.kind === "recipe" && b.usable > 0,
                  ).length
                }{" "}
                finished / prepared lots available.
              </p>
            </section>
          </div>
        </>
      )}

      {tab === "Purchases" && (
        <section className="inventory-panel">
          <h2>Purchase receipts</h2>

          <button className="primary" onClick={() => setForm("purchase")}>
            Record purchase / resume draft
          </button>

          <p>Actual receipts are separate from supplier price quotes.</p>

          {ops

            .filter((o) => o.type === "purchase")

            .map((o) => (
              <p key={o.id}>
                <button className="secondary" onClick={() => setOperation(o)}>
                  {String(o.body.reference || "Purchase")} ·{" "}
                  {String(o.body.date)} ·{" "}
                  {reversed.has(o.id) ? "Reversed" : "Received"}
                </button>
              </p>
            ))}
        </section>
      )}

      {(tab === "Stock on Hand" || tab === "Finished Products") && (
        <section className="inventory-panel">
          <h2>{tab}</h2>

          <div className="inventory-toolbar">
            <Text label="Search stock" value={query} change={setQuery} />

            <Select
              label="Sort stock"

              value={sort}

              change={setSort}

              options={[
                { id: "name", name: "Name" },

                { id: "expiry", name: "Recorded use-by" },

                { id: "value", name: "Highest value" },
              ]}
            />

            <label>
              <input
                type="checkbox"

                checked={attention}

                onChange={(e) => setAttention(e.target.checked)}
              />
              Needs attention only
            </label>
          </div>

          {filtered.length === 0 && (
            <p>No matching stock lots in this location.</p>
          )}

          {filtered.map((b) => (
            <article className="inventory-stock" key={b.lot.id}>
              <div>
                <h3>
                  {b.lot.name}{" "}
                  {b.lot.recipeVersion && (
                    <small>Version {b.lot.recipeVersion}</small>
                  )}
                </h3>

                <p>
                  Batch {b.lot.batchReference || b.lot.id.slice(0, 8)} ·
                  Received / produced {b.lot.receivedOn}
                </p>

                <p>
                  <b>
                    {number(b.quantity)} {b.lot.unit} remaining
                  </b>{" "}
                  · {number(b.usable)} usable · {number(b.lot.initialQuantity)}{" "}
                  originally received / produced
                </p>

                <p>
                  {money(b.lot.unitCost)} per {b.lot.unit} · {money(b.value)}{" "}
                  remaining value
                </p>

                <p>
                  {b.status} · Use-by {b.lot.useBy ?? "not recorded"}
                </p>

                {b.allergenReviewRequired && (
                  <p className="error">
                    Ingredient information changed. Review batch allergen
                    information before use or making dietary claims.
                  </p>
                )}
              </div>

              <div className="actions">
                <button className="secondary" onClick={() => setTrace(b.lot)}>
                  Trace batch
                </button>

                <button
                  className="secondary"

                  onClick={() => openAction("waste", b)}
                >
                  Record waste / sample
                </button>

                <button
                  className="secondary"

                  onClick={() => openAction("transfer", b)}
                >
                  Transfer
                </button>

                <button
                  className="secondary"

                  onClick={() => openAction("adjustment", b)}
                >
                  Adjust
                </button>

                <button className="secondary" onClick={() => setReview(b.lot)}>
                  Review dates
                </button>
              </div>
            </article>
          ))}

          {tab === "Stock on Hand" && (
            <details>
              <summary>Ingredient catalogue and minimum levels</summary>

              <p>
                Minimum levels are edited in Ingredients. All existing
                ingredient identities are shared with inventory.
              </p>

              {state.ingredients

                .filter((i) =>
                  i.name.toLowerCase().includes(query.toLowerCase()),
                )

                .map((i) => (
                  <p key={i.id}>
                    {i.name} · usable{" "}
                    {number(
                      balances

                        .filter(
                          (b) =>
                            b.lot.kind === "ingredient" &&
                            b.lot.itemId === i.id,
                        )

                        .reduce((s, b) => s + b.usable, 0),
                    )}{" "}
                    {i.baseUnit} · minimum {number(i.minimumStock)} {i.baseUnit}
                  </p>
                ))}
            </details>
          )}
        </section>
      )}

      {tab === "Production" && (
        <section className="inventory-panel">
          <h2>Production batches</h2>

          <button className="primary" onClick={() => setForm("production")}>
            Record production / resume draft
          </button>

          {productionOps.map((o) => {
            const r = o.result as ProductionResult;

            return (
              <article className="inventory-stock" key={o.id}>
                <h3>
                  {r.batchId} ·{" "}
                  {
                    state.recipes.find((x) => x.recipe.id === r.recipeId)
                      ?.recipe.name
                  }{" "}
                  · v{r.version}
                </h3>

                <p>
                  {r.actualYield} {r.unit} · {r.mode} ·{" "}
                  {reversed.has(o.id) ? "Reversed" : o.recordedAt.slice(0, 10)}
                </p>

                <p>
                  Actual batch {money(r.batchCost)} · actual unit{" "}
                  {money(r.unitCost)} · published batch estimate{" "}
                  {money(r.estimatedRecipeCost)}
                </p>

                <p>
                  Material {money(r.materialCost)} · labour{" "}
                  {money(r.labourCost)} · other {money(r.otherCost)} · Produced
                  by {r.operator}
                </p>

                <button className="secondary" onClick={() => setOperation(o)}>
                  View production and lots
                </button>
              </article>
            );
          })}
        </section>
      )}

      {tab === "Stocktake" && (
        <section className="inventory-panel">
          <h2>Stocktake</h2>

          <p>
            Start a consistent snapshot, then tick and count all or selected
            lots. Uncounted lots remain unchanged.
          </p>

          <Select
            label="Category (optional)"

            value={category}

            change={setCategory}

            options={[
              ...new Set([
                ...state.ingredients.map((i) => i.category),

                ...state.recipes.map((r) => r.recipe.category),
              ]),
            ].map((id) => ({ id, name: id }))}
          />

          <button
            className="primary"

            onClick={() =>
              run(async () => {
                const s = await api<Snapshot>("/inventory/stocktakes/start", {
                  locationId: location,

                  category,
                });

                await refresh();

                resume(s);
              })
            }
          >
            Start stocktake
          </button>

          {stock.stocktakes

            .filter((s) => s.locationId === location)

            .slice()

            .reverse()

            .map((s) => {
              const op = ops.find(
                (o) => o.type === "stocktake" && o.body.snapshotId === s.id,
              );

              return (
                <p key={s.id}>
                  {s.recordedAt} · {s.category || "All categories"} ·{" "}
                  {s.lines.length} lots{" "}
                  <button
                    className="secondary"

                    onClick={() => (op ? setOperation(op) : resume(s))}
                  >
                    {op ? "View finalised count" : "Resume counts"}
                  </button>
                </p>
              );
            })}
        </section>
      )}

      {tab === "Waste" && (
        <section className="inventory-panel">
          <h2>Waste and non-sale consumption</h2>

          <button className="primary" onClick={() => openAction("waste")}>
            Record waste / resume draft
          </button>

          <p>
            Values use the actual cost of each lot. Reversed waste is excluded
            from totals.
          </p>

          {[
            ...new Set(
              movements

                .filter((m) => m.type.startsWith("waste:"))

                .map((m) => m.type),
            ),
          ].map((type) => (
            <p key={type}>
              {type.slice(6).replaceAll("-", " ")}:{" "}
              <b>{money(summary.wasteByReason[type] ?? 0)}</b>
            </p>
          ))}

          {movements

            .filter((m) => m.type.startsWith("waste:"))

            .map((m) => (
              <p key={m.sequence}>
                {m.occurredOn} ·{" "}
                {stock.lots.find((l) => l.id === m.lotId)?.name} ·{" "}
                {number(-m.quantity)} {m.unit} · {m.type.slice(6)} ·{" "}
                {money(-m.value)} {reversed.has(m.operationId) && "· Reversed"}
              </p>
            ))}
        </section>
      )}

      {tab === "Shopping Lists" && (
        <ShoppingForm
          defaultLocation={location}

          state={state}

          inventory={stock}
        />
      )}

      {tab === "Movement History" && (
        <section className="inventory-panel">
          <h2>Movement history</h2>

          <details>
            <summary>Date review history</summary>
            {stock.operations
              .filter(
                (o) =>
                  o.type === "date-review" &&
                  stock.movements.some(
                    (m) =>
                      m.lotId === o.body.lotId && m.locationId === location,
                  ),
              )
              .map((o) => (
                <p key={o.id}>
                  <button className="secondary" onClick={() => setOperation(o)}>
                    {stock.lots.find((l) => l.id === o.body.lotId)?.name} ·{" "}
                    {o.recordedAt}
                  </button>
                </p>
              ))}
          </details>

          <Text label="Search movements" value={query} change={setQuery} />

          <p>
            All movements are retained. Open a source operation to review
            details or record a reversal.
          </p>

          <div className="inventory-table">
            <table>
              <thead>
                <tr>
                  <th>When / by</th>

                  <th>Item / batch</th>

                  <th>Movement</th>

                  <th>Quantity</th>

                  <th>Value</th>

                  <th>Source</th>
                </tr>
              </thead>

              <tbody>
                {movements

                  .filter((m) =>
                    `${m.type} ${m.notes} ${stock.lots.find((l) => l.id === m.lotId)?.name}`

                      .toLowerCase()

                      .includes(query.toLowerCase()),
                  )

                  .map((m) => {
                    const l = stock.lots.find((l) => l.id === m.lotId)!;

                    return (
                      <tr key={m.sequence}>
                        <td>
                          {m.occurredOn}

                          <small>
                            {m.recordedAt} · {m.actor}
                          </small>
                        </td>

                        <td>
                          {l.name}

                          <small>{l.batchReference || l.id}</small>
                        </td>

                        <td>
                          {m.type}

                          <small>{m.notes}</small>
                        </td>

                        <td>
                          {number(m.quantity)} {m.unit}
                        </td>

                        <td>{money(m.value)}</td>

                        <td>
                          <button
                            className="secondary"

                            onClick={() =>
                              setOperation(
                                stock.operations.find(
                                  (o) => o.id === m.operationId,
                                )!,
                              )
                            }
                          >
                            Operation #{m.sequence}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {form && (
        <Modal
          title={
            form === "location"
              ? "Add stock location"
              : `${form[0].toUpperCase() + form.slice(1)} draft`
          }

          wide

          close={() => setForm("")}
        >
          {form === "purchase" && (
            <PurchaseForm
              defaultLocation={location}

              state={state}

              inventory={stock}

              done={refresh}
            />
          )}{" "}
          {form === "production" && (
            <ProductionForm
              defaultLocation={location}

              state={state}

              inventory={stock}

              done={refresh}
            />
          )}{" "}
          {["waste", "transfer", "adjustment"].includes(form) && action && (
            <ActionForm
              kind={form}

              initial={action}

              inventory={stock}

              done={refresh}
            />
          )}{" "}
          {form === "stocktake" && count && (
            <CountForm
              key={count.snapshotId}

              initial={count}

              inventory={stock}

              done={refresh}
            />
          )}{" "}
          {form === "location" && (
            <LocationForm
              done={async () => {
                await refresh();

                setForm("");
              }}
            />
          )}
        </Modal>
      )}

      {review && (
        <Modal
          title={`Review dates: ${review.name}`}

          close={() => setReview(undefined)}
        >
          <DateForm
            lot={review}

            done={async () => {
              await refresh();

              setReview(undefined);
            }}
          />
        </Modal>
      )}

      {trace && (
        <Modal
          title={`Trace: ${trace.name}`}

          wide

          close={() => setTrace(undefined)}
        >
          <Trace lot={trace} stock={stock} />
        </Modal>
      )}

      {operation && (
        <Modal
          title={`${operation.type} details`}

          wide

          close={() => setOperation(undefined)}
        >
          <OperationDetail
            operation={operation}

            stock={stock}

            done={async () => {
              await refresh();

              setOperation(undefined);
            }}
          />
        </Modal>
      )}
    </>
  );
}

function Summary({ title, value }: { title: string; value: string }) {
  return (
    <section className="inventory-panel">
      <p>{title}</p>

      <strong className="inventory-value">{value}</strong>
    </section>
  );
}

function LocationForm({ done }: { done: () => Promise<void> }) {
  const [name, setName] = useState(""),
    [mode, setMode] = useState("testing"),
    [error, setError] = useState("");

  return (
    <div className="inventory-panel">
      <Text label="Location name" value={name} change={setName} />

      <Select
        label="Stock pool"

        value={mode}

        change={setMode}

        options={[
          { id: "testing", name: "Home testing" },

          { id: "commercial", name: "Commercial" },
        ]}
      />

      <p>Transfers and production stay within the same stock pool.</p>

      <ErrorBox error={error} />

      <button
        className="primary"

        onClick={async () => {
          try {
            await api("/inventory/locations", { id: "", name, mode });

            await done();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Create location
      </button>
    </div>
  );
}

function DateForm({ lot, done }: { lot: Lot; done: () => Promise<void> }) {
  const [v, set] = useState({
      operationId: identity(),

      lotId: lot.id,

      useBy: lot.useBy,

      dateReviewed: lot.dateReviewed,

      dateEvidence: lot.dateEvidence,
    }),
    [error, setError] = useState("");

  return (
    <div className="inventory-panel">
      <Dates value={v} change={(d) => set({ ...v, ...d })} />

      <ErrorBox error={error} />

      <button
        className="primary"

        onClick={async () => {
          try {
            await api("/inventory/date-review", v);

            await done();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        Record date review
      </button>

      <p>
        Each review is retained in operation history. It does not certify food
        safety.
      </p>
    </div>
  );
}

function Trace({
  lot,

  stock,

  depth = 0,
}: {
  lot: Lot;

  stock: InventoryState;

  depth?: number;
}) {
  const op = stock.operations.find((o) => o.id === lot.operationId);

  const production =
    op?.type === "production" ? (op.result as ProductionResult) : null;

  return (
    <section className="inventory-line">
      <h3>
        {lot.name} · {lot.batchReference || lot.id}
      </h3>

      <p>
        {lot.receivedOn} · {lot.initialQuantity} {lot.unit} · unit cost{" "}
        {money(lot.unitCost)} · use-by {lot.useBy ?? "not recorded"}
      </p>

      <p>Date evidence: {lot.dateEvidence || "Awaiting review"}</p>

      {lot.ingredientSnapshot && (
        <details>
          <summary>Supplier allergen information at receipt</summary>

          <p>
            {lot.ingredientSnapshot.allergenInfo?.supplierText ||
              lot.ingredientSnapshot.allergens ||
              "No supplier declaration recorded"}
          </p>

          <p>
            Verification:{" "}
            {lot.ingredientSnapshot.allergenInfo?.verification ?? "unknown"} ·
            source{" "}
            {lot.ingredientSnapshot.allergenInfo?.source || "not recorded"} ·
            reviewer{" "}
            {lot.ingredientSnapshot.allergenInfo?.reviewer || "not recorded"}
          </p>

          <p>{lot.ingredientSnapshot.allergenInfo?.crossContactNotes}</p>
        </details>
      )}

      {op?.type === "purchase" && (
        <p>
          Supplier {lot.supplierSnapshot?.name ?? String(op.body.supplierId)} ·
          receipt {String(op.body.reference || "—")} · recorded by {op.actor} at{" "}
          {op.recordedAt}
        </p>
      )}

      <p>
        Recorded contains:{" "}
        {lot.allergenSnapshot?.contains.join(", ") ||
          "No declarations recorded — not a free-from claim"}
        . May contain:{" "}
        {lot.allergenSnapshot?.mayContain.join(", ") || "Not recorded"}
      </p>

      {production && (
        <>
          <p>
            Recipe v{production.version} · actual cost{" "}
            {money(production.batchCost)} · operator {production.operator}
          </p>

          {production.allocations.map((a, i) => {
            const source = stock.lots.find((l) => l.id === a.lotId);

            return (
              <details key={i}>
                <summary>
                  {a.item} · {number(a.quantity)} {a.unit} · {money(a.cost)} ·{" "}
                  {a.batchReference || a.lotId}
                </summary>

                {source && depth < 40 && (
                  <Trace lot={source} stock={stock} depth={depth + 1} />
                )}
              </details>
            );
          })}
        </>
      )}
    </section>
  );
}

function OperationDetail({
  operation: o,

  stock,

  done,
}: {
  operation: Operation;

  stock: InventoryState;

  done: () => Promise<void>;
}) {
  const [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [id] = useState(identity);

  const reversed = stock.operations.some((x) => x.reverses === o.id);

  const result =
    o.type === "production" ? (o.result as ProductionResult) : null;

  return (
    <div className="inventory-panel">
      <p>
        {o.recordedAt} · {o.actor} · {o.id}
      </p>

      {result && (
        <>
          <h3>
            {result.batchId} · v{result.version}
          </h3>

          <p>
            Actual {money(result.batchCost)} / {result.actualYield}{" "}
            {result.unit} = {money(result.unitCost)} each recipe unit. Published
            batch estimate {money(result.estimatedRecipeCost)}.
          </p>

          {result.allocations.map((a, i) => (
            <p key={i}>
              {a.item} · {a.batchReference || a.lotId} · {number(a.quantity)}{" "}
              {a.unit} · {money(a.cost)}
            </p>
          ))}
        </>
      )}

      {stock.lots

        .filter((l) => l.operationId === o.id)

        .map((l) => (
          <Trace key={l.id} lot={l} stock={stock} />
        ))}

      <details>
        <summary>Recorded operation details</summary>

        <pre className="inventory-json">{JSON.stringify(o.body, null, 2)}</pre>
      </details>

      <details>
        <summary>Posting result</summary>

        <pre className="inventory-json">
          {JSON.stringify(o.result, null, 2)}
        </pre>
      </details>

      {!["reversal", "date-review"].includes(o.type) && !reversed && (
        <>
          <Text label="Reversal reason" value={reason} change={setReason} />

          <p>
            A reversal restores consumed quantities and removes produced /
            received quantities. It is blocked if doing so would create negative
            stock; reverse dependent usage first or record an explained
            correction.
          </p>

          <ErrorBox error={error} />

          <button
            className="secondary"

            onClick={async () => {
              try {
                await api("/inventory/reverse", {
                  operationId: id,

                  originalId: o.id,

                  reason,
                });

                await done();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Confirm reversing this operation
          </button>
        </>
      )}

      {reversed && (
        <p>
          This operation has been reversed. Both records remain in the ledger.
        </p>
      )}
    </div>
  );
}

export function ActualCostComparison({
  variableCost,
}: {
  variableCost: number;
}) {
  const [stock, setStock] = useState<InventoryState>(),
    [id, setId] = useState(""),
    [error, setError] = useState("");

  useEffect(() => {
    api<InventoryState>("/inventory/state")
      .then(setStock)

      .catch((e) => setError(e.message));
  }, []);

  const ops =
    stock?.operations.filter(
      (o) =>
        o.type === "production" &&
        !stock.operations.some((r) => r.reverses === o.id),
    ) ?? [];

  const op = ops.find((o) => o.id === id),
    r = op?.result as ProductionResult | undefined;

  return (
    <section className="panel inventory-panel">
      <h2>Actual production cost comparison</h2>

      <ErrorBox error={error} />

      <Select
        label="Compare a recorded batch"

        value={id}

        change={setId}

        options={ops.map((o) => ({
          id: o.id,

          name: `${(o.result as ProductionResult).batchId} · ${stock?.locations.find((l) => l.id === o.body.locationId)?.name} · v${(o.result as ProductionResult).version}`,
        }))}
      />

      {r ? (
        <p>
          Actual production unit cost <b>{money(r.unitCost)}</b> per {r.unit};
          published estimate {money(r.estimatedRecipeCost / r.plannedYield)} per
          planned unit. Current scenario variable cost is {money(variableCost)}{" "}
          per order. Check basket quantities and which labour/other costs are
          included before comparing units with orders.
        </p>
      ) : (
        <p>Select a batch after recording production in Inventory.</p>
      )}

      <p>Comparison only. Your scenario assumptions are not changed.</p>
    </section>
  );
}
