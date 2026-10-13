import { expect, type Page, type BrowserContext } from "@playwright/test";
let cookies: Awaited<ReturnType<BrowserContext["cookies"]>> = [];
export async function login(page: Page) {
  if (cookies.length) await page.context().addCookies(cookies);
  await page.goto("/");
  const auth = await (await page.request.get("/api/auth")).json();
  if (!auth.authenticated) {
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
  }
  await expect(
    page.getByRole("heading", { name: "What’s cooking today?" }),
  ).toBeVisible();
  cookies = await page.context().cookies();
}

export async function navigate(page: Page, name: string) {
  if (name === "Settings") {
    const b = page.getByRole("button", {
      name: "Settings & backups",
      exact: true,
    });
    if (!(await b.isVisible()))
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    await b.click();
    await expect(page.locator(".breadcrumb strong")).toHaveText("Settings");
    return;
  }
  const primary =
    name === "Ingredients"
      ? "Recipes"
      : name === "Financial planner"
        ? "Money"
        : name === "Inventory"
          ? "Stock"
          : name === "Overview"
            ? "Home"
            : name;
  const button = page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: primary, exact: true });
  if (!(await button.isVisible()))
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await button.click();
  await expect(page.locator(".breadcrumb strong")).toHaveText(primary);
  if (name === "Ingredients")
    await page
      .getByRole("navigation", { name: "Recipe workspace" })
      .getByRole("button", { name: "Ingredients", exact: true })
      .click();
}
