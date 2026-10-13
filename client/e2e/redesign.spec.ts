import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";

for (const width of [1440, 390])
  test(`redesign navigation, light surfaces, accessibility and quick tasks ${width}`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const failures: unknown[] = [];
    async function review(name: string) {
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
      const result = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      failures.push(
        ...result.violations.map((v) => ({
          page: name,
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
      );
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `test-results/redesign-${name}-${width}.png`,
        fullPage: true,
      });
    }
    await expect(page.locator(".sidebar nav button")).toHaveText([
      "Home",
      "Recipes",
      "Stock",
      "Money",
    ]);
    await expect(page.locator(".main-shell")).toHaveCSS(
      "background-color",
      "rgb(25, 21, 34)",
    );
    await expect(page.locator(".task-card").first()).toHaveCSS(
      "background-color",
      "rgb(243, 240, 245)",
    );
    await page.locator(".skip-link").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
    await page.evaluate(() =>
      document.documentElement.style.setProperty(
        "--brand-plum",
        "rgb(70, 32, 80)",
      ),
    );
    await expect(page.locator(".sidebar nav button.active")).toHaveCSS(
      "background-color",
      "rgb(70, 32, 80)",
    );
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("--brand-plum"),
    );
    await review("home");
    await page.getByRole("button", { name: /Add ingredient Supplier/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await review("ingredient");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await review("ingredients");
    await page.locator(".table-link").first().click();
    await review("ingredient-edit");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Update Price" }).first().click();
    await review("price");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await page.getByRole("button", { name: "Suppliers", exact: true }).click();
    await review("suppliers");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await navigate(page, "Recipes");
    await review("recipes");
    await page.locator(".recipe-card").first().click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Preparation method", exact: true }),
    ).toBeVisible();
    await review("recipe");
    await page
      .getByRole("button", { name: "Edit Recipe", exact: true })
      .click();
    await review("recipe-edit");
    await navigate(page, "Stock");
    await review("stock");
    await navigate(page, "Home");
    await page.getByRole("button", { name: /Record purchase Put/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await review("purchase");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await navigate(page, "Home");
    await page.getByRole("button", { name: /Make a batch From/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await review("production");
    await page.getByRole("button", { name: "Close dialog" }).click();
    await navigate(page, "Money");
    await review("money");
    await expect(
      page.getByRole("button", { name: "Save scenario", exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".planner-quick-results")).toBeInViewport();
    await page
      .getByRole("button", { name: "Financial glossary", exact: true })
      .click();
    await review("money-advanced");
    await navigate(page, "Stock");
    for (const tab of ["Overview", "Stocktake", "Shopping Lists", "Waste"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await review("stock-" + tab.toLowerCase().replaceAll(" ", "-"));
    }
    if (
      !(await page
        .getByRole("button", { name: "Settings & backups", exact: true })
        .isVisible())
    )
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("button", { name: "Settings & backups", exact: true })
      .click();
    await review("settings");
    if (
      !(await page
        .getByRole("button", { name: "Lock kitchen", exact: true })
        .isVisible())
    )
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    await page
      .getByRole("button", { name: "Lock kitchen", exact: true })
      .click();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await review("login");
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });

test("one ingredient workflow creates a supplier and VAT-aware quote with retained draft", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: /Add ingredient Supplier/ }).click();
  const name = `Combined ingredient ${Date.now()}`;
  await page.getByLabel("Ingredient name").fill(name);
  await page.getByLabel("Supplier", { exact: true }).selectOption("new");
  await page.getByLabel("New supplier name").fill(name + " supplier");
  await page.getByLabel("Pack size").fill("2");
  await page.getByLabel("Unit", { exact: true }).selectOption("kg");
  await page.getByLabel("Purchase price (£)").fill("12");
  await page
    .getByText("VAT, effective date & price source", { exact: true })
    .click();
  await page.getByLabel("VAT rate (%)").fill("20");
  await page.getByLabel("Recover input VAT in costing").check();
  await expect(
    page.getByText(/£5.00\/kg · 50p\/100g after VAT treatment/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await navigate(page, "Home");
  await page.getByRole("button", { name: /Add ingredient Supplier/ }).click();
  await expect(page.getByLabel("Ingredient name")).toHaveValue(name);
  await page
    .getByRole("button", { name: "Add ingredient & price", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const state = await (await page.request.get("/api/state")).json();
  const ingredient = state.ingredients.find(
    (i: { name: string }) => i.name === name,
  );
  expect(ingredient.baseUnit).toBe("g");
  const prices = state.prices.filter(
    (p: { ingredientId: string }) => p.ingredientId === ingredient.id,
  );
  expect(prices).toHaveLength(1);
  expect(
    state.suppliers.find((s: { id: string }) => s.id === prices[0].supplierId)
      .name,
  ).toBe(name + " supplier");
});
