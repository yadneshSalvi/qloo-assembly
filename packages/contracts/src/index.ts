export type Lifecycle = 'DRAFT' | 'RESEARCHING' | 'CONCEPT_READY' | 'VALIDATION_OPEN' | 'CONFIRMED' | 'BOOKING_OPEN' | 'READY' | 'LIVE' | 'COMPLETED';
export type Origin = 'QLOO_RESULT' | 'OPERATOR_ASSERTION' | 'APP_CALCULATION' | 'MODEL_HYPOTHESIS' | 'HUMAN_CHOICE' | 'AUTHORED_SAMPLE';
export interface Venue {
  id: string; name: string; neighborhood: string; address: string; timezone: string; capacity: number;
  soundLimitDb: number; curfew: string; access: string; availability: 'AVAILABLE' | 'UNCONFIRMED';
  confirmedAt: string; validUntil: string; source: string;
}
export interface Brief {
  ambition: string; date: string; doors: string; end: string; budgetMinor: number; ticketPriceMinor: number;
  audience: string; anchors: string[]; notes: string;
}
export interface Concept {
  id: string; number: string; title: string; subtitle: string; category: string; description: string;
  color: string; art: 'blue-hour' | 'night-garden' | 'soft-signal';
  fixedCostMinor: number; variableCostMinor: number; ticketPriceMinor: number;
  ingredients: string[]; rationale: string; evidenceIds: string[]; supplierIds: string[];
}
export interface Supplier {
  id: string; name: string; discipline: string; initials: string; feeMinor: number; description: string;
  status: 'QUOTED' | 'CONFIRMED' | 'UNAVAILABLE'; critical: boolean; confirmedAt: string | null;
  source: string; influence: string; scope: string; token: string;
}
export interface Requirement { id: string; label: string; detail: string; confirmed: boolean; proof: string | null; }
export interface Terms {
  version: number; title: string; date: string; doors: string; end: string; venue: string; address: string;
  priceMinor: number; currency: 'GBP'; program: string; access: string; conditional: boolean;
  notice: string; hash: string;
}
export interface Commitment {
  id: string; displayName: string; emailMasked: string; token: string; quantity: number; termsVersion: number;
  status: 'PENDING' | 'VERIFIED' | 'WITHDRAWN' | 'RECONFIRM_REQUIRED'; createdAt: string; verifiedAt: string | null;
}
export interface Booking { id: string; commitmentId: string; displayName: string; quantity: number; termsVersion: number; status: 'CONFIRMED' | 'RECONFIRM_REQUIRED' | 'CANCELLED'; checkedIn: boolean; createdAt: string; }
export interface ProductionTask { id: string; label: string; owner: string; due: string; done: boolean; evidence: string | null; dependencyIds: string[]; }
export interface RunOfShowItem { id: string; time: string; title: string; detail: string; owner: string; }
export interface Approval { id: string; action: string; termsVersion: number; payloadHash: string; approvedAt: string; actor: string; }
export interface Evidence { id: string; title: string; origin: Origin; body: string; source: string; capturedAt: string; boundary: string; }
export interface AuditEntry { id: string; action: string; description: string; at: string; version: number; }
export interface ChangeRequest {
  id: string; status: 'PROPOSED' | 'APPROVED'; reason: string; supplierId: string; replacementId: string;
  before: string; after: string; costDeltaMinor: number; expectedTermsVersion: number; affectedCommitments: number;
  affectedBookings: number; createdAt: string; approvedAt: string | null;
}
export interface ResearchRun { id: string; status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED'; stage: string; mode: 'SAMPLE' | 'LIVE'; milestones: { label: string; at: string }[]; error: string | null; }
export interface EventRecord {
  id: string; slug: string; title: string; lifecycle: Lifecycle; termsVersion: number; selectedConceptId: string | null;
  bookingPaused: boolean; operationalRisk: 'CLEAR' | 'SUPPLIER_LOSS'; publishedAt: string | null;
}
export interface Workspace {
  id: string; version: number; mode: 'SAMPLE'; createdAt: string; expiresAt: string; event: EventRecord;
  venue: Venue; brief: Brief; concepts: Concept[]; suppliers: Supplier[]; requirements: Requirement[]; terms: Terms;
  commitments: Commitment[]; bookings: Booking[]; tasks: ProductionTask[]; runOfShow: RunOfShowItem[];
  approvals: Approval[]; evidence: Evidence[]; audit: AuditEntry[]; change: ChangeRequest | null; run: ResearchRun | null;
  qloo: { status: 'UNAVAILABLE' | 'CONFIGURED' | 'LIVE'; message: string; lastCheckedAt: string | null };
}
export interface Counts { interested: number; pending: number; verified: number; reconfirmRequired: number; bookings: number; checkins: number; remaining: number; }
export type ActionType = 'SAVE_BRIEF' | 'SAVE_VENUE' | 'CONFIRM_AVAILABILITY' | 'RESEARCH' | 'SELECT_CONCEPT' | 'PUBLISH' | 'CONFIRM_SUPPLIER' | 'CONFIRM_REQUIREMENT' | 'GREENLIGHT' | 'OPEN_BOOKING' | 'EXPRESS_INTEREST' | 'VERIFY_INTEREST' | 'WITHDRAW_INTEREST' | 'BOOK' | 'CHECK_IN' | 'COMPLETE_TASK' | 'DISRUPT' | 'APPROVE_CHANGE' | 'RECONFIRM' | 'RESUME_BOOKING' | 'MARK_READY' | 'START_EVENT' | 'COMPLETE_EVENT';
export interface ActionRequest { type: ActionType; expectedVersion: number; idempotencyKey: string; payload: Record<string, unknown>; }
export interface ActionResult { workspace: Workspace; message: string; token?: string; }
export type ErrorCode = 'validation' | 'stale_version' | 'forbidden' | 'capacity' | 'dependency' | 'upstream' | 'not_found';
export interface ApiError { error: { code: ErrorCode; message: string; details?: string[]; currentVersion?: number }; }
export const formatMoney = (minor: number, currency = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
export function countsFor(w: Workspace): Counts {
  const sum = <T extends { quantity: number }>(items: T[]) => items.reduce((n, i) => n + i.quantity, 0);
  const active = w.commitments.filter(c => c.status !== 'WITHDRAWN');
  const bookings = w.bookings.filter(b => b.status !== 'CANCELLED');
  return { interested: sum(active), pending: sum(active.filter(c => c.status === 'PENDING')), verified: sum(active.filter(c => c.status === 'VERIFIED' && c.termsVersion === w.terms.version)), reconfirmRequired: sum(active.filter(c => c.status === 'RECONFIRM_REQUIRED')), bookings: sum(bookings.filter(b => b.status === 'CONFIRMED')), checkins: sum(bookings.filter(b => b.checkedIn)), remaining: Math.max(0, w.venue.capacity - sum(bookings)) };
}
export function selectedConcept(w: Workspace): Concept | undefined { return w.concepts.find(c => c.id === w.event.selectedConceptId); }
export function costWorksheet(w: Workspace) {
  const c = selectedConcept(w);
  const delta = w.change?.status === 'APPROVED' ? w.change.costDeltaMinor : 0;
  const fixed = (c?.fixedCostMinor ?? 78000) + delta;
  const variable = c?.variableCostMinor ?? 800;
  const price = w.terms.priceMinor;
  return { fixed, variable, total: fixed + variable * w.venue.capacity, maximumIncome: price * w.venue.capacity, breakEven: price > variable ? Math.ceil(fixed / (price - variable)) : null, headroom: w.brief.budgetMinor - (fixed + variable * w.venue.capacity) };
}
