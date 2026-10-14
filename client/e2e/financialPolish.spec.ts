import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";
import { post, seedForecast } from "./financialFixtures";
import { orderedChannels } from "../src/channelOrder";

test("channel ranking handles configured rates, ties and fallback without mutation", () => {
  const channels: any[] = [
    {
      id: "direct",
      name: "Direct",
      commissionPercent: 0,
      commissionConfigured: true,
    },
    { id: "uber", name: "Uber Eats", commissionPercent: 30 },
    {
      id: "ignored",
      name: "Unused",
      commissionPercent: 50,
      commissionConfigured: false,
    },
    {
      id: "deliveroo",
      name: "Deliveroo",
      commissionPercent: 30,
      commissionConfigured: true,
    },
  ];
  expect(orderedChannels(channels).map((c) => c.id)).toEqual([
    "deliveroo",
    "uber",
    "direct",
    "ignored",
  ]);
  expect(channels[0].id).toBe("direct");
  expect(
    orderedChannels(channels.map((c) => ({ ...c, commissionPercent: 0 }))).map(
      (c) => c.name,
    ),
  ).toEqual(["Deliveroo", "Direct", "Uber Eats", "Unused"]);
});

for (const width of [1440, 390])
  test(`financial polish save, cancel, chooser and chart ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const state = await (await page.request.get("/api/state")).json();
    const recipe = state.recipes.find(
      (r: any) => r.recipe.id === "brownie",
    ).recipe;
    let b = await seedForecast(page);
    b = await post(page, "/business", {
      ...b,
      staffHoursWeekly: 0,
      vatRegistered: false,
      inputRecoveryPercent: 0,
      channels: b.channels.map((c: any) => ({
        ...c,
        commissionPercent: c.id === "direct" ? 0 : 30,
      })),
      expenses: [
        {
          id: "rent",
          name: "Rent",
          category: "Rent",
          amount: 650,
          period: "monthly",
          attribution: "overhead",
          vatPercent: 0,
          includesVat: true,
        },
      ],
      products: [
        {
          recipeId: recipe.id,
          channels: b.channels.map((c: any) => ({
            channelId: c.id,
            price: 7,
            monthlyUnits: 100,
          })),
          vatTreatment: "zero",
          outputVatPercent: 0,
          inputRecoveryPercent: 0,
          energyConfirmed: true,
          equipment: [],
          waterLitresPerBatch: 0,
          labourBasis: "recipe",
          labourMinutesPerBatch: 0,
        },
      ],
    });
    await navigate(page, "Money");
    await expect(page.locator(".financial-cards")).toContainText("£650.00");
    await expect(page.locator(".financial-cards")).toHaveCSS(
      "position",
      "static",
    );
    await page
      .getByRole("button", { name: "Edit running costs", exact: true })
      .click();
    let editor = page.getByRole("dialog", { name: "Edit running costs" });
    await editor.getByLabel("Amount (£)", { exact: true }).fill("700");
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await (await page.request.get("/api/business")).json()).toEqual(b);
    await page
      .getByRole("button", { name: "Edit running costs", exact: true })
      .click();
    await editor.getByLabel("Amount (£)", { exact: true }).fill("-1");
    await editor.getByRole("button", { name: "Save running costs", exact: true }).click();
    await expect(editor.getByRole("alert")).toBeVisible();
    await expect(editor.getByLabel("Amount (£)", { exact: true })).toHaveValue("-1");
    expect(await (await page.request.get("/api/business")).json()).toEqual(b);
    await editor.getByLabel("Amount (£)", { exact: true }).fill("700");
    await editor
      .getByRole("button", { name: "+ Add running cost", exact: true })
      .click();
    await editor
      .getByLabel("Cost name", { exact: true })
      .last()
      .fill("Insurance");
    await editor.getByLabel("Amount (£)", { exact: true }).last().fill("540");
    await editor
      .getByLabel("Paid", { exact: true })
      .last()
      .selectOption("annual");
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
        .violations,
    ).toEqual([]);
    await editor
      .getByRole("button", { name: "Save running costs", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    await expect(page.locator(".financial-cards")).toContainText("£745.00");
    await page.getByRole("button", { name: "Edit running costs", exact: true }).click();
    await expect(editor.getByLabel("Amount (£)", { exact: true }).first()).toHaveValue("700");
    await page.screenshot({ path: `../artifacts/financial-polish/editor-${width}.png` });
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();

    const costs = page
      .locator("section")
      .filter({
        has: page.getByRole("heading", {
          name: "Monthly running costs",
          exact: true,
        }),
      });
    await expect(costs).toContainText("£700.00");
    await expect(costs).toContainText("£45.00");
    const after = await (await page.request.get("/api/business")).json();
    expect(after.products).toEqual(b.products);
    expect(after.channels).toEqual(b.channels);
    await page.screenshot({
      path: `../artifacts/financial-polish/money-${width}.png`,
      fullPage: true,
    });
    await page.getByLabel("Search desserts…").fill(recipe.name);
    await page.getByRole("button", { name: new RegExp(recipe.name) }).click();
    const panel = page.getByRole("dialog", { name: "Price Breakdown" });
    await expect(
      panel.getByLabel("Sales channel", { exact: true }),
    ).toHaveValue("deliveroo");
    expect(await panel.locator("select option").allTextContents()).toEqual([
      "Deliveroo",
      "Uber Eats",
      "Direct",
    ]);
    await expect(panel.locator(".price-doughnut")).toBeVisible();
    const strokes = await panel
      .locator("circle[pathLength]")
      .evaluateAll((nodes) => nodes.map((n) => getComputedStyle(n).stroke));
    const swatches = await panel
      .locator(".price-legend i")
      .evaluateAll((nodes) =>
        nodes.map((n) => getComputedStyle(n).backgroundColor),
      );
    expect(strokes).toEqual(swatches);
    await page.screenshot({
      path: `../artifacts/financial-polish/chart-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await navigate(page, "Settings");
    await page
      .getByRole("button", { name: "Product pricing", exact: true })
      .click();
    await page.getByLabel("Search products", { exact: true }).fill("brownie");
    await page
      .locator(".product-chooser")
      .getByRole("button", { name: new RegExp(recipe.name) })
      .click();
    await expect(page.locator(".price-breakdown-inline h3").first()).toHaveText(
      recipe.name,
    );
    await expect(page.getByLabel("Sales channel", { exact: true })).toHaveValue(
      "deliveroo",
    );
    await expect(page.locator(".product-pricing-workspace")).toHaveCSS(
      "gap",
      "24px",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `../artifacts/financial-polish/pricing-${width}.png`,
      fullPage: true,
    });
    expect(await (await page.request.get("/api/business")).json()).toEqual(
      after,
    );
  });
