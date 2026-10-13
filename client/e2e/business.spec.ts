import { test, expect, type Page } from "@playwright/test";
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
async function audit(page: Page, name: string, width: number) {
  await page.getByRole("heading").first().click();
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(result.violations).toEqual([]);
  await page.screenshot({
    path: `test-results/business-${name}-${width}.png`,
    fullPage: true,
  });
}
for (const width of [1440, 390])
  test(`business settings, product economics and isolated pricing scenarios ${width}`, async ({
    page,
  }) => {
    test.setTimeout(150000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const state = await (await page.request.get("/api/state")).json();
    const original = state.recipes.find(
      (r: any) => r.recipe.id === "lemon-pot",
    ).recipe;
    const recipe = (
      await post(page, "/recipes", {
        ...original,
        id: "",
        revision: 0,
        name: `Profit test pots ${width}`,
        sellingPrice: 6,
        yield: 4,
        labourMinutes: 0,
        lines: [
          {
            kind: "ingredient",
            referenceId: "cream-cheese",
            quantity: 300,
            unit: "g",
            wastePercent: 0,
            role: "ingredient",
          },
          {
            kind: "ingredient",
            referenceId: "pot",
            quantity: 4,
            unit: "each",
            wastePercent: 0,
            role: "packaging",
          },
        ],
      })
    ).recipe;
    let b = await (await page.request.get("/api/business")).json();
    await post(page, "/business", {
      ...b,
      name: `Test kitchen ${width}`,
      effectiveFrom: today(),
      vatRegistered: false,
      inputRecoveryPercent: 0,
      allocationMethod: "units",
      utilities: [
        {
          kind: "electricity",
          pencePerUnit: 0,
          standingPenceDaily: 0,
          vatPercent: 0,
          includesVat: true,
        },
        {
          kind: "gas",
          pencePerUnit: 0,
          standingPenceDaily: 0,
          vatPercent: 0,
          includesVat: true,
        },
        {
          kind: "water",
          pencePerUnit: 0,
          standingPenceDaily: 0,
          vatPercent: 0,
          includesVat: true,
        },
      ],
      equipment: [],
      expenses: [],
      products: [],
      staffHoursWeekly: 0,
      ownerHoursWeekly: 0,
    });
    const location = await post(page, "/inventory/locations", {
      id: "",
      name: `Cost testing ${width}`,
      mode: "testing",
    });
    for (const line of recipe.lines)
      await post(page, "/inventory/existing", {
        operationId: crypto.randomUUID(),
        kind: "ingredient",
        itemId: line.referenceId,
        quantity: line.quantity,
        unit: line.unit,
        locationId: location.id,
        date: today(),
        source: "Synthetic household stock",
        dateReviewed: true,
        dateEvidence: "Test review",
        valuationStatus: "unknown",
      });
    await post(page, "/inventory/production", {
      operationId: crypto.randomUUID(),
      recipeId: recipe.id,
      version: 1,
      plannedYield: 4,
      actualYield: 4,
      locationId: location.id,
      destinationId: location.id,
      date: today(),
      batchReference: "Synthetic cost check",
      dateReviewed: true,
      dateEvidence: "Test review",
    });
    await navigate(page, "Settings");
    await page.getByText("Utilities & equipment", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Business settings", exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("electricity unit rate (p/kWh)", { exact: true })
      .fill("30");
    await page.getByLabel("electricity standing charge (p/day)").fill("60");
    await page
      .getByRole("button", { name: "Add equipment", exact: true })
      .click();
    await page.getByLabel("Equipment name", { exact: true }).fill("Test oven");
    await page.getByLabel("Rated consumption (kW)").fill("2");
    await page.getByLabel("Average load (%)").fill("50");
    await page.getByText("Premises and regular costs", { exact: true }).click();
    await page
      .getByRole("button", { name: "Add expense", exact: true })
      .click();
    await page
      .getByLabel("Expense name", { exact: true })
      .fill("Annual insurance");
    await page.getByText("Advanced expense options", { exact: true }).click();
    await page.getByLabel("Expense category").selectOption("Insurance");
    await page.getByLabel("Expense period").selectOption("annual");
    await page.getByLabel("Expense amount (£)", { exact: true }).fill("1200");
    await expect(
      page.getByText("£100.00 per month before VAT recovery adjustment"),
    ).toBeVisible();
    await page.getByText("Selling platforms", { exact: true }).click();
    await page
      .getByLabel("Uber Eats commission (%)", { exact: true })
      .fill("30");
    await page.getByLabel("Uber Eats fee VAT (%)").fill("20");
    await page
      .getByLabel("Deliveroo commission (%)", { exact: true })
      .fill("25");
    await page.getByLabel("Deliveroo fee VAT (%)").fill("20");
    await expect(page.locator(".save-status")).toContainText("Saved");
    await audit(page, "settings", width);
    await page
      .getByRole("button", { name: "Product pricing", exact: true })
      .click();
    await page.getByLabel("Choose a product").selectOption(recipe.id);
    await page
      .getByRole("button", { name: "Edit saved product pricing", exact: true })
      .first()
      .click();
    const direct = page.getByRole("group", { name: "Direct", exact: true });
    await direct
      .getByText("Forecast sales volume (optional)", { exact: true })
      .click();
    await direct.getByLabel("Forecast units / month").fill("100");
    await page.getByLabel("Price to save for channel").selectOption("uber");
    const uber = page.getByRole("group", { name: "Uber Eats", exact: true });
    await uber
      .getByText("Forecast sales volume (optional)", { exact: true })
      .click();
    await uber.getByLabel("Forecast units / month").fill("100");
    await page
      .getByLabel("Price to save for channel")
      .selectOption("deliveroo");
    const deliveroo = page.getByRole("group", {
      name: "Deliveroo",
      exact: true,
    });
    await deliveroo
      .getByText("Forecast sales volume (optional)", { exact: true })
      .click();
    await deliveroo.getByLabel("Forecast units / month").fill("100");
    await page
      .getByText("Product VAT, equipment & direct labour", { exact: true })
      .click();
    await page.getByLabel("Product VAT treatment").selectOption("zero");
    await page.getByLabel("Test oven minutes / batch").fill("30");
    await page
      .getByRole("button", { name: "Return to catalogue", exact: true })
      .click();
    // Reopening must initialise from the latest saved business revision.
    await page.getByLabel("Choose a product").selectOption(recipe.id);
    await page
      .getByRole("button", { name: "Edit saved product pricing", exact: true })
      .first()
      .click();
    await page
      .getByText("Forecast sales volume (optional)", { exact: true })
      .click();
    await expect(
      page
        .getByRole("group", { name: "Direct", exact: true })
        .getByLabel("Forecast units / month"),
    ).toHaveValue("100");
    await page
      .getByRole("group", { name: "Direct", exact: true })
      .getByLabel("Customer selling price (£)")
      .fill("6.25");
    await expect(page.locator(".save-status")).toContainText("Saved");
    const reopened = await (await page.request.get("/api/business")).json();
    expect(
      reopened.products
        .find((p: any) => p.recipeId === recipe.id)
        .channels.find((c: any) => c.channelId === "direct").price,
    ).toBe(6.25);
    await navigate(page, "Money");
    await page.getByLabel("Search desserts…").fill(recipe.name);
    await page.getByRole("button", { name: new RegExp(recipe.name) }).click();
    await expect(
      page.getByRole("dialog", { name: "Price Breakdown" }),
    ).toBeVisible();
    await expect(page.locator(".price-legend")).toContainText("£0.04");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await audit(page, "catalogue", width);
    await navigate(page, "Settings");
    await page
      .getByRole("button", { name: "Product pricing", exact: true })
      .click();
    await page.getByLabel("Choose a product").selectOption(recipe.id);
    const beforeBusiness = await (
      await page.request.get("/api/business")
    ).json();
    const beforeState = await (await page.request.get("/api/state")).json();
    const beforeStock = await (
      await page.request.get("/api/inventory/state")
    ).json();
    await page
      .getByRole("button", { name: "Advanced pricing scenarios", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pricing simulator", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("group", { name: "Direct", exact: true })
      .getByLabel("Customer selling price (£)")
      .fill("8");
    await page.getByLabel("Portion size factor").fill("1.5");
    await page
      .getByText("Experiment with ingredients & quantities", { exact: true })
      .click();
    await page
      .getByRole("group", { name: "Recipe line 1", exact: true })
      .getByLabel("Batch quantity (g)")
      .fill("200");
    await page
      .getByText("Simulate business rates & operating costs", { exact: true })
      .click();
    await page.getByText("Utilities & equipment", { exact: true }).click();
    await page
      .getByLabel("electricity unit rate (p/kWh)", { exact: true })
      .fill("40");
    await page
      .getByText("Advanced: VAT & overhead allocation", { exact: true })
      .click();
    await page
      .getByLabel("Business is VAT registered", { exact: true })
      .check();
    await page
      .getByLabel("Business input VAT recovery (%)", { exact: true })
      .fill("50");
    await page
      .getByText("Product VAT, equipment & direct labour", { exact: true })
      .click();
    await page
      .getByLabel("Product VAT treatment", { exact: true })
      .selectOption("taxable");
    await page.getByLabel("Product output VAT (%)", { exact: true }).fill("20");
    await expect(
      page.getByRole("button", { name: "Save pricing scenario", exact: true }),
    ).toBeEnabled();
    await page
      .getByText("Direct — where each pound goes", { exact: true })
      .click();
    await expect(
      page.locator(".cost-bar-row").filter({ hasText: "Output VAT" }).first(),
    ).toContainText("£1.33");
    await page
      .getByLabel("Pricing scenario name", { exact: true })
      .fill(`Price experiment ${width}`);
    await page
      .getByRole("button", { name: "Save pricing scenario", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("snapshot saved");
    const comparison = page.getByLabel("Compare saved pricing scenario");
    await comparison.selectOption({ label: `Price experiment ${width}` });
    await page
      .getByRole("group", { name: "Direct", exact: true })
      .getByLabel("Customer selling price (£)")
      .fill("9");
    await expect(
      page.getByRole("region", { name: "Pricing scenario differences" }),
    ).toContainText("£83.33");
    await audit(page, "simulator", width);
    expect(await (await page.request.get("/api/business")).json()).toEqual(
      beforeBusiness,
    );
    expect(await (await page.request.get("/api/state")).json()).toEqual(
      beforeState,
    );
    expect(
      await (await page.request.get("/api/inventory/state")).json(),
    ).toEqual(beforeStock);
    await page.getByRole("button", { name: "Leave simulator" }).click();
    await navigate(page, "Money");
    await expect(
      page.getByText(
        /Actual recorded operating profit and profit after tax are unavailable/,
      ),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Financial glossary", exact: true })
      .click();
    await page.getByLabel("Search financial terms").fill("input VAT");
    await expect(page.locator(".glossary")).toContainText("£11");
    await audit(page, "glossary", width);
    await navigate(page, "Settings");
    await page.getByText("Utilities & equipment", { exact: true }).click();
    await page.getByText("Effective-date history", { exact: true }).click();
    await expect(page.getByText(/Revision .* effective/).first()).toBeVisible();
    await expect(
      page.getByLabel("electricity unit rate (p/kWh)", { exact: true }).first(),
    ).toHaveValue("30");
  });
