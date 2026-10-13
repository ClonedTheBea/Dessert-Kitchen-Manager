import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";
import { post, seedForecast } from "./financialFixtures";
import { today } from "../src/api";
for (const width of [1440, 390])
  test(`financial overview, exact chart, missing costs and read-only views ${width}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const state = await (await page.request.get("/api/state")).json();
    const source = state.recipes.find(
      (v: any) => v.recipe.id === "lemon-pot",
    ).recipe;
    const ingredients = [];
    for (const [i, price] of [
      [0, 1.41],
      [1, 0.16],
    ]) {
      const ingredient = await post(page, "/ingredients", {
        ...state.ingredients.find(
          (x: any) => x.id === (i ? "pot" : "cream-cheese"),
        ),
        id: "",
        revision: 0,
        name: `Chart ${i ? "pot" : "filling"} ${width}`,
        baseUnit: "each",
        isPackaging: !!i,
      });
      ingredients.push(ingredient);
      await post(page, "/prices", {
        id: "",
        ingredientId: ingredient.id,
        supplierId: state.suppliers[0].id,
        packQuantity: 1,
        unit: "each",
        packPrice: price,
        vatRate: 0,
        priceIncludesVat: true,
        recoverVat: false,
        productReference: "Synthetic chart acceptance fixture",
        effectiveDate: today(),
        isIllustrative: true,
      });
    }
    const recipe = (
      await post(page, "/recipes", {
        ...source,
        id: "",
        revision: 0,
        name: `Lemon Cheesecake chart ${width}`,
        yield: 1,
        labourMinutes: 0,
        sellingPrice: 5.95,
        lines: ingredients.map((i) => ({
          kind: "ingredient",
          referenceId: i.id,
          quantity: 1,
          unit: "each",
          wastePercent: 0,
          role: i.isPackaging ? "packaging" : "ingredient",
        })),
      })
    ).recipe;
    let b = await seedForecast(page);
    b = await post(page, "/business", {
      ...b,
      expenses: [],
      equipment: [],
      products: [
        {
          recipeId: recipe.id,
          channels: b.channels.map((c: any) => ({
            channelId: c.id,
            price: 5.95,
            monthlyUnits: 100,
          })),
          outputVatPercent: 0,
          vatTreatment: "zero",
          inputRecoveryPercent: 100,
          equipment: [],
          waterLitresPerBatch: 0,
          labourBasis: "recipe",
          labourMinutesPerBatch: 0,
          energyConfirmed: true,
        },
      ],
      forecast: {
        ...b.forecast,
        openDays: [4, 5, 6],
        tradingWeeks: 48,
        ordersPerEvening: 20,
      },
      forecastReviewed: true,
    });
    await navigate(page, "Settings");
    await page.getByText("Premises and regular costs", { exact: true }).click();
    for (const [name, amount, period] of [
      ["Rent", "625", "monthly"],
      ["Insurance", "540", "annual"],
    ]) {
      await page
        .getByRole("button", { name: "Add expense", exact: true })
        .click();
      await page.getByLabel("Expense name", { exact: true }).last().fill(name);
      await page
        .getByLabel("Expense period", { exact: true })
        .last()
        .selectOption(period);
      await page
        .getByLabel("Expense amount (£)", { exact: true })
        .last()
        .fill(amount);
    }
    await expect(
      page.getByText("£45.00 per month before VAT recovery adjustment"),
    ).toBeVisible();
    await page.getByText("Utilities & equipment", { exact: true }).click();
    await page
      .getByLabel("electricity unit rate (p/kWh)", { exact: true })
      .fill("22");
    await expect(page.locator(".save-status")).toContainText("Saved");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `../artifacts/financial-ux-evidence/after/settings-${width}.png`,
      fullPage: true,
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "What’s cooking today?" }),
    ).toBeVisible();
    await navigate(page, "Settings");
    await page.getByText("Utilities & equipment", { exact: true }).click();
    await expect(
      page.getByLabel("electricity unit rate (p/kWh)", { exact: true }),
    ).toHaveValue("22");
    const before = await (await page.request.get("/api/business")).json();
    const beforeState = await (await page.request.get("/api/state")).json();
    const beforeStock = await (
      await page.request.get("/api/inventory/state")
    ).json();
    const beforeHistory = await (
      await page.request.get("/api/business/history")
    ).json();
    await navigate(page, "Money");
    await expect(
      page.getByRole("heading", { name: "Financial Overview", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".financial-cards")).toContainText("£670.00");
    await expect(
      page.locator("main input:not([type=search]),main select"),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "How many orders?" }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `../artifacts/financial-ux-evidence/after/money-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Search desserts…").fill(recipe.name);
    await page.getByRole("button", { name: new RegExp(recipe.name) }).click();
    const panel = page.getByRole("dialog", { name: "Price Breakdown" });
    await expect(panel).toBeVisible();
    await panel
      .getByLabel("Sales channel", { exact: true })
      .selectOption("deliveroo");
    await expect(panel.locator(".price-legend")).toContainText("£2.14");
    await expect(panel.locator(".price-legend")).toContainText("£2.24");
    await expect(panel.locator(".price-legend")).toContainText("£1.41");
    await expect(panel.locator(".price-legend")).toContainText("£0.16");
    const segments = await panel.locator(".price-legend dd").allTextContents();
    expect(
      segments.reduce(
        (n, s) => n + Math.round(Number(s.match(/£([\d.]+)/)![1]) * 100),
        0,
      ),
    ).toBe(595);
    expect(
      segments.reduce(
        (n, s) => n + Math.round(Number(s.match(/([\d.]+)%/)![1]) * 100),
        0,
      ),
    ).toBe(10000);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `../artifacts/financial-ux-evidence/after/price-breakdown-${width}.png`,
      fullPage: false,
    });
    await panel
      .getByLabel("Sales channel", { exact: true })
      .selectOption("direct");
    await expect(panel.locator(".price-legend")).toContainText("£4.38");
    await panel
      .getByLabel("Sales channel", { exact: true })
      .selectOption("uber");
    await expect(panel.locator(".price-legend")).toContainText("£2.24");
    await panel
      .getByRole("button", { name: "Try a Different Price", exact: true })
      .click();
    await panel.getByLabel("Trial selling price (£)").fill("8");
    await expect(panel.getByLabel("Trial selling price (£)")).toBeFocused();
    await expect(panel.locator(".price-heading")).toContainText("£8.00");
    await panel.getByRole("button", { name: "Reset price test" }).click();
    await expect(panel.locator(".price-heading")).toContainText("£5.95");
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    expect(await (await page.request.get("/api/business")).json()).toEqual(
      before,
    );
    expect(
      await (await page.request.get("/api/business/history")).json(),
    ).toEqual(beforeHistory);
    expect(await (await page.request.get("/api/state")).json()).toEqual(
      beforeState,
    );
    expect(
      await (await page.request.get("/api/inventory/state")).json(),
    ).toEqual(beforeStock);
    b = await post(page, "/business", {
      ...before,
      channels: before.channels.map((c: any) =>
        c.id === "uber"
          ? { ...c, commissionPercent: 0, commissionConfigured: false }
          : c,
      ),
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "What’s cooking today?" }),
    ).toBeVisible();
    await navigate(page, "Money");
    await expect(page.locator(".financial-cards")).toContainText(
      "Check direct costs",
    );
    await expect(page.locator(".financial-cards")).not.toContainText("£0.00");
    await page.getByLabel("Search desserts…").fill(recipe.name);
    await page.getByRole("button", { name: new RegExp(recipe.name) }).click();
    await panel
      .getByLabel("Sales channel", { exact: true })
      .selectOption("uber");
    await expect(panel).toContainText("commission is not configured");
    await expect(panel.locator(".price-doughnut svg")).toHaveCount(0);
    await expect(panel).toContainText("Contribution incomplete");
    await page.keyboard.press("Escape");
    await post(page, "/business", {
      ...b,
      channels: b.channels.map((c: any) => ({
        ...c,
        commissionConfigured: true,
      })),
    });
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "What’s cooking today?" }),
    ).toBeVisible();
    await navigate(page, "Money");
    await expect(page.locator(".financial-cards")).not.toContainText(
      "Check direct costs",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
