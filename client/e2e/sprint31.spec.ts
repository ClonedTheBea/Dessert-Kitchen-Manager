import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { login, navigate } from "./login";
import { post } from "./financialFixtures";
import { today } from "../src/api";
const future = new Date(Date.now() + 86400000 * 10).toISOString().slice(0, 10);
test("supplier filtering and one-off new ingredient keep quotation history", async ({
  page,
}) => {
  await login(page);
  const supplier = await post(page, "/suppliers", {
    id: "",
    revision: 0,
    name: "Sprint31 One-off shop",
    contact: "",
    notes: "",
  });
  const before = await (await page.request.get("/api/state")).json();
  await navigate(page, "Inventory");
  await page
    .getByRole("navigation", { name: "Inventory views" })
    .getByRole("button", { name: "Purchases", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Record purchase / resume draft" })
    .click();
  const d = page.getByRole("dialog", { name: "Purchase draft" });
  await d.getByLabel("Supplier", { exact: true }).selectOption(supplier.id);
  await d.getByLabel("Search ingredient or packaging").fill("Cream cheese");
  await expect(
    d.getByRole("button", { name: "Cream cheese", exact: true }),
  ).toHaveCount(0);
  await d.getByRole("button", { name: "Add an item not listed" }).click();
  await d.getByLabel("Search ingredient or packaging").fill("Cream cheese");
  await d.getByRole("button", { name: "Cream cheese", exact: true }).click();
  await d.getByLabel("Actual price per pack (£)").fill("1.17");
  await d.getByRole("button", { name: "Add purchase line" }).click();
  const second = d.locator(".basket-line").nth(1);
  await second.getByRole("button", { name: "Add an item not listed" }).click();
  await second.getByRole("button", { name: "Create new ingredient" }).click();
  const setup = page.getByRole("dialog", { name: "Add ingredient & price" });
  await expect(setup.getByLabel("Add a supplier price now")).not.toBeChecked();
  await setup.getByLabel("Ingredient name").fill("Sprint31 One-off topping");
  await setup.getByLabel("Base unit").selectOption("g");
  await setup
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await expect(setup).not.toBeVisible();
  await expect(second).toContainText("Selected: Sprint31 One-off topping");
  await second.getByLabel("Quantity per pack").fill("500");
  await second.getByLabel("Actual price per pack (£)").fill("2.31");
  await d.getByRole("button", { name: "Confirm stock receipt" }).click();
  await expect(d).not.toBeVisible();
  const after = await (await page.request.get("/api/state")).json();
  expect(after.prices).toEqual(before.prices);
  const ingredient = after.ingredients.find(
    (i: any) => i.name === "Sprint31 One-off topping",
  );
  expect(ingredient.id).toBeTruthy();
  const stock = await (await page.request.get("/api/inventory/state")).json();
  const lot = stock.lots.find((l: any) => l.itemId === ingredient.id);
  expect(lot.initialQuantity).toBe(500);
  expect(lot.dateReviewed).toBe(false);
  expect(lot.supplierSnapshot.id).toBe(supplier.id);
});
for (const width of [1440, 390]) {
  test(`shared product categories preserve basket and financial breakdown ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    await page.getByRole("button", { name: /New Order/ }).click();
    await expect(
      page.getByRole("button", { name: /Cheesecakes.*products/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Lemon cheesecake pot.*Add/ }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `../artifacts/sprint31/categories-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: /Cheesecakes.*products/ }).click();
    await page
      .getByRole("button", { name: /Lemon cheesecake pot.*Add/ })
      .click();
    await page.getByRole("button", { name: /Back to Categories/ }).click();
    await page.getByRole("button", { name: /Brownies.*products/ }).click();
    await page
      .getByRole("button", { name: /Classic chocolate brownie.*Add/ })
      .click();
    await page
      .getByRole("button", { name: /Classic chocolate brownie.*Add/ })
      .click();
    await expect(page.locator(".running-cost-row")).toHaveCount(2);
    await expect(
      page
        .locator(".running-cost-row")
        .filter({ hasText: "Classic chocolate brownie" })
        .getByLabel("Quantity"),
    ).toHaveValue("2");
    await page.getByLabel("Search order products").fill("Lemon cheesecake");
    await expect(
      page.getByRole("button", { name: /Lemon cheesecake pot.*Add/ }),
    ).toBeVisible();
    await page.screenshot({
      path: `../artifacts/sprint31/basket-${width}.png`,
      fullPage: true,
    });
    await navigate(page, "Financial planner");
    await page.getByRole("button", { name: /Brownies.*products/ }).click();
    await page
      .getByRole("button", {
        name: /Classic chocolate brownie.*Price Breakdown/,
      })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "Classic chocolate brownie",
    );
    await page.getByRole("button", { name: "Close dialog" }).click();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `../artifacts/sprint31/money-${width}.png`,
      fullPage: true,
    });
  });
  test(`supplier search receipt reviews bulk confirmation and cancel ${width}`, async ({
    page,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 1000 });
    await login(page);
    const location = await post(page, "/inventory/locations", {
      id: "",
      name: `Sprint 3.1 ${width}`,
      mode: "testing",
    });
    await navigate(page, "Inventory");
    await page
      .getByLabel("Location", { exact: true })
      .selectOption(location.id);
    await page
      .getByRole("navigation", { name: "Inventory views" })
      .getByRole("button", { name: "Purchases", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record purchase / resume draft" })
      .click();
    let d = page.getByRole("dialog");
    await d
      .getByLabel("Supplier", { exact: true })
      .selectOption("sample-supplier");
    await d.getByLabel("Search ingredient or packaging").fill("Cream cheese");
    await d.getByRole("button", { name: "Cream cheese", exact: true }).click();
    await d.getByLabel("Actual price per pack (£)").fill("4.23");
    await d.getByText(/Batch reference & date review/).click();
    await expect(d.getByLabel("Review source")).toHaveValue("Product Checked");
    await expect(d.getByLabel("Dates / shelf life reviewed")).not.toBeChecked();
    await d.getByLabel("Date type").selectOption("use-by");
    await d.getByLabel("Recorded date").fill(future);
    await d.getByLabel("Dates / shelf life reviewed").check();
    await d.getByRole("button", { name: "Add purchase line" }).click();
    const line = d.locator(".basket-line").nth(1);
    await line.getByLabel("Search ingredient or packaging").fill("Butter");
    await line
      .getByRole("button", { name: "Unsalted butter", exact: true })
      .click();
    await line.getByText(/Batch reference & date review/).click();
    await line.getByLabel("Date type").selectOption("best-before");
    await line.getByLabel("Recorded date").fill(future);
    await line
      .getByLabel("Supplier batch / lot reference")
      .fill(`BULK-${width}`);
    await page.screenshot({
      path: `../artifacts/sprint31/purchase-date-${width}.png`,
      fullPage: false,
    });
    await d.evaluate(el => el.scrollTop = 0);
    await page.screenshot({path:`../artifacts/sprint31/purchase-${width}.png`,fullPage:false});
    // Fail a receipt once: retain the form and entered prices, then retry safely.
    await page.route(
      "**/api/inventory/confirm/purchase/current",
      (route) =>
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ error: "Test receipt failure" }),
        }),
      { times: 1 },
    );
    await d.getByRole("button", { name: "Confirm stock receipt" }).click();
    await expect(d.getByRole("alert")).toBeVisible();
    await expect(d.getByLabel("Actual price per pack (£)").first()).toHaveValue(
      "4.23",
    );
    await d.getByRole("button", { name: "Confirm stock receipt" }).click();
    await expect(d).not.toBeVisible();
    await expect(
      page.getByText(
        "Purchase received successfully. Stock and receipt totals are updated.",
      ),
    ).toBeVisible();
    let stock = await (await page.request.get("/api/inventory/state")).json();
    const lots = stock.balances
      .filter((b: any) => b.location.id === location.id)
      .map((b: any) => b.lot);
    expect(lots).toHaveLength(2);
    expect(
      lots.find((l: any) => l.itemId === "cream-cheese").dateReviewed,
    ).toBe(true);
    expect(lots.find((l: any) => l.itemId === "butter").dateReviewed).toBe(
      false,
    );
    await page
      .getByRole("navigation", { name: "Inventory views" })
      .getByRole("button", { name: "Stock on Hand", exact: true })
      .click();
    await page
      .locator(".stock-group")
      .filter({
        has: page.getByRole("heading", {
          name: "Unsalted butter",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Manage", exact: true })
      .click();
    await page
      .getByLabel(`Select date review Unsalted butter BULK-${width}`)
      .check();
    await page
      .getByRole("button", { name: /Confirm selected date reviews/ })
      .click();
    d = page.getByRole("dialog");
    await expect(d).toContainText(future);
    await d.getByRole("checkbox").check();
    await page.screenshot({
      path: `../artifacts/sprint31/bulk-${width}.png`,
      fullPage: false,
    });
    await d
      .getByRole("button", { name: "Confirm 1 eligible date reviews" })
      .click();
    await expect(d).not.toBeVisible();
    stock = await (await page.request.get("/api/inventory/state")).json();
    expect(
      stock.operations.filter(
        (o: any) =>
          o.type === "date-review" &&
          o.body.lotId === lots.find((l: any) => l.itemId === "butter").id,
      ),
    ).toHaveLength(1);
    await page
      .getByRole("navigation", { name: "Inventory views" })
      .getByRole("button", { name: "Purchases", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Record purchase / resume draft" })
      .click();
    d = page.getByRole("dialog");
    await d
      .getByLabel("Supplier", { exact: true })
      .selectOption("sample-supplier");
    await d.getByLabel("Actual price per pack (£)").fill("9.99");
    page.once("dialog", (dialog) => dialog.dismiss());
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await d.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(d).not.toBeVisible();
    await page
      .getByRole("button", { name: "Record purchase / resume draft" })
      .click();
    await expect(
      page.getByRole("dialog").getByLabel("Actual price per pack (£)"),
    ).toHaveValue("0");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
  });
}
