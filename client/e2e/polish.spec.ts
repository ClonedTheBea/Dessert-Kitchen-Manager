import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";
import { today } from "../src/api";

async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post("/api" + path, {
    data,
    headers: { "X-Kitchen-Request": "1" },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function stock(page: Page) {
  return (await page.request.get("/api/inventory/state")).json();
}
async function reviewDates(d: Locator) {
  await d.getByLabel("Dates / shelf life reviewed").check();
  await d
    .getByLabel("Date source or review evidence")
    .fill("Synthetic home-testing evidence; owner reviewed dates");
}
async function existing(
  page: Page,
  kind: string,
  id: string,
  quantity: string,
  source: string,
) {
  await page
    .getByRole("button", { name: "Add Existing Stock", exact: true })
    .click();
  const d = page.getByRole("dialog");
  await d.getByLabel("Stock type").selectOption(kind);
  await d.getByLabel("Item or product").selectOption(id);
  await d.getByLabel("Quantity", { exact: true }).fill(quantity);
  await d.getByLabel("Source of stock").fill(source);
  if (kind === "recipe")
    await d.getByLabel("Prepared on (if known)").fill(today());
  await reviewDates(d);
  await audit(page, `existing-${kind}`, page.viewportSize()!.width);
  await d.getByRole("button", { name: "Confirm existing stock" }).click();
  await expect(d).toHaveCount(0);
}
async function audit(page: Page, name: string, width: number) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/polish-${name}-${width}.png`,
    fullPage: true,
  });
}

for (const width of [1440, 390])
  test(`home baking, existing stock, shortage recovery and provenance ${width}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const location = await post(page, "/inventory/locations", {
      id: "",
      name: `Polish home kitchen ${width}`,
      mode: "testing",
    });
    let state = await (await page.request.get("/api/state")).json();
    const recipe = state.recipes.find(
      (v: any) => v.recipe.id === "lemon-pot",
    ).recipe;
    const brownie = (
      await post(page, "/recipes", {
        ...recipe,
        id: "",
        revision: 0,
        name: `Home brownies ${width}`,
        category: "Brownies",
        yield: 9,
        lines: [
          {
            kind: "ingredient",
            referenceId: "flour",
            quantity: 90,
            unit: "g",
            wastePercent: 0,
          },
        ],
        methodSteps: ["Synthetic test recipe."],
      })
    ).recipe;
    await navigate(page, "Stock");
    await page
      .getByLabel("Location", { exact: true })
      .selectOption(location.id);
    const before = await stock(page);
    await existing(
      page,
      "ingredient",
      "flour",
      "500",
      "Already in my cupboard",
    );
    await existing(page, "ingredient", "flour", "100", "Second cupboard bag");
    // The same product is grouped even when its opening stock has two distinct lots.
    const group = page
      .locator(".stock-group")
      .filter({ hasText: "600 g available" });
    await expect(group).toHaveCount(1);
    await expect(
      group.getByRole("button", { name: "Manage", exact: true }),
    ).toBeVisible();
    await expect(group.locator(".inventory-stock")).toHaveCount(0);
    await group.getByRole("button", { name: "Manage", exact: true }).click();
    await expect(group.locator(".inventory-stock")).toHaveCount(2);
    await expect(group).toContainText("Cost unknown");
    await audit(page, "lots", width);
    await existing(
      page,
      "recipe",
      brownie.id,
      "9",
      "Brownies already baked for testing",
    );
    await existing(
      page,
      "recipe",
      "lemon-pot",
      "4",
      "Cheesecake pots prepared earlier",
    );
    let current = await stock(page);
    expect(
      current.operations.filter((o: any) => o.type === "purchase"),
    ).toHaveLength(
      before.operations.filter((o: any) => o.type === "purchase").length,
    );
    const historical = current.lots.find((l: any) => l.itemId === brownie.id);
    expect(historical.recipeVersion).toBeNull();
    expect(historical.unitCost).toBeNull();
    expect(historical.provenance).toBe("Historical preparation");
    await audit(page, "grouped-stock", width);
    const brownies = page
      .locator(".stock-group")
      .filter({ hasText: brownie.name });
    await brownies.getByRole("button", { name: "Manage", exact: true }).click();
    await brownies
      .getByRole("button", { name: "Record waste / sample" })
      .click();
    let d = page.getByRole("dialog");
    await d.getByLabel("Quantity in lot units").fill("1");
    await d.getByRole("button", { name: "Confirm waste", exact: true }).click();
    await expect(
      d.getByRole("button", { name: "Confirmed", exact: true }),
    ).toBeVisible();
    await d.getByRole("button", { name: "Close dialog" }).click();
    await expect(brownies).toContainText("8 each available");
    await brownies.getByRole("button", { name: "Trace batch" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Brownies already baked for testing",
    );
    await expect(page.getByRole("dialog")).toContainText(
      "No purchase or ingredient consumption",
    );
    await audit(page, "provenance", width);
    await page.getByRole("button", { name: "Close dialog" }).click();

    await page.getByRole("button", { name: "Production", exact: true }).click();
    await page
      .getByRole("button", { name: "Make a batch / resume draft" })
      .click();
    d = page.getByRole("dialog");
    await d.getByLabel("Recipe", { exact: true }).selectOption("lemon-pot");
    await d.getByLabel(/Quantity to make/).fill("4");
    await expect(d.getByLabel("Recipe version")).not.toBeVisible();
    await expect(d.getByLabel("Recipe version")).toHaveValue(
      String(recipe.revision),
    );
    await expect(
      d.getByRole("heading", { name: "What’s missing?" }),
    ).toBeVisible();
    await expect(d.locator(".shortage-help")).toContainText("Cream cheese");
    await audit(page, "shortage", width);
    await d.getByRole("button", { name: "Create shopping list" }).click();
    await expect(page.getByLabel(/Planned output/)).toHaveValue("4");
    await page.getByRole("button", { name: "Return to production" }).click();
    d = page.getByRole("dialog");
    await expect(d.getByLabel(/Quantity to make/)).toHaveValue("4");
    await d.getByRole("button", { name: "Manage / adjust stock" }).click();
    await expect(
      page.getByRole("heading", { name: "Stock on Hand", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Return to production" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Record Purchase", exact: true })
      .click();
    d = page.getByRole("dialog");
    await d
      .getByLabel("Supplier", { exact: true })
      .selectOption("sample-supplier");
    await d.getByLabel("Ingredient or packaging").selectOption("cream-cheese");
    await d.getByLabel("Quantity per pack").fill("300");
    await d.getByLabel("Actual price per pack (£)").fill("3.25");
    await d.getByText(/Batch reference & date review/).click();
    await reviewDates(d);
    await d.getByRole("button", { name: "Confirm stock receipt" }).click();
    await expect(
      d.getByRole("button", { name: "Confirmed", exact: true }),
    ).toBeVisible();
    await d.getByRole("button", { name: "Close dialog" }).click();
    const draft = (
      await (
        await page.request.get("/api/drafts/inventory-production/current")
      ).json()
    ).body;
    expect(draft.plannedYield).toBe(4);
    expect(draft.recipeId).toBe("lemon-pot");
    const preview = await post(page, "/inventory/production/preview", draft);
    // Seed the other reviewed household ingredients, using the new opening-stock API, in the isolated test location.
    for (const row of preview.requirements.filter((r: any) => r.shortage > 0))
      await post(page, "/inventory/existing", {
        operationId: crypto.randomUUID(),
        kind: "ingredient",
        itemId: row.requirement.itemId,
        quantity: row.shortage,
        unit: row.requirement.unit,
        locationId: location.id,
        date: today(),
        source: "Synthetic cupboard stock",
        dateReviewed: true,
        dateEvidence: "Synthetic date review",
        valuationStatus: "unknown",
      });
    await page.getByRole("button", { name: "Return to production" }).click();
    d = page.getByRole("dialog");
    await expect(d.getByLabel(/Quantity to make/)).toHaveValue("4");
    await expect(
      d.getByText("Usable stock covers the selected actual quantities."),
    ).toBeVisible();
    await reviewDates(d);
    await d
      .getByText("Actual quantities, FIFO & cost details", { exact: true })
      .click();
    await expect(d).toContainText("Valuation: unknown");
    await d.getByText("Lots allocated by FIFO", { exact: true }).click();
    await audit(page, "production", width);
    await d
      .getByRole("button", { name: "Confirm completed production" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Finished Products", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(
      "Batch recorded: 4 each",
    );
    const cheesecake = page
      .locator(".stock-group")
      .filter({ hasText: "Lemon cheesecake pot" });
    await expect(cheesecake).toContainText("8 each available");
    await audit(page, "finished-stock", width);
    current = await stock(page);
    const operation = current.operations.find(
      (o: any) => o.id === draft.operationId,
    );
    expect(operation.result.actualYield).toBe(4);
    expect(operation.result.batchCost).toBeNull();
    expect(operation.result.allocations.length).toBeGreaterThan(0);
    expect(current.balances.every((b: any) => b.quantity >= 0)).toBe(true);
    await navigate(page, "Money");
    await expect(page.locator(".planner-quick-results")).toContainText(
      "Orders needed to break even",
    );
    await expect(page.locator(".planner-quick-results")).toContainText(
      "per month",
    );
  });

test("supplier price shortcut prefills a separate purchase draft without changing stock early", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: /Add ingredient Supplier/ }).click();
  let d = page.getByRole("dialog");
  const name = `Pantry sugar ${Date.now()}`;
  await d.getByLabel("Ingredient name").fill(name);
  await d
    .getByLabel("Supplier", { exact: true })
    .selectOption("sample-supplier");
  await d.getByLabel("Pack size").fill("2");
  await d.getByLabel("Unit", { exact: true }).selectOption("kg");
  await d.getByLabel("Purchase price (£)").fill("3.26");
  await expect(d).toContainText("£1.63/kg");
  await d
    .getByRole("button", { name: "Add ingredient & price", exact: true })
    .click();
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: "Update Price" }).click();
  d = page.getByRole("dialog");
  await expect(d).toContainText("£1.63/kg");
  await d.getByRole("button", { name: "Record Purchase", exact: true }).click();
  d = page.getByRole("dialog");
  await expect(d.getByLabel("Quantity per pack")).toHaveValue("2");
  await expect(d.getByLabel("Pack unit")).toHaveValue("kg");
  await expect(d.getByLabel("Actual price per pack (£)")).toHaveValue("3.26");
  const before = (await stock(page)).movements.length;
  await expect(d.getByLabel("Supplier", { exact: true })).toHaveValue(
    "sample-supplier",
  );
  await d.getByText(/Batch reference & date review/).click();
  await reviewDates(d);
  expect((await stock(page)).movements).toHaveLength(before);
  await d.getByRole("button", { name: "Confirm stock receipt" }).click();
  await expect(
    d.getByRole("button", { name: "Confirmed", exact: true }),
  ).toBeVisible();
  expect((await stock(page)).movements).toHaveLength(before + 1);
});
