import type { AllergenAssessment, Ingredient, Supplier } from "./types";
export type Location = { id: string; name: string; mode: string };
export type Lot = {
  id: string;
  kind: string;
  itemId: string;
  name: string;
  unit: string;
  recipeVersion: number | null;
  operationId: string;
  batchReference: string;
  receivedOn: string;
  useBy: string | null;
  dateReviewed: boolean;
  dateEvidence: string;
  initialQuantity: number;
  unitCost: number;
  allergenSnapshot?: AllergenAssessment;
  ingredientSnapshot?: Ingredient;
  supplierSnapshot?: Supplier;
};
export type Movement = {
  sequence: number;
  operationId: string;
  lotId: string;
  locationId: string;
  type: string;
  quantity: number;
  unit: string;
  value: number;
  occurredOn: string;
  recordedAt: string;
  actor: string;
  notes: string;
};
export type Allocation = {
  lotId: string;
  batchReference: string;
  item: string;
  unit: string;
  quantity: number;
  unitCost: number;
  cost: number;
};
export type ProductionResult = {
  batchId: string;
  recipeId: string;
  version: number;
  plannedYield: number;
  actualYield: number;
  unit: string;
  mode: string;
  estimatedRecipeCost: number;
  materialCost: number;
  labourCost: number;
  otherCost: number;
  batchCost: number;
  unitCost: number;
  finishedLotId: string | null;
  allocations: Allocation[];
  operator: string;
  notes: string;
};
export type Operation = {
  id: string;
  type: string;
  recordedAt: string;
  actor: string;
  body: Record<string, unknown>;
  result: unknown;
  reverses: string | null;
};
export type Balance = {
  lot: Lot;
  location: Location;
  quantity: number;
  usable: number;
  value: number;
  status: string;
  allergenReviewRequired: boolean;
};
export type Snapshot = {
  id: string;
  locationId: string;
  category: string;
  recordedAt: string;
  lines: { lotId: string; quantity: number; lastSequence: number }[];
};
export type InventoryState = {
  locations: Location[];
  balances: Balance[];
  lots: Lot[];
  movements: Movement[];
  operations: Operation[];
  stocktakes: Snapshot[];
  summaries: {
    locationId: string;
    physicalValue: number;
    wasteValue: number;
    wasteByReason: Record<string, number>;
  }[];
  valuationMethod: string;
};
export type DateReview = {
  useBy: string | null;
  dateReviewed: boolean;
  dateEvidence: string;
};
export type PurchaseLine = DateReview & {
  ingredientId: string;
  packs: number;
  packSize: number;
  unit: string;
  packPrice: number;
  vatRate: number;
  priceIncludesVat: boolean;
  recoverVat: boolean;
  packLabel: string;
  packsPerCase: number;
  batchReference: string;
};
export type Purchase = {
  operationId: string;
  supplierId: string;
  locationId: string;
  date: string;
  lines: PurchaseLine[];
  reference: string;
  notes: string;
};
export type Usage = { key: string; quantity: number; lotId?: string };
export type Production = DateReview & {
  operationId: string;
  recipeId: string;
  version: number;
  plannedYield: number;
  actualYield: number;
  locationId: string;
  destinationId: string;
  date: string;
  batchReference: string;
  heldRecipeIds: string[];
  actualUsage: Usage[] | null;
  extraWastePercent: number;
  labourCost: number;
  otherCost: number;
  mode: string;
  operator: string;
  notes: string;
};
export type Requirement = {
  key: string;
  kind: string;
  itemId: string;
  version: number | null;
  name: string;
  unit: string;
  quantity: number;
};
export type ProductionPreview = {
  requirements: {
    requirement: Requirement;
    available: number;
    shortage: number;
  }[];
  allocations: Allocation[];
  estimatedRecipeCost: number;
  actualMaterialCost: number;
  canProduce: boolean;
};
export type Action = {
  operationId: string;
  lotId: string;
  locationId: string;
  quantity: number;
  reason: string;
  notes: string;
  destinationId: string;
  date: string;
};
export type Count = {
  operationId: string;
  snapshotId: string;
  counts: { lotId: string; quantity: number; reason: string }[];
  notes: string;
};
export type Plan = {
  recipeId: string;
  version: number;
  quantity: number;
  heldRecipeIds?: string[];
};
export type Shopping = {
  locationId: string;
  plans: Plan[];
  packOverrides: Record<string, number>;
  notes: string;
};
export type ShoppingRow = {
  key: string;
  itemId: string;
  name: string;
  unit: string;
  required: number;
  available: number;
  shortfall: number;
  packSize: number | null;
  suggestedPacks: number | null;
  selectedPacks: number | null;
  purchaseQuantity: number | null;
  supplier: string;
  estimatedCost: number | null;
  illustrative: boolean;
};
