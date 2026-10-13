import { useEffect, useState } from "react";
import { api, money, number, today } from "../api";
import { SaveStatus, useAutoSave, flushEdits } from "../autoSave";
import { ErrorBox } from "../components/ui";
import type { Recipe, State } from "../types";
import type {
  Business,
  ProductPlan,
  ProductResult,
  ProfitContext,
  ProfitInput,
  ProfitReport,
  ProfitScenario,
} from "../businessTypes";
import { productPlan } from "../businessTypes";
import { BusinessFields, N, T, S, C } from "./BusinessSettings";
import { Term } from "./FinancialGlossary";

export function ProductFields({
  recipe: r,
  business: b,
  value: p,
  change: set,
  channelId,
  advancedOpen = false,
}: {
  recipe: Recipe;
  business: Business;
  value: ProductPlan;
  change: (p: ProductPlan) => void;
  channelId?: string;
  advancedOpen?: boolean;
}) {
  return (
    <div className="product-fields">
      <p className="help">
        Amounts are per sellable yield unit ({r.yieldUnit}); the published batch
        yields {number(r.yield)}. Monthly volume is per product/channel, not
        whole baskets.
      </p>
      {p.channels.map((c, i) =>
        channelId && c.channelId !== channelId ? null : (
          <fieldset key={c.channelId}>
            <legend>
              {b.channels.find((x) => x.id === c.channelId)?.name}
            </legend>
            <div className="form-grid">
              <N
                label="Customer selling price (£)"
                value={c.price}
                onChange={(price) =>
                  set({
                    ...p,
                    channels: p.channels.map((x, j) =>
                      j === i ? { ...x, price } : x,
                    ),
                  })
                }
              />
              <details>
                <summary>Forecast sales volume (optional)</summary>
                <N
                  label="Forecast units / month"
                  value={c.monthlyUnits}
                  onChange={(monthlyUnits) =>
                    set({
                      ...p,
                      channels: p.channels.map((x, j) =>
                        j === i ? { ...x, monthlyUnits } : x,
                      ),
                    })
                  }
                />
              </details>
            </div>
          </fieldset>
        ),
      )}
      <details open={advancedOpen || undefined}>
        <summary>Product VAT, equipment & direct labour</summary>
        <C
          label="Energy costs reviewed (including no energy needed)"
          value={p.energyConfirmed ?? false}
          onChange={(energyConfirmed) => set({ ...p, energyConfirmed })}
        />
        <div className="form-grid">
          <S
            label="Product VAT treatment"
            value={p.vatTreatment}
            onChange={(vatTreatment) =>
              set({ ...p, vatTreatment, outputVatPercent: 0 })
            }
            options={[
              ["unconfigured", "Not reviewed — check when needed"],
              ["taxable", "Taxable — enter rate"],
              ["zero", "Zero-rated"],
              ["exempt", "Exempt"],
              ["outside", "Outside scope"],
            ]}
          />
          {p.vatTreatment === "taxable" && (
            <N
              label="Product output VAT (%)"
              value={p.outputVatPercent}
              onChange={(outputVatPercent) => set({ ...p, outputVatPercent })}
            />
          )}
          {b.vatRegistered ? (
            <N
              label="Product input VAT recovery limit (%)"
              value={p.inputRecoveryPercent}
              onChange={(inputRecoveryPercent) =>
                set({ ...p, inputRecoveryPercent })
              }
            />
          ) : (
            <p>
              Not VAT registered: no input VAT is recovered. Any saved product
              recovery limit is retained for history and does not apply.
            </p>
          )}
          <S
            label="Direct labour basis"
            value={p.labourBasis}
            onChange={(labourBasis) => set({ ...p, labourBasis })}
            options={[
              ["recipe", "Published recipe paid labour"],
              ["staff", "Configured paid staff rate"],
              ["owner", "Owner time — separate compensation"],
            ]}
          />
          {p.labourBasis !== "recipe" && (
            <N
              label="Direct labour minutes / batch"
              value={p.labourMinutesPerBatch}
              onChange={(labourMinutesPerBatch) =>
                set({ ...p, labourMinutesPerBatch })
              }
            />
          )}
          <N
            label="Water litres / batch"
            value={p.waterLitresPerBatch}
            onChange={(waterLitresPerBatch) =>
              set({ ...p, waterLitresPerBatch })
            }
          />
        </div>
        <p className="help">
          Configured labour replaces published labour for this estimate,
          including nested recipe labour. Equipment usage is for the whole
          published batch, including subcomponents; packaging does not scale
          with the portion-size simulator.
        </p>
        {b.equipment.map((e) => (
          <N
            key={e.id}
            label={`${e.name} minutes / batch`}
            value={
              p.equipment?.find((x) => x.equipmentId === e.id)?.minutes ?? 0
            }
            onChange={(minutes) =>
              set({
                ...p,
                equipment: [
                  ...(p.equipment ?? []).filter((x) => x.equipmentId !== e.id),
                  { equipmentId: e.id, minutes },
                ],
              })
            }
          />
        ))}
      </details>
    </div>
  );
}
export function ConfigureProduct({
  recipe,
  initial,
  done,
  advancedOpen = false,
}: {
  recipe: Recipe;
  initial: Business;
  advancedOpen?: boolean;
  done: () => void;
}) {
  const [b, B] = useState(initial);
  const save = useAutoSave(b, B, "/business");
  const p = productPlan(recipe, b);
  const [channel, C] = useState(b.channels[0]?.id ?? "");
  return (
    <section className="panel">
      <h2>Configure {recipe.name}</h2>
      <p>
        Saved prices — changes here autosave. To experiment without saving, use
        Try a price. Recipe and supplier records stay unchanged.
      </p>
      <SaveStatus save={save} />
      {b.effectiveFrom > today() && (
        <p>
          These saved prices take effect on {b.effectiveFrom}. Today’s price
          test uses the prices currently in effect.
        </p>
      )}
      <S
        label="Price to save for channel"
        value={channel}
        onChange={C}
        options={b.channels.map((c) => [c.id, c.name])}
      />
      <ProductFields
        channelId={channel}
        advancedOpen={advancedOpen}
        recipe={recipe}
        business={b}
        value={p}
        change={(p) =>
          B({
            ...b,
            products: [
              ...b.products.filter((x) => x.recipeId !== p.recipeId),
              p,
            ],
          })
        }
      />
      <button
        className="primary"
        onClick={async () => {
          if (await save.flush()) done();
        }}
      >
        Return to catalogue
      </button>
    </section>
  );
}
function Breakdown({ row: r }: { row: ProductResult }) {
  const parts: [string, number | null][] = [
    ["Output VAT", r.outputVat],
    ["Ingredients", r.ingredients],
    ["Packaging", r.packaging],
    ["Energy", r.energy],
    ["Direct paid labour", r.labour],
    ["Other variable costs", r.otherVariable],
    ["Platform fees incl. unrecovered VAT", r.platformFees],
    ["Allocated overheads", r.allocatedOverheads],
    ["Estimated operating profit", r.operatingProfit],
  ];
  return (
    <details className="cost-breakdown">
      <summary>{r.channel} — where each pound goes</summary>
      <p>
        {money(r.grossPrice)} customer price per unit. Values are estimates;
        profit can be negative. The rows reconcile to the price before display
        rounding when overhead allocation is available.
      </p>
      {parts.map(([label, value]) => (
        <div className="cost-bar-row" key={label}>
          <span>
            {[
              "Output VAT",
              "Energy",
              "Allocated overheads",
              "Estimated operating profit",
            ].includes(label) ? (
              <Term name={label} />
            ) : (
              label
            )}
          </span>
          <strong>{value === null ? "Not allocated" : money(value)}</strong>
          <div className="cost-track" aria-hidden="true">
            <span
              className={value !== null && value < 0 ? "negative" : ""}
              style={{
                width: `${Math.min(100, (Math.abs(value ?? 0) / Math.max(r.grossPrice, 0.01)) * 100)}%`,
              }}
            />
          </div>
          <small>
            {value === null || r.grossPrice === 0
              ? "—"
              : `${number((value / r.grossPrice) * 100)}p per £1 of customer price`}
          </small>
        </div>
      ))}
      <p>
        <Term name="Contribution" />: {money(r.contribution)} ·{" "}
        <Term name="Contribution margin" />: {number(r.contributionMargin)}%
      </p>
      <p>
        <Term name="Profit margin" />:{" "}
        {r.profitMargin === null
          ? "Not allocated"
          : number(r.profitMargin) + "%"}
        . After allocated owner compensation:{" "}
        {r.afterOwner === null ? "Not allocated" : money(r.afterOwner)} / unit.
      </p>
      {r.warnings.map((w) => (
        <p className="notice" key={w}>
          {w}
        </p>
      ))}
      <details>
        <summary>Recipe and supplier cost sources</summary>
        <p>
          <Term name="Estimated recipe cost" /> · refreshed from effective
          supplier prices; historical recipe snapshots are not rewritten.
        </p>
        <ul>
          {r.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </details>
    </details>
  );
}
function Totals({ report: r }: { report: ProfitReport }) {
  return (
    <>
      <p className="help">
        Whole-business forecast: totals include all configured product/channel
        volumes. Search filters the product cards only.
      </p>
      <div className="profit-summary">
        <section>
          <span>Forecast sales</span>
          <strong>{number(r.monthlyUnits)} units / month</strong>
        </section>
        <section>
          <Term name="Contribution" />
          <strong>{money(r.monthlyContribution)} / month</strong>
        </section>
        <section>
          <Term name="Estimated operating profit" />
          <strong>{money(r.monthlyOperatingProfit)} / month</strong>
        </section>
        <section>
          <Term name="Break-even" />
          <strong>
            {r.breakEvenUnits === null
              ? "Not achievable / no sales mix"
              : `${number(r.breakEvenUnits)} units / month`}
          </strong>
        </section>
      </div>
      <p>
        Fixed costs {money(r.monthlyFixedCosts)} / month · Owner compensation{" "}
        {money(r.monthlyOwnerCompensation)} / month · After owner{" "}
        {money(r.monthlyAfterOwner)} / month.
      </p>
      <details>
        <summary>Allocation assumptions & overhead reconciliation</summary>
        <p>
          <Term name="Fixed-cost allocation" />: {r.allocationMethod}. Forecast{" "}
          {number(r.monthlyUnits)} units and {money(r.monthlyNetSales)} net
          sales / month. Unallocated overheads: {money(r.unallocatedOverheads)}{" "}
          / month.
        </p>
        <dl className="breakdown">
          {Object.entries(r.fixedBreakdown).map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{money(v)} / month</dd>
            </div>
          ))}
        </dl>
        <p className="help">
          Staffing totals equal the greater of the configured payroll budget and
          direct paid labour. Break-even holds the product/channel mix constant
          and accounts for that payroll floor. Owner compensation is excluded
          from break-even.
        </p>
      </details>
      {r.warnings.map((w) => (
        <p className="notice" key={w}>
          {w}
        </p>
      ))}
    </>
  );
}
function Products({
  report,
  query = "",
}: {
  report: ProfitReport;
  query?: string;
}) {
  const ids = [
    ...new Set(
      report.products
        .filter((r) => r.name.toLowerCase().includes(query.toLowerCase()))
        .map((r) => r.recipeId),
    ),
  ];
  return (
    <>
      {ids.map((id) => {
        const rows = report.products.filter((r) => r.recipeId === id);
        return (
          <section className="panel profitability-product" key={id}>
            <h2>{rows[0].name}</h2>
            <p className="help">
              Published recipe version {rows[0].recipeVersion} · refreshed cost
              estimate as of {report.asOf}
            </p>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label={`${rows[0].name} channel comparison`}
            >
              <table>
                <thead>
                  <tr>
                    <th>Channel</th>
                    <th>Customer price / unit</th>
                    <th>Contribution / unit</th>
                    <th>Contribution margin</th>
                    <th>Allocated overhead / unit</th>
                    <th>Estimated operating profit / unit</th>
                    <th>Profit margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.channelId}>
                      <td>{r.channel}</td>
                      <td>{money(r.grossPrice)}</td>
                      <td>{money(r.contribution)}</td>
                      <td>{number(r.contributionMargin)}%</td>
                      <td>
                        {r.allocatedOverheads === null
                          ? "Not allocated"
                          : money(r.allocatedOverheads)}
                      </td>
                      <td>
                        {r.operatingProfit === null
                          ? "Not allocated"
                          : money(r.operatingProfit)}
                      </td>
                      <td>
                        {r.profitMargin === null
                          ? "—"
                          : number(r.profitMargin) + "%"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.map((r) => (
              <Breakdown key={r.channelId} row={r} />
            ))}
          </section>
        );
      })}
      {ids.length === 0 && (
        <p>
          No products match. Check the date, search or missing-price warnings.
        </p>
      )}
    </>
  );
}
export function Simulator({
  context,
  recipe: initialRecipe,
  state,
  asOf,
  done,
}: {
  context: ProfitContext;
  recipe: Recipe;
  state: State;
  asOf: string;
  done: () => void;
}) {
  const [input, I] = useState<ProfitInput>({
    asOf,
    settings: structuredClone(context.settings),
    experiments: [
      {
        recipeId: initialRecipe.id,
        portionFactor: 1,
        lines: structuredClone(initialRecipe.lines),
      },
    ],
  });
  const [report, R] = useState<ProfitReport>();
  const [error, E] = useState("");
  const [name, Name] = useState(`${initialRecipe.name} pricing plan`);
  const [saved, Save] = useState(context.scenarios);
  const [compare, Compare] = useState("");
  const [message, M] = useState("");
  useEffect(() => {
    let active = true;
    R(undefined);
    const t = setTimeout(
      () =>
        api<ProfitReport>("/profitability/preview", input)
          .then((r) => {
            if (active) {
              R(r);
              E("");
            }
          })
          .catch((e) => {
            if (active) E(e.message);
          }),
      200,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [input]);
  const recipe =
    context.recipes.find((r) => r.id === input.experiments[0].recipeId) ??
    initialRecipe;
  const b = input.settings;
  const p = productPlan(recipe, b);
  const e = input.experiments[0];
  const other = saved.find((s) => s.id === compare);
  return (
    <>
      <section className="panel">
        <h1>Pricing simulator</h1>
        <p className="notice">
          Temporary what-if changes only. Recipes, prices, business settings,
          stock and existing planner scenarios stay unchanged. Save a scenario
          to retain these inputs and the calculated snapshot.
        </p>
        <button className="secondary" onClick={done}>
          Leave simulator
        </button>
        <h2>{recipe.name}</h2>
        <ProductFields
          recipe={recipe}
          business={b}
          value={p}
          change={(p) =>
            I({
              ...input,
              settings: {
                ...b,
                products: [
                  ...b.products.filter((x) => x.recipeId !== p.recipeId),
                  p,
                ],
              },
            })
          }
        />
        <N
          label="Portion size factor"
          value={e.portionFactor}
          onChange={(portionFactor) =>
            I({ ...input, experiments: [{ ...e, portionFactor }] })
          }
        />
        <p className="help">
          1 = published size; 1.5 = 50% larger. Ingredient, labour and energy
          estimates scale; packaging stays per unit. This is a linear forecast,
          not a new production recipe.
        </p>
        <details>
          <summary>Experiment with ingredients & quantities</summary>
          {(e.lines ?? recipe.lines).map((line, i) => (
            <fieldset key={i}>
              <legend>Recipe line {i + 1}</legend>
              <div className="form-grid">
                <S
                  label="Ingredient or component"
                  value={line.kind + ":" + line.referenceId}
                  onChange={(v) => {
                    const [kind, referenceId] = v.split(":");
                    const unit =
                      kind === "ingredient"
                        ? state.ingredients.find((x) => x.id === referenceId)!
                            .baseUnit
                        : state.recipes.find(
                            (x) => x.recipe.id === referenceId,
                          )!.recipe.yieldUnit;
                    I({
                      ...input,
                      experiments: [
                        {
                          ...e,
                          lines: (e.lines ?? recipe.lines).map((x, j) =>
                            j === i ? { ...x, kind, referenceId, unit } : x,
                          ),
                        },
                      ],
                    });
                  }}
                  options={[
                    ...state.ingredients
                      .filter((x) => !x.archived)
                      .map(
                        (x) =>
                          ["ingredient:" + x.id, x.name] as [string, string],
                      ),
                    ...state.recipes
                      .filter((x) => x.recipe.id !== recipe.id)
                      .map(
                        (x) =>
                          ["recipe:" + x.recipe.id, x.recipe.name] as [
                            string,
                            string,
                          ],
                      ),
                  ]}
                />
                <N
                  label={`Batch quantity (${line.unit})`}
                  value={line.quantity}
                  onChange={(quantity) =>
                    I({
                      ...input,
                      experiments: [
                        {
                          ...e,
                          lines: (e.lines ?? recipe.lines).map((x, j) =>
                            j === i ? { ...x, quantity } : x,
                          ),
                        },
                      ],
                    })
                  }
                />
              </div>
              <button
                className="secondary"
                onClick={() =>
                  I({
                    ...input,
                    experiments: [
                      { ...e, lines: e.lines!.filter((_, j) => j !== i) },
                    ],
                  })
                }
              >
                Remove experimental line
              </button>
            </fieldset>
          ))}
          <button
            className="secondary"
            onClick={() =>
              I({
                ...input,
                experiments: [
                  {
                    ...e,
                    lines: [
                      ...(e.lines ?? recipe.lines),
                      {
                        kind: "ingredient",
                        referenceId: state.ingredients[0].id,
                        quantity: 1,
                        unit: state.ingredients[0].baseUnit,
                        wastePercent: 0,
                        role: "ingredient",
                      },
                    ],
                  },
                ],
              })
            }
          >
            Add experimental ingredient
          </button>
        </details>
        <details>
          <summary>Simulate business rates & operating costs</summary>
          <BusinessFields
            simulation
            value={b}
            change={(settings) => I({ ...input, settings })}
          />
        </details>
      </section>
      <section className="panel" aria-live="polite">
        <h2>Simulated results</h2>
        <ErrorBox error={error} />
        {report ? (
          <Totals report={report} />
        ) : (
          <p>
            {error
              ? "Correct the highlighted inputs to calculate results."
              : "Recalculating…"}
          </p>
        )}
      </section>
      {report && <Products report={report} query={recipe.name} />}
      <section className="panel">
        <h2>Save & compare pricing scenarios</h2>
        <T label="Pricing scenario name" value={name} onChange={Name} />
        <button
          disabled={!report}
          className="primary"
          onClick={async () => {
            try {
              const s = await api<ProfitScenario>("/profitability/scenarios", {
                id: crypto.randomUUID(),
                revision: 0,
                name,
                input,
                result: report,
                recordedAt: "",
              });
              Save([...saved, s]);
              M("Scenario snapshot saved. Live records unchanged.");
              E("");
            } catch (e) {
              E((e as Error).message);
            }
          }}
        >
          Save pricing scenario
        </button>
        <p role="status">{message}</p>
        <S
          label="Compare saved pricing scenario"
          value={compare}
          onChange={Compare}
          options={[
            ["", "Choose a saved snapshot"],
            ...saved.map((s) => [s.id, s.name] as [string, string]),
          ]}
        />
        {other && report && (
          <>
            <p>
              Saved {other.recordedAt} · source date {other.input.asOf}.
              Comparison uses saved results; newer prices never rewrite this
              snapshot.
            </p>
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Pricing scenario differences"
            >
              <table>
                <thead>
                  <tr>
                    <th>Monthly result</th>
                    <th>Saved</th>
                    <th>Current simulation</th>
                    <th>Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    [
                      ["monthlyContribution", "Contribution"],
                      ["monthlyFixedCosts", "Fixed costs"],
                      ["monthlyOperatingProfit", "Estimated operating profit"],
                      ["monthlyOwnerCompensation", "Owner compensation"],
                      ["monthlyAfterOwner", "After owner"],
                    ] as const
                  ).map(([k, label]) => (
                    <tr key={k}>
                      <td>{label}</td>
                      <td>{money(other.result[k])}</td>
                      <td>{money(report[k])}</td>
                      <td>{money(report[k] - other.result[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>Saved snapshot inputs</summary>
              <p>
                {other.input.settings.name} ·{" "}
                {other.input.settings.allocationMethod} allocation
              </p>
              <fieldset disabled>
                <BusinessFields
                  value={other.input.settings}
                  change={() => {}}
                />
              </fieldset>
            </details>
            <button
              className="secondary"
              onClick={() => {
                I(structuredClone(other.input));
                Name(other.name + " copy");
                M(
                  "Loaded saved assumptions; live supplier estimates are recalculated. The saved comparison stays frozen.",
                );
              }}
            >
              Load saved assumptions into simulator
            </button>
          </>
        )}
      </section>
    </>
  );
}
export default function ProductProfitability({
  state,
  openPlanner,
}: {
  state: State;
  openPlanner: (id: string) => Promise<void>;
}) {
  const [asOf, D] = useState(today());
  const [ctx, Ctx] = useState<ProfitContext>();
  const [error, E] = useState("");
  const [q, Q] = useState("");
  const [selected, Select] = useState("");
  const [simulation, Sim] = useState(false);
  const [edit, Edit] = useState<Business>();
  const [seq, Seq] = useState(0);
  useEffect(() => {
    let active = true;
    Ctx(undefined);
    api<ProfitContext>(`/profitability/context?date=${asOf}`)
      .then((c) => {
        if (active) {
          Ctx(c);
          E("");
        }
      })
      .catch((e) => {
        if (active) E(e.message);
      });
    return () => {
      active = false;
    };
  }, [asOf, seq]);
  const recipe = ctx?.recipes.find((r) => r.id === selected);
  if (ctx && recipe && simulation)
    return (
      <Simulator
        context={ctx}
        recipe={recipe}
        state={state}
        asOf={asOf}
        done={() => {
          Sim(false);
          Seq((n) => n + 1);
        }}
      />
    );
  if (ctx && recipe && edit)
    return (
      <ConfigureProduct
        recipe={recipe}
        initial={edit}
        done={() => {
          Edit(undefined);
          Seq((n) => n + 1);
        }}
      />
    );
  return (
    <>
      <section className="panel">
        <h1>Product profitability</h1>
        <p>
          Estimated product economics linked to your recipe book, supplier
          prices and business settings. Allocated profit is a forecast, never
          realised profit.
        </p>
        <div className="form-grid">
          <T label="Costing date" type="date" value={asOf} onChange={D} />
          <T label="Search products" value={q} onChange={Q} />
        </div>
        <ErrorBox error={error} />
        {ctx && (
          <>
            <p>
              Business settings revision {ctx.settings.revision} · effective{" "}
              {ctx.settings.effectiveFrom}.{" "}
              <Term name="Estimated recipe cost" />
            </p>
            <Totals report={ctx.report} />
            <details>
              <summary>Use these assumptions in the financial planner</summary>
              <p>
                Creates a new independent planner scenario with one sold unit
                per order and the current forecast mix. It snapshots costs, fees
                and remaining payroll overhead at this volume. Existing
                scenarios stay unchanged; return here to recalculate staffing
                allocation at a different volume.
              </p>
              <button
                className="secondary"
                disabled={ctx.report.monthlyUnits <= 0}
                onClick={async () => {
                  try {
                    const s = await api<{ id: string }>(
                      "/profitability/planner-scenario",
                      { asOf, settings: ctx.settings, experiments: [] },
                    );
                    await openPlanner(s.id);
                  } catch (e) {
                    E((e as Error).message);
                  }
                }}
              >
                Create planner scenario from business forecast
              </button>
            </details>
            <S
              label="Product to configure or simulate"
              value={selected}
              onChange={Select}
              options={[
                ["", "Choose a product"],
                ...ctx.recipes.map((r) => [r.id, r.name] as [string, string]),
              ]}
            />
            <div className="actions">
              <button
                disabled={!recipe}
                className="secondary"
                onClick={async () => {
                  try {
                    if (await flushEdits())
                      Edit(await api<Business>("/business"));
                  } catch (e) {
                    E((e as Error).message);
                  }
                }}
              >
                Configure product
              </button>
              <button
                disabled={!recipe}
                className="primary"
                onClick={() => Sim(true)}
              >
                Try pricing simulator
              </button>
            </div>
          </>
        )}
      </section>
      {!ctx && !error && (
        <p className="shell-caption">Loading product costs…</p>
      )}
      {ctx && (
        <>
          <Products report={ctx.report} query={q} />
          <section className="panel">
            <h2>Actual production costs — separate from estimates</h2>
            <p>
              <Term name="Actual batch cost" /> · Recorded inventory figures
              retain their original VAT/cost basis; business setting changes do
              not revalue historical batches.
            </p>
            {ctx.actualBatches.length === 0 ? (
              <p>No production batches recorded.</p>
            ) : (
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Recorded production costs"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Batch / recipe</th>
                      <th>Recorded</th>
                      <th>Output</th>
                      <th>Materials</th>
                      <th>Total batch cost</th>
                      <th>Unit cost</th>
                      <th>Cost status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ctx.actualBatches.map((b) => (
                      <tr key={b.id}>
                        <td>
                          {
                            state.recipes.find(
                              (r) => r.recipe.id === b.body.recipeId,
                            )?.recipe.name
                          }{" "}
                          v{b.body.version}
                          <small>{b.id.slice(0, 8)}</small>
                        </td>
                        <td>{b.recordedAt.slice(0, 10)}</td>
                        <td>{number(b.result.actualYield)}</td>
                        <td>{money(b.result.materialCost)}</td>
                        <td>{money(b.result.batchCost)}</td>
                        <td>{money(b.result.unitCost)}</td>
                        <td>{b.result.valuationStatus ?? "known"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p>
              <Term name="Actual recorded operating profit" />: unavailable —
              sales/expense ledger not implemented.
            </p>
            <p>
              <Term name="Profit after tax" />: unsupported.
            </p>
          </section>
        </>
      )}
    </>
  );
}
