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
async function open(page: Page, name: string) {
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page
    .locator(".recipe-card")
    .filter({ has: page.getByRole("heading", { name, exact: true }) })
    .click();
}

test("read-only method, empty state, draft debounce, reordering and publication", async ({
  page,
}) => {
  await login(page);
  await open(page, "Belgian waffle");
  await expect(
    page.getByText("No preparation method yet.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Recipe name", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add Method", exact: true }).click();
  let writes = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && r.url().endsWith("/drafts/recipe/waffle"))
      writes++;
  });
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page.getByLabel("Preparation step 1", { exact: true }).fill("Mix");
  await page
    .getByLabel("Preparation step 1", { exact: true })
    .fill("Mix the batter.");
  await page.getByRole("button", { name: "Add step", exact: true }).click();
  await page
    .getByLabel("Preparation step 2", { exact: true })
    .fill("Heat the waffle iron.");
  await expect(page.locator(".editor-save-bar .save-status")).toContainText(
    "Draft saved",
  );
  expect(writes).toBe(1);
  expect(
    (await (await page.request.get("/api/recipes/waffle/versions")).json())
      .length,
  ).toBe(1);
  await page.getByRole("button", { name: "Move step 2 up" }).click();
  await page
    .getByRole("button", { name: "Return to recipe", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Method", exact: true }).click();
  await expect(
    page.getByLabel("Preparation step 1", { exact: true }),
  ).toHaveValue("Heat the waffle iron.");
  await page.getByRole("button", { name: "Publish method & return" }).click();
  await expect(
    page.locator(".recipe-reader .method-read li").first(),
  ).toHaveText("Heat the waffle iron.");
  await expect(
    page.getByLabel("Preparation step 1", { exact: true }),
  ).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/recipes/waffle/versions")).json())
      .length,
  ).toBe(2);
  await page.screenshot({
    path: "test-results/hotfix-reader-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page
      .locator(".recipe-page")
      .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
  ).toBeTruthy();
  await page.screenshot({
    path: "test-results/hotfix-reader-mobile.png",
    fullPage: true,
  });
});

test("failed autosave, retry, rapid edits in flight and navigation flush", async ({
  page,
}) => {
  await login(page);
  await open(page, "Chocolate milkshake");
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  let fail = true;
  let slow = false;
  await page.route("**/api/drafts/recipe/milkshake", async (route) => {
    if (route.request().method() === "POST") {
      if (fail)
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Temporary test outage" }),
        });
      if (slow) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    await route.continue();
  });
  await page.getByLabel("Description", { exact: true }).fill("Retain my edits");
  await expect(
    page.getByText("Temporary test outage", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toHaveValue(
    "Retain my edits",
  );
  await page
    .getByRole("button", { name: "Return to recipe", exact: true })
    .click();
  await expect(page.getByLabel("Description", { exact: true })).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.locator(".editor-save-bar .save-status")).toContainText(
    "Draft saved",
  );
  slow = true;
  const request = page.waitForRequest(
    (r) =>
      r.method() === "POST" && r.url().endsWith("/drafts/recipe/milkshake"),
  );
  await page.getByLabel("Description", { exact: true }).fill("Earlier request");
  await request;
  await page
    .getByLabel("Description", { exact: true })
    .fill("Newest edit wins");
  await page
    .getByRole("button", { name: "Return to recipe", exact: true })
    .click();
  await expect(page.getByLabel("Description", { exact: true })).toHaveCount(0);
  const d = await (
    await page.request.get("/api/drafts/recipe/milkshake")
  ).json();
  expect(d.body.description).toBe("Newest edit wins");
  expect(
    (await (await page.request.get("/api/recipes/milkshake/versions")).json())
      .length,
  ).toBe(1);
});

test("mutable records validate, autosave, preserve conflicts and flush page navigation", async ({
  page,
}) => {
  await login(page);
  await navigate(page, "Settings");
  await page
    .getByText("Advanced: configuration history & scheduling", { exact: true })
    .click();
  await page
    .getByLabel("Business configuration name")
    .fill("Autosave navigation test");
  await navigate(page, "Ingredients");
  await expect(
    page.getByRole("button", { name: "Suppliers", exact: true }),
  ).toBeVisible();
  let s = await (await page.request.get("/api/state")).json();
  expect(
    (await (await page.request.get("/api/business")).json()).name ===
      "Autosave navigation test",
  ).toBeTruthy();
  await page.getByRole("button", { name: "Cream cheese", exact: true }).click();
  await page.getByLabel("Ingredient name").fill("");
  await expect(page.getByText("Unable to save", { exact: true })).toBeVisible();
  await page.getByLabel("Ingredient name").fill("Cream cheese");
  await page.getByLabel("Brand", { exact: true }).fill("Autosaved brand");
  await expect(page.locator(".editor-save-bar .save-status")).toContainText(
    "Saved",
  );
  s = await (await page.request.get("/api/state")).json();
  const ingredient = s.ingredients.find((i: any) => i.id === "cream-cheese");
  await post(page, "/ingredients", { ...ingredient, brand: "Other window" });
  await page.getByLabel("Brand", { exact: true }).fill("My conflicting edit");
  await expect(
    page.getByText("This record changed in another window.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Brand", { exact: true })).toHaveValue(
    "My conflicting edit",
  );
});

test("category illustrations retain dimensions across versions 1 2 3 and types", async ({
  page,
}) => {
  await login(page);
  let state = await (await page.request.get("/api/state")).json();
  let r = {
    ...state.recipes.find((v: any) => v.recipe.id === "biscoff-pot").recipe,
    id: "icon-regression",
    revision: 0,
    name: "Illustration regression",
    methodSteps: ["Mix."],
  };
  const sizes: Record<string, unknown[]> = { "1280": [], "390": [] };
  for (let version = 1; version <= 3; version++) {
    r = (
      await post(page, "/recipes", {
        ...r,
        description: "Published revision " + version,
        isSellable: version !== 2,
      })
    ).recipe;
    await page.reload();
    await page.getByRole("button", { name: "Recipes", exact: true }).click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const card = page.locator(".recipe-card").filter({
        has: page.getByRole("heading", {
          name: "Illustration regression",
          exact: true,
        }),
      });
      const art = await card.locator(".recipe-card-art").boundingBox();
      const icon = await card.locator(".recipe-initial svg").boundingBox();
      expect(icon!.width).toBe(width === 390 ? 37 : 48);
      expect(icon!.height).toBe(icon!.width);
      sizes[String(width)].push({
        artWidth: art!.width,
        artHeight: art!.height,
        iconWidth: icon!.width,
        iconHeight: icon!.height,
      });
    }
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  for (const values of Object.values(sizes)) {
    expect(values[1]).toEqual(values[0]);
    expect(values[2]).toEqual(values[0]);
  }
  await page
    .locator(".recipe-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Illustration regression",
        exact: true,
      }),
    })
    .click();
  await page.getByRole("button", { name: "View History", exact: true }).click();
  let first;
  for (const version of ["1", "2", "3"]) {
    await page.getByLabel("View published version").selectOption(version);
    const b = await page.locator(".recipe-hero").boundingBox();
    const shape = { width: b!.width, height: b!.height };
    first ??= shape;
    expect(shape).toEqual(first);
  }
});

test("draft load failure can retry without replacing the saved draft", async ({
  page,
}) => {
  await login(page);
  await open(page, "Oreo brownie");
  let fail = true;
  await page.route("**/api/drafts/recipe/oreo-brownie", async (route) => {
    if (fail && route.request().method() === "GET")
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Draft temporarily unavailable" }),
      });
    await route.continue();
  });
  await page.getByRole("button", { name: "Edit Recipe" }).click();
  await expect(
    page.getByText("Unable to load draft", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Description", { exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole("button", { name: "Retry save" }).click();
  await expect(page.getByLabel("Description", { exact: true })).toBeEnabled();
});
