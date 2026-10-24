import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { countsFor, costWorksheet, selectedConcept, type ActionRequest, type ActionResult, type ErrorCode, type Workspace } from '@assembly/contracts';
import { hashTerms } from './seed';

export class ActionError extends Error {
  constructor(public code: ErrorCode, message: string, public status = 422, public details?: string[]) { super(message); }
}
export interface StoredWorkspace { workspace: Workspace; contactDigests: Record<string, string> }
function fail(message: string, code: ErrorCode = 'dependency', status = 422): never { throw new ActionError(code, message, status); }
const id = () => randomUUID();
const timestamp = () => new Date().toISOString();
const token = () => randomBytes(24).toString('hex');
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Expected a structured input.', 'validation', 400);
  return value as Record<string, unknown>;
};
const keys = (p: Record<string, unknown>, allowed: string[]) => { if (Object.keys(p).some(k => !allowed.includes(k))) fail('This action contains an unsupported field.', 'validation', 400); };
const text = (p: Record<string, unknown>, k: string, max = 500, min = 1): string => {
  if (typeof p[k] !== 'string' || (p[k] as string).trim().length < min || (p[k] as string).length > max) return fail(`Check ${k}.`, 'validation', 400);
  return (p[k] as string).trim();
};
const integer = (p: Record<string, unknown>, k: string, min: number, max: number): number => {
  if (!Number.isSafeInteger(p[k]) || (p[k] as number) < min || (p[k] as number) > max) return fail(`Check ${k}.`, 'validation', 400);
  return p[k] as number;
};
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const clockTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
function refreshProductionPlan(w: Workspace) {
  const concept = selectedConcept(w), kind = concept?.id ?? 'blue-hour', doors = minutes(w.brief.doors);
  const duration = kind === 'night-garden' ? 70 : kind === 'soft-signals' ? 90 : 50;
  const main = doors + 30, supper = main + duration + 10;
  const supplier = w.suppliers.find(s => s.id === concept?.supplierIds[0]);
  const supplierName = supplier?.name ?? 'Nila & The Low Lights';
  const treatment = kind === 'night-garden' ? 'short-film program & conversation' : kind === 'soft-signals' ? 'vinyl & print workshop' : 'acoustic live set';
  w.runOfShow = [
    { id: 'setup', time: clockTime(doors - 150), title: 'Set the room', detail: `${w.venue.capacity} places, clear exits, and a welcome for everyone.`, owner: 'Venue team' },
    { id: 'soundcheck', time: clockTime(doors - 60), title: kind === 'night-garden' ? 'Check picture & sound' : kind === 'soft-signals' ? 'Set up the workshop' : 'Find the right volume', detail: `Production check · sound limit ${w.venue.soundLimitDb} dB`, owner: supplierName },
    { id: 'doors', time: w.brief.doors, title: 'Doors & first conversations', detail: 'Welcome drink, check-in, and time to settle in.', owner: 'Front of house' },
    { id: 'music', time: clockTime(main), title: kind === 'night-garden' ? 'The screen comes alive' : kind === 'soft-signals' ? 'Make something together' : 'A set to settle into', detail: `${supplierName} · ${duration}-minute ${treatment}`, owner: supplierName },
    { id: 'supper', time: clockTime(supper), title: 'Pass the plates', detail: 'Seasonal plates and drinks, served together.', owner: 'Little Table' },
    { id: 'records', time: clockTime(supper + 45), title: 'A little more conversation', detail: 'A gentle close to the program.', owner: 'Venue team' },
    { id: 'close', time: w.brief.end, title: 'Until next time', detail: `Guest departure before the ${w.venue.curfew} curfew.`, owner: 'Duty manager' },
  ];
  const offsets: Record<string, number> = { room: -150, sound: -60, menu: -45, front: -30, guest: -15 };
  for (const task of w.tasks) task.due = clockTime(doors + offsets[task.id]);
  const technical = w.tasks.find(t => t.id === 'sound');
  if (technical) technical.label = kind === 'night-garden' ? 'Projection, rights & sound check' : kind === 'soft-signals' ? 'Workshop materials & record setup' : `Soundcheck under ${w.venue.soundLimitDb} dB`;
  if (supplier) supplier.scope = `Authored sample offer: ${duration}-minute ${treatment}, ${clockTime(main)}–${clockTime(main + duration)} on ${w.brief.date}. Production check ${clockTime(doors - 60)}. Maximum ${w.venue.soundLimitDb} dB. Permissions require operator confirmation.`;
  const catering = w.suppliers.find(s => s.id === 'little-table');
  if (catering) catering.scope = `Authored sample offer: seasonal plates for up to ${w.venue.capacity} guests, ${clockTime(supper)}–${clockTime(supper + 45)} on ${w.brief.date}. Confirm all allergen and access needs.`;
  const safety = w.requirements.find(r => r.id === 'safety');
  if (safety) safety.detail = `A named duty manager, ${w.venue.capacity}-person capacity, clear exits, and ${w.venue.curfew} curfew.`;
}
function invalidateProductionChecks(w: Workspace) {
  for (const supplier of w.suppliers) { if (supplier.status === 'CONFIRMED') supplier.status = 'QUOTED'; supplier.confirmedAt = null; }
  for (const requirement of w.requirements) { requirement.confirmed = false; requirement.proof = null; }
  for (const task of w.tasks) { task.done = false; task.evidence = null; }
}
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const editable = (w: Workspace) => { if (!['DRAFT', 'CONCEPT_READY'].includes(w.event.lifecycle)) fail('Published terms need an explicit change review.'); };
const approve = (w: Workspace, action: string, p: Record<string, unknown>) => {
  if (p.termsHash !== w.terms.hash) fail('These terms changed. Review the current version before approving.', 'stale_version', 409);
  w.approvals.push({ id: id(), action, termsVersion: w.terms.version, payloadHash: w.terms.hash, approvedAt: timestamp(), actor: 'Alex · sample owner' });
};
const renewTerms = (w: Workspace, changes: Partial<Workspace['terms']>) => {
  w.terms = { ...w.terms, ...changes, version: w.terms.version + 1 };
  w.terms.hash = hashTerms(w.terms); w.event.termsVersion = w.terms.version;
};
const requireFeasible = (w: Workspace) => {
  const worksheet = costWorksheet(w);
  const failures = [
    ...(w.venue.availability !== 'AVAILABLE' || Date.parse(w.venue.validUntil) <= Date.now() ? ['Reconfirm venue availability.'] : []),
    ...(!validTime(w.brief.doors) || !validTime(w.brief.end) || w.brief.doors >= w.brief.end || w.brief.end > w.venue.curfew ? ['Keep the event within the available evening and curfew.'] : []),
    ...(worksheet.headroom < 0 ? ['The production exceeds the budget.'] : []),
    ...(!selectedConcept(w) ? ['Choose a concept first.'] : []),
  ];
  if (failures.length) throw new ActionError('dependency', 'The production is not yet feasible.', 422, failures);
};

export function applyAction(stored: StoredWorkspace, request: ActionRequest): ActionResult {
  const w = stored.workspace;
  if (request.expectedVersion !== w.version) throw new ActionError('stale_version', 'This workspace changed. Refresh before trying again.', 409);
  if (w.event.lifecycle === 'COMPLETED') fail('This event is complete. Start a new sample to explore another production.');
  const p = object(request.payload);
  let message = 'Saved to this sample workspace.';
  let returnedToken: string | undefined;
  switch (request.type) {
    case 'SAVE_BRIEF': {
      keys(p, ['brief']); editable(w); const b = object(p.brief);
      keys(b, ['ambition', 'date', 'doors', 'end', 'budgetMinor', 'ticketPriceMinor', 'audience', 'anchors', 'notes']);
      const date = text(b, 'date', 10), doors = text(b, 'doors', 5), end = text(b, 'end', 5);
      if (!validDate(date) || !validTime(doors) || !validTime(end) || minutes(doors) < 150 || minutes(end) - minutes(doors) < 180) fail('Enter a valid date and a same-day program of at least three hours, with time for setup.', 'validation', 400);
      if (!Array.isArray(b.anchors) || b.anchors.length < 1 || b.anchors.length > 10 || b.anchors.some(a => typeof a !== 'string' || !a.trim() || a.length > 100)) fail('Choose one to ten cultural anchors.', 'validation', 400);
      const timingChanged = date !== w.brief.date || doors !== w.brief.doors || end !== w.brief.end;
      w.brief = { ambition: text(b, 'ambition', 1500), date, doors, end, budgetMinor: integer(b, 'budgetMinor', 0, 100_000_000), ticketPriceMinor: integer(b, 'ticketPriceMinor', 0, 100_000), audience: text(b, 'audience', 1000), anchors: (b.anchors as string[]).map(a => a.trim()), notes: text(b, 'notes', 2000, 0) };
      if (timingChanged) { invalidateProductionChecks(w); w.venue.availability = 'UNCONFIRMED'; }
      refreshProductionPlan(w); renewTerms(w, { date, doors, end, priceMinor: w.brief.ticketPriceMinor }); message = timingChanged ? 'Brief saved. Timing changed; reconfirm venue and supplier availability.' : 'Brief saved. Your terms have a new version.'; break;
    }
    case 'SAVE_VENUE': {
      keys(p, ['venue']); editable(w); const v = object(p.venue);
      keys(v, ['name', 'neighborhood', 'address', 'timezone', 'capacity', 'soundLimitDb', 'curfew', 'access', 'id', 'availability', 'confirmedAt', 'validUntil', 'source']);
      const curfew = text(v, 'curfew', 5); if (!validTime(curfew)) fail('Enter a valid curfew.', 'validation', 400);
      w.venue = { ...w.venue, name: text(v, 'name', 100), neighborhood: text(v, 'neighborhood', 100), address: text(v, 'address', 300), capacity: integer(v, 'capacity', 1, 500), soundLimitDb: integer(v, 'soundLimitDb', 0, 140), curfew, access: text(v, 'access', 1500), availability: 'UNCONFIRMED' };
      invalidateProductionChecks(w); refreshProductionPlan(w); renewTerms(w, { venue: w.venue.name, address: w.venue.address, access: w.venue.access }); message = 'Venue details updated. Reconfirm availability before greenlight.'; break;
    }
    case 'CONFIRM_AVAILABILITY':
      keys(p, []); w.venue.availability = 'AVAILABLE'; w.venue.confirmedAt = timestamp(); w.venue.validUntil = new Date(Date.now() + 86400000).toISOString(); message = 'Sample venue availability confirmed for this session.'; break;
    case 'RESEARCH': {
      keys(p, ['mode']); editable(w);
      if (p.mode !== 'SAMPLE') fail('Live research is not connected. Add the Qloo key and verify entity mappings before using live mode.', 'upstream', 503);
      if (w.run && ['QUEUED', 'RUNNING'].includes(w.run.status)) fail('Research is already running.');
      w.run = { id: id(), status: 'QUEUED', stage: 'Queued', mode: 'SAMPLE', milestones: [], error: null }; w.event.lifecycle = 'RESEARCHING'; message = 'Sample research queued. Every concept remains an authored example.'; break;
    }
    case 'SELECT_CONCEPT': {
      keys(p, ['conceptId']); editable(w); const concept = w.concepts.find(c => c.id === text(p, 'conceptId', 100)); if (!concept) fail('Run research before choosing one of its concepts.', 'not_found', 404);
      w.event.selectedConceptId = concept.id; w.event.title = concept.title;
      invalidateProductionChecks(w); refreshProductionPlan(w);
      const supplierNames = concept.supplierIds.map(sid => w.suppliers.find(s => s.id === sid)!.name);
      renewTerms(w, { title: concept.title, program: `${supplierNames.join(' · ')} — ${concept.ingredients.join(' · ')}`, priceMinor: w.brief.ticketPriceMinor }); message = 'Concept chosen. Review the exact public proposition next.'; break;
    }
    case 'PUBLISH':
      keys(p, ['termsHash']); if (w.event.lifecycle !== 'CONCEPT_READY') fail('Complete research and choose a concept first.'); requireFeasible(w); approve(w, request.type, p);
      w.event.lifecycle = 'VALIDATION_OPEN'; w.event.publishedAt = timestamp(); message = 'Conditional interest is open inside this sample.'; break;
    case 'CONFIRM_SUPPLIER': {
      keys(p, ['supplierId']); const supplier = w.suppliers.find(s => s.id === text(p, 'supplierId', 100)); if (!supplier) fail('Supplier not found.', 'not_found', 404);
      if (supplier.status === 'UNAVAILABLE') fail('An unavailable supplier must be replaced through change review.');
      supplier.status = 'CONFIRMED'; supplier.confirmedAt = timestamp(); message = 'Sample supplier terms confirmed. No real booking was made.'; break;
    }
    case 'CONFIRM_REQUIREMENT': {
      keys(p, ['requirementId', 'proof']); const requirement = w.requirements.find(r => r.id === text(p, 'requirementId', 100)); if (!requirement) fail('Requirement not found.', 'not_found', 404);
      requirement.confirmed = true; requirement.proof = text(p, 'proof', 2000, 5); message = 'Readiness evidence recorded.'; break;
    }
    case 'GREENLIGHT': {
      keys(p, ['termsHash']); if (w.event.lifecycle !== 'VALIDATION_OPEN') fail('Open validation before greenlighting the event.'); requireFeasible(w);
      const concept = selectedConcept(w)!;
      const missing = [...concept.supplierIds.filter(sid => w.suppliers.find(s => s.id === sid)?.status !== 'CONFIRMED').map(sid => `Confirm ${w.suppliers.find(s => s.id === sid)?.name ?? sid}.`), ...w.requirements.filter(r => !r.confirmed).map(r => r.label)];
      if (missing.length) throw new ActionError('dependency', 'Some production requirements are still unresolved.', 422, missing);
      approve(w, request.type, p); w.event.lifecycle = 'CONFIRMED'; message = 'Production greenlit. Interest is still separate from bookings.'; break;
    }
    case 'OPEN_BOOKING':
      keys(p, []); if (w.event.lifecycle !== 'CONFIRMED' || w.event.bookingPaused) fail('Confirm the production and resolve any pause first.');
      w.event.lifecycle = 'BOOKING_OPEN'; message = 'Sample booking is open. No payment is collected.'; break;
    case 'EXPRESS_INTEREST': {
      keys(p, ['name', 'email', 'quantity', 'consent', 'termsVersion']);
      if (!w.event.publishedAt) fail('This proposition has not been published.');
      if (p.consent !== true || p.termsVersion !== w.terms.version) fail('Accept the current exact terms before expressing interest.', 'stale_version', 409);
      const name = text(p, 'name', 100), email = text(p, 'email', 254).toLowerCase(), quantity = integer(p, 'quantity', 1, 6);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email-shaped sample contact.', 'validation', 400);
      const digest = createHash('sha256').update(w.id + ':' + email).digest('hex');
      const existing = w.commitments.find(c => stored.contactDigests[c.id] === digest && c.status !== 'WITHDRAWN');
      if (existing) fail('This contact already has an active choice. Use its existing confirmation.', 'validation', 409);
      const cid = id(), claim = token(); stored.contactDigests[cid] = digest;
      const [local, domain] = email.split('@');
      w.commitments.push({ id: cid, displayName: name, emailMasked: `${local.slice(0, 1)}•••@${domain}`, token: claim, quantity, termsVersion: w.terms.version, status: 'PENDING', createdAt: timestamp(), verifiedAt: null });
      returnedToken = claim; message = 'Interest saved as pending. Open the sample confirmation link to verify it.'; break;
    }
    case 'VERIFY_INTEREST': case 'WITHDRAW_INTEREST': case 'RECONFIRM': {
      keys(p, ['token', 'termsVersion']); const commitment = w.commitments.find(c => c.token === text(p, 'token', 100)); if (!commitment) fail('This confirmation link is not valid in this workspace.', 'not_found', 404);
      if (request.type !== 'WITHDRAW_INTEREST' && p.termsVersion !== w.terms.version) fail('Read the updated terms before confirming.', 'stale_version', 409);
      if (request.type === 'WITHDRAW_INTEREST') {
        commitment.status = 'WITHDRAWN'; for (const booking of w.bookings.filter(b => b.commitmentId === commitment.id)) booking.status = 'CANCELLED';
        message = 'Choice withdrawn and any sample seat allocation released.';
      } else {
        if (commitment.status === 'WITHDRAWN') fail('This choice was withdrawn. Submit a new choice if desired.');
        commitment.status = 'VERIFIED'; commitment.termsVersion = w.terms.version; commitment.verifiedAt = timestamp();
        for (const booking of w.bookings.filter(b => b.commitmentId === commitment.id && b.status === 'RECONFIRM_REQUIRED')) { booking.status = 'CONFIRMED'; booking.termsVersion = w.terms.version; }
        message = 'Choice verified against the current terms. No payment has been made.';
      } break;
    }
    case 'BOOK': {
      keys(p, ['commitmentId']); if (w.event.lifecycle !== 'BOOKING_OPEN' || w.event.bookingPaused) fail('Bookings are not currently open.');
      const commitment = w.commitments.find(c => c.id === text(p, 'commitmentId', 100)); if (!commitment || commitment.status !== 'VERIFIED' || commitment.termsVersion !== w.terms.version) fail('Verify this choice against the current terms first.');
      if (w.bookings.some(b => b.commitmentId === commitment.id && b.status !== 'CANCELLED')) fail('This choice already has a booking.', 'validation', 409);
      if (countsFor(w).remaining < commitment.quantity) fail('There are not enough remaining sample places.', 'capacity', 409);
      w.bookings.push({ id: id(), commitmentId: commitment.id, displayName: commitment.displayName, quantity: commitment.quantity, termsVersion: w.terms.version, status: 'CONFIRMED', checkedIn: false, createdAt: timestamp() }); message = 'Sample places allocated atomically. This is not a paid ticket.'; break;
    }
    case 'CHECK_IN': {
      keys(p, ['bookingId']); if (!['READY', 'LIVE'].includes(w.event.lifecycle) || w.event.bookingPaused) fail('Check-in opens when the event is ready.');
      const booking = w.bookings.find(b => b.id === text(p, 'bookingId', 100)); if (!booking || booking.status !== 'CONFIRMED' || booking.termsVersion !== w.terms.version) fail('A current confirmed booking is required.');
      booking.checkedIn = true; message = 'Sample arrival recorded once.'; break;
    }
    case 'COMPLETE_TASK': {
      keys(p, ['taskId', 'evidence']); if (!['CONFIRMED', 'BOOKING_OPEN', 'READY'].includes(w.event.lifecycle)) fail('Greenlight the production first.');
      const task = w.tasks.find(t => t.id === text(p, 'taskId', 100)); if (!task) fail('Task not found.', 'not_found', 404);
      if (task.dependencyIds.some(tid => !w.tasks.find(t => t.id === tid)?.done)) fail('Complete the preceding tasks first.');
      task.evidence = text(p, 'evidence', 2000, 5); task.done = true; message = 'Production task completed with evidence.'; break;
    }
    case 'DISRUPT': {
      keys(p, ['supplierId']); if (!['CONFIRMED', 'BOOKING_OPEN', 'READY'].includes(w.event.lifecycle)) fail('This recovery scenario requires a confirmed production.');
      if (w.change) fail('Finish the existing recovery before another change.');
      const supplier = w.suppliers.find(s => s.id === text(p, 'supplierId', 100));
      if (!supplier || supplier.id !== 'low-lights' || !selectedConcept(w)?.supplierIds.includes(supplier.id)) fail('This authored recovery scenario applies to the Blue hour music supplier.');
      const replacement = w.suppliers.find(s => s.id === 'sunday-people')!;
      supplier.status = 'UNAVAILABLE'; w.event.bookingPaused = true; w.event.operationalRisk = 'SUPPLIER_LOSS';
      w.change = { id: id(), status: 'PROPOSED', reason: 'The sample music supplier can no longer perform.', supplierId: supplier.id, replacementId: replacement.id, before: supplier.name, after: replacement.name, costDeltaMinor: replacement.feeMinor - supplier.feeMinor, expectedTermsVersion: w.terms.version, affectedCommitments: w.commitments.filter(c => c.status !== 'WITHDRAWN').length, affectedBookings: w.bookings.filter(b => b.status !== 'CANCELLED').length, createdAt: timestamp(), approvedAt: null };
      message = 'Bookings paused. Review the replacement and the commitments it affects.'; break;
    }
    case 'APPROVE_CHANGE': {
      keys(p, ['termsHash', 'changeId']); const change = w.change; if (!change || change.status !== 'PROPOSED' || change.expectedTermsVersion !== w.terms.version || (p.changeId !== undefined && p.changeId !== change.id)) fail('This change is no longer current.', 'stale_version', 409);
      const replacement = w.suppliers.find(s => s.id === change.replacementId)!; if (replacement.status !== 'CONFIRMED') fail('Confirm replacement availability and terms first.');
      if (costWorksheet(w).headroom < change.costDeltaMinor) fail('The replacement exceeds the approved budget.');
      approve(w, request.type, p); change.status = 'APPROVED'; change.approvedAt = timestamp();
      renewTerms(w, { program: `${replacement.name} · a seasonal supper by Little Table` });
      const concept = selectedConcept(w)!; concept.supplierIds = concept.supplierIds.map(sid => sid === change.supplierId ? change.replacementId : sid);
      w.runOfShow = w.runOfShow.map(item => item.id === 'music' ? { ...item, detail: `${replacement.name} · 50-minute live set`, owner: replacement.name } : item);
      for (const commitment of w.commitments) if (commitment.status !== 'WITHDRAWN') commitment.status = 'RECONFIRM_REQUIRED';
      for (const booking of w.bookings) if (booking.status !== 'CANCELLED') { booking.status = 'RECONFIRM_REQUIRED'; booking.checkedIn = false; }
      for (const task of w.tasks) if (['sound', 'front', 'guest'].includes(task.id)) { task.done = false; task.evidence = null; }
      w.event.lifecycle = 'BOOKING_OPEN'; message = 'Replacement approved. Affected guests must accept the changed program.'; break;
    }
    case 'RESUME_BOOKING':
      keys(p, []); if (!w.event.bookingPaused || w.change?.status !== 'APPROVED') fail('Approve the recovery before resuming.');
      if (w.commitments.some(c => c.status === 'RECONFIRM_REQUIRED') || w.bookings.some(b => b.status === 'RECONFIRM_REQUIRED')) fail('Resolve every affected commitment by reconfirmation or withdrawal first.');
      requireFeasible(w); w.event.bookingPaused = false; w.event.operationalRisk = 'CLEAR'; message = 'Booking resumed with the revised terms.'; break;
    case 'MARK_READY':
      keys(p, []); if (w.event.lifecycle !== 'BOOKING_OPEN' || w.event.bookingPaused) fail('Open bookings and resolve any pause first.');
      if (w.tasks.some(t => !t.done)) fail('Complete every production task before marking ready.'); requireFeasible(w); w.event.lifecycle = 'READY'; message = 'The sample production is ready to welcome guests.'; break;
    case 'START_EVENT':
      keys(p, []); if (w.event.lifecycle !== 'READY' || w.event.bookingPaused) fail('The production must be ready first.'); w.event.lifecycle = 'LIVE'; message = 'The sample event is underway.'; break;
    case 'COMPLETE_EVENT':
      keys(p, []); if (w.event.lifecycle !== 'LIVE') fail('Start the sample event before recording its outcome.'); w.event.lifecycle = 'COMPLETED'; message = 'Sample event completed. The outcome contains only actions from this workspace.'; break;
    default: fail('Unknown action.', 'validation', 400);
  }
  w.version++; w.audit.push({ id: id(), action: request.type, description: message, at: timestamp(), version: w.version });
  if (w.audit.length > 500) w.audit = w.audit.slice(-500);
  return { workspace: w, message, ...(returnedToken ? { token: returnedToken } : {}) };
}
