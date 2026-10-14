import { useEffect, useState } from "react";
import { api, money, today } from "../api";
import { ErrorBox } from "../components/ui";
import { N, S, T } from "./BusinessSettings";
export default function SalesImports({
  payouts = false,
}: {
  payouts?: boolean;
}) {
  const [catalogue, C] = useState<any>(),
    [orders, O] = useState<any[]>([]),
    [view, V] = useState<any>(),
    [error, E] = useState(""),
    [busy, B] = useState(false),
    [channel, H] = useState("deliveroo"),
    [csv, F] = useState(""),
    [headers, J] = useState<string[]>([]),
    [mapping, M] = useState<Record<string, string>>({}),
    [maps, W] = useState<any[]>([]),
    [mapName, MN] = useState("My sales report"),
    [rows, R] = useState<any[]>(),
    [confirmed, CF] = useState(false),
    [op, OP] = useState(crypto.randomUUID()),
    [p, P] = useState<any>({
      id: crypto.randomUUID(),
      reference: "",
      date: today(),
      orderIds: [],
      actual: 0,
      commission: null,
      otherFees: 0,
      refunds: 0,
      adjustments: 0,
      notes: "",
      corrects: null,
    });
  const load = async () => {
    const [c, o, v, m] = await Promise.all([
      api<any>("/sales/catalogue"),
      api<any[]>("/sales/orders"),
      api<any>("/sales/payouts"),
      api<any[]>("/sales/mappings"),
    ]);
    C(c);
    O(o);
    V(v);
    W(m);
  };
  useEffect(() => {
    load().catch((e) => E(e.message));
  }, []);
  const run = async (fn: () => Promise<void>) => {
    B(true);
    E("");
    try {
      await fn();
    } catch (e) {
      E((e as Error).message);
    } finally {
      B(false);
    }
  };
  const input = { operationId: op, channelId: channel, csv, columns: mapping };
  const fields = [
    ["reference", "Platform order reference (required)"],
    ["date", "Order date / time — ISO (required)"],
    ["gross", "Gross merchant item sales before discounts (required)"],
    ["product", "Product ID or name (optional)"],
    ["quantity", "Quantity"],
    ["salesVat", "Reported food-sales VAT"],
    ["discount", "Merchant-funded discount"],
    ["commission", "Commission including fee VAT"],
    ["otherFees", "Other merchant fees"],
    ["refund", "Refunds"],
    ["adjustment", "Merchant adjustments (+ / −)"],
    ["net", "Reported net owed / paid (not proof of bank receipt)"],
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{payouts ? "Payouts" : "Import Sales"}</h1>
          <p>
            {payouts
              ? "Match platform reports to orders and actual bank receipts."
              : "Preview a CSV before saving historical financial-only sales."}
          </p>
        </div>
      </div>
      <ErrorBox error={error} />
      <section className="panel">
        <S
          label="Report channel"
          value={channel}
          options={catalogue?.channels.map((c: any) => [c.id, c.name]) ?? []}
          onChange={(v) => {
            H(v);
            R(undefined);
            CF(false);
            P({ ...p, orderIds: [] });
          }}
        />
        {!payouts ? (
          <>
            <p>
              General-purpose CSV: one row per order, comma-separated, up to 1
              MB / 1,000 orders. Dates must use ISO format and amounts plain
              decimal numbers. This has not been certified against current
              platform exports. No stock is consumed. Tax and missing product
              costs remain unknown.
            </p>
            <label>
              Sales CSV
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file)
                    void run(async () => {
                      if (file.size > 1000000)
                        throw new Error("Choose a CSV up to 1 MB.");
                      const text = await file.text();
                      const h = await api<string[]>("/sales/csv/headers", {
                        csv: text,
                      });
                      F(text);
                      J(h);
                      M({});
                      R(undefined);
                      CF(false);
                      OP(crypto.randomUUID());
                    });
                }}
              />
            </label>
            {headers.length > 0 && (
              <>
                <S
                  label="Saved column mapping"
                  value=""
                  options={[
                    ["", "Choose saved mapping"],
                    ...maps.map((m) => [m.id, m.name] as [string, string]),
                  ]}
                  onChange={(id) => {
                    M(maps.find((m) => m.id === id)?.columns ?? {});
                    R(undefined);
                  }}
                />
                <div className="form-grid">
                  {fields.map(([key, label]) => (
                    <S
                      key={key}
                      label={label}
                      value={mapping[key] ?? ""}
                      options={[
                        ["", "Not mapped"],
                        ...headers.map((h) => [h, h] as [string, string]),
                      ]}
                      onChange={(v) => {
                        M({ ...mapping, [key]: v });
                        R(undefined);
                        CF(false);
                      }}
                    />
                  ))}
                </div>
                <T label="Mapping name" value={mapName} onChange={MN} />
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/sales/mappings", {
                        id: crypto.randomUUID(),
                        name: mapName,
                        columns: mapping,
                      });
                      await load();
                    })
                  }
                >
                  Save column mapping
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      OP(crypto.randomUUID());
                      R(await api<any[]>("/sales/csv/preview", input));
                      CF(false);
                    })
                  }
                >
                  Preview & validate
                </button>
              </>
            )}
            {rows && (
              <>
                <h2>Review import</h2>
                <p>
                  {rows.filter((r) => r.status === "new").length} new ·{" "}
                  {rows.filter((r) => r.status === "duplicate").length}{" "}
                  duplicate ·{" "}
                  {rows.filter((r) => r.status === "conflict").length}{" "}
                  conflicting ·{" "}
                  {rows.filter((r) => r.status === "incomplete").length}{" "}
                  incomplete
                </p>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable sales details"
                >
                  <table>
                    <thead>
                      <tr>
                        <th>Row / reference</th>
                        <th>Review</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.row}>
                          <td>
                            {r.row} · {r.reference}
                          </td>
                          <td>
                            {r.status}: {r.message}
                          </td>
                          <td>{money(r.order?.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p>
                  Confirmation imports only new rows. Duplicates are skipped;
                  conflicts and incomplete rows need separate review. Platform
                  promotions, tips and delivery charges are not automatically
                  merchant income: map only amounts you have verified belong to
                  the business. Original CSV values are retained.
                </p>
                <button
                  disabled={
                    busy || confirmed || !rows.some((r) => r.status === "new")
                  }
                  onClick={() =>
                    run(async () => {
                      await api("/sales/csv/confirm", {
                        ...input,
                        confirm: true,
                      });
                      CF(true);
                      await load();
                    })
                  }
                >
                  Confirm new financial-only sales
                </button>
                {confirmed && (
                  <p role="status">Import saved. No inventory moved.</p>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <p>
              Expected settlement = customer item sales − merchant discounts −
              commissions and fee VAT − other fees − refunds ± verified merchant
              adjustments. Food-sales VAT is separate from platform fee VAT.
              Unmatched differences are not classified as profit or expense.
            </p>
            <details>
              <summary>Correct an earlier payout</summary>
              <S
                label="Payout to correct"
                value={p.corrects ?? ""}
                options={[
                  ["", "New payout"],
                  ...(view?.records ?? [])
                    .filter((x: any) => x.input.channelId === channel)
                    .map((x: any) => [x.input.id, x.input.reference]),
                ]}
                onChange={(id) => {
                  const old = view.records.find((x: any) => x.input.id === id);
                  if (old)
                    P({
                      ...old.input,
                      id: crypto.randomUUID(),
                      reference: "",
                      corrects: id,
                      notes: "",
                    });
                }}
              />
              <p>
                Corrections replace the earlier payout in reconciliation but
                retain its original record. Enter a new reference and an
                explanation.
              </p>
            </details>
            <h2>Match completed orders</h2>
            <div className="order-match-list">
              {orders
                .filter(
                  (o) => o.channelId === channel && o.status === "completed",
                )
                .map((o) => (
                  <label className="checkbox" key={o.id}>
                    <input
                      type="checkbox"
                      checked={p.orderIds.includes(o.id)}
                      onChange={(e) =>
                        P({
                          ...p,
                          orderIds: e.target.checked
                            ? [...p.orderIds, o.id]
                            : p.orderIds.filter((id: string) => id !== o.id),
                        })
                      }
                    />
                    {o.reference || o.number} · {money(o.total)} · refunds{" "}
                    {money(o.refunds)} · {o.paymentStatus}
                  </label>
                ))}
            </div>
            <p>
              For a partial or delayed payment, reuse the complete matched order
              group. Payments can span multiple periods. Do not include orders
              belonging to a different payout group.
            </p>
            <div className="form-grid">
              <T
                label="Payout reference"
                value={p.reference}
                onChange={(v) => P({ ...p, reference: v })}
              />
              <T
                label="Bank receipt date"
                type="date"
                value={p.date}
                onChange={(v) => P({ ...p, date: v })}
              />
              <N
                label="Actual bank receipt (£)"
                value={p.actual}
                onChange={(v) => P({ ...p, actual: v })}
              />
            </div>
            <details>
              <summary>Report fees, refunds & adjustments</summary>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={p.commission !== null}
                  onChange={(e) =>
                    P({ ...p, commission: e.target.checked ? 0 : null })
                  }
                />
                Use reported total commission instead of order estimates
              </label>
              {p.commission !== null && (
                <N
                  label="Total commission including fee VAT (£)"
                  value={p.commission}
                  onChange={(v) => P({ ...p, commission: v })}
                />
              )}
              <p>
                Use total commission for the complete matched group. Enter only
                additional fees/refunds not already in its order records.
              </p>
              <N
                label="Additional fees (£)"
                value={p.otherFees}
                onChange={(v) => P({ ...p, otherFees: v })}
              />
              <N
                label="Additional refunds (£)"
                value={p.refunds}
                onChange={(v) => P({ ...p, refunds: v })}
              />
              <label>
                Merchant adjustments (£, signed)
                <input
                  type="number"
                  value={p.adjustments}
                  onChange={(e) =>
                    P({ ...p, adjustments: Number(e.target.value) })
                  }
                />
              </label>
              <p>
                Explain withheld amounts, platform-funded promotions, tips and
                delivery charges. Only include amounts owed to the merchant.
              </p>
            </details>
            <T
              label="Payout notes / correction explanation"
              value={p.notes}
              onChange={(v) => P({ ...p, notes: v })}
            />
            <button
              disabled={busy || !p.orderIds.length}
              onClick={() =>
                run(async () => {
                  await api("/sales/payouts", { ...p, channelId: channel });
                  P({
                    ...p,
                    id: crypto.randomUUID(),
                    reference: "",
                    actual: 0,
                    corrects: null,
                  });
                  await load();
                })
              }
            >
              Record payout & reconcile
            </button>
            <h2>Reconciliation</h2>
            {view?.groups.map((g: any, i: number) => (
              <div className="running-cost-row" key={i}>
                <strong>
                  {g.channel} · {g.status}
                </strong>
                <button className="secondary" onClick={()=>{H(g.channel);P({...g.template,id:crypto.randomUUID(),reference:"",date:today(),actual:0,corrects:null});}}>Record another receipt for this group</button>
                <p>
                  {g.orderIds.length} orders · Expected {money(g.expected)} ·
                  Bank receipts {money(g.actual)} · Difference{" "}
                  {money(g.difference)}
                </p>
              </div>
            ))}
            <details>
              <summary>Original payouts & corrections</summary>
              {view?.records.map((x: any) => (
                <p key={x.input.id}>
                  {x.input.reference} · {money(x.input.actual)} · {x.input.date}
                  {x.input.corrects
                    ? " · correction of " + x.input.corrects
                    : ""}{" "}
                  · {x.input.notes}
                </p>
              ))}
            </details>
          </>
        )}
      </section>
    </>
  );
}
