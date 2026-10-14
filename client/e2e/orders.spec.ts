import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";
import { post, seedForecast } from "./financialFixtures";
import { today } from "../src/api";
for (const width of [1440, 390])
  test(`till orders and stock ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    let b = await seedForecast(page);
    await post(page, "/business", {
      ...b,
      products: [
        {
          recipeId: "brownie",
          channels: b.channels.map((c: any) => ({
            channelId: c.id,
            price: 6.95,
            monthlyUnits: 0,
          })),
          vatTreatment: "zero",
          outputVatPercent: 0,
          inputRecoveryPercent: 0,
          equipment: [],
          waterLitresPerBatch: 0,
          labourBasis: "recipe",
          labourMinutesPerBatch: 0,
        },
      ],
    });
    const state = await (await page.request.get("/api/state")).json();
    const recipe = state.recipes.find(
      (v: any) => v.recipe.id === "brownie",
    ).recipe;
    await post(page, "/inventory/existing", {
      operationId: crypto.randomUUID(),
      kind: "recipe",
      itemId: "brownie",
      quantity: 9,
      unit: "each",
      locationId: "home",
      date: today(),
      source: "test",
      dateReviewed: true,
      dateEvidence: "Test review",
      totalCost: 9,
      valuationStatus: "known",
      notes: "Synthetic order test",
      recipeVersion: recipe.revision,
    });
    await page.getByRole("button", { name: /New Order/ }).click();
    await page
      .getByLabel("Search order products")
      .fill("Classic chocolate brownie");
    await page
      .getByRole("button", { name: /Classic chocolate brownie.*Add/ })
      .click();
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await expect(page.locator(".till-layout")).toContainText("£13.90");
    await page.screenshot({
      path: `../artifacts/sprint3/till-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Confirm order", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Complete & deduct stock" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Record paid", exact: true })
      .click();
    await page.getByRole("button", { name: "Complete & deduct stock" }).click();
    await expect(page.getByText(/completed · Payment: paid/)).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../artifacts/sprint3/order-${width}.png`,
      fullPage: true,
    });
    await navigate(page, "Money");
    await expect(
      page.getByRole("heading", { name: "Financial Overview", exact: true }),
    ).toBeVisible();
  });

for (const width of [1440, 390])
  test(`CSV mapping and payout reconciliation ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await navigate(page, "Money");
    await page
      .getByRole("button", { name: "Import Sales", exact: true })
      .click();
    const ref = "CSV-" + width;
    await page.getByLabel("Sales CSV", { exact: true }).setInputFiles({
      name: "sales.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        `ref,date,gross,fees,other,refund,net\n${ref},2026-01-01,300,108,7,10,175`,
      ),
    });
    for (const [label, col] of [
      ["Platform order reference (required)", "ref"],
      ["Order date / time — ISO (required)", "date"],
      ["Gross merchant item sales before discounts (required)", "gross"],
      ["Commission including fee VAT", "fees"],
      ["Other merchant fees", "other"],
      ["Refunds", "refund"],
      ["Reported net owed / paid (not proof of bank receipt)", "net"],
    ])
      await page.getByLabel(label, { exact: true }).selectOption(col);
    await page.getByRole("button", { name: "Preview & validate" }).click();
    await expect(
      page.getByText("1 new · 0 duplicate · 0 conflicting · 0 incomplete"),
    ).toBeVisible();
    await page.screenshot({
      path: `../artifacts/sprint3/import-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Confirm new financial-only sales" })
      .click();
    await expect(
      page.getByText("Import saved. No inventory moved."),
    ).toBeVisible();
    await page.getByRole("button", { name: "Preview & validate" }).click();
    await expect(
      page.getByText("0 new · 1 duplicate · 0 conflicting · 0 incomplete"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Payouts", exact: true }).click();
    await page.getByRole("checkbox", { name: new RegExp(ref) }).check();
    await page
      .getByLabel("Payout reference", { exact: true })
      .fill("PAY-" + width);
    await page.getByLabel("Actual bank receipt (£)").fill("175");
    await page
      .getByRole("button", { name: "Record payout & reconcile" })
      .click();
    await expect(
      page
        .locator(".running-cost-row")
        .filter({ hasText: "Reconciled" })
        .last(),
    ).toContainText("£175.00");
    await page.screenshot({
      path: `../artifacts/sprint3/payout-${width}.png`,
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
  });

for (const width of [1440, 390])
  test(`recorded sales report ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await navigate(page, "Money");
    await page.getByRole("button", { name: "Sales", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Best-selling desserts", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "This month versus forecast",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../artifacts/sprint3/sales-${width}.png`,
      fullPage: true,
    });
  });
