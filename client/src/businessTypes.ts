import type { Recipe, RecipeLine, Scenario } from "./types";
export type Tariff = {
  rateConfigured?: boolean | null;
  kind: string;
  pencePerUnit: number;
  standingPenceDaily: number;
  vatPercent: number;
  includesVat: boolean;
};
export type Equipment = {
  id: string;
  name: string;
  fuel: string;
  kw: number;
  loadPercent: number;
};
export type BusinessExpense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  period: string;
  attribution: string;
  vatPercent: number;
  includesVat: boolean;
};
export type Channel = {
  commissionConfigured?: boolean | null;
  id: string;
  name: string;
  commissionPercent: number;
  feeVatPercent: number;
  chargePerUnit: number;
  commissionBasis: string;
};
export type ProductPlan = {
  energyConfirmed?: boolean | null;
  recipeId: string;
  channels: { channelId: string; price: number; monthlyUnits: number }[];
  outputVatPercent: number;
  vatTreatment: string;
  inputRecoveryPercent: number;
  equipment: { equipmentId: string; minutes: number }[] | null;
  waterLitresPerBatch: number;
  labourBasis: string;
  labourMinutesPerBatch: number;
};
export type Business = {
  forecast?: Scenario | null;
  forecastShares?: Record<string, number> | null;
  forecastReviewed?: boolean;
  itemsPerOrder?: number;
  directLabourPerOrder?: number;
  id: string;
  revision: number;
  name: string;
  effectiveFrom: string;
  vatRegistered: boolean;
  inputRecoveryPercent: number;
  allocationMethod: string;
  utilities: Tariff[];
  equipment: Equipment[];
  expenses: BusinessExpense[];
  channels: Channel[];
  products: ProductPlan[];
  staffHoursWeekly: number;
  staffHourlyRate: number;
  employerPercent: number;
  ownerHoursWeekly: number;
  ownerHourlyRate: number;
};
export type Experiment = {
  recipeId: string;
  portionFactor: number;
  lines: RecipeLine[] | null;
};
export type ProfitInput = {
  asOf: string;
  settings: Business;
  experiments: Experiment[];
};
export type ProductResult = {
  recipeId: string;
  recipeVersion: number;
  name: string;
  channelId: string;
  channel: string;
  monthlyUnits: number;
  grossPrice: number;
  outputVat: number;
  netSales: number;
  ingredients: number;
  packaging: number;
  energy: number;
  labour: number;
  otherVariable: number;
  platformFees: number;
  contribution: number;
  contributionMargin: number;
  allocatedOverheads: number | null;
  operatingProfit: number | null;
  profitMargin: number | null;
  ownerDirect: number;
  afterOwner: number | null;
  sources: string[];
  warnings: string[];
};
export type ProfitReport = {
  asOf: string;
  settingsRevision: number;
  allocationMethod: string;
  products: ProductResult[];
  monthlyUnits: number;
  monthlyNetSales: number;
  monthlyContribution: number;
  monthlyFixedCosts: number;
  unallocatedOverheads: number;
  monthlyOperatingProfit: number;
  monthlyOwnerCompensation: number;
  monthlyAfterOwner: number;
  breakEvenUnits: number | null;
  fixedBreakdown: Record<string, number>;
  warnings: string[];
};
export type ProfitScenario = {
  id: string;
  revision: number;
  name: string;
  input: ProfitInput;
  result: ProfitReport;
  recordedAt: string;
};
export type ProfitContext = {
  settings: Business;
  recipes: Recipe[];
  report: ProfitReport;
  scenarios: ProfitScenario[];
  actualBatches: {
    id: string;
    recordedAt: string;
    body: { recipeId: string; version: number };
    result: {
      actualYield: number;
      materialCost: number | null;
      batchCost: number | null;
      unitCost: number | null;
      valuationStatus: string;
    };
  }[];
};
export const productPlan = (r: Recipe, b: Business): ProductPlan =>
  b.products.find((p) => p.recipeId === r.id) ?? {
    recipeId: r.id,
    channels: b.channels.map((c) => ({
      channelId: c.id,
      price: r.sellingPrice,
      monthlyUnits: 0,
    })),
    outputVatPercent: 0,
    vatTreatment: "unconfigured",
    inputRecoveryPercent: b.vatRegistered ? b.inputRecoveryPercent : 0,
    equipment: [],
    waterLitresPerBatch: 0,
    labourBasis: "recipe",
    labourMinutesPerBatch: r.labourMinutes,
  };
