import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  CULTURAL_TYPES,
  RESEARCH_CALL_LIMITS,
  countsFor,
  costWorksheet,
  presentConcept,
  assessOfferSchedule,
  offerProgramSlot,
  offerSetupSlot,
  programScheduleFor,
  selectedConcept,
  type ActionRequest,
  type ActionResult,
  type ErrorCode,
  type Workspace,
} from "@assembly/contracts";
import { hashTerms, hashSupplierOffer } from "./seed";
import { canonicalJson } from "./serialization";
import {
  requiresTypedSchedule,
  selectedOffers,
  scheduleMatchesOffers,
  supplierScheduleIssues,
} from "./scheduling";

export class ActionError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status = 422,
    public details?: string[],
  ) {
    super(message);
  }
}
export interface StoredWorkspace {
  workspace: Workspace;
  contactDigests: Record<string, string>;
}
function fail(
  message: string,
  code: ErrorCode = "dependency",
  status = 422,
): never {
  throw new ActionError(code, message, status);
}
const id = () => randomUUID();
const timestamp = () => new Date().toISOString();
const token = () => randomBytes(24).toString("hex");
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("Expected a structured input.", "validation", 400);
  return value as Record<string, unknown>;
};
const keys = (p: Record<string, unknown>, allowed: string[]) => {
  if (Object.keys(p).some((k) => !allowed.includes(k)))
    fail("This action contains an unsupported field.", "validation", 400);
};
const text = (
  p: Record<string, unknown>,
  k: string,
  max = 500,
  min = 1,
): string => {
  if (
    typeof p[k] !== "string" ||
    (p[k] as string).trim().length < min ||
    (p[k] as string).length > max
  )
    return fail(`Check ${k}.`, "validation", 400);
  return (p[k] as string).trim();
};
const integer = (
  p: Record<string, unknown>,
  k: string,
  min: number,
  max: number,
): number => {
  if (
    !Number.isSafeInteger(p[k]) ||
    (p[k] as number) < min ||
    (p[k] as number) > max
  )
    return fail(`Check ${k}.`, "validation", 400);
  return p[k] as number;
};
const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = (value: string) =>
  Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
const clockTime = (value: number) =>
  `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
function refreshProductionPlan(w: Workspace) {
  if (requiresTypedSchedule(w)) {
    const offers = selectedOffers(w);
    const setup = offers.flatMap((offer) => {
      const slot = offerSetupSlot(offer);
      return slot
        ? [
            {
              id: `setup-${offer.id}`,
              time: slot.start,
              title: `${offer.name} setup`,
              detail: `Operator-agreed setup ${slot.start}–${slot.end}.`,
              owner: offer.name,
            },
          ]
        : [];
    });
    const program = offers.flatMap((offer) => {
      const slot = offerProgramSlot(offer);
      return slot
        ? [
            {
              id: `offer-${offer.id}`,
              time: slot.start,
              title: offer.name,
              detail: `${slot.start}–${slot.end} · ${offer.discipline}${offer.canOverlap ? " · explicitly permitted alongside other program" : ""}.`,
              owner: offer.name,
            },
          ]
        : [];
    });
    w.runOfShow = [
      {
        id: "doors",
        time: w.brief.doors,
        title: "Doors open",
        detail: "Event doors from the operator brief.",
        owner: "Operator",
      },
      ...setup,
      ...program,
      {
        id: "close",
        time: w.brief.end,
        title: "Event ends",
        detail: `Departure before ${w.venue.curfew}.`,
        owner: "Operator",
      },
    ].sort((a, b) => a.time.localeCompare(b.time) || a.id.localeCompare(b.id));
    for (const task of w.tasks) {
      task.owner = "Operator";
      task.due = "TBC";
      if (task.id === "sound")
        task.label = "Supplier technical and setup checks";
      if (task.id === "menu")
        task.label = "Supplier service and access briefing";
    }
    return;
  }
  const concept = selectedConcept(w),
    kind = concept?.id ?? "blue-hour",
    doors = minutes(w.brief.doors);
  const duration =
    kind === "night-garden" ? 70 : kind === "soft-signals" ? 90 : 50;
  const main = doors + 30,
    supper = main + duration + 10;
  const supplier = w.suppliers.find((s) => s.id === concept?.supplierIds[0]);
  const supplierName = supplier?.name ?? "Nila & The Low Lights";
  const treatment =
    kind === "night-garden"
      ? "short-film program & conversation"
      : kind === "soft-signals"
        ? "vinyl & print workshop"
        : "acoustic live set";
  w.runOfShow = [
    {
      id: "setup",
      time: clockTime(doors - 150),
      title: "Set the room",
      detail: `${w.venue.capacity} places, clear exits, and a welcome for everyone.`,
      owner: "Venue team",
    },
    {
      id: "soundcheck",
      time: clockTime(doors - 60),
      title:
        kind === "night-garden"
          ? "Check picture & sound"
          : kind === "soft-signals"
            ? "Set up the workshop"
            : "Find the right volume",
      detail: `Production check · sound limit ${w.venue.soundLimitDb} dB`,
      owner: supplierName,
    },
    {
      id: "doors",
      time: w.brief.doors,
      title: "Doors & first conversations",
      detail: "Welcome drink, check-in, and time to settle in.",
      owner: "Front of house",
    },
    {
      id: "music",
      time: clockTime(main),
      title:
        kind === "night-garden"
          ? "The screen comes alive"
          : kind === "soft-signals"
            ? "Make something together"
            : "A set to settle into",
      detail: `${supplierName} · ${duration}-minute ${treatment}`,
      owner: supplierName,
    },
    {
      id: "supper",
      time: clockTime(supper),
      title: "Pass the plates",
      detail: "Seasonal plates and drinks, served together.",
      owner: "Little Table",
    },
    {
      id: "records",
      time: clockTime(supper + 45),
      title: "A little more conversation",
      detail: "A gentle close to the program.",
      owner: "Venue team",
    },
    {
      id: "close",
      time: w.brief.end,
      title: "Until next time",
      detail: `Guest departure before the ${w.venue.curfew} curfew.`,
      owner: "Duty manager",
    },
  ];
  const offsets: Record<string, number> = {
    room: -150,
    sound: -60,
    menu: -45,
    front: -30,
    guest: -15,
  };
  for (const task of w.tasks) task.due = clockTime(doors + offsets[task.id]);
  const technical = w.tasks.find((t) => t.id === "sound");
  if (technical)
    technical.label =
      kind === "night-garden"
        ? "Projection, rights & sound check"
        : kind === "soft-signals"
          ? "Workshop materials & record setup"
          : `Soundcheck under ${w.venue.soundLimitDb} dB`;
  if (supplier)
    supplier.scope = `Authored sample offer: ${duration}-minute ${treatment}, ${clockTime(main)}–${clockTime(main + duration)} on ${w.brief.date}. Production check ${clockTime(doors - 60)}. Maximum ${w.venue.soundLimitDb} dB. Permissions require operator confirmation.`;
  const catering = w.suppliers.find((s) => s.id === "little-table");
  if (catering)
    catering.scope = `Authored sample offer: seasonal plates for up to ${w.venue.capacity} guests, ${clockTime(supper)}–${clockTime(supper + 45)} on ${w.brief.date}. Confirm all allergen and access needs.`;
  const safety = w.requirements.find((r) => r.id === "safety");
  if (safety)
    safety.detail = `A named duty manager, ${w.venue.capacity}-person capacity, clear exits, and ${w.venue.curfew} curfew.`;
}
function invalidateProductionChecks(w: Workspace) {
  for (const supplier of w.suppliers) {
    if (supplier.status === "CONFIRMED") supplier.status = "QUOTED";
    supplier.confirmedAt = null;
  }
  for (const requirement of w.requirements) {
    requirement.confirmed = false;
    requirement.proof = null;
  }
  for (const task of w.tasks) {
    task.done = false;
    task.evidence = null;
  }
}
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const editable = (w: Workspace) => {
  if (!["DRAFT", "CONCEPT_READY"].includes(w.event.lifecycle))
    fail("Published terms need an explicit change review.");
};
const approve = (w: Workspace, action: string, p: Record<string, unknown>) => {
  if (p.termsHash !== w.terms.hash)
    fail(
      "These terms changed. Review the current version before approving.",
      "stale_version",
      409,
    );
  w.approvals.push({
    id: id(),
    action,
    termsVersion: w.terms.version,
    payloadHash: w.terms.hash,
    approvedAt: timestamp(),
    actor: w.mode === "SAMPLE" ? "Sample operator" : "Operator",
  });
};
const renewTerms = (w: Workspace, changes: Partial<Workspace["terms"]>) => {
  w.terms = { ...w.terms, ...changes, version: w.terms.version + 1 };
  w.terms.hash = hashTerms(w.terms);
  w.event.termsVersion = w.terms.version;
};
const requireFeasible = (w: Workspace) => {
  const worksheet = costWorksheet(w);
  const schedule = requiresTypedSchedule(w)
    ? assessOfferSchedule(selectedOffers(w), w.terms.doors, w.terms.end)
    : null;
  const failures = [
    ...(schedule
      ? [
          ...schedule.violations,
          ...schedule.unresolvedProgram,
          ...(!scheduleMatchesOffers(w.terms.programSchedule, selectedOffers(w))
            ? [
                "Review and capture the exact typed program schedule before publishing.",
              ]
            : []),
        ]
      : []),
    ...(w.venue.availability !== "AVAILABLE" ||
    !Number.isFinite(Date.parse(w.venue.validUntil)) ||
    Date.parse(w.venue.validUntil) <= Date.now()
      ? ["Reconfirm venue availability."]
      : []),
    ...(!validDate(w.brief.date) ||
    !validTime(w.brief.doors) ||
    !validTime(w.brief.end) ||
    w.brief.doors >= w.brief.end ||
    w.brief.end > w.venue.curfew
      ? ["Keep the event within the available evening and curfew."]
      : []),
    ...(worksheet.headroom < 0 ? ["The production exceeds the budget."] : []),
    ...(!selectedConcept(w) ? ["Choose a concept first."] : []),
    ...(w.mode === "REAL" && w.terms.priceMinor !== 0
      ? ["Real operations support free events only."]
      : []),
    ...(w.mode === "REAL" && selectedConcept(w)?.origin === "AUTHORED_SAMPLE"
      ? ["Authored sample concepts cannot be published as real operations."]
      : []),
    ...(w.mode === "REAL" &&
    selectedConcept(w)?.supplierIds.some((sid) => {
      const s = w.suppliers.find((s) => s.id === sid);
      return (
        !s ||
        s.status === "UNAVAILABLE" ||
        !s.validUntil ||
        Date.parse(s.validUntil) <= Date.now()
      );
    })
      ? ["Selected supply is unavailable or its quote has expired."]
      : []),
  ];
  if (failures.length)
    throw new ActionError(
      "dependency",
      "The production is not yet feasible.",
      422,
      failures,
    );
};

export function applyAction(
  stored: StoredWorkspace,
  request: ActionRequest,
  actor: "OWNER" | "PARTICIPANT" = "OWNER",
): ActionResult {
  const w = stored.workspace;
  if (request.workspaceId && request.workspaceId !== w.id)
    fail(
      "The active event changed. Return to the intended workspace.",
      "stale_version",
      409,
    );
  if (request.expectedVersion !== w.version)
    throw new ActionError(
      "stale_version",
      "This workspace changed. Refresh before trying again.",
      409,
    );
  if (
    w.mode === "REAL" &&
    actor === "OWNER" &&
    [
      "EXPRESS_INTEREST",
      "VERIFY_INTEREST",
      "WITHDRAW_INTEREST",
      "RECONFIRM",
      "BOOK",
    ].includes(request.type)
  )
    fail(
      "Audience choices require the attendee’s private response link.",
      "forbidden",
      403,
    );
  if (actor !== "OWNER")
    fail("Operator authority is required for this action.", "forbidden", 403);
  if (w.event.lifecycle === "CANCELLED") fail("This event has been cancelled.");
  if (w.event.lifecycle === "COMPLETED")
    fail(
      "This event is complete. Create a new workspace to plan another gathering.",
    );
  const p = object(request.payload);
  let message = "Saved to this sample workspace.";
  let returnedToken: string | undefined;
  switch (request.type) {
    case "SAVE_BRIEF": {
      keys(p, ["brief"]);
      editable(w);
      const b = object(p.brief);
      keys(b, [
        "ambition",
        "date",
        "doors",
        "end",
        "budgetMinor",
        "ticketPriceMinor",
        "overheadMinor",
        "perGuestMinor",
        "audience",
        "anchors",
        "notes",
      ]);
      const date = text(b, "date", 10),
        doors = text(b, "doors", 5),
        end = text(b, "end", 5);
      if (
        !validDate(date) ||
        !validTime(doors) ||
        !validTime(end) ||
        minutes(doors) < 150 ||
        minutes(end) - minutes(doors) < 180
      )
        fail(
          "Enter a valid date and a same-day program of at least three hours, with time for setup.",
          "validation",
          400,
        );
      if (
        !Array.isArray(b.anchors) ||
        b.anchors.length < (w.mode === "REAL" ? 0 : 1) ||
        b.anchors.length > 10 ||
        b.anchors.some(
          (a) => typeof a !== "string" || !a.trim() || a.length > 100,
        )
      )
        fail("Choose one to ten cultural anchors.", "validation", 400);
      const timingChanged =
        date !== w.brief.date || doors !== w.brief.doors || end !== w.brief.end;
      w.brief = {
        ambition: text(b, "ambition", 1500),
        date,
        doors,
        end,
        budgetMinor: integer(b, "budgetMinor", 0, 100_000_000),
        ticketPriceMinor: integer(b, "ticketPriceMinor", 0, 100_000),
        ...(w.mode === "REAL" || b.overheadMinor !== undefined
          ? { overheadMinor: integer(b, "overheadMinor", 0, 100_000_000) }
          : {}),
        ...(w.mode === "REAL" || b.perGuestMinor !== undefined
          ? { perGuestMinor: integer(b, "perGuestMinor", 0, 100_000) }
          : {}),
        audience: text(b, "audience", 1000),
        anchors: (b.anchors as string[]).map((a) => a.trim()),
        notes: text(b, "notes", 2000, 0),
      };
      if (timingChanged) {
        invalidateProductionChecks(w);
        w.venue.availability = "UNCONFIRMED";
      }
      invalidateRealConcepts(w);
      refreshProductionPlan(w);
      renewTerms(w, { date, doors, end, priceMinor: w.brief.ticketPriceMinor });
      message = timingChanged
        ? "Brief saved. Timing changed; reconfirm venue and supplier availability."
        : "Brief saved. Your terms have a new version.";
      break;
    }
    case "SAVE_VENUE": {
      keys(p, ["venue"]);
      editable(w);
      const v = object(p.venue);
      keys(v, [
        "name",
        "neighborhood",
        "address",
        "timezone",
        "capacity",
        "soundLimitDb",
        "curfew",
        "access",
        "id",
        "availability",
        "confirmedAt",
        "validUntil",
        "source",
        "confirmationMethod",
      ]);
      const timezone = text(v, "timezone", 100);
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone });
      } catch {
        fail("Enter a valid IANA timezone.", "validation", 400);
      }
      const curfew = text(v, "curfew", 5);
      if (!validTime(curfew)) fail("Enter a valid curfew.", "validation", 400);
      w.venue = {
        ...w.venue,
        name: text(v, "name", 100),
        neighborhood: text(v, "neighborhood", 100),
        address: text(v, "address", 300),
        capacity: integer(v, "capacity", 1, 500),
        soundLimitDb: integer(v, "soundLimitDb", 0, 140),
        curfew,
        access: text(v, "access", 1500),
        availability: "UNCONFIRMED",
        timezone: text(v, "timezone", 100),
        source: w.mode === "REAL" ? text(v, "source", 1000, 5) : w.venue.source,
        confirmationMethod:
          w.mode === "REAL" ? "OWNER_ATTESTATION" : "AUTHORED_SAMPLE",
      };
      invalidateProductionChecks(w);
      invalidateRealConcepts(w);
      refreshProductionPlan(w);
      renewTerms(w, {
        venue: w.venue.name,
        address: w.venue.address,
        access: w.venue.access,
        capacity: w.venue.capacity,
        soundLimitDb: w.venue.soundLimitDb,
        curfew: w.venue.curfew,
        timezone: w.venue.timezone,
      });
      message =
        "Venue details updated. Reconfirm availability before greenlight.";
      break;
    }
    case "CONFIRM_AVAILABILITY":
      keys(p, w.mode === "REAL" ? ["validUntil", "source"] : []);
      if (w.mode === "REAL") {
        const expiry = text(p, "validUntil", 40);
        if (
          !Number.isFinite(Date.parse(expiry)) ||
          Date.parse(expiry) <= Date.now()
        )
          fail("Set a future venue confirmation expiry.", "validation", 400);
        w.venue.source = text(p, "source", 1000, 5);
        w.venue.validUntil = expiry;
        w.venue.confirmationMethod = "OWNER_ATTESTATION";
      }
      w.venue.availability = "AVAILABLE";
      w.venue.confirmedAt = timestamp();
      if (w.mode === "SAMPLE")
        w.venue.validUntil = new Date(Date.now() + 86400000).toISOString();
      message =
        w.mode === "SAMPLE"
          ? "Sample venue availability confirmed for this session."
          : "Venue availability recorded as an operator attestation with expiry.";
      break;
    case "SEARCH_CATALOG": {
      keys(p, ["query", "entityType"]);
      editable(w);
      if (w.run && ["QUEUED", "RUNNING"].includes(w.run.status))
        fail("Research is already running.");
      const query = text(p, "query", 200, 2),
        entityType = text(p, "entityType", 30);
      if (!(CULTURAL_TYPES as readonly string[]).includes(entityType))
        fail("Choose a supported catalog type.", "validation", 400);
      w.research ??= {
        anchors: [],
        influences: [],
        search: null,
        targetTypes: ["artist", "movie", "book"],
        trace: [],
        budget: { qlooUsed: 0, qlooLimit: 1, modelUsed: 0, modelLimit: 0 },
      };
      w.research.budget = {
        qlooUsed: 0,
        qlooLimit: 1,
        modelUsed: 0,
        modelLimit: 0,
      };
      const runId = id();
      w.research.search = {
        id: runId,
        query,
        entityType: entityType as import("@assembly/contracts").CulturalType,
        status: "QUEUED",
        candidates: [],
        capturedAt: null,
        error: null,
      };
      w.run = {
        id: runId,
        status: "QUEUED",
        stage: "Catalog search queued",
        mode: "LIVE",
        milestones: [],
        error: null,
      };
      message =
        "Catalog search queued. Choose an exact result before using it as an anchor.";
      break;
    }
    case "SELECT_ANCHORS": {
      keys(p, ["anchors", "influences", "targetTypes"]);
      editable(w);
      if (w.run && ["QUEUED", "RUNNING"].includes(w.run.status))
        fail("Wait for the current catalog search first.");
      if (
        !w.research?.search ||
        !["COMPLETED", "EMPTY"].includes(w.research.search.status)
      )
        fail("Search the catalog before selecting exact matches.");
      if (!Array.isArray(p.anchors) || p.anchors.length > 10)
        fail("Choose up to ten catalog results.", "validation", 400);
      const candidates = [
        ...w.research.search.candidates,
        ...(w.research.catalogHistory ?? []).flatMap(
          (search) => search.candidates,
        ),
      ];
      const previous = w.research.anchors;
      const chosen = p.anchors.map((a) => {
        const entry = typeof a === "string" ? { entityId: a } : object(a);
        const match =
          candidates.find((c) => c.entityId === entry.entityId) ??
          previous.find((c) => c.entityId === entry.entityId);
        if (!match)
          fail(
            "Select an exact candidate returned by catalog search.",
            "validation",
            400,
          );
        return {
          ...match,
          id: match.entityId,
          confirmedAt: timestamp(),
          source: "CATALOG_SELECTION" as const,
        };
      });
      if (new Set(chosen.map((c) => c.entityId)).size !== chosen.length)
        fail("Choose distinct catalog anchors.", "validation", 400);
      w.research.anchors = chosen;
      if (p.influences !== undefined) {
        if (!Array.isArray(p.influences) || p.influences.length > 30)
          fail("Check supplier influence mappings.", "validation", 400);
        w.research.influences = p.influences.map((raw) => {
          const i = object(raw);
          const match =
            candidates.find((c) => c.entityId === i.entityId) ??
            chosen.find((c) => c.entityId === i.entityId) ??
            w.research!.influences.find((c) => c.entityId === i.entityId);
          if (!match || !w.suppliers.some((s) => s.id === i.supplierId))
            fail(
              "Map supplier influences to exact returned catalog entities.",
              "validation",
              400,
            );
          return {
            supplierId: String(i.supplierId),
            entityId: match.entityId,
            entityType: match.entityType,
            name: match.name,
            confirmedAt: timestamp(),
          };
        });
      }
      if (p.targetTypes !== undefined) {
        if (
          !Array.isArray(p.targetTypes) ||
          p.targetTypes.length < 2 ||
          p.targetTypes.length > 3 ||
          new Set(p.targetTypes).size !== p.targetTypes.length ||
          p.targetTypes.some(
            (t) => !(CULTURAL_TYPES as readonly unknown[]).includes(t),
          )
        )
          fail(
            "Choose two or three distinct supported research categories.",
            "validation",
            400,
          );
        w.research.targetTypes =
          p.targetTypes as import("@assembly/contracts").CulturalType[];
      }
      w.brief.anchors = chosen.map((c) => c.name);
      invalidateRealConcepts(w);
      message =
        "Exact catalog matches confirmed by the operator. Influence mappings describe editorial relationships, not direct supplier scores.";
      break;
    }
    case "RESEARCH": {
      keys(p, ["mode"]);
      editable(w);
      if (p.mode !== "SAMPLE" && p.mode !== "LIVE")
        fail("Choose sample or live research explicitly.", "validation", 400);
      if (w.mode === "REAL" && w.brief.ticketPriceMinor !== 0)
        fail("Real operations currently support free events only.");
      if (w.mode === "REAL" && p.mode === "SAMPLE")
        fail(
          "Authored concepts cannot supply real operations.",
          "forbidden",
          403,
        );
      if (
        p.mode === "LIVE" &&
        (!w.research?.anchors.length || !w.suppliers.length)
      )
        fail(
          "Live research is not connected to confirmed anchors and operator inventory yet.",
          "dependency",
          422,
        );
      if (w.run && ["QUEUED", "RUNNING"].includes(w.run.status))
        fail("Research is already running.");
      if (p.mode === "LIVE") {
        if (
          !validDate(w.brief.date) ||
          !validTime(w.brief.doors) ||
          !validTime(w.brief.end) ||
          w.brief.doors >= w.brief.end ||
          w.brief.end > w.venue.curfew ||
          !w.venue.name.trim() ||
          !w.venue.address.trim()
        )
          fail(
            "Save a valid event date, schedule and operator venue before live research.",
            "validation",
            400,
          );
        const targets = w.research!.targetTypes;
        if (
          targets.length < 2 ||
          targets.length > 3 ||
          new Set(targets).size !== targets.length ||
          targets.some(
            (t) => !(CULTURAL_TYPES as readonly string[]).includes(t),
          )
        )
          fail(
            "Choose two or three distinct supported research categories.",
            "validation",
            400,
          );
        const offerReviews = w.suppliers.map((offer) => {
          const timing = assessOfferSchedule(
            [offer],
            w.brief.doors,
            w.brief.end,
          );
          const issues = [
            ...timing.violations,
            ...timing.unresolvedProgram,
            ...timing.unresolvedSetup,
          ];
          if (offer.status === "UNAVAILABLE")
            issues.push("This offer is marked unavailable.");
          if (
            (w.mode === "REAL" || offer.validUntil !== undefined) &&
            (!offer.validUntil ||
              !Number.isFinite(Date.parse(offer.validUntil)) ||
              Date.parse(offer.validUntil) <= Date.now())
          )
            issues.push(
              "Record a current quote validity before using this offer.",
            );
          const singletonCost =
            offer.feeMinor +
            (w.brief.overheadMinor ?? 0) +
            (w.brief.perGuestMinor ?? 0) * w.venue.capacity;
          if (
            !Number.isSafeInteger(singletonCost) ||
            singletonCost > w.brief.budgetMinor
          )
            issues.push(
              "This offer plus supplied overhead and per-guest costs exceeds the saved budget at full capacity.",
            );
          if (
            offer.soundDb !== undefined &&
            (!Number.isSafeInteger(offer.soundDb) ||
              offer.soundDb < 0 ||
              offer.soundDb > w.venue.soundLimitDb)
          )
            issues.push(
              "This offer exceeds the venue sound limit or needs a valid sound value.",
            );
          return { id: offer.id, name: offer.name, issues };
        });
        if (
          new Set(
            offerReviews
              .filter((offer) => offer.issues.length === 0)
              .map((offer) => offer.id),
          ).size < 2
        )
          throw new ActionError(
            "dependency",
            "Add at least two individually feasible offers with exact program and setup timing so live research can produce different inventory combinations.",
            422,
            offerReviews.map(
              (offer) =>
                `${offer.name}: ${offer.issues.length ? offer.issues.join(" ") : "Usable individually; another distinct feasible offer is required for different combinations."}`,
            ),
          );
        w.research!.budget = {
          qlooUsed: 0,
          qlooLimit: RESEARCH_CALL_LIMITS.qloo,
          modelUsed: 0,
          modelLimit: RESEARCH_CALL_LIMITS.model,
        };
        w.research!.trace = [];
      }
      w.run = {
        id: id(),
        status: "QUEUED",
        stage: "Queued",
        mode: p.mode as "SAMPLE" | "LIVE",
        milestones: [],
        error: null,
      };
      w.event.lifecycle = "RESEARCHING";
      message =
        p.mode === "SAMPLE"
          ? "Sample research queued. Every concept remains an authored example."
          : "Live research queued with confirmed catalog anchors and operator inventory.";
      break;
    }
    case "SELECT_CONCEPT": {
      keys(p, ["conceptId"]);
      editable(w);
      const concept = w.concepts.find(
        (c) => c.id === text(p, "conceptId", 100),
      );
      if (!concept)
        fail(
          "Run research before choosing one of its concepts.",
          "not_found",
          404,
        );
      w.event.selectedConceptId = concept.id;
      w.event.title = concept.title;
      invalidateProductionChecks(w);
      refreshProductionPlan(w);
      if (
        concept.supplierIds.some(
          (sid) => !w.suppliers.some((s) => s.id === sid),
        )
      )
        fail("The concept references inventory that no longer exists.");
      renewTerms(w, {
        title: concept.title,
        program: presentConcept(concept, w.suppliers, w.evidence).program,
        priceMinor: w.brief.ticketPriceMinor,
        ...(requiresTypedSchedule(w)
          ? { programSchedule: programScheduleFor(selectedOffers(w)) }
          : {}),
      });
      message = "Concept chosen. Review the exact public proposition next.";
      break;
    }
    case "PUBLISH":
      keys(p, ["termsHash"]);
      if (w.event.lifecycle !== "CONCEPT_READY")
        fail("Complete research and choose a concept first.");
      requireFeasible(w);
      approve(w, request.type, p);
      w.event.lifecycle = "VALIDATION_OPEN";
      w.event.publishedAt = timestamp();
      message =
        w.mode === "SAMPLE"
          ? "Conditional interest is open inside this sample."
          : "The exact conditional proposition is published at its independent public event link.";
      break;
    case "CONFIRM_SUPPLIER": {
      keys(p, ["supplierId", "validUntil", "note"]);
      const supplier = w.suppliers.find(
        (s) => s.id === text(p, "supplierId", 100),
      );
      if (!supplier) fail("Supplier not found.", "not_found", 404);
      const timingIssues = supplierScheduleIssues(w, supplier);
      if (timingIssues.length)
        throw new ActionError(
          "dependency",
          "Set and review the exact program and setup timing before confirming this offer.",
          422,
          timingIssues,
        );
      if (supplier.status === "UNAVAILABLE")
        fail("An unavailable supplier must be replaced through change review.");
      if (w.mode === "REAL") {
        const expiry = text(p, "validUntil", 40);
        if (
          !Number.isFinite(Date.parse(expiry)) ||
          Date.parse(expiry) <= Date.now()
        )
          fail("Set a future confirmation expiry.", "validation", 400);
        supplier.validUntil = expiry;
        supplier.confirmationNote = text(p, "note", 1000, 5);
        supplier.confirmationMethod = "OWNER_ATTESTATION";
        supplier.confirmedTermsHash = w.terms.hash;
        supplier.confirmedOfferHash = hashSupplierOffer(w, supplier);
      } else {
        supplier.confirmationMethod = "AUTHORED_SAMPLE";
        if (requiresTypedSchedule(w)) {
          const expiry =
            p.validUntil !== undefined
              ? text(p, "validUntil", 40)
              : (supplier.validUntil ?? w.expiresAt);
          if (
            !Number.isFinite(Date.parse(expiry)) ||
            Date.parse(expiry) <= Date.now()
          )
            fail("Set a future confirmation expiry.", "validation", 400);
          supplier.validUntil = expiry;
          supplier.confirmedTermsHash = w.terms.hash;
          supplier.confirmedOfferHash = hashSupplierOffer(w, supplier);
        }
      }
      supplier.status = "CONFIRMED";
      supplier.confirmedAt = timestamp();
      message =
        w.mode === "REAL"
          ? "Operator attestation recorded. The supplier has not responded independently."
          : "Sample supplier terms confirmed. No real booking was made.";
      break;
    }
    case "CONFIRM_REQUIREMENT": {
      keys(p, ["requirementId", "proof"]);
      const requirement = w.requirements.find(
        (r) => r.id === text(p, "requirementId", 100),
      );
      if (!requirement) fail("Requirement not found.", "not_found", 404);
      requirement.confirmed = true;
      requirement.proof = text(p, "proof", 2000, 5);
      message = "Readiness evidence recorded.";
      break;
    }
    case "GREENLIGHT": {
      keys(p, ["termsHash"]);
      if (w.event.lifecycle !== "VALIDATION_OPEN")
        fail("Open validation before greenlighting the event.");
      requireFeasible(w);
      const concept = selectedConcept(w)!;
      const timing = requiresTypedSchedule(w)
        ? assessOfferSchedule(selectedOffers(w), w.terms.doors, w.terms.end)
        : null;
      const missing = [
        ...(timing
          ? [
              ...timing.violations,
              ...timing.unresolvedProgram,
              ...timing.unresolvedSetup,
            ]
          : []),
        ...concept.supplierIds
          .filter((sid) => !supplierCurrent(w, sid))
          .map(
            (sid) =>
              `Confirm ${w.suppliers.find((s) => s.id === sid)?.name ?? sid}.`,
          ),
        ...w.requirements.filter((r) => !r.confirmed).map((r) => r.label),
      ];
      if (missing.length)
        throw new ActionError(
          "dependency",
          "Some production requirements are still unresolved.",
          422,
          missing,
        );
      approve(w, request.type, p);
      w.event.lifecycle = "CONFIRMED";
      message =
        "Production greenlit. Interest is still separate from bookings.";
      break;
    }
    case "OPEN_BOOKING":
      keys(p, []);
      if (w.mode === "REAL" && w.terms.priceMinor !== 0)
        fail("Real operations currently support free bookings only.");
      if (w.event.lifecycle !== "CONFIRMED" || w.event.bookingPaused)
        fail("Confirm the production and resolve any pause first.");
      w.event.lifecycle = "BOOKING_OPEN";
      message =
        w.mode === "SAMPLE"
          ? "Sample booking is open. No payment is collected."
          : "Free booking is open. No payment is collected.";
      break;
    case "EXPRESS_INTEREST": {
      keys(p, ["name", "email", "quantity", "consent", "termsVersion"]);
      if (!w.event.publishedAt)
        fail("This proposition has not been published.");
      if (p.consent !== true || p.termsVersion !== w.terms.version)
        fail(
          "Accept the current exact terms before expressing interest.",
          "stale_version",
          409,
        );
      const name = text(p, "name", 100),
        email = text(p, "email", 254).toLowerCase(),
        quantity = integer(p, "quantity", 1, 6);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        fail("Enter a valid email-shaped sample contact.", "validation", 400);
      const digest = createHash("sha256")
        .update(w.id + ":" + email)
        .digest("hex");
      const existing = w.commitments.find(
        (c) =>
          stored.contactDigests[c.id] === digest && c.status !== "WITHDRAWN",
      );
      if (existing)
        fail(
          "This contact already has an active choice. Use its existing confirmation.",
          "validation",
          409,
        );
      const cid = id(),
        claim = token();
      stored.contactDigests[cid] = digest;
      const [local, domain] = email.split("@");
      w.commitments.push({
        id: cid,
        displayName: name,
        emailMasked: `${local.slice(0, 1)}•••@${domain}`,
        token: claim,
        quantity,
        termsVersion: w.terms.version,
        status: "PENDING",
        createdAt: timestamp(),
        verifiedAt: null,
      });
      returnedToken = claim;
      message =
        "Interest saved as pending. Open the sample confirmation link to verify it.";
      break;
    }
    case "VERIFY_INTEREST":
    case "WITHDRAW_INTEREST":
    case "RECONFIRM": {
      keys(p, ["token", "termsVersion"]);
      const commitment = w.commitments.find(
        (c) => c.token === text(p, "token", 100),
      );
      if (!commitment)
        fail(
          "This confirmation link is not valid in this workspace.",
          "not_found",
          404,
        );
      if (
        request.type !== "WITHDRAW_INTEREST" &&
        p.termsVersion !== w.terms.version
      )
        fail("Read the updated terms before confirming.", "stale_version", 409);
      if (request.type === "WITHDRAW_INTEREST") {
        commitment.status = "WITHDRAWN";
        for (const booking of w.bookings.filter(
          (b) => b.commitmentId === commitment.id,
        ))
          booking.status = "CANCELLED";
        message = "Choice withdrawn and any sample seat allocation released.";
      } else {
        if (commitment.status === "WITHDRAWN")
          fail("This choice was withdrawn. Submit a new choice if desired.");
        commitment.status = "VERIFIED";
        commitment.termsVersion = w.terms.version;
        commitment.verifiedAt = timestamp();
        for (const booking of w.bookings.filter(
          (b) =>
            b.commitmentId === commitment.id &&
            b.status === "RECONFIRM_REQUIRED",
        )) {
          booking.status = "CONFIRMED";
          booking.termsVersion = w.terms.version;
        }
        message =
          "Choice verified against the current terms. No payment has been made.";
      }
      break;
    }
    case "BOOK": {
      keys(p, ["commitmentId"]);
      if (w.event.lifecycle !== "BOOKING_OPEN" || w.event.bookingPaused)
        fail("Bookings are not currently open.");
      const commitment = w.commitments.find(
        (c) => c.id === text(p, "commitmentId", 100),
      );
      if (
        !commitment ||
        commitment.status !== "VERIFIED" ||
        commitment.termsVersion !== w.terms.version
      )
        fail("Verify this choice against the current terms first.");
      if (
        w.bookings.some(
          (b) => b.commitmentId === commitment.id && b.status !== "CANCELLED",
        )
      )
        fail("This choice already has a booking.", "validation", 409);
      if (countsFor(w).remaining < commitment.quantity)
        fail("There are not enough remaining sample places.", "capacity", 409);
      w.bookings.push({
        id: id(),
        commitmentId: commitment.id,
        displayName: commitment.displayName,
        quantity: commitment.quantity,
        termsVersion: w.terms.version,
        status: "CONFIRMED",
        checkedIn: false,
        createdAt: timestamp(),
      });
      message =
        "Sample places allocated atomically. This is not a paid ticket.";
      break;
    }
    case "CHECK_IN": {
      keys(p, ["bookingId"]);
      if (
        !["READY", "LIVE"].includes(w.event.lifecycle) ||
        w.event.bookingPaused
      )
        fail("Check-in opens when the event is ready.");
      const booking = w.bookings.find(
        (b) => b.id === text(p, "bookingId", 100),
      );
      if (
        !booking ||
        booking.status !== "CONFIRMED" ||
        booking.termsVersion !== w.terms.version
      )
        fail("A current confirmed booking is required.");
      booking.checkedIn = true;
      message =
        w.mode === "SAMPLE"
          ? "Sample arrival recorded once."
          : "Operator recorded arrival once against the current booking.";
      break;
    }
    case "COMPLETE_TASK": {
      keys(p, ["taskId", "evidence"]);
      if (!["CONFIRMED", "BOOKING_OPEN", "READY"].includes(w.event.lifecycle))
        fail("Greenlight the production first.");
      const task = w.tasks.find((t) => t.id === text(p, "taskId", 100));
      if (!task) fail("Task not found.", "not_found", 404);
      if (
        task.dependencyIds.some(
          (tid) => !w.tasks.find((t) => t.id === tid)?.done,
        )
      )
        fail("Complete the preceding tasks first.");
      task.evidence = text(p, "evidence", 2000, 5);
      task.done = true;
      message = "Production task completed with evidence.";
      break;
    }
    case "PROPOSE_CHANGE": {
      proposeChange(w, p);
      message =
        "Exact material change proposed. Review its diff and approve the current terms hash.";
      break;
    }
    case "UPSERT_SUPPLIER": {
      upsertSupplier(w, p);
      message = "Operator inventory saved with source and confirmation expiry.";
      break;
    }
    case "REMOVE_SUPPLIER": {
      keys(p, ["supplierId"]);
      const sid = text(p, "supplierId", 100);
      if (selectedConcept(w)?.supplierIds.includes(sid))
        fail(
          "Selected supply must be replaced through change review before removal.",
        );
      if (!w.suppliers.some((s) => s.id === sid))
        fail("Supplier not found.", "not_found", 404);
      w.suppliers = w.suppliers.filter((s) => s.id !== sid);
      invalidateRealConcepts(w);
      message = "Unused supplier removed.";
      break;
    }
    case "CANCEL_RESEARCH": {
      keys(p, []);
      if (!w.run || !["QUEUED", "RUNNING"].includes(w.run.status))
        fail("No active research run.");
      w.run.status = "CANCELLED";
      if (w.research?.search?.id === w.run.id)
        w.research.search.status = "CANCELLED";
      w.run.stage = "Cancelled by operator";
      w.event.lifecycle = w.concepts.length ? "CONCEPT_READY" : "DRAFT";
      message = "Research cancelled; late worker results will be rejected.";
      break;
    }
    case "CANCEL_EVENT": {
      keys(p, ["termsHash", "reason"]);
      approve(w, request.type, p);
      const reason = text(p, "reason", 1500, 5);
      w.event.lifecycle = "CANCELLED";
      w.event.bookingPaused = true;
      for (const b of w.bookings) b.status = "CANCELLED";
      for (const c of w.commitments) c.status = "WITHDRAWN";
      message = `Event cancelled: ${reason}. Seats released; response links display cancellation. No external messages sent.`;
      break;
    }
    case "DISRUPT": {
      keys(p, ["supplierId"]);
      if (!["CONFIRMED", "BOOKING_OPEN", "READY"].includes(w.event.lifecycle))
        fail("This recovery scenario requires a confirmed production.");
      if (w.change?.status === "PROPOSED")
        fail("Finish the existing change review first.");
      const supplier = w.suppliers.find(
        (s) => s.id === text(p, "supplierId", 100),
      );
      if (!supplier || !selectedConcept(w)?.supplierIds.includes(supplier.id))
        fail("Choose one of the selected suppliers.");
      const replacement =
        w.mode === "SAMPLE" &&
        !requiresTypedSchedule(w) &&
        supplier.id === "low-lights"
          ? w.suppliers.find((s) => s.id === "sunday-people")
          : undefined;
      supplier.status = "UNAVAILABLE";
      supplier.confirmedAt = null;
      w.event.bookingPaused = true;
      w.event.operationalRisk = "SUPPLIER_LOSS";
      w.change = makeChange(w, {
        reason: `${supplier.name} can no longer supply the event.`,
        supplierId: supplier.id,
        replacementId: replacement?.id ?? "",
      });
      message =
        "Bookings paused. Review the replacement and the commitments it affects.";
      break;
    }
    case "APPROVE_CHANGE": {
      keys(p, ["termsHash", "changeId"]);
      const change = w.change;
      if (
        !change ||
        change.status !== "PROPOSED" ||
        change.expectedTermsVersion !== w.terms.version ||
        (p.changeId !== undefined && p.changeId !== change.id)
      )
        fail("This change is no longer current.", "stale_version", 409);
      const replacement = change.replacementId
        ? w.suppliers.find((s) => s.id === change.replacementId)
        : undefined;
      if (
        change.supplierId &&
        (!replacement || !supplierCurrent(w, replacement.id))
      )
        fail("Confirm replacement availability and exact terms first.");
      validateChangeFeasibility(w, change);
      if (change.proposedHash && change.proposedHash !== hashChange(change, w))
        fail(
          "The change proposal changed. Review it again.",
          "stale_version",
          409,
        );
      approve(w, request.type, p);
      change.status = "APPROVED";
      change.approvedAt = timestamp();
      for (const timing of change.supplierTimingPatch ?? []) {
        const offer = w.suppliers.find((s) => s.id === timing.supplierId);
        if (!offer)
          fail(
            "A reviewed supplier offer no longer exists.",
            "stale_version",
            409,
          );
        if (timing.programStart !== undefined)
          offer.programStart = timing.programStart;
        if (timing.setupStart !== undefined)
          offer.setupStart = timing.setupStart;
      }
      const concept = selectedConcept(w);
      if (change.supplierId && replacement && concept) {
        concept.supplierIds = concept.supplierIds.map((sid) =>
          sid === change.supplierId ? replacement.id : sid,
        );
        concept.fixedCostMinor += change.costDeltaMinor;
      }
      const patch =
        change.termsPatch ??
        (replacement
          ? {
              program: w.terms.program.replace(change.before, replacement.name),
            }
          : {});
      renewTerms(w, { ...patch, ...change.venuePatch });
      w.event.title = w.terms.title;
      w.brief = {
        ...w.brief,
        date: w.terms.date,
        doors: w.terms.doors,
        end: w.terms.end,
        ticketPriceMinor: w.terms.priceMinor,
      };
      w.venue = {
        ...w.venue,
        ...change.venuePatch,
        name: w.terms.venue,
        address: w.terms.address,
        access: w.terms.access,
      };
      const timingOrPlace = change.diff?.some((d) =>
        ["date", "doors", "end", "venue", "address", "access"].includes(
          d.field,
        ),
      );
      if (timingOrPlace || Object.keys(change.venuePatch ?? {}).length) {
        w.venue.availability = "UNCONFIRMED";
        for (const s of w.suppliers) {
          if (s.status === "CONFIRMED") s.status = "QUOTED";
          s.confirmedAt = null;
        }
      }
      if (
        w.mode === "REAL" ||
        selectedConcept(w)?.origin === "MODEL_HYPOTHESIS" ||
        change.diff?.some((d) =>
          [
            "date",
            "doors",
            "end",
            "venue",
            "address",
            "access",
            "capacity",
            "soundLimitDb",
            "curfew",
            "timezone",
          ].includes(d.field),
        )
      )
        for (const r of w.requirements) {
          r.confirmed = false;
          r.proof = null;
        }
      refreshProductionPlan(w);
      for (const commitment of w.commitments)
        if (commitment.status !== "WITHDRAWN")
          commitment.status = "RECONFIRM_REQUIRED";
      for (const booking of w.bookings)
        if (booking.status !== "CANCELLED") {
          booking.status = "RECONFIRM_REQUIRED";
          booking.checkedIn = false;
        }
      for (const task of w.tasks)
        if (
          w.mode === "REAL" ||
          selectedConcept(w)?.origin === "MODEL_HYPOTHESIS" ||
          change.diff?.some((d) =>
            [
              "date",
              "doors",
              "end",
              "venue",
              "address",
              "access",
              "capacity",
              "soundLimitDb",
              "curfew",
              "timezone",
            ].includes(d.field),
          ) ||
          ["sound", "front", "guest"].includes(task.id)
        ) {
          task.done = false;
          task.evidence = null;
        }
      w.event.lifecycle =
        change.resumeLifecycle === "READY"
          ? "BOOKING_OPEN"
          : (change.resumeLifecycle ?? "BOOKING_OPEN");
      message =
        "Replacement approved. Affected guests must accept the changed program.";
      break;
    }
    case "RESUME_BOOKING":
      keys(p, []);
      if (!w.event.bookingPaused || w.change?.status !== "APPROVED")
        fail("Approve the recovery before resuming.");
      if (
        w.commitments.some((c) => c.status === "RECONFIRM_REQUIRED") ||
        w.bookings.some((b) => b.status === "RECONFIRM_REQUIRED")
      )
        fail(
          "Resolve every affected commitment by reconfirmation or withdrawal first.",
        );
      requireFeasible(w);
      if (
        w.requirements.some((r) => !r.confirmed) ||
        selectedConcept(w)?.supplierIds.some((sid) => !supplierCurrent(w, sid))
      )
        fail(
          "Reconfirm changed production requirements and suppliers before resuming.",
        );
      w.event.bookingPaused = false;
      w.event.operationalRisk = "CLEAR";
      message = "Booking resumed with the revised terms.";
      break;
    case "MARK_READY":
      keys(p, []);
      if (w.event.lifecycle !== "BOOKING_OPEN" || w.event.bookingPaused)
        fail("Open bookings and resolve any pause first.");
      if (w.tasks.some((t) => !t.done))
        fail("Complete every production task before marking ready.");
      if (requiresTypedSchedule(w) && productionReadiness(w).length)
        fail(
          "Reconfirm expired or changed production evidence before marking ready.",
        );
      requireFeasible(w);
      w.event.lifecycle = "READY";
      message =
        w.mode === "SAMPLE"
          ? "The sample production is ready to welcome guests."
          : "Production tasks and evidence are complete. The event is ready.";
      break;
    case "START_EVENT":
      keys(p, []);
      if (w.event.lifecycle !== "READY" || w.event.bookingPaused)
        fail("The production must be ready first.");
      requireFeasible(w);
      if (requiresTypedSchedule(w) && productionReadiness(w).length)
        fail(
          "Reconfirm expired or changed production evidence before starting.",
        );
      w.event.lifecycle = "LIVE";
      message =
        w.mode === "SAMPLE"
          ? "The sample event is underway."
          : "The operator recorded that the event is underway.";
      break;
    case "COMPLETE_EVENT":
      keys(p, w.mode === "REAL" ? ["evidence"] : []);
      if (w.event.lifecycle !== "LIVE")
        fail("Start the event before recording its outcome.");
      if (w.mode === "REAL")
        w.completion = {
          evidence: text(p, "evidence", 2000, 5),
          observedAt: timestamp(),
          origin: "OPERATOR_ASSERTION",
        };
      else
        w.completion = {
          evidence: "Authored sample actions only.",
          observedAt: timestamp(),
          origin: "AUTHORED_SAMPLE",
        };
      if (w.event.lifecycle !== "LIVE")
        fail("Start the sample event before recording its outcome.");
      w.event.lifecycle = "COMPLETED";
      message =
        w.mode === "SAMPLE"
          ? "Sample event completed. The outcome contains only authored workspace actions."
          : "The operator recorded completion with observation evidence. Participant feedback remains a separate observation.";
      break;
    default:
      fail("Unknown action.", "validation", 400);
  }
  w.version++;
  w.event.publicVersion = (w.event.publicVersion ?? 1) + 1;
  w.audit.push({
    id: id(),
    action: request.type,
    description: message,
    at: timestamp(),
    version: w.version,
  });
  if (w.audit.length > 500) w.audit = w.audit.slice(-500);
  return {
    workspace: w,
    message,
    ...(returnedToken ? { token: returnedToken } : {}),
  };
}

export function supplierCurrent(w: Workspace, sid: string) {
  const s = w.suppliers.find((s) => s.id === sid);
  return (
    !!s &&
    s.status === "CONFIRMED" &&
    (!requiresTypedSchedule(w) ||
      (!!s.validUntil &&
        Date.parse(s.validUntil) > Date.now() &&
        s.confirmedOfferHash === hashSupplierOffer(w, s) &&
        supplierScheduleIssues(w, s).length === 0))
  );
}
function upsertSupplier(w: Workspace, p: Record<string, unknown>) {
  keys(p, ["supplier"]);
  const s = object(p.supplier);
  keys(s, [
    "id",
    "name",
    "discipline",
    "feeMinor",
    "description",
    "critical",
    "source",
    "influence",
    "scope",
    "validUntil",
    "variableCostMinor",
    "setupMinutes",
    "durationMinutes",
    "programStart",
    "setupStart",
    "canOverlap",
    "soundDb",
    "rightsConfirmed",
    "availabilityConfirmed",
  ]);
  const sid = typeof s.id === "string" && s.id ? text(s, "id", 100) : id();
  const current = w.suppliers.find((x) => x.id === sid);
  if (
    current &&
    selectedConcept(w)?.supplierIds.includes(sid) &&
    w.event.publishedAt
  )
    fail(
      "Selected supplier changes require an explicit change proposal. Add a replacement offer instead.",
    );
  const expiry = text(s, "validUntil", 40);
  if (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())
    fail("Set a future quote expiry.", "validation", 400);
  const name = text(s, "name", 100);
  const supplier: Workspace["suppliers"][number] = {
    id: sid,
    name,
    initials: name
      .split(/\s+/)
      .slice(0, 2)
      .map((x) => x[0])
      .join(""),
    discipline: text(s, "discipline", 100),
    feeMinor: integer(s, "feeMinor", 0, 100_000_000),
    description: text(s, "description", 1500),
    critical: s.critical !== false,
    source: text(s, "source", 1500, 5),
    influence: text(s, "influence", 1500, 0),
    scope: text(s, "scope", 2000, 5),
    validUntil: expiry,
    status: "QUOTED",
    confirmedAt: null,
    token: "",
    confirmationMethod: "OWNER_ATTESTATION",
  };
  for (const key of [
    "variableCostMinor",
    "setupMinutes",
    "durationMinutes",
    "soundDb",
  ] as const)
    if (s[key] !== undefined)
      supplier[key] = integer(
        s,
        key,
        0,
        key === "variableCostMinor"
          ? 100_000
          : key === "setupMinutes"
            ? 240
            : key === "durationMinutes"
              ? 180
              : 140,
      );
  for (const key of ["programStart", "setupStart"] as const)
    if (s[key] !== undefined) {
      const time = text(s, key, 5);
      if (!validTime(time))
        fail(`Check ${key}. Use an exact HH:mm local time.`, "validation", 400);
      supplier[key] = time;
    }
  if (s.canOverlap !== undefined) {
    if (typeof s.canOverlap !== "boolean")
      fail("Check the explicit overlap choice.", "validation", 400);
    supplier.canOverlap = s.canOverlap;
  }
  if (s.rightsConfirmed !== undefined) {
    if (typeof s.rightsConfirmed !== "boolean")
      fail("Check rights confirmation.", "validation", 400);
    supplier.rightsConfirmed = s.rightsConfirmed;
  }
  if (s.availabilityConfirmed !== undefined) {
    if (typeof s.availabilityConfirmed !== "boolean")
      fail("Check availability assertion.", "validation", 400);
    supplier.availabilityConfirmed = s.availabilityConfirmed;
  }
  w.suppliers = [...w.suppliers.filter((x) => x.id !== sid), supplier];
  if (!w.event.publishedAt) invalidateRealConcepts(w);
}
function changeOffers(
  w: Workspace,
  change: Pick<
    NonNullable<Workspace["change"]>,
    "supplierId" | "replacementId" | "supplierTimingPatch"
  >,
  applyTiming = true,
) {
  const ids = (selectedConcept(w)?.supplierIds ?? []).map((sid) =>
    sid === change.supplierId && change.replacementId
      ? change.replacementId
      : sid,
  );
  return ids.flatMap((id) => {
    const offer = w.suppliers.find((s) => s.id === id);
    const timing = applyTiming
      ? change.supplierTimingPatch?.find((patch) => patch.supplierId === id)
      : undefined;
    return offer
      ? [
          {
            ...offer,
            ...(timing
              ? {
                  ...(timing.programStart !== undefined
                    ? { programStart: timing.programStart }
                    : {}),
                  ...(timing.setupStart !== undefined
                    ? { setupStart: timing.setupStart }
                    : {}),
                }
              : {}),
          },
        ]
      : [];
  });
}
function shiftOfferTime(time: string, delta: number): string {
  if (!validTime(time))
    fail(
      "A reviewed timing shift needs valid original supplier times.",
      "validation",
      400,
    );
  const shifted = minutes(time) + delta;
  if (shifted < 0 || shifted >= 1440)
    fail(
      "The proposed timing shift would cross the event day. Choose a same-day schedule.",
      "validation",
      400,
    );
  return clockTime(shifted);
}
function formatSetup(offers: Workspace["suppliers"]): string {
  return (
    offers
      .map((offer) => {
        const slot = offerSetupSlot(offer);
        return `${offer.name}: ${offer.setupMinutes === 0 ? "no setup required" : slot ? `${slot.start}–${slot.end}` : "setup time unresolved"}`;
      })
      .join("; ") || "No exact setup slots"
  );
}
function formatSchedule(slots: Workspace["terms"]["programSchedule"]): string {
  return slots?.length
    ? slots
        .map(
          (slot) =>
            `${slot.name}: ${slot.start}–${slot.end}${slot.canOverlap ? " (parallel service permitted)" : ""}`,
        )
        .join("; ")
    : "No approved typed program slots";
}
function hashChange(change: Workspace["change"], w?: Workspace) {
  const canonical = change?.hashFormat === "canonical-json-v1";
  return createHash("sha256")
    .update(
      (canonical ? canonicalJson : JSON.stringify)({
        supplierId: change?.supplierId,
        replacementId: change?.replacementId,
        termsPatch: change?.termsPatch,
        venuePatch: change?.venuePatch,
        totalCostDeltaMinor: change?.totalCostDeltaMinor,
        costDeltaMinor: change?.costDeltaMinor,
        expectedTermsVersion: change?.expectedTermsVersion,
        ...(canonical ? { hashFormat: change.hashFormat } : {}),
        ...(canonical && change?.supplierTimingPatch?.length
          ? { supplierTimingPatch: change.supplierTimingPatch }
          : {}),
        ...(canonical && change && w && requiresTypedSchedule(w)
          ? {
              exactOffers: changeOffers(w, change, false).map((offer) => ({
                id: offer.id,
                name: offer.name,
                scope: offer.scope,
                feeMinor: offer.feeMinor,
                programStart: offer.programStart,
                durationMinutes: offer.durationMinutes,
                setupStart: offer.setupStart,
                setupMinutes: offer.setupMinutes,
                canOverlap: offer.canOverlap === true,
              })),
            }
          : {}),
      }),
    )
    .digest("hex");
}
function makeChange(
  w: Workspace,
  p: Record<string, unknown>,
): NonNullable<Workspace["change"]> {
  const sid = typeof p.supplierId === "string" ? p.supplierId : "",
    rid = typeof p.replacementId === "string" ? p.replacementId : "";
  const supplier = w.suppliers.find((s) => s.id === sid),
    replacement = w.suppliers.find((s) => s.id === rid);
  if (rid && !sid)
    fail(
      "Choose the selected supplier this offer would replace.",
      "validation",
      400,
    );
  if (sid && (!supplier || !selectedConcept(w)?.supplierIds.includes(sid)))
    fail("The lost supplier must be part of the selected program.");
  if (
    rid &&
    (!replacement ||
      replacement.status === "UNAVAILABLE" ||
      rid === sid ||
      selectedConcept(w)?.supplierIds.includes(rid))
  )
    fail("Choose an available replacement quote.");
  const raw = p.terms === undefined ? {} : object(p.terms);
  keys(raw, [
    "title",
    "date",
    "doors",
    "end",
    "venue",
    "address",
    "priceMinor",
    "program",
    "programSchedule",
    "access",
  ]);
  const patch: NonNullable<NonNullable<Workspace["change"]>["termsPatch"]> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === "programSchedule") continue;
    if (key === "priceMinor") {
      patch.priceMinor = integer(raw, key, 0, 100_000);
      if (w.mode === "REAL" && patch.priceMinor !== 0)
        fail("Real booking supports free events only.");
    } else {
      if (typeof value !== "string" || value.length < 1 || value.length > 2000)
        fail(`Check ${key}.`, "validation", 400);
      Object.assign(patch, { [key]: value.trim() });
    }
  }
  if (patch.date && !validDate(patch.date))
    fail("Enter a valid date.", "validation", 400);
  const venueRaw = p.venue === undefined ? {} : object(p.venue);
  keys(venueRaw, ["capacity", "soundLimitDb", "curfew", "timezone"]);
  const venuePatch: NonNullable<
    NonNullable<Workspace["change"]>["venuePatch"]
  > = {};
  if (venueRaw.capacity !== undefined)
    venuePatch.capacity = integer(venueRaw, "capacity", 1, 500);
  if (venueRaw.soundLimitDb !== undefined)
    venuePatch.soundLimitDb = integer(venueRaw, "soundLimitDb", 0, 140);
  if (venueRaw.curfew !== undefined) {
    venuePatch.curfew = text(venueRaw, "curfew", 5);
    if (!validTime(venuePatch.curfew))
      fail("Enter a valid curfew.", "validation", 400);
  }
  if (venueRaw.timezone !== undefined) {
    venuePatch.timezone = text(venueRaw, "timezone", 100);
    try {
      new Intl.DateTimeFormat("en", { timeZone: venuePatch.timezone });
    } catch {
      fail("Enter a valid IANA timezone.", "validation", 400);
    }
  }
  const doors = patch.doors ?? w.terms.doors,
    end = patch.end ?? w.terms.end;
  if (
    !validTime(doors) ||
    !validTime(end) ||
    doors >= end ||
    end > (venuePatch.curfew ?? w.venue.curfew)
  )
    fail("Keep the changed program within curfew.", "validation", 400);
  if (replacement)
    patch.program = (patch.program ?? w.terms.program).replace(
      supplier!.name,
      replacement.name,
    );
  let supplierTimingPatch: NonNullable<
    Workspace["change"]
  >["supplierTimingPatch"];
  if (requiresTypedSchedule(w)) {
    const delta = minutes(doors) - minutes(w.terms.doors);
    if (delta !== 0)
      supplierTimingPatch = changeOffers(
        w,
        { supplierId: sid, replacementId: rid },
        false,
      ).map((offer) => ({
        supplierId: offer.id,
        ...(offer.programStart !== undefined
          ? { programStart: shiftOfferTime(offer.programStart, delta) }
          : {}),
        ...(offer.setupStart !== undefined
          ? { setupStart: shiftOfferTime(offer.setupStart, delta) }
          : {}),
      }));
    patch.programSchedule = programScheduleFor(
      changeOffers(w, {
        supplierId: sid,
        replacementId: rid,
        supplierTimingPatch,
      }),
    );
    if (
      raw.programSchedule !== undefined &&
      canonicalJson(raw.programSchedule) !==
        canonicalJson(patch.programSchedule)
    )
      fail(
        "Schedule changes must use exact typed supplier offers. Add a new reviewed offer for different timing.",
        "validation",
        400,
      );
  } else if (raw.programSchedule !== undefined)
    fail(
      "The authored scenario schedule is managed by its selected treatment.",
      "validation",
      400,
    );
  const diff = Object.entries(patch)
    .filter(
      ([key, value]) =>
        canonicalJson(w.terms[key as keyof typeof patch]) !==
        canonicalJson(value),
    )
    .map(([field, after]) => ({
      field,
      before:
        field === "programSchedule"
          ? formatSchedule(w.terms.programSchedule)
          : String(w.terms[field as keyof typeof patch]),
      after:
        field === "programSchedule"
          ? formatSchedule(patch.programSchedule)
          : String(after),
    }));
  if (requiresTypedSchedule(w)) {
    const beforeSetup = formatSetup(selectedOffers(w)),
      afterSetup = formatSetup(
        changeOffers(w, {
          supplierId: sid,
          replacementId: rid,
          supplierTimingPatch,
        }),
      );
    if (beforeSetup !== afterSetup)
      diff.push({
        field: "setupSchedule",
        before: beforeSetup,
        after: afterSetup,
      });
  }
  diff.push(
    ...Object.entries(venuePatch)
      .filter(
        ([field, value]) => w.venue[field as keyof typeof venuePatch] !== value,
      )
      .map(([field, after]) => ({
        field,
        before: String(w.venue[field as keyof typeof venuePatch]),
        after: String(after),
      })),
  );
  if (!diff.length && !sid)
    fail("Provide a material change to review.", "validation", 400);
  const change: NonNullable<Workspace["change"]> = {
    id: id(),
    status: "PROPOSED",
    resumeLifecycle: w.event.lifecycle,
    reason: text(p, "reason", 1500, 5),
    supplierId: sid,
    replacementId: rid,
    before:
      supplier?.name ?? diff.map((d) => `${d.field}: ${d.before}`).join(" · "),
    after:
      replacement?.name ??
      (sid
        ? "No replacement selected — booking remains blocked"
        : diff.map((d) => `${d.field}: ${d.after}`).join(" · ")),
    costDeltaMinor:
      replacement && supplier ? replacement.feeMinor - supplier.feeMinor : 0,
    expectedTermsVersion: w.terms.version,
    affectedCommitments: w.commitments.filter((c) => c.status !== "WITHDRAWN")
      .length,
    affectedBookings: w.bookings.filter((b) => b.status !== "CANCELLED").length,
    createdAt: timestamp(),
    approvedAt: null,
    hashFormat: "canonical-json-v1",
    termsPatch: patch,
    ...(supplierTimingPatch?.length ? { supplierTimingPatch } : {}),
    venuePatch,
    diff,
  };
  const worksheet = costWorksheet(w),
    proposedCapacity = venuePatch.capacity ?? w.venue.capacity;
  change.totalCostDeltaMinor =
    change.costDeltaMinor +
    worksheet.variable * (proposedCapacity - w.venue.capacity);
  validateChangeFeasibility(w, change);
  change.proposedHash = hashChange(change, w);
  return change;
}
function proposeChange(w: Workspace, p: Record<string, unknown>) {
  keys(p, ["reason", "supplierId", "replacementId", "terms", "venue"]);
  if (
    !w.event.publishedAt ||
    ["LIVE", "COMPLETED", "CANCELLED"].includes(w.event.lifecycle)
  )
    fail("Material changes require a published event before it starts.");
  w.change = makeChange(w, p);
  w.event.bookingPaused = true;
  if (w.change.supplierId) {
    const supplier = w.suppliers.find((s) => s.id === w.change!.supplierId)!;
    supplier.status = "UNAVAILABLE";
    supplier.confirmedAt = null;
    w.event.operationalRisk = "SUPPLIER_LOSS";
  }
}

function invalidateRealConcepts(w: Workspace) {
  if (
    (w.mode !== "REAL" &&
      !w.concepts.some((c) => c.origin === "MODEL_HYPOTHESIS")) ||
    w.event.publishedAt
  )
    return;
  w.concepts = [];
  w.event.selectedConceptId = null;
  w.event.lifecycle = "DRAFT";
  w.event.title = "Untitled gathering";
}

export function productionReadiness(w: Workspace): string[] {
  if (!requiresTypedSchedule(w)) return [];
  const timing = assessOfferSchedule(
    selectedOffers(w),
    w.terms.doors,
    w.terms.end,
  );
  return [
    ...timing.violations,
    ...timing.unresolvedProgram,
    ...timing.unresolvedSetup,
    ...(!scheduleMatchesOffers(w.terms.programSchedule, selectedOffers(w))
      ? ["The approved program schedule no longer matches the exact offers."]
      : []),
    ...(w.venue.availability !== "AVAILABLE" ||
    !Number.isFinite(Date.parse(w.venue.validUntil)) ||
    Date.parse(w.venue.validUntil) <= Date.now()
      ? ["Venue confirmation expired."]
      : []),
    ...(!selectedConcept(w) ? ["No selected production."] : []),
    ...(selectedConcept(w)
      ?.supplierIds.filter((sid) => !supplierCurrent(w, sid))
      .map(() => "A selected supplier confirmation expired or changed.") ?? []),
    ...w.requirements.filter((r) => !r.confirmed).map((r) => r.label),
  ];
}

function validateChangeFeasibility(
  w: Workspace,
  change: NonNullable<Workspace["change"]>,
) {
  const venue = { ...w.venue, ...change.venuePatch },
    terms = { ...w.terms, ...change.termsPatch },
    worksheet = costWorksheet(w);
  const held = w.bookings
    .filter((b) => b.status !== "CANCELLED")
    .reduce((n, b) => n + b.quantity, 0);
  if (venue.capacity < held)
    fail(
      "The proposed capacity is below existing held allocations. Resolve withdrawals or choose a larger venue.",
      "capacity",
      409,
    );
  if (
    worksheet.fixed +
      change.costDeltaMinor +
      worksheet.variable * venue.capacity >
    w.brief.budgetMinor
  )
    fail("The proposed production exceeds the saved budget at full capacity.");
  if (change.supplierId && change.replacementId) {
    const original = w.suppliers.find((s) => s.id === change.supplierId),
      replacement = w.suppliers.find((s) => s.id === change.replacementId);
    if (
      !original ||
      !replacement ||
      replacement.feeMinor - original.feeMinor !== change.costDeltaMinor
    )
      fail(
        "Supplier fees changed after this proposal. Prepare a new exact change.",
        "stale_version",
        409,
      );
  }
  const offers = changeOffers(w, change);
  if (
    offers.some(
      (s) => s.soundDb !== undefined && s.soundDb > venue.soundLimitDb,
    )
  )
    fail("Selected supply exceeds the proposed venue sound limit.");
  if (
    terms.end > venue.curfew ||
    !validTime(terms.doors) ||
    !validTime(terms.end) ||
    terms.doors >= terms.end
  )
    fail("The proposed schedule exceeds the proposed venue curfew.");
  if (requiresTypedSchedule(w)) {
    const timing = assessOfferSchedule(offers, terms.doors, terms.end);
    if (timing.violations.length || timing.unresolvedProgram.length)
      throw new ActionError(
        "dependency",
        "The proposed exact program slots need review.",
        422,
        [...timing.violations, ...timing.unresolvedProgram],
      );
    if (!scheduleMatchesOffers(change.termsPatch?.programSchedule, offers))
      fail(
        "Supplier program slots changed after the proposal. Prepare a new exact change.",
        "stale_version",
        409,
      );
  } else {
    if (
      offers.reduce((n, s) => n + (s.durationMinutes ?? 0), 0) >
      minutes(terms.end) - minutes(terms.doors)
    )
      fail("Selected program durations exceed the proposed event window.");
    if (offers.some((s) => (s.setupMinutes ?? 0) > minutes(terms.doors)))
      fail("Selected setup would start before the available day.");
  }
}
