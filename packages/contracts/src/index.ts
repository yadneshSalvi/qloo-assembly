import type {
  ResearchState,
  FeasibilityResult,
  ResearchComposition,
} from "./research";
export type Lifecycle =
  | "DRAFT"
  | "RESEARCHING"
  | "CONCEPT_READY"
  | "VALIDATION_OPEN"
  | "CONFIRMED"
  | "BOOKING_OPEN"
  | "READY"
  | "LIVE"
  | "COMPLETED"
  | "CANCELLED";
export type Origin =
  | "QLOO_RESULT"
  | "OPERATOR_ASSERTION"
  | "APP_CALCULATION"
  | "MODEL_HYPOTHESIS"
  | "HUMAN_CHOICE"
  | "AUTHORED_SAMPLE";
export interface Venue {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  timezone: string;
  capacity: number;
  soundLimitDb: number;
  curfew: string;
  access: string;
  availability: "AVAILABLE" | "UNCONFIRMED";
  confirmedAt: string;
  validUntil: string;
  source: string;
  confirmationMethod?: "AUTHORED_SAMPLE" | "OWNER_ATTESTATION";
}
export interface Brief {
  ambition: string;
  date: string;
  doors: string;
  end: string;
  overheadMinor?: number;
  perGuestMinor?: number;
  budgetMinor: number;
  ticketPriceMinor: number;
  audience: string;
  anchors: string[];
  notes: string;
}
export interface Concept {
  composition?: ResearchComposition;
  origin?: "AUTHORED_SAMPLE" | "MODEL_HYPOTHESIS";
  researchRunId?: string;
  id: string;
  number: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  color: string;
  art: "blue-hour" | "night-garden" | "soft-signal";
  feasibility?: FeasibilityResult;
  fixedCostMinor: number;
  variableCostMinor: number;
  ticketPriceMinor: number;
  ingredients: string[];
  rationale: string;
  evidenceIds: string[];
  supplierIds: string[];
}
export interface Supplier {
  id: string;
  name: string;
  discipline: string;
  initials: string;
  feeMinor: number;
  description: string;
  status: "QUOTED" | "CONFIRMED" | "UNAVAILABLE";
  critical: boolean;
  confirmedAt: string | null;
  variableCostMinor?: number;
  setupMinutes?: number;
  durationMinutes?: number;
  /** Operator-entered local times on the event date, in the venue timezone. */
  programStart?: string;
  setupStart?: string;
  /** Explicitly permits this service to run alongside another program item. */
  canOverlap?: boolean;
  soundDb?: number;
  rightsConfirmed?: boolean;
  availabilityConfirmed?: boolean;
  source: string;
  influence: string;
  scope: string;
  token: string;
  validUntil?: string;
  confirmationMethod?:
    "AUTHORED_SAMPLE" | "OWNER_ATTESTATION" | "SUPPLIER_RESPONSE";
  confirmationNote?: string;
  confirmedTermsHash?: string;
  confirmedOfferHash?: string;
}
export interface Requirement {
  id: string;
  label: string;
  detail: string;
  confirmed: boolean;
  proof: string | null;
}
export interface ProgramSlot {
  supplierId: string;
  name: string;
  start: string;
  end: string;
  canOverlap: boolean;
}
export interface Terms {
  capacity?: number;
  soundLimitDb?: number;
  curfew?: string;
  timezone?: string;
  version: number;
  title: string;
  date: string;
  doors: string;
  end: string;
  venue: string;
  address: string;
  priceMinor: number;
  currency: "GBP";
  program: string;
  /** Captured on an explicit selection or reviewed change, never backfilled on reads. */
  programSchedule?: ProgramSlot[];
  access: string;
  conditional: boolean;
  notice: string;
  hash: string;
}
export interface Commitment {
  id: string;
  displayName: string;
  emailMasked: string;
  token: string;
  quantity: number;
  termsVersion: number;
  status: "PENDING" | "VERIFIED" | "WITHDRAWN" | "RECONFIRM_REQUIRED";
  createdAt: string;
  verifiedAt: string | null;
}
export interface Booking {
  id: string;
  commitmentId: string;
  displayName: string;
  quantity: number;
  termsVersion: number;
  status: "CONFIRMED" | "RECONFIRM_REQUIRED" | "CANCELLED";
  checkedIn: boolean;
  createdAt: string;
}
export interface ProductionTask {
  id: string;
  label: string;
  owner: string;
  due: string;
  done: boolean;
  evidence: string | null;
  dependencyIds: string[];
}
export interface RunOfShowItem {
  id: string;
  time: string;
  title: string;
  detail: string;
  owner: string;
}
export interface Approval {
  id: string;
  action: string;
  termsVersion: number;
  payloadHash: string;
  approvedAt: string;
  actor: string;
}
export interface Evidence {
  id: string;
  title: string;
  origin: Origin;
  body: string;
  source: string;
  capturedAt: string;
  boundary: string;
}
export interface AuditEntry {
  id: string;
  action: string;
  description: string;
  at: string;
  version: number;
}
export interface ChangeRequest {
  id: string;
  status: "PROPOSED" | "APPROVED";
  reason: string;
  supplierId: string;
  replacementId: string;
  before: string;
  after: string;
  costDeltaMinor: number;
  expectedTermsVersion: number;
  affectedCommitments: number;
  affectedBookings: number;
  createdAt: string;
  approvedAt: string | null;
  resumeLifecycle?: Lifecycle;
  venuePatch?: Partial<
    Pick<Venue, "capacity" | "soundLimitDb" | "curfew" | "timezone">
  >;
  totalCostDeltaMinor?: number;
  /** Proposed local-time shift; applied only after exact material-change approval. */
  supplierTimingPatch?: {
    supplierId: string;
    programStart?: string;
    setupStart?: string;
  }[];
  termsPatch?: Partial<
    Pick<
      Terms,
      | "title"
      | "date"
      | "doors"
      | "end"
      | "venue"
      | "address"
      | "priceMinor"
      | "program"
      | "programSchedule"
      | "access"
    >
  >;
  diff?: { field: string; before: string; after: string }[];
  proposedHash?: string;
  hashFormat?: "canonical-json-v1";
}
export interface ResearchRun {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  stage: string;
  mode: "SAMPLE" | "LIVE";
  milestones: { label: string; at: string }[];
  error: string | null;
}
export interface EventRecord {
  id: string;
  slug: string;
  title: string;
  lifecycle: Lifecycle;
  termsVersion: number;
  selectedConceptId: string | null;
  publicVersion?: number;
  bookingPaused: boolean;
  operationalRisk: "CLEAR" | "SUPPLIER_LOSS";
  publishedAt: string | null;
}
export interface Workspace {
  id: string;
  version: number;
  mode: "SAMPLE" | "REAL";
  createdAt: string;
  expiresAt: string;
  event: EventRecord;
  venue: Venue;
  brief: Brief;
  concepts: Concept[];
  suppliers: Supplier[];
  requirements: Requirement[];
  terms: Terms;
  commitments: Commitment[];
  bookings: Booking[];
  tasks: ProductionTask[];
  runOfShow: RunOfShowItem[];
  approvals: Approval[];
  evidence: Evidence[];
  audit: AuditEntry[];
  change: ChangeRequest | null;
  run: ResearchRun | null;
  research?: ResearchState;
  feedback?: Feedback[];
  completion?: {
    evidence: string;
    observedAt: string;
    origin: "AUTHORED_SAMPLE" | "OPERATOR_ASSERTION";
  };
  qloo: {
    status: "UNAVAILABLE" | "CONFIGURED" | "LIVE";
    message: string;
    lastCheckedAt: string | null;
  };
}
export interface Counts {
  interested: number;
  pending: number;
  verified: number;
  reconfirmRequired: number;
  bookings: number;
  checkins: number;
  remaining: number;
}
export type ActionType =
  | "UPSERT_SUPPLIER"
  | "REMOVE_SUPPLIER"
  | "PROPOSE_CHANGE"
  | "CANCEL_EVENT"
  | "CANCEL_RESEARCH"
  | "SEARCH_CATALOG"
  | "SELECT_ANCHORS"
  | "SAVE_BRIEF"
  | "SAVE_VENUE"
  | "CONFIRM_AVAILABILITY"
  | "RESEARCH"
  | "SELECT_CONCEPT"
  | "PUBLISH"
  | "CONFIRM_SUPPLIER"
  | "CONFIRM_REQUIREMENT"
  | "GREENLIGHT"
  | "OPEN_BOOKING"
  | "EXPRESS_INTEREST"
  | "VERIFY_INTEREST"
  | "WITHDRAW_INTEREST"
  | "BOOK"
  | "CHECK_IN"
  | "COMPLETE_TASK"
  | "DISRUPT"
  | "APPROVE_CHANGE"
  | "RECONFIRM"
  | "RESUME_BOOKING"
  | "MARK_READY"
  | "START_EVENT"
  | "COMPLETE_EVENT";
export interface ActionRequest {
  workspaceId?: string;
  type: ActionType;
  expectedVersion: number;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}
export interface ActionResult {
  workspace: Workspace;
  message: string;
  token?: string;
}
export type ErrorCode =
  | "validation"
  | "stale_version"
  | "forbidden"
  | "capacity"
  | "dependency"
  | "upstream"
  | "not_found";
export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details?: string[];
    currentVersion?: number;
  };
}
export { composeConceptCopy, presentConcept } from "./presentation";
export {
  assessOfferSchedule,
  offerProgramSlot,
  offerSetupSlot,
  programScheduleFor,
} from "./schedule";
export type { ScheduledOffer } from "./schedule";

export const formatMoney = (minor: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
export function countsFor(w: Workspace): Counts {
  const sum = <T extends { quantity: number }>(items: T[]) =>
    items.reduce((n, i) => n + i.quantity, 0);
  const active = w.commitments.filter((c) => c.status !== "WITHDRAWN");
  const bookings = w.bookings.filter((b) => b.status !== "CANCELLED");
  return {
    interested: sum(active),
    pending: sum(active.filter((c) => c.status === "PENDING")),
    verified: sum(
      active.filter(
        (c) => c.status === "VERIFIED" && c.termsVersion === w.terms.version,
      ),
    ),
    reconfirmRequired: sum(
      active.filter((c) => c.status === "RECONFIRM_REQUIRED"),
    ),
    bookings: sum(bookings.filter((b) => b.status === "CONFIRMED")),
    checkins: sum(bookings.filter((b) => b.checkedIn)),
    remaining: Math.max(0, w.venue.capacity - sum(bookings)),
  };
}
export function selectedConcept(w: Workspace): Concept | undefined {
  return w.concepts.find((c) => c.id === w.event.selectedConceptId);
}
export function costWorksheet(w: Workspace) {
  const c = selectedConcept(w);
  const fixed =
    c?.fixedCostMinor ??
    (w.mode === "REAL"
      ? w.suppliers.reduce((n, s) => n + s.feeMinor, w.brief.overheadMinor ?? 0)
      : 78000);
  const variable =
    c?.variableCostMinor ??
    (w.mode === "REAL" ? (w.brief.perGuestMinor ?? 0) : 800);
  const price = w.terms.priceMinor;
  return {
    fixed,
    variable,
    total: fixed + variable * w.venue.capacity,
    maximumIncome: price * w.venue.capacity,
    breakEven: price > variable ? Math.ceil(fixed / (price - variable)) : null,
    headroom: w.brief.budgetMinor - (fixed + variable * w.venue.capacity),
  };
}

export interface Feedback {
  id: string;
  commitmentId: string;
  rating: number;
  comment: string;
  createdAt: string;
  origin: "AUTHORED_SAMPLE" | "PARTICIPANT_RESPONSE";
}
/** Explicit allowlists: never pass Workspace through a public HTTP response. */
export interface PublicEventView {
  id: string;
  version: number;
  mode: Workspace["mode"];
  event: Pick<
    EventRecord,
    "slug" | "title" | "lifecycle" | "bookingPaused" | "publishedAt"
  >;
  venue: Pick<
    Venue,
    "name" | "neighborhood" | "address" | "capacity" | "access" | "timezone"
  >;
  concept: Pick<
    Concept,
    | "title"
    | "subtitle"
    | "category"
    | "description"
    | "ingredients"
    | "art"
    | "color"
  > | null;
  terms: Terms;
  counts: Counts;
  runOfShow: Pick<RunOfShowItem, "id" | "time" | "title" | "detail">[];
  suppliers: Pick<Supplier, "name" | "discipline">[];
  consentNotice: string;
  programSchedulePending?: boolean;
}
export interface ParticipantView {
  event: PublicEventView;
  commitment: Pick<
    Commitment,
    | "id"
    | "displayName"
    | "quantity"
    | "termsVersion"
    | "status"
    | "createdAt"
    | "verifiedAt"
  >;
  booking: Pick<
    Booking,
    "id" | "quantity" | "termsVersion" | "status" | "checkedIn"
  > | null;
  feedback: Pick<Feedback, "rating" | "comment" | "createdAt"> | null;
}
export interface SupplierView {
  mode: Workspace["mode"];
  requiresEnteredSchedule?: boolean;
  version: number;
  termsHash: string;
  invitationHash: string;
  event: Pick<
    Terms,
    | "title"
    | "date"
    | "doors"
    | "end"
    | "venue"
    | "address"
    | "access"
    | "capacity"
    | "soundLimitDb"
    | "curfew"
    | "timezone"
  > & { lifecycle: Lifecycle };
  supplier: Pick<
    Supplier,
    | "id"
    | "name"
    | "discipline"
    | "feeMinor"
    | "scope"
    | "status"
    | "validUntil"
    | "confirmationMethod"
    | "programStart"
    | "setupStart"
    | "durationMinutes"
    | "setupMinutes"
    | "canOverlap"
  >;
}
export interface PublicActionRequest {
  type:
    | "EXPRESS_INTEREST"
    | "CONFIRM"
    | "RECONFIRM"
    | "WITHDRAW"
    | "FREE_BOOK"
    | "SUBMIT_FEEDBACK";
  expectedPublicVersion: number;
  termsVersion: number;
  termsHash: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
}
export interface SupplierActionRequest {
  type: "CONFIRM" | "DECLINE";
  expectedVersion: number;
  termsHash: string;
  invitationHash: string;
  idempotencyKey: string;
  payload: { validUntil?: string; note?: string };
}
export interface PublicActionResult {
  view: ParticipantView;
  message: string;
  token?: string;
}
export * from "./research";
