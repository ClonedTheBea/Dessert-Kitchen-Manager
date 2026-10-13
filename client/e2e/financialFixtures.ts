import { expect, type Page } from "@playwright/test";
import { today } from "../src/api";
export async function post(page: Page, path: string, data: unknown) {
  const r = await page.request.post("/api" + path, {
    data,
    headers: { "X-Kitchen-Request": "1" },
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
export async function seedForecast(page: Page) {
  const state = await (await page.request.get("/api/state")).json();
  const f =
    state.scenarios.find((s: any) => s.id === "baseline") ?? state.scenarios[0];
  const b = await (await page.request.get("/api/business")).json();
  return post(page, "/business", {
    ...b,
    effectiveFrom: today(),
    forecast: f,
    forecastReviewed: true,
    forecastShares: { uber: 100 },
    itemsPerOrder: 1,
    directLabourPerOrder: 0,
    vatRegistered: f.vatRegistered,
    inputRecoveryPercent: f.recoverCommissionVat ? 100 : 0,
    staffHoursWeekly: f.staffHoursWeekly ?? 0,
    staffHourlyRate: f.staffHourlyRate ?? 0,
    employerPercent: f.employerCostPercent ?? 0,
    ownerHoursWeekly: f.ownerHoursWeekly,
    ownerHourlyRate: f.ownerHourlyRate,
    expenses: f.expenses.map((e: any, i: number) => ({
      id: "forecast-" + i,
      name: e.name,
      category: "Other",
      amount: e.monthlyAmount,
      period: "monthly",
      attribution: "overhead",
      vatPercent: 0,
      includesVat: true,
    })),
    utilities: b.utilities.map((u: any) => ({ ...u, standingPenceDaily: 0 })),
    channels: [
      {
        id: "direct",
        name: "Direct",
        commissionPercent: 0,
        feeVatPercent: 0,
        chargePerUnit: 0,
        commissionBasis: "gross",
        commissionConfigured: true,
      },
      {
        id: "uber",
        name: "Uber Eats",
        commissionPercent: f.commissionPercent,
        feeVatPercent: f.commissionVatPercent,
        chargePerUnit: 0,
        commissionBasis: "gross",
        commissionConfigured: true,
      },
      {
        id: "deliveroo",
        name: "Deliveroo",
        commissionPercent: 30,
        feeVatPercent: 20,
        chargePerUnit: 0,
        commissionBasis: "gross",
        commissionConfigured: true,
      },
    ],
  });
}
