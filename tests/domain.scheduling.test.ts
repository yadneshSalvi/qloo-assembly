import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { type ActionType, type Supplier } from "@assembly/contracts";
import {
  ActionError,
  applyAction,
  concepts,
  createWorkspace,
  hashTerms,
  productionReadiness,
  publicEvent,
  researchSnapshot,
  supplierInvitationHash,
  supplierView,
  type StoredWorkspace,
} from "@assembly/domain";
import { hashSupplierOffer } from "../packages/domain/src/seed";
import {
  scheduleMatchesOffers,
  supplierScheduleIssues,
} from "../packages/domain/src/scheduling";
import { programScheduleFor } from "@assembly/contracts";

function fixture(): StoredWorkspace {
  const workspace = createWorkspace(randomUUID());
  workspace.concepts = [
    {
      ...structuredClone(concepts[0]),
      id: "live-scheduled",
      origin: "MODEL_HYPOTHESIS",
    },
  ];
  workspace.event.lifecycle = "CONCEPT_READY";
  for (const offer of workspace.suppliers)
    offer.validUntil = workspace.expiresAt;
  Object.assign(
    workspace.suppliers.find((s) => s.id === "low-lights")!,
    {
      programStart: "19:00",
      setupStart: "17:30",
      setupMinutes: 60,
      durationMinutes: 50,
      canOverlap: false,
    },
  );
  Object.assign(
    workspace.suppliers.find((s) => s.id === "little-table")!,
    {
      programStart: "20:00",
      setupStart: "17:30",
      setupMinutes: 45,
      durationMinutes: 45,
      canOverlap: false,
    },
  );
  return { workspace, contactDigests: {} };
}
function act(
  s: StoredWorkspace,
  type: ActionType,
  payload: Record<string, unknown> = {},
) {
  return applyAction(s, {
    type,
    payload,
    expectedVersion: s.workspace.version,
    idempotencyKey: randomUUID(),
  });
}
function select(s: StoredWorkspace) {
  act(s, "SELECT_CONCEPT", { conceptId: "live-scheduled" });
}
function prepared(s: StoredWorkspace) {
  select(s);
  act(s, "PUBLISH", { termsHash: s.workspace.terms.hash });
  for (const supplierId of ["low-lights", "little-table"])
    act(s, "CONFIRM_SUPPLIER", { supplierId });
  for (const requirement of s.workspace.requirements)
    act(s, "CONFIRM_REQUIREMENT", {
      requirementId: requirement.id,
      proof: "Authored operator checklist evidence.",
    });
  act(s, "GREENLIGHT", { termsHash: s.workspace.terms.hash });
  act(s, "OPEN_BOOKING");
}
function offerPayload(supplier: Supplier) {
  const {
    id,
    name,
    discipline,
    feeMinor,
    description,
    critical,
    source,
    influence,
    scope,
    validUntil,
    setupMinutes,
    durationMinutes,
    programStart,
    setupStart,
    canOverlap,
    soundDb,
  } = supplier;
  return {
    id,
    name,
    discipline,
    feeMinor,
    description,
    critical,
    source,
    influence,
    scope,
    validUntil,
    setupMinutes,
    durationMinutes,
    programStart,
    setupStart,
    canOverlap,
    soundDb,
  };
}

describe("typed schedule authority without network or database writes", () => {
  it("ignores persisted object-key order while retaining every slot value and array order", () => {
    const s = fixture();
    const offers = s.workspace.suppliers.filter((offer) =>
      ["low-lights", "little-table"].includes(offer.id),
    );
    const slots = programScheduleFor(offers);
    const reordered = slots.map((slot) =>
      Object.fromEntries(Object.entries(slot).reverse()),
    ) as typeof slots;
    expect(scheduleMatchesOffers(reordered, offers)).toBe(true);
    expect(scheduleMatchesOffers([...reordered].reverse(), offers)).toBe(false);
    for (const patch of [
      { supplierId: "another-offer" },
      { name: "Another supplier" },
      { start: "19:05" },
      { end: "19:55" },
      { canOverlap: true },
      { unapprovedField: "must not be ignored" },
    ])
      expect(
        scheduleMatchesOffers(
          [{ ...reordered[0], ...patch }, reordered[1]],
          offers,
        ),
      ).toBe(false);
  });
  it("uses the agreed 19:00 set and 20:00 supper, includes exact setup, and captures approved terms", () => {
    const s = fixture();
    select(s);
    const w = s.workspace;
    expect(w.runOfShow.find((row) => row.id === "offer-low-lights")?.time).toBe(
      "19:00",
    );
    expect(
      w.runOfShow.find((row) => row.id === "offer-little-table")?.time,
    ).toBe("20:00");
    expect(w.runOfShow.find((row) => row.id === "setup-low-lights")?.time).toBe(
      "17:30",
    );
    expect(w.runOfShow.map((row) => row.time)).toEqual(
      w.runOfShow.map((row) => row.time).sort(),
    );
    expect(w.tasks.every((task) => task.due === "TBC")).toBe(true);
    expect(w.terms.programSchedule).toEqual([
      {
        supplierId: "low-lights",
        name: "Nila & The Low Lights",
        start: "19:00",
        end: "19:50",
        canOverlap: false,
      },
      {
        supplierId: "little-table",
        name: "Little Table",
        start: "20:00",
        end: "20:45",
        canOverlap: false,
      },
    ]);
    const event = publicEvent(w);
    expect(event.programSchedulePending).toBe(false);
    expect(
      event.runOfShow
        .filter((row) => row.id.startsWith("offer-"))
        .map((row) => row.time),
    ).toEqual(["19:00", "20:00"]);
    expect(event.runOfShow.some((row) => row.id.startsWith("setup-"))).toBe(
      false,
    );
  });
  it("does not parse scope prose or invent legacy slots, and leaves approved terms/hash unchanged on reads", () => {
    const s = fixture();
    for (const offer of s.workspace.suppliers) {
      delete offer.programStart;
      delete offer.setupStart;
      delete offer.canOverlap;
    }
    select(s);
    const w = s.workspace;
    expect(w.terms.programSchedule).toEqual([]);
    expect(w.runOfShow.map((row) => row.id)).toEqual(["doors", "close"]);
    // Emulate a pre-candidate03 published model document, with a historically invented timeline.
    delete w.terms.programSchedule;
    w.terms.hash = hashTerms(w.terms);
    w.runOfShow.push({
      id: "old-invented",
      time: "18:30",
      title: "Invented legacy set",
      detail: "Old calculation",
      owner: "Operator",
    });
    const before = JSON.stringify(w.terms);
    const event = publicEvent(w);
    expect(event.programSchedulePending).toBe(true);
    expect(event.runOfShow.map((row) => row.id)).toEqual(["doors", "close"]);
    expect(JSON.stringify(w.terms)).toBe(before);
    expect(() => act(s, "PUBLISH", { termsHash: w.terms.hash })).toThrow(
      ActionError,
    );
    expect(() =>
      act(s, "CONFIRM_SUPPLIER", { supplierId: "low-lights" }),
    ).toThrow("exact program and setup timing");
  });
  it("allows explicitly parallel service without rejecting the sum of durations, but rejects a real conflict", () => {
    const s = fixture();
    for (const id of ["low-lights", "little-table"])
      Object.assign(
        s.workspace.suppliers.find((o) => o.id === id)!,
        { programStart: "19:00", durationMinutes: 120 },
      );
    s.workspace.suppliers.find((o) => o.id === "little-table")!.canOverlap =
      true;
    select(s);
    expect(() =>
      act(s, "PUBLISH", { termsHash: s.workspace.terms.hash }),
    ).not.toThrow();
    const conflict = fixture();
    Object.assign(
      conflict.workspace.suppliers.find((o) => o.id === "little-table")!,
      { programStart: "19:20" },
    );
    select(conflict);
    try {
      act(conflict, "PUBLISH", { termsHash: conflict.workspace.terms.hash });
      throw new Error("Expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError);
      expect(
        (error as ActionError).details?.some((detail) =>
          detail.includes("overlap"),
        ),
      ).toBe(true);
    }
  });
  it("keeps setup unresolved until explicitly entered and blocks confirmation and greenlight", () => {
    const s = fixture();
    delete s.workspace.suppliers.find((o) => o.id === "low-lights")!.setupStart;
    select(s);
    act(s, "PUBLISH", { termsHash: s.workspace.terms.hash });
    expect(
      supplierScheduleIssues(
        s.workspace,
        s.workspace.suppliers.find((o) => o.id === "low-lights")!,
      ).some((detail) => detail.includes("setup start")),
    ).toBe(true);
    expect(() =>
      act(s, "CONFIRM_SUPPLIER", { supplierId: "low-lights" }),
    ).toThrow("exact program and setup");
    expect(
      productionReadiness(s.workspace).some((detail) =>
        detail.includes("setup start"),
      ),
    ).toBe(true);
    expect(() =>
      act(s, "GREENLIGHT", { termsHash: s.workspace.terms.hash }),
    ).toThrow("unresolved");
    expect(
      supplierView(s.workspace, "low-lights").requiresEnteredSchedule,
    ).toBe(true);
    expect(supplierView(s.workspace, "low-lights").supplier.programStart).toBe(
      "19:00",
    );
  });
  it("validates entered fields, fingerprints them, preserves cultural mappings, and prohibits silent published edits", () => {
    const s = fixture(),
      offer = s.workspace.suppliers.find((o) => o.id === "low-lights")!;
    s.workspace.research = {
      anchors: [
        {
          id: "fixture-anchor",
          entityId: "fixture-anchor",
          entityType: "artist",
          name: "Explicit fixture anchor",
          disambiguation: "Synthetic test",
          confirmedAt: "2026-01-01",
          source: "CATALOG_SELECTION",
        },
      ],
      influences: [
        {
          supplierId: offer.id,
          entityId: "fixture-influence",
          entityType: "artist",
          name: "Explicit fixture influence",
          confirmedAt: "2026-01-01",
        },
      ],
      search: null,
      targetTypes: ["artist", "movie"],
      trace: [],
      budget: { qlooUsed: 0, qlooLimit: 6, modelUsed: 0, modelLimit: 3 },
    };
    const cultural = JSON.stringify({
      anchors: s.workspace.research.anchors,
      influences: s.workspace.research.influences,
    });
    const before = researchSnapshot(s.workspace).inputHash;
    expect(() =>
      act(s, "UPSERT_SUPPLIER", {
        supplier: { ...offerPayload(offer), programStart: "25:00" },
      }),
    ).toThrow("programStart");
    expect(() =>
      act(s, "UPSERT_SUPPLIER", {
        supplier: { ...offerPayload(offer), canOverlap: "yes" },
      }),
    ).toThrow("overlap");
    act(s, "UPSERT_SUPPLIER", {
      supplier: { ...offerPayload(offer), programStart: "19:05" },
    });
    expect(researchSnapshot(s.workspace).inputHash).not.toBe(before);
    expect(
      JSON.stringify({
        anchors: s.workspace.research.anchors,
        influences: s.workspace.research.influences,
      }),
    ).toBe(cultural);
    const published = fixture();
    prepared(published);
    const active = published.workspace.suppliers.find(
      (o) => o.id === "low-lights",
    )!;
    expect(() =>
      act(published, "UPSERT_SUPPLIER", {
        supplier: { ...offerPayload(active), programStart: "19:05" },
      }),
    ).toThrow("explicit change proposal");
  });
  it("preserves legacy invitation hashes but binds every entered program/setup/overlap term", () => {
    const s = fixture(),
      w = s.workspace,
      offer = w.suppliers.find((o) => o.id === "low-lights")!;
    delete offer.programStart;
    delete offer.setupStart;
    delete offer.canOverlap;
    const legacy = createHash("sha256")
      .update(
        JSON.stringify({
          supplierId: offer.id,
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
          scope: offer.scope,
          feeMinor: offer.feeMinor,
          currency: w.terms.currency,
        }),
      )
      .digest("hex");
    expect(hashSupplierOffer(w, offer)).toBe(legacy);
    Object.assign(offer, {
      programStart: "19:00",
      setupStart: "17:30",
      canOverlap: false,
    });
    const typed = supplierInvitationHash(w, offer.id);
    expect(typed).not.toBe(legacy);
    for (const patch of [
      { programStart: "19:05" },
      { durationMinutes: 55 },
      { setupStart: "17:20" },
      { setupMinutes: 45 },
      { canOverlap: true },
    ])
      expect(hashSupplierOffer(w, { ...offer, ...patch })).not.toBe(typed);
  });
  it("reviews the replacement actual slot and rejects changed program or setup after proposal", () => {
    for (const modification of [
      { programStart: "19:10" },
      { setupStart: "17:20" },
    ]) {
      const s = fixture();
      prepared(s);
      act(s, "DISRUPT", { supplierId: "low-lights" });
      expect(s.workspace.change?.replacementId).toBe("");
      const replacement = s.workspace.suppliers.find(
        (o) => o.id === "sunday-people",
      )!;
      act(s, "UPSERT_SUPPLIER", {
        supplier: {
          ...offerPayload(replacement),
          programStart: "19:05",
          setupStart: "17:30",
          setupMinutes: 60,
          durationMinutes: 50,
          canOverlap: false,
        },
      });
      act(s, "PROPOSE_CHANGE", {
        supplierId: "low-lights",
        replacementId: "sunday-people",
        reason: "Review exact replacement offer.",
      });
      const change = s.workspace.change!;
      expect(
        change.termsPatch?.programSchedule?.find(
          (slot) => slot.supplierId === "sunday-people",
        )?.start,
      ).toBe("19:05");
      expect(
        change.diff?.find((diff) => diff.field === "programSchedule")?.after,
      ).toContain("19:05–19:55");
      const current = s.workspace.suppliers.find(
        (o) => o.id === "sunday-people",
      )!;
      act(s, "UPSERT_SUPPLIER", {
        supplier: { ...offerPayload(current), ...modification },
      });
      act(s, "CONFIRM_SUPPLIER", { supplierId: "sunday-people" });
      expect(() =>
        act(s, "APPROVE_CHANGE", {
          changeId: change.id,
          termsHash: s.workspace.terms.hash,
        }),
      ).toThrow(
        modification.programStart
          ? "program slots changed"
          : "proposal changed",
      );
    }
  });
  it("approves a reviewed replacement schedule with a new terms hash and renewed attendee consent", () => {
    const s = fixture();
    prepared(s);
    const interest = act(s, "EXPRESS_INTEREST", {
      name: "Sample attendee",
      email: "fixture@example.test",
      quantity: 1,
      consent: true,
      termsVersion: s.workspace.terms.version,
    });
    act(s, "VERIFY_INTEREST", {
      token: interest.token,
      termsVersion: s.workspace.terms.version,
    });
    act(s, "DISRUPT", { supplierId: "low-lights" });
    const replacement = s.workspace.suppliers.find(
      (o) => o.id === "sunday-people",
    )!;
    act(s, "UPSERT_SUPPLIER", {
      supplier: {
        ...offerPayload(replacement),
        programStart: "19:05",
        setupStart: "17:30",
        setupMinutes: 60,
        durationMinutes: 50,
        canOverlap: false,
      },
    });
    act(s, "PROPOSE_CHANGE", {
      supplierId: "low-lights",
      replacementId: "sunday-people",
      reason: "Review replacement exact time and scope.",
    });
    act(s, "CONFIRM_SUPPLIER", { supplierId: "sunday-people" });
    const oldHash = s.workspace.terms.hash;
    act(s, "APPROVE_CHANGE", {
      changeId: s.workspace.change!.id,
      termsHash: oldHash,
    });
    expect(s.workspace.terms.hash).not.toBe(oldHash);
    expect(s.workspace.commitments[0].status).toBe("RECONFIRM_REQUIRED");
    expect(
      publicEvent(s.workspace).runOfShow.find(
        (row) => row.id === "offer-sunday-people",
      )?.time,
    ).toBe("19:05");
  });
  it("proposes a later doors shift with exact program/setup diffs and applies it only on explicit approval", () => {
    const s = fixture();
    prepared(s);
    const interest = act(s, "EXPRESS_INTEREST", {
      name: "Sample attendee",
      email: "shift@example.test",
      quantity: 1,
      consent: true,
      termsVersion: s.workspace.terms.version,
    });
    act(s, "VERIFY_INTEREST", {
      token: interest.token,
      termsVersion: s.workspace.terms.version,
    });
    const beforeTerms = JSON.stringify(s.workspace.terms),
      oldHash = s.workspace.terms.hash;
    act(s, "PROPOSE_CHANGE", {
      reason:
        "The operator proposes later doors and exact corresponding supplier slots.",
      terms: { doors: "19:00", end: "22:30" },
    });
    const change = s.workspace.change!;
    expect(
      s.workspace.suppliers.find((offer) => offer.id === "low-lights")
        ?.programStart,
    ).toBe("19:00");
    expect(
      s.workspace.suppliers.find((offer) => offer.id === "low-lights")
        ?.setupStart,
    ).toBe("17:30");
    expect(JSON.stringify(s.workspace.terms)).toBe(beforeTerms);
    expect(change.supplierTimingPatch).toEqual([
      { supplierId: "low-lights", programStart: "19:30", setupStart: "18:00" },
      {
        supplierId: "little-table",
        programStart: "20:30",
        setupStart: "18:00",
      },
    ]);
    expect(
      change.diff?.find((diff) => diff.field === "programSchedule")?.after,
    ).toContain("19:30–20:20");
    expect(
      change.diff?.find((diff) => diff.field === "setupSchedule")?.after,
    ).toContain("18:00–19:00");
    act(s, "APPROVE_CHANGE", { changeId: change.id, termsHash: oldHash });
    expect(s.workspace.terms.doors).toBe("19:00");
    expect(s.workspace.terms.hash).not.toBe(oldHash);
    expect(
      s.workspace.terms.programSchedule?.find(
        (slot) => slot.supplierId === "low-lights",
      )?.start,
    ).toBe("19:30");
    expect(
      s.workspace.suppliers.find((offer) => offer.id === "low-lights")
        ?.programStart,
    ).toBe("19:30");
    expect(
      s.workspace.suppliers.find((offer) => offer.id === "little-table")
        ?.setupStart,
    ).toBe("18:00");
    expect(
      s.workspace.suppliers
        .filter((offer) => ["low-lights", "little-table"].includes(offer.id))
        .every((offer) => offer.status === "QUOTED"),
    ).toBe(true);
    expect(s.workspace.commitments[0].status).toBe("RECONFIRM_REQUIRED");
    expect(
      publicEvent(s.workspace).runOfShow.find(
        (row) => row.id === "offer-little-table",
      )?.time,
    ).toBe("20:30");
  });
  it("rejects same-day boundary failures, an event window too short for a shift, and stale original timing", () => {
    const early = fixture();
    prepared(early);
    expect(() =>
      act(early, "PROPOSE_CHANGE", {
        reason: "This shift would move setup before the event date.",
        terms: { doors: "00:30" },
      }),
    ).toThrow("cross the event day");
    const late = fixture();
    prepared(late);
    expect(() =>
      act(late, "PROPOSE_CHANGE", {
        reason: "This shift would move program after midnight.",
        terms: { doors: "23:30", end: "23:59" },
        venue: { curfew: "23:59" },
      }),
    ).toThrow("cross the event day");
    const short = fixture();
    prepared(short);
    expect(() =>
      act(short, "PROPOSE_CHANGE", {
        reason: "Later doors without sufficient room in the event window.",
        terms: { doors: "21:30" },
      }),
    ).toThrow("exact program slots");
    const stale = fixture();
    prepared(stale);
    act(stale, "PROPOSE_CHANGE", {
      reason: "Review the exact original supplier timing.",
      terms: { doors: "19:00", end: "22:30" },
    });
    stale.workspace.suppliers.find(
      (offer) => offer.id === "low-lights",
    )!.setupStart = "17:20";
    expect(() =>
      act(stale, "APPROVE_CHANGE", {
        changeId: stale.workspace.change!.id,
        termsHash: stale.workspace.terms.hash,
      }),
    ).toThrow("proposal changed");
  });
  function researchReady(s: StoredWorkspace) {
    s.workspace.research = {
      anchors: [
        {
          id: "fixture-anchor",
          entityId: "fixture-anchor",
          entityType: "artist",
          name: "Explicit fixture anchor",
          disambiguation: "Synthetic test",
          confirmedAt: "2026-01-01",
          source: "CATALOG_SELECTION",
        },
      ],
      influences: [
        {
          supplierId: "low-lights",
          entityId: "fixture-influence",
          entityType: "artist",
          name: "Explicit fixture influence",
          confirmedAt: "2026-01-01",
        },
      ],
      search: null,
      targetTypes: ["artist", "movie"],
      trace: [
        {
          id: "prior-trace",
          stage: "Prior saved research",
          summary: "Preserve this saved evidence.",
          at: "2026-01-01",
        },
      ],
      budget: { qlooUsed: 3, qlooLimit: 6, modelUsed: 1, modelLimit: 3 },
    };
  }
  it("rejects an all-missing timing pool before changing run intent, budget, cultural selections or workspace state", () => {
    const s = fixture();
    researchReady(s);
    for (const offer of s.workspace.suppliers) {
      delete offer.programStart;
      delete offer.setupStart;
    }
    const before = JSON.stringify(s);
    try {
      act(s, "RESEARCH", { mode: "LIVE" });
      throw new Error("Expected timing preflight rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError);
      expect((error as ActionError).code).toBe("dependency");
      expect((error as ActionError).message).toContain(
        "at least two individually feasible offers",
      );
      expect(
        (error as ActionError).details?.some(
          (detail) =>
            detail.includes("Nila") &&
            detail.includes("program start") &&
            detail.includes("setup start"),
        ),
      ).toBe(true);
    }
    expect(s.workspace.run).toBeNull();
    expect(JSON.stringify(s)).toBe(before);
  });
  it("rejects one complete offer without changing run intent or saved cultural state", () => {
    const s = fixture();
    researchReady(s);
    for (const offer of s.workspace.suppliers)
      if (offer.id !== "low-lights") {
        delete offer.programStart;
        delete offer.setupStart;
        offer.validUntil = "2020-01-01";
      }
    const before = JSON.stringify(s);
    expect(() => act(s, "RESEARCH", { mode: "LIVE" })).toThrow(
      "at least two individually feasible offers",
    );
    expect(JSON.stringify(s)).toBe(before);
  });
  it("accepts two independently feasible offers while unused incomplete alternatives remain unresolved", () => {
    const s = fixture();
    researchReady(s);
    for (const offer of s.workspace.suppliers)
      if (!["low-lights", "little-table"].includes(offer.id)) {
        delete offer.programStart;
        delete offer.setupStart;
        offer.validUntil = "2020-01-01";
      }
    // Two valid singleton alternatives need not fit together: these overlap and their joint cost exceeds this budget.
    s.workspace.brief.budgetMinor = 100000;
    s.workspace.suppliers.find(
      (offer) => offer.id === "little-table",
    )!.programStart = "19:00";
    const cultural = JSON.stringify({
      anchors: s.workspace.research!.anchors,
      influences: s.workspace.research!.influences,
    });
    act(s, "RESEARCH", { mode: "LIVE" });
    expect(s.workspace.run?.status).toBe("QUEUED");
    expect(s.workspace.run?.mode).toBe("LIVE");
    expect(
      JSON.stringify({
        anchors: s.workspace.research!.anchors,
        influences: s.workspace.research!.influences,
      }),
    ).toBe(cultural);
  });
  it("rejects individually over-budget or over-sound offers before changing saved state", () => {
    const s = fixture();
    researchReady(s);
    s.workspace.suppliers.find((offer) => offer.id === "low-lights")!.feeMinor =
      200000;
    s.workspace.suppliers.find(
      (offer) => offer.id === "little-table",
    )!.soundDb = 100;
    const before = JSON.stringify(s);
    try {
      act(s, "RESEARCH", { mode: "LIVE" });
      throw new Error("Expected physical and cost preflight rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError);
      expect(
        (error as ActionError).details?.some((detail) =>
          detail.includes("saved budget"),
        ),
      ).toBe(true);
      expect(
        (error as ActionError).details?.some((detail) =>
          detail.includes("sound limit"),
        ),
      ).toBe(true);
    }
    expect(JSON.stringify(s)).toBe(before);
  });
  it("does not treat unavailable or expired complete offers as a usable research pool", () => {
    const s = fixture();
    researchReady(s);
    s.workspace.suppliers = s.workspace.suppliers.filter((offer) =>
      ["low-lights", "little-table"].includes(offer.id),
    );
    s.workspace.suppliers[0].status = "UNAVAILABLE";
    s.workspace.suppliers[1].validUntil = "2020-01-01";
    const before = JSON.stringify(s);
    try {
      act(s, "RESEARCH", { mode: "LIVE" });
      throw new Error("Expected availability preflight rejection");
    } catch (error) {
      expect(
        (error as ActionError).details?.some((detail) =>
          detail.includes("unavailable"),
        ),
      ).toBe(true);
      expect(
        (error as ActionError).details?.some((detail) =>
          detail.includes("quote validity"),
        ),
      ).toBe(true);
    }
    expect(JSON.stringify(s)).toBe(before);
  });
});
