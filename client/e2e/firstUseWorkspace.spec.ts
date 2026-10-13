import { test, expect } from "@playwright/test";
import { login, navigate } from "./login";
const kind = process.env.KITCHEN_ACCEPTANCE;
if (kind)
  test(`first-use acceptance against ${kind} workspace`, async ({ page }) => {
    test.setTimeout(60000);
    await login(page);
    const state = await (await page.request.get("/api/state")).json();
    const stock = await (await page.request.get("/api/inventory/state")).json();
    const business = await (await page.request.get("/api/business")).json();
    const history = await (
      await page.request.get("/api/business/history")
    ).json();
    for (const name of ["Cost a dessert", "Plan my business", "Manage stock"])
      await expect(
        page.getByRole("button", { name: new RegExp(name) }),
      ).toBeVisible();
    if (kind === "empty") {
      expect(state.recipes).toHaveLength(0);
      expect(state.prices).toHaveLength(0);
      await page.getByRole("button", { name: /Cost a dessert/ }).click();
      await expect(
        page.getByRole("button", { name: "Create a recipe", exact: true }),
      ).toBeVisible();
    } else {
      expect(state.recipes.length).toBeGreaterThan(0);
      await page.getByRole("button", { name: /Cost a dessert/ }).click();
      const recipe =
        state.recipes.find(
          (v: any) =>
            v.recipe.name.toLowerCase().includes("brownie") &&
            v.recipe.isSellable !== false,
        )?.recipe ??
        state.recipes.find((v: any) => v.recipe.isSellable !== false).recipe;
      await page.getByLabel("Choose a product").selectOption(recipe.id);
      await expect(page.locator(".price-legend")).toContainText("Ingredients");
      await page.getByLabel("Test selling price (£)").fill("6.95");
      await expect(page.locator(".price-heading")).toContainText("£6.95");
    }
    await navigate(page, "Home");
    await page.getByRole("button", { name: /Plan my business/ }).click();
    await expect(
      page.getByRole("button", { name: "Add expense", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add expense", exact: true })
      .click();
    await page
      .getByLabel("Expense name", { exact: true })
      .last()
      .fill("First-use acceptance bill");
    await page
      .getByLabel("Expense amount (£)", { exact: true })
      .last()
      .fill("625");
    await expect(page.locator(".save-status")).toContainText("Saved");
    await navigate(page, "Money");
    const overview = await (
      await page.request.get("/api/financial/overview")
    ).json();
    expect(overview.knownMonthlyCosts).not.toBeNull();
    expect(overview.runningCosts["First-use acceptance bill"]).toBe(625);
    await expect(page.locator(".financial-cards")).not.toContainText(
      "Add your first bill",
    );
    expect(await (await page.request.get("/api/state")).json()).toEqual(state);
    expect(
      await (await page.request.get("/api/inventory/state")).json(),
    ).toEqual(stock);
    const after = await (await page.request.get("/api/business")).json();
    expect(after.expenses.slice(0, -1)).toEqual(business.expenses);
    expect(after.products).toEqual(business.products);
    const afterHistory = await (
      await page.request.get("/api/business/history")
    ).json();
    for (const old of history) expect(afterHistory).toContainEqual(old);
  });
