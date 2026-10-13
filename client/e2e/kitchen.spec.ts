import { seedForecast } from "./financialFixtures";
import { navigate } from "./login";
import { test, expect } from "@playwright/test";

test("owner setup, catalogue, quotes, recipe costing, versions, scenarios and backup", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const auth = await (await page.request.get("/api/auth")).json();
  if (!auth.configured) {
    await page
      .getByLabel("Choose a password")
      .fill("browser-test-kitchen-password");
    await page
      .getByLabel("Confirm password")
      .fill("browser-test-kitchen-password");
    await page.getByRole("button", { name: "Create my workspace" }).click();
  } else {
    await page
      .getByLabel("Password", { exact: true })
      .fill("browser-test-kitchen-password");
    await page.getByRole("button", { name: "Unlock kitchen" }).click();
  }
  await expect(
    page.getByRole("heading", { name: "What’s cooking today?" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/overview-desktop.png",
    fullPage: true,
  });
  await navigate(page, "Ingredients");
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page.getByLabel("Supplier name").fill("Local bakery supplier");
  await page.getByLabel("Contact / website").fill("Test supplier");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Local bakery supplier/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Add ingredient", exact: true })
    .click();
  await page.getByLabel("Ingredient name").fill("Test cream cheese");
  await page
    .getByLabel("Supplier", { exact: true })
    .selectOption({ label: "Local bakery supplier" });
  await page.getByLabel("Pack size").fill("280");
  await page.getByLabel("Purchase price (£)").fill("3.25");
  await page
    .getByRole("button", { name: "Add ingredient & price", exact: true })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("button", { name: "Test cream cheese", exact: true }),
  });
  await row.getByRole("button", { name: "Update Price" }).click();
  await page
    .getByRole("combobox", { name: "Supplier", exact: true })
    .selectOption({ label: "Local bakery supplier" });
  await page.getByLabel("Pack quantity").fill("280");
  await page.getByLabel("Pack price (£)").fill("3.25");
  await page.getByRole("button", { name: "Confirm new price" }).click();
  await page.getByText("Price history", { exact: true }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("cell", { name: "£3.25", exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: "Create a recipe" }).click();
  await page
    .getByLabel("Recipe name", { exact: true })
    .fill("First homemade cheesecake");
  await page.getByLabel("Batch yield", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Add line" }).click();
  await page
    .getByLabel("Line 1 ingredient or sub-recipe")
    .selectOption({ label: "Test cream cheese" });
  await page.getByLabel("Quantity", { exact: true }).fill("75");
  await page
    .getByRole("button", { name: "Cost & pricing", exact: true })
    .click();
  await page.getByRole("button", { name: "Calculate current costs" }).click();
  await expect(page.locator(".cost-total strong")).toHaveText("£0.87");
  await page
    .getByRole("button", { name: "Publish recipe version", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "First homemade cheesecake" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page
    .getByRole("button")
    .filter({
      has: page.getByRole("heading", { name: "First homemade cheesecake" }),
    })
    .click();
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  await page.getByText("Labour & batch scaling", { exact: true }).click();
  await page.getByLabel("Scale saved recipe to yield").fill("20");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Scale saved batch" }).click();
  await expect(page.getByLabel("Quantity", { exact: true })).toHaveValue(
    "1500",
  );
  await page.getByRole("button", { name: "Publish recipe version" }).click();
  await seedForecast(page);
  await navigate(page, "Money");
  await expect(page.locator(".planner-quick-results")).toContainText(
    "£1,550.87",
  );
  await navigate(page, "Settings");
  await page.getByText("Forecast assumptions", { exact: true }).click();
  await page
    .getByLabel("Average order value (£ including sales VAT)", { exact: true })
    .fill("25");
  await expect(page.locator(".save-status")).toContainText("Saved");
  await page
    .getByText("Advanced: compare forecasts & actual production costs", {
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Prepare current forecast" }).click();
  await page.getByLabel("Snapshot name").fill("Higher basket test");
  await page.getByRole("button", { name: "Save forecast snapshot" }).click();
  await expect(
    page.getByText("Forecast snapshot saved. Active settings unchanged."),
  ).toBeVisible();
  await page
    .getByLabel("Compare scenario")
    .selectOption({ label: "Opening plan" });
  await expect(page.locator(".comparison")).toContainText("£1,550.87");
  await navigate(page, "Money");
  await expect(page.locator(".planner-quick-results")).toContainText(
    "£2,438.33",
  );
  await page.screenshot({
    path: "test-results/planner-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Settings & backups" }).click();
  await page.getByRole("button", { name: "Backups", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download database backup" }).click();
  expect((await download).suggestedFilename()).toMatch(
    /dessert-kitchen-.*\.db/,
  );
  await page.getByRole("button", { name: "Lock kitchen" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile navigation and recipe editor fit the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page
    .getByLabel("Password", { exact: true })
    .fill("browser-test-kitchen-password");
  await page.getByRole("button", { name: "Unlock kitchen" }).click();
  await expect(
    page.getByRole("heading", { name: "What’s cooking today?" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/overview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.getByRole("button", { name: /Lemon cheesecake pot/ }).click();
  await expect(page.locator(".recipe-page")).toBeVisible();
  expect(
    await page
      .locator(".recipe-page")
      .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  await page
    .getByRole("button", { name: "Cost & pricing", exact: true })
    .click();
  await page.getByRole("button", { name: "Calculate current costs" }).click();
  await expect(page.locator(".cost-total strong")).toBeVisible();
  await page.screenshot({
    path: "test-results/recipe-mobile.png",
    fullPage: true,
  });
});
