import { seedForecast } from "./financialFixtures";
import { test, expect, type Page } from "@playwright/test";

import { login, navigate } from "./login";
async function post(page: Page, url: string, data: unknown) {
  const r = await page.request.post("/api" + url, {
    data,
    headers: { "X-Kitchen-Request": "1" },
  });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

test("method steps, internal pricing, version history and separate variant", async ({
  page,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Recipes & Ingredients", exact: true }).click();
  await page.getByRole("button", { name: /Cheesecake biscuit base/ }).click();
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  await expect(page.getByLabel("Selling price per yield unit (£)")).toHaveCount(
    0,
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill("Buttery base, kept separate from the method.");
  await page.getByRole("button", { name: "Method", exact: true }).click();
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .getByLabel("Preparation step 1", { exact: true })
    .fill("Crush the digestive biscuits.");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .getByLabel("Preparation step 2", { exact: true })
    .fill("Melt the butter carefully.");
  await page
    .getByRole("button", { name: "Move step 2 up", exact: true })
    .click();
  await expect(
    page.getByLabel("Preparation step 1", { exact: true }),
  ).toHaveValue("Melt the butter carefully.");
  await page.getByText("Read preparation method", { exact: true }).click();
  await expect(page.locator(".method-read")).toContainText(
    "Melt the butter carefully.",
  );
  await page.getByRole("button", { name: "Publish recipe version" }).click();
  await page.getByRole("button", { name: /Cheesecake biscuit base/ }).click();
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  await expect(
    page.getByLabel("Preparation step 1", { exact: true }),
  ).toHaveValue("Melt the butter carefully.");
  await page.getByRole("button", { name: "Version history" }).click();
  await expect(page.locator(".history")).toContainText("Version 2");
  await page
    .getByRole("combobox", { name: "Recipe type", exact: true })
    .selectOption("sellable");
  await page
    .getByRole("button", { name: "Cost & pricing", exact: true })
    .click();
  await expect(
    page.getByLabel("Selling price per yield unit (£)"),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Create variant", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Recipe details", exact: true })
    .click();
  await page
    .getByLabel("Recipe name", { exact: true })
    .fill("Separately costed base variant");
  await page.getByRole("button", { name: "Publish recipe version" }).click();
  await expect(
    page.getByRole("heading", { name: "Separately costed base variant" }),
  ).toBeVisible();
  const state = await (await page.request.get("/api/state")).json();
  expect(
    state.recipes.find(
      (v: any) => v.recipe.name === "Separately costed base variant",
    ).recipe.variantOf,
  ).toBe("cheesecake-base");
  expect(
    state.recipes.find((v: any) => v.recipe.id === "cheesecake-base").recipe
      .isSellable,
  ).toBe(false);
});

test("unused supplier deletion and referenced ingredient archive/restore preserve history", async ({
  page,
}) => {
  await login(page);
  await navigate(page, "Ingredients");
  await page.getByRole("button", { name: "Suppliers", exact: true }).click();
  await page.getByLabel("Supplier name").fill("Unused UI supplier");
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: /Unused UI supplier/ }).click();
  await page.getByRole("button", { name: /Manage supplier/ }).click();
  const management = page.getByRole("dialog", {
    name: "Manage Unused UI supplier",
  });
  await expect(
    management.getByRole("button", { name: "Delete permanently" }),
  ).toBeEnabled();
  page.once("dialog", (d) => d.accept());
  await management.getByRole("button", { name: "Delete permanently" }).click();
  await expect(management).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "Your suppliers", exact: true })
    .getByRole("button", { name: "Close dialog" })
    .click();
  const row = page.getByRole("row").filter({
    has: page.getByRole("button", { name: "Cream cheese", exact: true }),
  });
  await row.getByRole("button", { name: "Manage record" }).click();
  const manage = page.getByRole("dialog", { name: "Manage Cream cheese" });
  await expect(
    manage.getByRole("button", { name: "Delete permanently" }),
  ).toBeDisabled();
  await expect(manage).toContainText("Historic recipe");
  page.once("dialog", (d) => d.accept());
  await manage.getByRole("button", { name: "Archive record" }).click();
  await expect(
    page.getByRole("button", { name: "Cream cheese", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Include archived ingredients").check();
  await page
    .getByRole("row")
    .filter({
      has: page.getByRole("button", {
        name: "Cream cheese · Archived",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Manage record" })
    .click();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Restore record", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cream cheese", exact: true }),
  ).toBeVisible();
});

test("documented allergen review, invalidation, matrix export and print", async ({
  page,
}) => {
  await login(page);
  let state = await (await page.request.get("/api/state")).json();
  const supplier = state.suppliers.find((s: any) => !s.archived);
  const profile = {
    contains: [],
    mayContain: [],
    verification: "verified",
    supplierText:
      "Rice flour: full supplier declaration; none of the UK 14 declared.",
    source: "Test specification 101",
    verifiedOn: "2026-01-01",
    crossContactNotes: "",
    reviewer: "Test reviewer",
  };
  let ingredient = await post(page, "/ingredients", {
    id: "ui-rice",
    revision: 0,
    name: "UI verified rice",
    category: "Baking",
    description: "",
    baseUnit: "g",
    brand: "",
    allergens: "",
    minimumStock: 0,
    isPackaging: false,
    allergenInfo: profile,
  });
  await post(page, "/prices", {
    id: "",
    ingredientId: ingredient.id,
    supplierId: supplier.id,
    packQuantity: 1000,
    unit: "g",
    packPrice: 2,
    vatRate: 0,
    priceIncludesVat: true,
    recoverVat: false,
    productReference: "RICE-101",
    effectiveDate: "2026-01-01",
    isIllustrative: false,
  });
  ingredient = await post(page, "/ingredients", {
    ...ingredient,
    allergenInfo: { ...profile, verifiedPriceSource: null },
  });
  const source = state.recipes.find(
    (v: any) => v.recipe.id === "brownie",
  ).recipe;
  await post(page, "/recipes", {
    ...source,
    id: "ui-rice-product",
    revision: 0,
    name: "UI allergen review product",
    lines: [
      {
        kind: "ingredient",
        referenceId: ingredient.id,
        quantity: 100,
        unit: "g",
        wastePercent: 0,
      },
    ],
    methodSteps: ["Prepare using documented controls."],
  });
  await page.reload();
  await page.getByRole("button", { name: "Recipes & Ingredients", exact: true }).click();
  await page
    .getByRole("button", { name: /UI allergen review product/ })
    .click();
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  await page.getByText("Allergens & dietary review", { exact: true }).click();
  await page
    .getByText("Document a suitability review", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Review allergen / dietary claim" })
    .selectOption("gluten-free");
  await page
    .getByLabel("Reviewer / approver", { exact: true })
    .fill("Kitchen tester");
  await page
    .getByLabel("Supplier verification record", { exact: true })
    .fill("All specifications reviewed");
  await page
    .getByLabel("Preparation and cross-contact controls", { exact: true })
    .fill("Separate validated equipment and cleaning controls");
  await page
    .getByLabel("Supporting evidence / document references", { exact: true })
    .fill("Test report 101 and cleaning validation");
  await page
    .getByLabel("Documented gluten level in food as sold (ppm)", {
      exact: true,
    })
    .fill("20");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Approve documented controls" })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Documented review approved.",
  );
  const approved = await (await page.request.get("/api/state")).json();
  expect(approved.recipeSafety["ui-rice-product"].publicClaims).toContain(
    "Gluten-free",
  );
  await page
    .getByLabel("Line 1 ingredient or sub-recipe")
    .selectOption({ label: "Plain flour" });
  await expect(
    page.getByRole("button", { name: "Approve documented controls" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Publish recipe version" }).click();
  await expect(page.getByRole("button", { name: "Publish recipe version" })).toHaveCount(0);
  state = await (await page.request.get("/api/state")).json();
  expect(state.recipeSafety["ui-rice-product"].publicClaims).toEqual([]);
  await page.getByText("Allergen filters & matrix", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Allergen restriction" })
    .selectOption("milk");
  await page
    .getByRole("combobox", { name: "Suitability filter" })
    .selectOption("review");
  await expect(
    page.getByRole("heading", { name: "UI allergen review product" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Allergen matrix & export" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export allergen CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "kitchen-allergen-matrix.csv",
  );
  await page.pdf({
    path: "test-results/allergen-matrix.pdf",
    format: "A3",
    landscape: true,
    printBackground: true,
  });
});

test("planner sections, staffing, sales-channel mix, comparisons and mobile results", async ({
  page,
}) => {
  await login(page);
  await seedForecast(page);
  await navigate(page, "Money");
  await expect(page.locator(".planner-quick-results")).toContainText("£8.44");
  await navigate(page, "Settings");
  await page.getByText("Staff and labour", { exact: true }).click();
  await page.getByLabel("Total staff hours / week", { exact: true }).fill("10");
  await page.getByLabel("Staff hourly rate (£)", { exact: true }).fill("12");
  await page
    .getByLabel("Employer cost allowance (%)", { exact: true })
    .fill("20");
  await page.getByText("Forecast assumptions", { exact: true }).click();
  await page
    .getByLabel("Uber Eats order share (%)", { exact: true })
    .fill("50");
  await page.getByLabel("Direct order share (%)", { exact: true }).fill("50");
  await expect(page.locator(".save-status")).toContainText("Saved");
  await page
    .getByText("Advanced: compare forecasts & actual production costs", {
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Prepare current forecast" }).click();
  await page.getByLabel("Compare scenario").selectOption("baseline");
  await expect(page.locator(".comparison")).toContainText("£624.00");
  await expect(page.locator(".comparison")).toContainText(
    "Break-even incl. owner",
  );
  await page.screenshot({
    path: "test-results/sprint11-planner-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  const oversized = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 15)
      .map((e) => ({
        tag: e.tagName,
        cls: e.className,
        width: e.getBoundingClientRect().width,
        right: e.getBoundingClientRect().right,
      })),
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    JSON.stringify(oversized),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/sprint11-planner-mobile.png",
    fullPage: true,
  });
});
