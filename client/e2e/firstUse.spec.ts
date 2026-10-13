import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";
import { post } from "./financialFixtures";
import { today } from "../src/api";
for (const width of [1440, 390])
  test(`first-use choices, partial recipe costs, price testing and VAT repair ${width}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    let b = await (await page.request.get("/api/business")).json();
    b = await post(page, "/business", {
      ...b,
      effectiveFrom: today(),
      forecast: null,
      forecastReviewed: false,
      forecastShares: null,
      vatRegistered: false,
      inputRecoveryPercent: 0,
      staffHoursWeekly: 0,
      ownerHoursWeekly: 0,
      expenses: [],
      products: [],
      utilities: b.utilities.map((u: any) => ({ ...u, standingPenceDaily: 0 })),
      channels: b.channels.map((c: any) => ({
        ...c,
        commissionPercent: 0,
        commissionConfigured: false,
      })),
    });
    await navigate(page, "Home");
    for (const name of ["Cost a dessert", "Plan my business", "Manage stock"])
      await expect(
        page.getByRole("button", { name: new RegExp(name) }),
      ).toBeVisible();
    await page.getByText("Optional setup checklist", { exact: true }).click();
    await expect(page.locator(".setup-checklist")).toContainText(
      "published sellable recipes already available",
    );
    await page.getByRole("button", { name: "Hide getting started" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Show getting started" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Show getting started" }).click();
    await page.screenshot({
      path: `../artifacts/first-use-evidence/home-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Cost a dessert/ }).click();
    const state = await (await page.request.get("/api/state")).json();
    const brownie = state.recipes.find((v: any) =>
      v.recipe.name.toLowerCase().includes("brownie"),
    ).recipe;
    await page.getByLabel("Choose a product").selectOption(brownie.id);
    await expect(
      page.getByRole("heading", { name: "What we know so far" }),
    ).toBeVisible();
    await expect(page.locator(".known-cost-summary")).toContainText(
      "Ingredients £",
    );
    await expect(page.locator(".known-cost-summary")).toContainText(
      "uncosted remainder",
    );
    await expect(page.locator(".known-cost-summary")).toContainText(
      "not contribution or profit",
    );
    await expect(page.getByLabel("Forecast units / month")).toHaveCount(0);
    await expect(
      page.getByLabel("Business input VAT recovery (%)"),
    ).toHaveCount(0);
    const before = await (await page.request.get("/api/business")).json();
    await page.getByLabel("Test selling price (£)").fill("7.25");
    await expect(page.locator(".price-heading")).toContainText("£7.25");
    await page
      .getByLabel("Sales channel", { exact: true })
      .selectOption("deliveroo");
    await expect(page.locator(".setup-list")).toContainText(
      "Deliveroo commission",
    );
    await page.getByLabel("Test selling price (£)").fill("7.25");
    await expect(page.locator(".price-heading")).toContainText("£7.25");
    expect(await (await page.request.get("/api/business")).json()).toEqual(
      before,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({
      path: `../artifacts/first-use-evidence/partial-price-${width}.png`,
      fullPage: true,
    });
    await navigate(page, "Settings");
    await page
      .getByText("Advanced: VAT & overhead allocation", { exact: true })
      .click();
    await expect(
      page.getByLabel("Business input VAT recovery (%)", { exact: true }),
    ).toBeDisabled();
    // Reproduce the old invalid in-memory state without changing any stored history.
    await page.route("**/api/business", async (route) => {
      if (route.request().method() === "GET") {
        const response = await route.fetch();
        const body = await response.json();
        await route.fulfill({
          response,
          json: { ...body, inputRecoveryPercent: 100 },
        });
      } else await route.continue();
    });
    await navigate(page, "Home");
    await navigate(page, "Settings");
    await expect(page.getByRole("alert")).toContainText("cannot be reclaimed");
    await page.getByText("Premises and regular costs", { exact: true }).click();
    await page
      .getByRole("button", { name: "Add expense", exact: true })
      .click();
    await page.getByLabel("Expense name", { exact: true }).fill("Rent");
    await page.getByLabel("Expense amount (£)", { exact: true }).fill("625");
    await expect(page.locator(".save-status")).toContainText(
      "Input VAT recovery requires VAT registration",
    );
    await expect(
      page.getByLabel("Expense amount (£)", { exact: true }),
    ).toHaveValue("625");
    await page.unroute("**/api/business");
    await page
      .getByRole("button", { name: "Use no VAT recovery (0%)" })
      .click();
    await expect(page.locator(".save-status")).toContainText("Saved");
    b = await (await page.request.get("/api/business")).json();
    expect(b.inputRecoveryPercent).toBe(0);
    expect(b.expenses[0].amount).toBe(625);
    expect(b.vatRegistered).toBe(false);
    await navigate(page, "Money");
    await expect(page.locator(".financial-cards")).toContainText("£625.00");
    await expect(
      page.getByRole("heading", { name: "Known monthly running costs" }),
    ).toBeVisible();
    await expect(page.locator(".financial-cards")).not.toContainText("£0.00");
    await page.screenshot({
      path: `../artifacts/first-use-evidence/partial-money-${width}.png`,
      fullPage: true,
    });
    await navigate(page, "Settings");
    await page
      .getByText("Advanced: VAT & overhead allocation", { exact: true })
      .click();
    await page
      .getByLabel("Business is VAT registered", { exact: true })
      .check();
    await page
      .getByLabel("Business input VAT recovery (%)", { exact: true })
      .fill("100");
    await expect(page.locator(".save-status")).toContainText("Saved");
    await page
      .getByLabel("Business is VAT registered", { exact: true })
      .uncheck();
    await page.getByText("Premises and regular costs", { exact: true }).click();
    await page.getByLabel("Expense amount (£)", { exact: true }).fill("640");
    await navigate(page, "Money");
    await expect(page.locator(".financial-cards")).toContainText("£640.00");
    b = await (await page.request.get("/api/business")).json();
    expect(b.vatRegistered).toBe(false);
    expect(b.inputRecoveryPercent).toBe(0);
  });
