import { useEffect, useState } from "react";
import { api, money } from "../api";
import { ErrorBox } from "../components/ui";
import { N, S, T } from "./BusinessSettings";
const uid = () => crypto.randomUUID();
export default function SalesWorkspace({
  initialNew = false,
}: {
  initialNew?: boolean;
}) {
  const [orders, O] = useState<any[]>([]),
    [catalogue, C] = useState<any>(),
    [selected, V] = useState<any>(),
    [search, Q] = useState(""),
    [filter, F] = useState("active"),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [draft, D] = useState<any>(),
    [location, L] = useState(""),
    [links, K] = useState<Record<string, string>>({}),
    [amount, A] = useState(0),
    [reason, R] = useState(""),
    [method, M] = useState("cash"),
    [history, H] = useState<any>();
  const load = async () => {
    const [o, c] = await Promise.all([
      api<any[]>("/sales/orders"),
      api<any>("/sales/catalogue"),
    ]);
    O(o);
    C(c);
    L((x) => x || c.locations[0]?.id || "");
    return c;
  };
  const fresh = (c: any) =>
    D({
      operationId: uid(),
      id: uid(),
      revision: 0,
      channelId: c.channels[0]?.id ?? "direct",
      items: [],
      discount: 0,
      notes: "",
      reference: "",
      confirm: true,
    });
  useEffect(() => {
    load()
      .then((c) => {
        if (initialNew) fresh(c);
      })
      .catch((e) => E(e.message));
  }, []);
  const run = async (work: () => Promise<void>) => {
    B(true);
    E("");
    try {
      await work();
    } catch (e) {
      E((e as Error).message);
    } finally {
      B(false);
    }
  };
  const action = (action: string) =>
    run(async () => {
      const o = await api<any>("/sales/action", {
        operationId: uid(),
        id: selected.id,
        revision: selected.revision,
        action,
        locationId: location,
        productionLinks: links,
        amount,
        method,
        reason,
      });
      V(o);
      H(undefined);
      await load();
    });
  const edit = (change: any) => D({ ...draft, ...change, operationId: uid() });
  const price = (id: string, channel = draft?.channelId) =>
    catalogue?.products.find((p: any) => p.id === id)?.prices[channel] ?? 0;
  const total =
    draft?.items.reduce((n: number, i: any) => n + i.quantity * i.price, 0) ??
    0;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Orders</h1>
          <p>Take an order, prepare it and record payment separately.</p>
        </div>
        <button
          className="secondary"
          disabled={busy || !catalogue}
          onClick={() => {
            fresh(catalogue);
            V(undefined);
            Q("");
          }}
        >
          New Order
        </button>
      </div>
      <ErrorBox error={error} />
      {draft ? (
        <section className="panel">
          <div className="till-layout">
            <div>
              <h2>Add desserts</h2>
              <S
                label="Order channel"
                value={draft.channelId}
                options={catalogue.channels.map((c: any) => [c.id, c.name])}
                onChange={(channelId) =>
                  edit({
                    channelId,
                    items: draft.items.map((i: any) => ({
                      ...i,
                      price: price(i.recipeId, channelId),
                    })),
                  })
                }
              />
              <T label="Search order products" value={search} onChange={Q} />
              <div className="dessert-results">
                {catalogue.products
                  .filter((p: any) =>
                    p.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((p: any) => (
                    <button
                      className="secondary"
                      key={p.id}
                      onClick={() => {
                        const exists = draft.items.some(
                          (i: any) => i.recipeId === p.id,
                        );
                        edit({
                          items: exists
                            ? draft.items.map((i: any) =>
                                i.recipeId === p.id
                                  ? { ...i, quantity: i.quantity + 1 }
                                  : i,
                              )
                            : [
                                ...draft.items,
                                {
                                  recipeId: p.id,
                                  quantity: 1,
                                  price: price(p.id),
                                },
                              ],
                        });
                      }}
                    >
                      {p.name}
                      <span>{money(price(p.id))} · Add</span>
                    </button>
                  ))}
              </div>
            </div>
            <div>
              <h2>Basket</h2>
              {draft.items.map((i: any) => (
                <div className="running-cost-row" key={i.recipeId}>
                  <strong>
                    {
                      catalogue.products.find((p: any) => p.id === i.recipeId)
                        ?.name
                    }
                  </strong>
                  <N
                    label="Quantity"
                    value={i.quantity}
                    onChange={(quantity) =>
                      edit({
                        items: draft.items.map((x: any) =>
                          x.recipeId === i.recipeId ? { ...x, quantity } : x,
                        ),
                      })
                    }
                  />
                  <p>
                    {money(i.price)} each · {money(i.price * i.quantity)}
                  </p>
                  <button
                    className="text-button"
                    onClick={() =>
                      edit({
                        items: draft.items.filter(
                          (x: any) => x.recipeId !== i.recipeId,
                        ),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p>Items {money(total)}</p>
              <N
                label="Discount (£)"
                value={draft.discount}
                onChange={(discount) => edit({ discount })}
              />
              <strong className="financial-value">
                Total {money(total - draft.discount)}
              </strong>
              <details>
                <summary>Notes & external order reference</summary>
                <T
                  label="Order notes"
                  value={draft.notes}
                  onChange={(notes) => edit({ notes })}
                />
                <T
                  label="Platform order reference"
                  value={draft.reference}
                  onChange={(reference) => edit({ reference })}
                />
                <p>
                  Use the original reference for orders received elsewhere to
                  prevent duplicate sales.
                </p>
              </details>
              <div className="actions">
                {[true, false].map((confirm) => (
                  <button
                    disabled={busy || !draft.items.length}
                    key={String(confirm)}
                    className={confirm ? "primary" : "secondary"}
                    onClick={() =>
                      run(async () => {
                        const o = await api<any>("/sales/orders", {
                          ...draft,
                          confirm,
                        });
                        V(o);
                        D(undefined);
                        await load();
                      })
                    }
                  >
                    {confirm ? "Confirm order" : "Save draft"}
                  </button>
                ))}
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => D(undefined)}
                >
                  Discard unsaved basket
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : selected ? (
        <section className="panel">
          <button
            className="secondary"
            onClick={() => {
              V(undefined);
              H(undefined);
            }}
          >
            Back to orders
          </button>
          <h2>
            {selected.number} · {selected.channel}
          </h2>
          <p>
            {new Date(selected.recordedAt).toLocaleString("en-GB")} ·{" "}
            {selected.status} · Payment: {selected.paymentStatus}
          </p>
          {selected.financialOnly && (
            <p>Historical financial-only record — no stock was consumed.</p>
          )}
          {selected.lines.map((l: any) => (
            <p key={l.recipeId}>
              {l.quantity || "Quantity unknown"} × {l.name} · {money(l.price)}{" "}
              each
            </p>
          ))}
          <p>
            Items {money(selected.gross)} − discount {money(selected.discount)}
          </p>
          <h3>Total {money(selected.total)}</h3>
          <p>
            Refunds {money(selected.refunds)} · Expected platform fees{" "}
            {money(selected.expectedFees)} (estimate, awaiting reconciliation)
          </p>
          <p>{selected.notes}</p>
          {selected.financialOnly && (
            <p>
              Reported fees {money(selected.reportedFees)} · other fees{" "}
              {money(selected.otherFees)} · merchant adjustments{" "}
              {money(selected.adjustments)} · reported net{" "}
              {money(selected.reportedNet)}. Reported net is not proof of bank
              receipt.
            </p>
          )}
          {selected.status === "draft" && (
            <button
              onClick={() => {
                D({
                  operationId: uid(),
                  id: selected.id,
                  revision: selected.revision,
                  channelId: selected.channelId,
                  items: selected.lines.map((l: any) => ({
                    recipeId: l.recipeId,
                    quantity: l.quantity,
                    price: l.price,
                  })),
                  discount: selected.discount,
                  notes: selected.notes,
                  reference: selected.reference,
                  confirm: true,
                });
                V(undefined);
              }}
            >
              Edit draft
            </button>
          )}
          {(["received", "preparing", "ready"].includes(selected.status) ||
            (selected.financialOnly &&
              selected.lines.every((l: any) => l.allocations == null))) && (
            <>
              <S
                label="Fulfil from stock location"
                value={location}
                onChange={L}
                options={catalogue.locations.map((l: any) => [
                  l.id,
                  l.name + " (" + l.mode + ")",
                ])}
              />
              <details>
                <summary>Made to order instead of prepared stock</summary>
                <p>
                  First record an explicit made-to-order production action in
                  Stock → Production, matching this order's recipe version and
                  quantity. Select that action here; ingredients will not be
                  consumed twice.
                </p>
                {selected.lines.map((l: any) => (
                  <S
                    key={l.recipeId}
                    label={l.name + " preparation"}
                    value={links[l.recipeId] ?? ""}
                    onChange={(v) => K({ ...links, [l.recipeId]: v })}
                    options={[
                      ["", "Use prepared finished stock"],
                      ...catalogue.production
                        .filter(
                          (p: any) =>
                            p.result.recipeId === l.recipeId &&
                            p.result.actualYield === l.quantity,
                        )
                        .map((p: any) => [
                          p.id,
                          p.result.batchId + " · " + p.result.actualYield,
                        ]),
                    ]}
                  />
                ))}
              </details>
              {selected.financialOnly && (
                <T label="Verification evidence" value={reason} onChange={R} />
              )}
              <div className="actions">
                {(selected.financialOnly
                  ? ["verify-fulfilment"]
                  : ["preparing", "ready", "complete"]
                ).map((a) => (
                  <button disabled={busy} key={a} onClick={() => action(a)}>
                    {a === "verify-fulfilment"
                      ? "Verify historical preparation links"
                      : a === "complete"
                        ? "Complete & deduct stock"
                        : a === "ready"
                          ? "Mark ready"
                          : "Start preparing"}
                  </button>
                ))}
              </div>
            </>
          )}
          {selected.channelId === "direct" &&
            selected.paymentStatus === "unpaid" &&
            !["draft", "cancelled"].includes(selected.status) && (
              <>
                <S
                  label="Payment method"
                  value={method}
                  onChange={M}
                  options={[
                    ["cash", "Cash"],
                    ["card", "Card"],
                    ["bank", "Bank transfer"],
                    ["manual", "Other / manual"],
                  ]}
                />
                <button disabled={busy} onClick={() => action("paid")}>
                  Record paid
                </button>
              </>
            )}
          <details>
            <summary>Cancel or refund</summary>
            <p>
              Neither action returns food to stock. Record waste or a justified
              stock correction separately in Stock.
            </p>
            <T label="Reason" value={reason} onChange={R} />
            {!["completed", "cancelled"].includes(selected.status) ? (
              <button disabled={busy} onClick={() => action("cancel")}>
                Cancel order
              </button>
            ) : (
              <>
                <N label="Refund amount (£)" value={amount} onChange={A} />
                <button disabled={busy} onClick={() => action("refund")}>
                  Record refund
                </button>
              </>
            )}
          </details>
          <button
            className="text-button"
            onClick={() =>
              run(async () => H(await api("/sales/history/" + selected.id)))
            }
          >
            Show audit history
          </button>
          {history && (
            <ul>
              {history.map((h: any) => (
                <li key={h.at}>
                  {new Date(h.at).toLocaleString()} ·{" "}
                  {h.request.action ?? "Order saved"} · revision{" "}
                  {h.snapshot.revision}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <section className="panel">
          <h2>Recent orders</h2>
          <T label="Search orders" value={search} onChange={Q} />
          <S
            label="Order filter"
            value={filter}
            onChange={F}
            options={[
              ["active", "Active orders"],
              ["all", "All orders"],
              ["completed", "Completed"],
              ["cancelled", "Cancelled"],
            ]}
          />
          <div className="order-list">
            {orders
              .filter(
                (o) =>
                  (filter === "all" || filter === "active"
                    ? !["completed", "cancelled"].includes(o.status) ||
                      filter === "all"
                    : o.status === filter) &&
                  [
                    o.number,
                    o.reference,
                    o.channel,
                    ...o.lines.map((l: any) => l.name),
                  ]
                    .join(" ")
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((o) => (
                <button
                  className="secondary"
                  key={o.id}
                  onClick={() => {
                    V(o);
                    K({});
                    H(undefined);
                    R("");
                    A(0);
                  }}
                >
                  <strong>
                    {o.number} · {money(o.total)}
                  </strong>
                  <span>
                    {o.channel} · {o.status} · {o.paymentStatus}
                  </span>
                  <span>
                    {o.lines
                      .map(
                        (l: any) =>
                          (l.quantity || "Quantity unknown") + " × " + l.name,
                      )
                      .join(", ")}
                  </span>
                  <small>
                    {new Date(o.recordedAt).toLocaleString("en-GB")}
                  </small>
                </button>
              ))}
          </div>
          {!orders.length && (
            <p>No orders yet. Choose New Order to start a basket.</p>
          )}
        </section>
      )}
    </>
  );
}
