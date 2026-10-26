import type { Concept, Evidence } from "./index";

/** The fourth model call is reserved for one correction using already captured evidence. */
export const RESEARCH_CALL_LIMITS = { qloo: 6, model: 4 } as const;
export const DEFAULT_PROVIDER_DAILY_LIMITS = {
  qloo: { global: 24, workspace: 12 },
  model: { global: 90, workspace: 12 },
} as const;

export const CULTURAL_TYPES = [
  "artist",
  "movie",
  "book",
  "person",
  "brand",
  "place",
] as const;
export type CulturalType = (typeof CULTURAL_TYPES)[number];
export interface CatalogCandidate {
  entityId: string;
  entityType: CulturalType;
  name: string;
  disambiguation: string;
}
export interface ConfirmedAnchor extends CatalogCandidate {
  id: string;
  confirmedAt: string;
  source: "CATALOG_SELECTION" | "VERIFIED_IMPORT";
}
/** This maps an operator offer to an influence. It never identifies the offer as a Qloo entity. */
export interface SupplierInfluence {
  supplierId: string;
  entityId: string;
  entityType: CulturalType;
  name: string;
  confirmedAt: string;
}
export interface CatalogSearch {
  id: string;
  query: string;
  entityType: CulturalType;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "EMPTY" | "FAILED" | "CANCELLED";
  candidates: CatalogCandidate[];
  capturedAt: string | null;
  error: string | null;
}
export interface ResearchTrace {
  id: string;
  stage: string;
  summary: string;
  at: string;
  provider?: "qloo" | "model";
  cacheHit?: boolean;
}
export interface ResearchBudget {
  qlooUsed: number;
  qlooLimit: number;
  modelUsed: number;
  modelLimit: number;
}
/** Model choices are IDs and creative purposes; factual public copy is application-rendered. */
export interface ResearchComposition {
  format: "listening" | "conversation" | "participatory";
  inventoryIds: string[];
  culturalReferences: {
    evidenceId: string;
    entityId: string;
    purpose: "atmosphere" | "conversation" | "participation";
  }[];
}
export interface ResearchEvidence extends Evidence {
  origin: "QLOO_RESULT";
  category: CulturalType;
  entityIds: string[];
  queryFingerprint: string;
  transport: "LIVE";
  purpose: "DISCOVERY" | "SUPPLIER_INFLUENCE";
  rankings: {
    entityId: string;
    name: string;
    position: number;
    affinity: number | null;
  }[];
  candidateCoverage?: {
    requested: number;
    returned: number;
    omittedEntityIds: string[];
    inputOverlapEntityIds: string[];
  };
}
export interface ResearchState {
  anchors: ConfirmedAnchor[];
  influences: SupplierInfluence[];
  search: CatalogSearch | null;
  catalogHistory?: CatalogSearch[];
  targetTypes: CulturalType[];
  trace: ResearchTrace[];
  budget: ResearchBudget;
}
export interface ResearchInventory {
  id: string;
  role: string;
  label: string;
  feeMinor: number;
  status: "QUOTED" | "CONFIRMED" | "UNAVAILABLE";
  scope: string;
  influenceIds: string[];
  /** Explicit operator numbers. Missing data is unresolved, never inferred by a model. */
  variableCostMinor?: number;
  setupMinutes?: number;
  durationMinutes?: number;
  programStart?: string;
  setupStart?: string;
  canOverlap?: boolean;
  soundDb?: number;
  rightsConfirmed?: boolean;
  availabilityConfirmed?: boolean;
}
/** Construct with an allowlist: never serialize Workspace, supplier tokens, addresses or contacts. */
export interface ResearchSnapshot {
  workspaceId: string;
  inputHash: string;
  brief: {
    ambition: string;
    audience: string;
    notes: string;
    date: string;
    doors: string;
    end: string;
    budgetMinor: number;
    ticketPriceMinor: number;
    overheadMinor?: number;
    perGuestMinor?: number;
  };
  venue: {
    capacity: number;
    soundLimitDb: number;
    curfew: string;
    availability: "AVAILABLE" | "UNCONFIRMED";
  };
  inventory: ResearchInventory[];
  anchors: ConfirmedAnchor[];
  influences: SupplierInfluence[];
  targetTypes: CulturalType[];
}
export interface ClaimedResearchJob {
  id: string;
  workspaceId: string;
  leaseToken: string;
  attempts: number;
  inputHash: string;
  kind: "RESEARCH" | "SEARCH";
  snapshot: ResearchSnapshot;
  search?: { query: string; entityType: CulturalType };
}
export interface ResearchJobResult {
  concepts?: Concept[];
  evidence?: ResearchEvidence[];
  search?: CatalogSearch;
  trace?: ResearchTrace[];
  summary?: string;
}
export interface FeasibilityResult {
  feasible: boolean;
  violations: string[];
  unresolved: string[];
  fixedCostMinor: number;
  variableCostMinor: number;
  totalCostMinor: number;
  ticketPriceMinor: number;
  breakEven: number | null;
  maximumIncomeMinor: number;
}
