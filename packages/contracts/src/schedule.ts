import type { ProgramSlot } from "./index";

export interface ScheduledOffer {
  id: string;
  name: string;
  programStart?: string;
  durationMinutes?: number;
  setupStart?: string;
  setupMinutes?: number;
  canOverlap?: boolean;
}
const minutes = (time: string | undefined) =>
  time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)
    ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    : null;
const clock = (value: number) =>
  `${Math.floor(value / 60)
    .toString()
    .padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;

function slot(start: string | undefined, duration: number | undefined) {
  const from = minutes(start);
  if (
    from === null ||
    !Number.isSafeInteger(duration) ||
    duration! <= 0 ||
    from + duration! >= 1440
  )
    return null;
  return { start: start!, end: clock(from + duration!) };
}
export const offerProgramSlot = (
  offer: Pick<ScheduledOffer, "programStart" | "durationMinutes">,
) => slot(offer.programStart, offer.durationMinutes);
export const offerSetupSlot = (
  offer: Pick<ScheduledOffer, "setupStart" | "setupMinutes">,
) => slot(offer.setupStart, offer.setupMinutes);

export function programScheduleFor(
  offers: readonly ScheduledOffer[],
): ProgramSlot[] {
  return offers
    .flatMap((offer) => {
      const time = offerProgramSlot(offer);
      return time
        ? [
            {
              supplierId: offer.id,
              name: offer.name,
              ...time,
              canOverlap: offer.canOverlap === true,
            },
          ]
        : [];
    })
    .sort(
      (a, b) =>
        a.start.localeCompare(b.start) ||
        a.supplierId.localeCompare(b.supplierId),
    );
}

/** Scope prose is never parsed for an agreed time; overlapping service needs an explicit choice. */
export function assessOfferSchedule(
  offers: readonly ScheduledOffer[],
  doors: string,
  end: string,
) {
  const violations: string[] = [],
    unresolvedProgram: string[] = [],
    unresolvedSetup: string[] = [];
  const open = minutes(doors),
    close = minutes(end);
  if (open === null || close === null || open >= close)
    violations.push(
      "Set valid opening and closing times for the event window.",
    );
  const slots = programScheduleFor(offers);
  for (const offer of offers) {
    const program = offerProgramSlot(offer);
    if (!offer.programStart || offer.durationMinutes === undefined)
      unresolvedProgram.push(
        `Set an exact program start and duration for ${offer.name}.`,
      );
    else if (!program)
      violations.push(`Check the program time and duration for ${offer.name}.`);
    else if (
      open !== null &&
      close !== null &&
      (minutes(program.start)! < open || minutes(program.end)! > close)
    )
      violations.push(
        `${offer.name}'s program must fit between doors and the event end.`,
      );

    if (offer.setupMinutes === undefined)
      unresolvedSetup.push(
        `Record the setup duration for ${offer.name}, including zero if none is needed.`,
      );
    else if (offer.setupMinutes > 0) {
      const setup = offerSetupSlot(offer);
      if (!offer.setupStart)
        unresolvedSetup.push(`Set an exact setup start for ${offer.name}.`);
      else if (
        !setup ||
        (program && minutes(setup.end)! > minutes(program.start)!)
      )
        violations.push(
          `${offer.name}'s setup must finish before its program starts.`,
        );
    } else if (
      !Number.isSafeInteger(offer.setupMinutes) ||
      offer.setupMinutes < 0
    )
      violations.push(`Check the setup duration for ${offer.name}.`);
  }
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i],
        b = slots[j];
      if (a.start < b.end && b.start < a.end && !a.canOverlap && !b.canOverlap)
        violations.push(
          `${a.name} and ${b.name} overlap. Choose separate times or explicitly allow a service to run alongside other program items.`,
        );
    }
  }
  return { violations, unresolvedProgram, unresolvedSetup };
}
