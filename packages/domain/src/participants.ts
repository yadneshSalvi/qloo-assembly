import { createHash, randomUUID } from "node:crypto";
import {
  countsFor,
  presentConcept,
  selectedConcept,
  type Workspace,
  type PublicEventView,
  type ParticipantView,
  type SupplierView,
  type PublicActionRequest,
} from "@assembly/contracts";
import {
  ActionError,
  productionReadiness,
  supplierCurrent,
  type StoredWorkspace,
} from "./actions";
import { hashSupplierOffer } from "./seed";
import { approvedProgramSchedule, requiresTypedSchedule } from "./scheduling";
const reject = (
  message: string,
  code:
    | "validation"
    | "forbidden"
    | "stale_version"
    | "capacity"
    | "dependency"
    | "not_found" = "validation",
  status = 400,
): never => {
  throw new ActionError(code, message, status);
};
const now = () => new Date().toISOString();
export const capabilityDigest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function publicEvent(w: Workspace): PublicEventView {
  const c = selectedConcept(w);
  const copy = c ? presentConcept(c, w.suppliers, w.evidence) : null;
  const typed = requiresTypedSchedule(w),
    approved = typed ? approvedProgramSchedule(w) : null;
  const publicSchedule = typed
    ? [
        {
          id: "doors",
          time: w.terms.doors,
          title: "Doors open",
          detail: "Doors from the approved event terms.",
        },
        ...(approved ?? []).map((slot) => ({
          id: `offer-${slot.supplierId}`,
          time: slot.start,
          title: slot.name,
          detail: `${slot.start}–${slot.end}${slot.canOverlap ? " · explicitly permitted alongside other program" : ""}.`,
        })),
        {
          id: "close",
          time: w.terms.end,
          title: "Event ends",
          detail: "End time from the approved event terms.",
        },
      ].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
    : w.runOfShow.map((i) => ({
        id: i.id,
        time: i.time,
        title: i.title,
        detail: i.detail,
      }));
  return {
    id: w.event.id,
    version: w.event.publicVersion ?? 1,
    mode: w.mode,
    event: {
      slug: w.event.slug,
      title: w.event.title,
      lifecycle: w.event.lifecycle,
      bookingPaused:
        w.event.bookingPaused ||
        (["BOOKING_OPEN", "READY", "LIVE"].includes(w.event.lifecycle) &&
          productionReadiness(w).length > 0),
      publishedAt: w.event.publishedAt,
    },
    venue: {
      name: w.venue.name,
      neighborhood: w.venue.neighborhood,
      address: w.venue.address,
      capacity: w.venue.capacity,
      access: w.venue.access,
      timezone: w.venue.timezone,
    },
    concept: c
      ? {
          title: c.title,
          subtitle: c.subtitle,
          category: c.category,
          description: copy!.description,
          ingredients: copy!.ingredients,
          art: c.art,
          color: c.color,
        }
      : null,
    terms: { ...w.terms },
    counts: countsFor(w),
    runOfShow: publicSchedule,
    ...(typed ? { programSchedulePending: approved === null } : {}),
    suppliers: (c?.supplierIds ?? []).flatMap((sid) => {
      const s = w.suppliers.find((s) => s.id === sid);
      return s ? [{ name: s.name, discipline: s.discipline }] : [];
    }),
    consentNotice:
      "Confirmation records possession of your private response link. It does not verify an email address or identity. Interest does not hold a seat. Keep the response link to return from another browser; no email is sent.",
  };
}
export function participantView(
  w: Workspace,
  commitmentId: string,
): ParticipantView {
  const c = w.commitments.find((c) => c.id === commitmentId);
  if (!c) return reject("Response not found.", "not_found", 404);
  const b =
    w.bookings.find(
      (b) => b.commitmentId === c.id && b.status !== "CANCELLED",
    ) ?? w.bookings.find((b) => b.commitmentId === c.id);
  const f = w.feedback?.find((f) => f.commitmentId === c.id);
  return {
    event: publicEvent(w),
    commitment: {
      id: c.id,
      displayName: c.displayName,
      quantity: c.quantity,
      termsVersion: c.termsVersion,
      status: c.status,
      createdAt: c.createdAt,
      verifiedAt: c.verifiedAt,
    },
    booking: b
      ? {
          id: b.id,
          quantity: b.quantity,
          termsVersion: b.termsVersion,
          status: b.status,
          checkedIn: b.checkedIn,
        }
      : null,
    feedback: f
      ? { rating: f.rating, comment: f.comment, createdAt: f.createdAt }
      : null,
  };
}
export function supplierInvitationHash(w: Workspace, supplierId: string) {
  const s = w.suppliers.find((s) => s.id === supplierId);
  if (!s) return reject("Supplier not found.", "not_found", 404);
  return hashSupplierOffer(w, s);
}
export function supplierView(w: Workspace, supplierId: string): SupplierView {
  const s = w.suppliers.find((s) => s.id === supplierId);
  if (!s) return reject("Supplier not found.", "not_found", 404);
  return {
    mode: w.mode,
    requiresEnteredSchedule: requiresTypedSchedule(w),
    version: w.event.publicVersion ?? 1,
    termsHash: w.terms.hash,
    invitationHash: supplierInvitationHash(w, s.id),
    event: {
      title: w.terms.title,
      capacity: w.venue.capacity,
      soundLimitDb: w.venue.soundLimitDb,
      curfew: w.venue.curfew,
      timezone: w.venue.timezone,
      date: w.terms.date,
      doors: w.terms.doors,
      end: w.terms.end,
      venue: w.terms.venue,
      address: w.terms.address,
      access: w.terms.access,
      lifecycle: w.event.lifecycle,
    },
    supplier: {
      id: s.id,
      name: s.name,
      discipline: s.discipline,
      feeMinor: s.feeMinor,
      scope: s.scope,
      programStart: s.programStart,
      setupStart: s.setupStart,
      durationMinutes: s.durationMinutes,
      setupMinutes: s.setupMinutes,
      canOverlap: s.canOverlap,
      status:
        s.status === "CONFIRMED" && !supplierCurrent(w, s.id)
          ? "QUOTED"
          : s.status,
      validUntil: s.validUntil,
      confirmationMethod: s.confirmationMethod,
    },
  };
}
export function validatePublicRequest(r: PublicActionRequest) {
  if (
    !r ||
    typeof r !== "object" ||
    Object.keys(r).some(
      (k) =>
        ![
          "type",
          "expectedPublicVersion",
          "termsVersion",
          "termsHash",
          "idempotencyKey",
          "payload",
        ].includes(k),
    ) ||
    typeof r.idempotencyKey !== "string" ||
    r.idempotencyKey.length < 8 ||
    r.idempotencyKey.length > 120 ||
    !Number.isSafeInteger(r.expectedPublicVersion) ||
    !Number.isSafeInteger(r.termsVersion) ||
    typeof r.termsHash !== "string" ||
    !r.payload ||
    typeof r.payload !== "object" ||
    Array.isArray(r.payload)
  )
    reject("A request key, version and structured choice are required.");
}
export function assertCurrentPublic(w: Workspace, r: PublicActionRequest) {
  if (
    r.expectedPublicVersion !== (w.event.publicVersion ?? 1) ||
    r.termsVersion !== w.terms.version ||
    r.termsHash !== w.terms.hash
  )
    reject(
      "The event terms changed. Read the current terms before confirming.",
      "stale_version",
      409,
    );
}
export function recordParticipantAction(
  stored: StoredWorkspace,
  commitmentId: string,
  r: PublicActionRequest,
): string {
  validatePublicRequest(r);
  const w = stored.workspace,
    c = w.commitments.find((c) => c.id === commitmentId);
  if (!c) return reject("Response not found.", "not_found", 404);
  if (r.type !== "WITHDRAW" && r.type !== "SUBMIT_FEEDBACK")
    assertCurrentPublic(w, r);
  if (
    ![
      "CONFIRM",
      "RECONFIRM",
      "WITHDRAW",
      "FREE_BOOK",
      "SUBMIT_FEEDBACK",
    ].includes(r.type)
  )
    reject("This response link does not allow that action.", "forbidden", 403);
  const p = r.payload;
  if (["CONFIRM", "RECONFIRM"].includes(r.type)) {
    if (p.consent !== true || Object.keys(p).some((k) => k !== "consent"))
      reject("Accept the exact current terms to confirm.");
  } else if (r.type !== "SUBMIT_FEEDBACK" && Object.keys(p).length)
    reject("Unsupported response fields.");
  if (
    ["CANCELLED", "COMPLETED"].includes(w.event.lifecycle) &&
    !["WITHDRAW", "SUBMIT_FEEDBACK"].includes(r.type)
  )
    reject("This event is no longer accepting choices.", "dependency", 422);
  let message = "Choice saved.";
  if (r.type === "WITHDRAW") {
    c.status = "WITHDRAWN";
    for (const b of w.bookings.filter((b) => b.commitmentId === c.id)) {
      b.status = "CANCELLED";
      b.checkedIn = false;
    }
    message = "Choice withdrawn and any held seats released.";
  } else if (r.type === "CONFIRM" || r.type === "RECONFIRM") {
    if (c.status === "WITHDRAWN")
      reject("This choice has been withdrawn.", "dependency", 422);
    c.status = "VERIFIED";
    c.termsVersion = w.terms.version;
    c.verifiedAt = now();
    for (const b of w.bookings.filter(
      (b) => b.commitmentId === c.id && b.status === "RECONFIRM_REQUIRED",
    )) {
      b.status = "CONFIRMED";
      b.termsVersion = w.terms.version;
    }
    message = "Interest confirmed by possession of this private response link.";
  } else if (r.type === "FREE_BOOK") {
    if (w.terms.priceMinor !== 0 && w.mode === "REAL")
      reject("Only free bookings are supported.", "dependency", 422);
    if (
      w.event.lifecycle !== "BOOKING_OPEN" ||
      w.event.bookingPaused ||
      productionReadiness(w).length
    )
      reject(
        "Bookings are not currently open or operational confirmation has expired.",
        "dependency",
        422,
      );
    if (c.status !== "VERIFIED" || c.termsVersion !== w.terms.version)
      reject("Confirm the current exact terms first.", "dependency", 422);
    if (
      w.bookings.some(
        (b) => b.commitmentId === c.id && b.status !== "CANCELLED",
      )
    )
      reject("This choice already has a booking.", "validation", 409);
    if (countsFor(w).remaining < c.quantity)
      reject("There are not enough remaining places.", "capacity", 409);
    w.bookings.push({
      id: randomUUID(),
      commitmentId: c.id,
      displayName: c.displayName,
      quantity: c.quantity,
      termsVersion: w.terms.version,
      status: "CONFIRMED",
      checkedIn: false,
      createdAt: now(),
    });
    message =
      w.mode === "SAMPLE"
        ? "Sample places allocated. No real ticket or payment."
        : "Free places confirmed. No payment collected.";
  } else {
    if (w.event.lifecycle !== "COMPLETED")
      reject(
        "Feedback opens after the event is recorded as completed.",
        "dependency",
        422,
      );
    if (!w.bookings.some((b) => b.commitmentId === c.id && b.checkedIn))
      reject("Feedback requires a recorded arrival.", "dependency", 422);
    if (
      Object.keys(p).some(
        (k) => !["rating", "comment", "consent"].includes(k),
      ) ||
      !Number.isSafeInteger(p.rating) ||
      (p.rating as number) < 1 ||
      (p.rating as number) > 5 ||
      typeof p.comment !== "string" ||
      p.comment.length > 2000
    )
      reject("Give a rating from 1–5 and consent to save optional feedback.");
    if (w.feedback?.some((f) => f.commitmentId === c.id))
      reject("Feedback has already been saved.", "validation", 409);
    (w.feedback ??= []).push({
      id: randomUUID(),
      commitmentId: c.id,
      rating: p.rating as number,
      comment: (p.comment as string).trim(),
      createdAt: now(),
      origin: w.mode === "SAMPLE" ? "AUTHORED_SAMPLE" : "PARTICIPANT_RESPONSE",
    });
    message = "Optional feedback saved.";
  }
  auditParticipant(w, r.type, message);
  return message;
}
export function auditParticipant(
  w: Workspace,
  action: string,
  message: string,
) {
  w.version++;
  w.audit.push({
    id: randomUUID(),
    action,
    description: message,
    at: now(),
    version: w.version,
  });
  if (w.audit.length > 500) w.audit = w.audit.slice(-500);
}
