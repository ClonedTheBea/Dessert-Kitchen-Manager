import { test, expect, type Page, type Locator } from "@playwright/test";
import { login, navigate } from "./login";
import type {
  InventoryState,
  ProductionPreview,
  ProductionResult,
} from "../src/inventoryTypes";
const headers = { "X-Kitchen-Request": "1" };
async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post("/api" + path, { data, headers });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}
async function stock(page: Page): Promise<InventoryState> {
  return (await page.request.get("/api/inventory/state")).json();
}
async function nav(page: Page) {
  if (await page.getByRole("button", { name: "Toggle navigation" }).isVisible())
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await navigate(page, "Inventory");
}
async function tab(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Inventory views" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function dateReview(scope: Locator) {
  await scope.getByLabel("Dates / shelf life reviewed").check();
  await scope
    .getByLabel("Date source or review evidence")
    .fill("Illustrative test label and date review; isolated environment");
}
async function purchase(
  page: Page,
  locationId: string,
  lines: { id: string; quantity: number; price: number; unit: string }[],
  reference: string,
) {
  await tab(page, "Purchases");
  await page
    .getByRole("button", { name: "Record purchase / resume draft" })
    .click();
  const d = page.getByRole("dialog");
  await d
    .getByLabel("Supplier", { exact: true })
    .selectOption("sample-supplier");
  await d.getByLabel("Location", { exact: true }).selectOption(locationId);
  await d.getByText("Receipt reference & notes", { exact: true }).click();
  await d.getByLabel("Receipt reference").fill(reference);
  for (let i = 0; i < lines.length; i++) {
    if (i) await d.getByRole("button", { name: "Add purchase line" }).click();
    const section = d.locator(".inventory-line").nth(i),
      line = lines[i];
    await section.getByLabel("Ingredient or packaging").selectOption(line.id);
    await section.getByLabel("Quantity per pack").fill(String(line.quantity));
    await section.getByLabel("Pack unit").selectOption(line.unit);
    await section
      .getByLabel("Actual price per pack (£)")
      .fill(String(line.price));
    await section.getByText(/Batch reference & date review/).click();
    await section
      .getByLabel("Supplier batch / lot reference")
      .fill(`${reference}-${line.id}`);
    await dateReview(section);
  }
  const before = (await stock(page)).movements.length;
  await expect(d.locator(".save-status")).toContainText("Draft saved");
  expect((await stock(page)).movements).toHaveLength(before);
  await d.getByRole("button", { name: "Confirm stock receipt" }).click();
  await expect(
    d.getByRole("button", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  await d.getByRole("button", { name: "Close dialog" }).click();
  expect((await stock(page)).movements.length).toBe(before + lines.length);
}
for (const width of [1280, 390])
  test(`inventory purchase-to-production lifecycle and responsive layout ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const location = await post(page, "/inventory/locations", {
      id: "",
      name: `Isolated acceptance ${width}`,
      mode: "testing",
    });
    await nav(page);
    await page
      .getByLabel("Location", { exact: true })
      .selectOption(location.id);
    const production = {
      operationId: crypto.randomUUID(),
      recipeId: "lemon-pot",
      version: 1,
      plannedYield: 4,
      actualYield: 4,
      locationId: location.id,
      destinationId: location.id,
      date: new Date().toISOString().slice(0, 10),
      batchReference: `ACCEPTANCE-${width}`,
      operator: "Browser acceptance",
      dateReviewed: true,
      dateEvidence: "Illustrative test review",
    };
    const preview: ProductionPreview = await post(
      page,
      "/inventory/production/preview",
      production,
    );
    const lines = [
      { id: "cream-cheese", quantity: 280, price: 3.25, unit: "g" },
      { id: "cream", quantity: 300, price: 1.7, unit: "ml" },
      { id: "butter", quantity: 250, price: 1.85, unit: "g" },
      ...preview.requirements
        .filter(
          (x) =>
            !["cream-cheese", "cream", "butter"].includes(x.requirement.itemId),
        )
        .map((x) => ({
          id: x.requirement.itemId,
          quantity: x.requirement.quantity * 2,
          price: 1,
          unit: x.requirement.unit,
        })),
    ];
    await purchase(page, location.id, lines, `INITIAL-${width}`);
    const shortage: ProductionPreview = await post(
      page,
      "/inventory/production/preview",
      production,
    );
    expect(
      shortage.requirements.find(
        (r) => r.requirement.itemId === "cream-cheese",
      )!.shortage,
    ).toBe(20);
    expect(shortage.canProduce).toBe(false);
    await purchase(
      page,
      location.id,
      [{ id: "cream-cheese", quantity: 280, price: 3.25, unit: "g" }],
      `TOPUP-${width}`,
    );
    await tab(page, "Production");
    await page
      .getByRole("button", { name: "Make a batch / resume draft" })
      .click();
    let d = page.getByRole("dialog");
    await d.getByLabel("Recipe", { exact: true }).selectOption("lemon-pot");
    await d.getByText(/Recipe version ·/).click();
    await d.getByLabel("Recipe version").selectOption("1");
    await d.getByLabel(/Quantity to make/).fill("4");
    await d
      .getByText("Adjust yield, costs, location or batch details", {
        exact: true,
      })
      .click();
    await d.getByLabel("Actual finished yield").fill("4");
    await d.getByLabel("Consume from").selectOption(location.id);
    await d.getByLabel("Finished stock location").selectOption(location.id);
    await d
      .getByLabel("Production batch reference")
      .fill(production.batchReference);
    await dateReview(d);
    await expect(
      d.getByText("Usable stock covers the selected actual quantities."),
    ).toBeVisible();
    await d
      .getByRole("button", { name: "Confirm completed production" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText(
      "Batch recorded: 4 each",
    );
    let s = await stock(page);
    const op = s.operations.find(
      (o) =>
        o.type === "production" &&
        (o.result as ProductionResult).batchId === production.batchReference,
    )!;
    const result = op.result as ProductionResult;
    expect(
      s.balances.find((b) => b.lot.id === result.finishedLotId)!.quantity,
    ).toBe(4);
    expect(
      result.allocations
        .filter((a) => a.item === "Cream cheese")
        .reduce((n, a) => n + a.quantity, 0),
    ).toBe(300);
    await tab(page, "Finished Products");
    await page
      .locator(".stock-group")
      .filter({ hasText: "Lemon cheesecake pot" })
      .getByRole("button", { name: "Manage", exact: true })
      .click();
    let card = page
      .locator(".inventory-stock")
      .filter({ hasText: production.batchReference });
    await card.getByRole("button", { name: "Record waste / sample" }).click();
    d = page.getByRole("dialog");
    await d
      .getByLabel("Waste / consumption reason")
      .selectOption("quality-control-sample");
    await d.getByLabel("Quantity in lot units").fill("1");
    await d.getByRole("button", { name: "Confirm waste", exact: true }).click();
    await expect(
      d.getByRole("button", { name: "Confirmed", exact: true }),
    ).toBeVisible();
    await d.getByRole("button", { name: "Close dialog" }).click();
    await expect(card).toContainText("3 each remaining");
    await tab(page, "Stocktake");
    await page.getByLabel("Category (optional)").selectOption("Dairy");
    await page.getByRole("button", { name: "Start stocktake" }).click();
    d = page.getByRole("dialog");
    await d.getByLabel(/Unsalted butter/).check();
    await d.getByLabel("Physical count Unsalted butter").fill("200");
    await d
      .getByLabel("Discrepancy explanation")
      .fill("2g handling loss found during physical count");
    await expect(d).toContainText("Difference: -2 g");
    await d.getByRole("button", { name: "Confirm reviewed stocktake" }).click();
    await expect(
      d.getByRole("button", { name: "Confirmed", exact: true }),
    ).toBeVisible();
    await d.getByRole("button", { name: "Close dialog" }).click();
    await tab(page, "Shopping Lists");
    await expect(
      page.getByRole("button", { name: "Add planned recipe" }),
    ).toBeEnabled();
    if (width === 390) {
      // The persisted list is shared; replace the earlier test's plan explicitly.
      const remove = page.getByRole("button", { name: /Remove plan/ });
      while (await remove.count()) await remove.first().click();
    }
    await page
      .getByLabel("Location", { exact: true })
      .last()
      .selectOption(location.id);
    await page.getByRole("button", { name: "Add planned recipe" }).click();
    await page.getByLabel("Recipe", { exact: true }).selectOption("lemon-pot");
    await page.getByLabel("Recipe version").selectOption("1");
    await page.getByLabel(/Planned output/).fill("4");
    const row = page.getByRole("row").filter({ hasText: "Cream cheese" });
    await expect(row.getByRole("cell").nth(1)).toHaveText("300 g");
    await expect(row.getByRole("cell").nth(2)).toHaveText("260 g");
    await expect(row.getByRole("cell").nth(3)).toHaveText("40 g");
    await expect(page.locator(".shopping-print .save-status")).toContainText(
      "Draft saved",
    );
    const before = (await stock(page)).movements.length;
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    await (await download).saveAs(testInfo.outputPath(`shopping-${width}.csv`));
    expect((await stock(page)).movements).toHaveLength(before);
    await page.getByLabel("Shopping notes").fill(`Keep this draft ${width}`);
    await tab(page, "Overview");
    await tab(page, "Shopping Lists");
    await expect(page.getByLabel("Shopping notes")).toHaveValue(
      `Keep this draft ${width}`,
    );
    await tab(page, "Finished Products");
    card = page
      .locator(".inventory-stock")
      .filter({ hasText: production.batchReference });
    await card.getByRole("button", { name: "Trace batch" }).click();
    await expect(page.getByRole("dialog")).toContainText("Cream cheese");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Close dialog" })
      .click();
    await page.screenshot({
      path: testInfo.outputPath(`inventory-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    s = await stock(page);
    expect(
      s.balances.find((b) => b.lot.id === result.finishedLotId)!.quantity,
    ).toBe(3);
    expect(s.operations.find((o) => o.id === op.id)!.result).toEqual(result);
  });

test("purchase draft survives reopening and a duplicate confirmation cannot add stock twice", async ({
  page,
}) => {
  await login(page);
  await nav(page);
  await tab(page, "Purchases");
  await page
    .getByRole("button", { name: "Record purchase / resume draft" })
    .click();
  let d = page.getByRole("dialog");
  await d
    .getByLabel("Supplier", { exact: true })
    .selectOption("sample-supplier");
  await d.getByLabel("Ingredient or packaging").selectOption("cream-cheese");
  await d.getByLabel("Quantity per pack").fill("280");
  await d.getByLabel("Actual price per pack (£)").fill("3.25");
  await d.getByText("Receipt reference & notes", { exact: true }).click();
  await d.getByLabel("Receipt reference").fill("Draft survives reopen");
  await d.getByText(/Batch reference & date review/).click();
  await dateReview(d.locator(".inventory-line"));
  await expect(d.locator(".save-status")).toContainText("Draft saved");
  const count = (await stock(page)).movements.length;
  await d.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Record purchase / resume draft" })
    .click();
  d = page.getByRole("dialog");
  await expect(d.getByLabel("Receipt reference")).toHaveValue(
    "Draft survives reopen",
  );
  expect((await stock(page)).movements).toHaveLength(count);
  await d.getByRole("button", { name: "Confirm stock receipt" }).click();
  await expect(
    d.getByRole("button", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  const draft = await (
    await page.request.get("/api/drafts/inventory-purchase/current")
  ).json();
  await post(page, "/inventory/confirm/purchase/current", {
    revision: draft.revision,
  });
  expect((await stock(page)).movements).toHaveLength(count + 1);
});
