import { test, expect } from "@playwright/test";
import { login } from "./login";
for (const width of [1440, 390]) test(`orders use recipe categories with an older sales response ${width}`, async ({ page }) => {
  await page.setViewportSize({width,height:1000});
  await login(page);
  await page.route("**/api/sales/catalogue", async route => {
    const response = await route.fetch();
    const catalogue = await response.json();
    for (const product of catalogue.products) delete product.category;
    await route.fulfill({response,json:catalogue});
  });
  await page.getByRole("button",{name:/New Order/}).click();
  await expect(page.getByRole("button",{name:/Cheesecakes.*products/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Brownies.*products/})).toBeVisible();
  await expect(page.getByRole("button",{name:/Other.*products/})).toHaveCount(0);
  await page.getByRole("button",{name:/Cheesecakes.*products/}).click();
  await page.getByRole("button",{name:/Lemon cheesecake pot.*Add/}).click();
  await page.getByRole("button",{name:/Back to Categories/}).click();
  await page.getByRole("button",{name:/Brownies.*products/}).click();
  await page.getByRole("button",{name:/Classic chocolate brownie.*Add/}).click();
  await expect(page.locator(".running-cost-row")).toHaveCount(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
