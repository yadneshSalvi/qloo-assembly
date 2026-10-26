import {
  assessOfferSchedule,
  programScheduleFor,
  selectedConcept,
  type ProgramSlot,
  type Supplier,
  type Workspace,
} from "@assembly/contracts";
import { canonicalJson } from "./serialization";
/** Authored scenario mechanics remain separate from live or real operator offers. */
export function requiresTypedSchedule(w: Workspace): boolean {
  const concept = selectedConcept(w);
  return (
    w.mode === "REAL" ||
    concept?.origin === "MODEL_HYPOTHESIS" ||
    (w.run?.mode === "LIVE" && concept?.origin !== "AUTHORED_SAMPLE")
  );
}
export function selectedOffers(w: Workspace): Supplier[] {
  return (selectedConcept(w)?.supplierIds ?? []).flatMap((id) => {
    const offer = w.suppliers.find((s) => s.id === id);
    return offer ? [offer] : [];
  });
}
export function supplierScheduleIssues(
  w: Workspace,
  supplier: Supplier,
): string[] {
  if (!requiresTypedSchedule(w)) return [];
  const result = assessOfferSchedule([supplier], w.terms.doors, w.terms.end);
  return [
    ...result.violations,
    ...result.unresolvedProgram,
    ...result.unresolvedSetup,
  ];
}
export function scheduleMatchesOffers(
  schedule: ProgramSlot[] | undefined,
  offers: Supplier[],
): boolean {
  return (
    Array.isArray(schedule) &&
    canonicalJson(schedule) === canonicalJson(programScheduleFor(offers))
  );
}
/** Validate immutable approved slots without manufacturing or persisting new terms. */
export function approvedProgramSchedule(w: Workspace): ProgramSlot[] | null {
  const slots = w.terms.programSchedule,
    ids = selectedConcept(w)?.supplierIds ?? [];
  if (
    !Array.isArray(slots) ||
    !slots.length ||
    slots.length !== ids.length ||
    new Set(slots.map((s) => s.supplierId)).size !== slots.length
  )
    return null;
  const validTime = (time: unknown): time is string =>
    typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  if (
    slots.some(
      (slot) =>
        !ids.includes(slot.supplierId) ||
        typeof slot.name !== "string" ||
        !slot.name.trim() ||
        !validTime(slot.start) ||
        !validTime(slot.end) ||
        slot.start >= slot.end ||
        typeof slot.canOverlap !== "boolean",
    )
  )
    return null;
  const offers = slots.map((slot) => ({
    id: slot.supplierId,
    name: slot.name,
    programStart: slot.start,
    durationMinutes:
      Number(slot.end.slice(0, 2)) * 60 +
      Number(slot.end.slice(3)) -
      (Number(slot.start.slice(0, 2)) * 60 + Number(slot.start.slice(3))),
    setupMinutes: 0,
    canOverlap: slot.canOverlap,
  }));
  const check = assessOfferSchedule(offers, w.terms.doors, w.terms.end);
  return check.violations.length || check.unresolvedProgram.length
    ? null
    : slots.map((slot) => ({ ...slot }));
}
