import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { countsFor, type ActionType } from "@assembly/contracts";
import {
  ActionError,
  applyAction,
  concepts,
  createWorkspace,
  type StoredWorkspace,
  workerHealth,
} from "@assembly/domain";

function fixture() {
  return {
    workspace: createWorkspace(randomUUID()),
    contactDigests: {},
  } satisfies StoredWorkspace;
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
function prepared(s: StoredWorkspace) {
  s.workspace.concepts = structuredClone(concepts);
  s.workspace.event.lifecycle = "CONCEPT_READY";
  act(s, "SELECT_CONCEPT", { conceptId: "blue-hour" });
  act(s, "PUBLISH", { termsHash: s.workspace.terms.hash });
  for (const supplierId of ["low-lights", "little-table"])
    act(s, "CONFIRM_SUPPLIER", { supplierId });
  for (const r of s.workspace.requirements)
    act(s, "CONFIRM_REQUIREMENT", {
      requirementId: r.id,
      proof: "Sample operator checklist reviewed.",
    });
  act(s, "GREENLIGHT", { termsHash: s.workspace.terms.hash });
  act(s, "OPEN_BOOKING");
}
function interest(
  s: StoredWorkspace,
  email = "guest@example.test",
  quantity = 1,
) {
  const result = act(s, "EXPRESS_INTEREST", {
    name: "Sample Guest",
    email,
    quantity,
    consent: true,
    termsVersion: s.workspace.terms.version,
  });
  act(s, "VERIFY_INTEREST", {
    token: result.token,
    termsVersion: s.workspace.terms.version,
  });
  return s.workspace.commitments.at(-1)!;
}

describe("production authority and exact terms", () => {
  it("keeps each concept’s public program, supplier scope and schedule consistent", () => {
    for (const [conceptId, supplierName, treatment] of [
      ["night-garden", "Frame Club", "short-film"],
      ["soft-signals", "Paper & Sound", "print workshop"],
    ]) {
      const s = fixture();
      s.workspace.concepts = structuredClone(concepts);
      s.workspace.event.lifecycle = "CONCEPT_READY";
      act(s, "SELECT_CONCEPT", { conceptId });
      expect(s.workspace.terms.program).toContain(supplierName);
      expect(
        s.workspace.runOfShow.find((item) => item.id === "music")?.detail,
      ).toContain(treatment);
      expect(JSON.stringify(s.workspace.runOfShow)).not.toContain("Nila");
      expect(s.workspace.runOfShow.map((item) => item.time)).toEqual(
        s.workspace.runOfShow.map((item) => item.time).sort(),
      );
    }
  });
  it("rebuilds the schedule and invalidates confirmed supply when timing changes", () => {
    const s = fixture();
    s.workspace.concepts = structuredClone(concepts);
    s.workspace.event.lifecycle = "CONCEPT_READY";
    act(s, "SELECT_CONCEPT", { conceptId: "blue-hour" });
    act(s, "CONFIRM_SUPPLIER", { supplierId: "low-lights" });
    act(s, "SAVE_BRIEF", {
      brief: { ...s.workspace.brief, doors: "18:00", end: "21:30" },
    });
    expect(
      s.workspace.runOfShow.find((item) => item.id === "music")?.time,
    ).toBe("18:30");
    expect(
      s.workspace.suppliers.find((item) => item.id === "low-lights")?.status,
    ).toBe("QUOTED");
    expect(s.workspace.venue.availability).toBe("UNCONFIRMED");
    expect(() =>
      act(s, "SAVE_BRIEF", {
        brief: { ...s.workspace.brief, doors: "20:00", end: "21:00" },
      }),
    ).toThrow("three hours");
  });
  it("does not treat a concept or unverified supply as a greenlight", () => {
    const s = fixture();
    expect(() =>
      act(s, "GREENLIGHT", { termsHash: s.workspace.terms.hash }),
    ).toThrow(ActionError);
    s.workspace.concepts = structuredClone(concepts);
    s.workspace.event.lifecycle = "CONCEPT_READY";
    act(s, "SELECT_CONCEPT", { conceptId: "blue-hour" });
    act(s, "PUBLISH", { termsHash: s.workspace.terms.hash });
    expect(() =>
      act(s, "GREENLIGHT", { termsHash: s.workspace.terms.hash }),
    ).toThrow("unresolved");
  });
  it("rejects stale versions, unknown fields and stale approval hashes", () => {
    const s = fixture();
    expect(() =>
      applyAction(s, {
        type: "CONFIRM_AVAILABILITY",
        payload: {},
        expectedVersion: 0,
        idempotencyKey: randomUUID(),
      }),
    ).toThrow("changed");
    expect(() =>
      act(s, "CONFIRM_AVAILABILITY", { approveEverything: true }),
    ).toThrow("unsupported");
    s.workspace.concepts = structuredClone(concepts);
    s.workspace.event.lifecycle = "CONCEPT_READY";
    act(s, "SELECT_CONCEPT", { conceptId: "blue-hour" });
    expect(() => act(s, "PUBLISH", { termsHash: "old" })).toThrow("changed");
  });
  it("blocks an event outside curfew or budget", () => {
    const s = fixture();
    s.workspace.concepts = structuredClone(concepts);
    s.workspace.event.lifecycle = "CONCEPT_READY";
    act(s, "SELECT_CONCEPT", { conceptId: "blue-hour" });
    s.workspace.brief.end = "23:00";
    expect(() =>
      act(s, "PUBLISH", { termsHash: s.workspace.terms.hash }),
    ).toThrow("feasible");
    s.workspace.brief.end = "22:00";
    s.workspace.brief.budgetMinor = 100;
    expect(() =>
      act(s, "PUBLISH", { termsHash: s.workspace.terms.hash }),
    ).toThrow("feasible");
  });
  it("never silently falls back from live research to authored results", () => {
    const s = fixture();
    expect(() => act(s, "RESEARCH", { mode: "LIVE" })).toThrow("not connected");
    expect(s.workspace.run).toBeNull();
  });
});

describe("interest, bookings and attendance are different facts", () => {
  it("deduplicates contacts and counts only verified choices as verified", () => {
    const s = fixture();
    prepared(s);
    act(s, "EXPRESS_INTEREST", {
      name: "Guest",
      email: "one@example.test",
      quantity: 2,
      consent: true,
      termsVersion: s.workspace.terms.version,
    });
    expect(countsFor(s.workspace)).toMatchObject({
      interested: 2,
      pending: 2,
      verified: 0,
      bookings: 0,
    });
    expect(() => interest(s, "ONE@example.test")).toThrow("already");
  });
  it("requires verification, prevents duplicate allocation and cannot oversell", () => {
    const s = fixture();
    prepared(s);
    s.workspace.venue.capacity = 1;
    const first = interest(s);
    act(s, "BOOK", { commitmentId: first.id });
    const second = interest(s, "other@example.test");
    expect(() => act(s, "BOOK", { commitmentId: second.id })).toThrow(
      "remaining",
    );
    expect(() => act(s, "BOOK", { commitmentId: first.id })).toThrow("already");
    expect(countsFor(s.workspace).remaining).toBe(0);
    act(s, "WITHDRAW_INTEREST", {
      token: first.token,
      termsVersion: s.workspace.terms.version,
    });
    expect(countsFor(s.workspace).remaining).toBe(1);
  });
  it("does not accept check-in before readiness or complete before live", () => {
    const s = fixture();
    prepared(s);
    const c = interest(s);
    act(s, "BOOK", { commitmentId: c.id });
    expect(() =>
      act(s, "CHECK_IN", { bookingId: s.workspace.bookings[0].id }),
    ).toThrow("ready");
    expect(() => act(s, "COMPLETE_EVENT")).toThrow("Start");
  });
});

describe("recovery preserves capacity and asks for renewed consent", () => {
  it("pauses, reviews the replacement, invalidates commitments and preserves held seats until resolved", () => {
    const s = fixture();
    prepared(s);
    const c = interest(s, "guest@example.test", 2);
    act(s, "BOOK", { commitmentId: c.id });
    const oldVersion = s.workspace.terms.version,
      remaining = countsFor(s.workspace).remaining;
    act(s, "DISRUPT", { supplierId: "low-lights" });
    expect(s.workspace.event.bookingPaused).toBe(true);
    expect(() =>
      act(s, "APPROVE_CHANGE", { termsHash: s.workspace.terms.hash }),
    ).toThrow("availability");
    act(s, "CONFIRM_SUPPLIER", { supplierId: "sunday-people" });
    act(s, "APPROVE_CHANGE", {
      termsHash: s.workspace.terms.hash,
      changeId: s.workspace.change!.id,
    });
    expect(s.workspace.terms.version).toBe(oldVersion + 1);
    expect(countsFor(s.workspace).remaining).toBe(remaining);
    expect(countsFor(s.workspace).bookings).toBe(0);
    expect(s.workspace.bookings[0].status).toBe("RECONFIRM_REQUIRED");
    expect(() => act(s, "RESUME_BOOKING")).toThrow("Resolve");
    act(s, "RECONFIRM", {
      token: c.token,
      termsVersion: s.workspace.terms.version,
    });
    act(s, "RESUME_BOOKING");
    expect(s.workspace.bookings[0].status).toBe("CONFIRMED");
    expect(s.workspace.event.bookingPaused).toBe(false);
  });
  it("requires dependency evidence then records sample completion", () => {
    const s = fixture();
    prepared(s);
    const c = interest(s);
    act(s, "BOOK", { commitmentId: c.id });
    expect(() =>
      act(s, "COMPLETE_TASK", { taskId: "front", evidence: "Checked." }),
    ).toThrow("preceding");
    for (const task of s.workspace.tasks)
      act(s, "COMPLETE_TASK", {
        taskId: task.id,
        evidence: "Sample operator verified this task.",
      });
    act(s, "MARK_READY");
    act(s, "CHECK_IN", { bookingId: s.workspace.bookings[0].id });
    act(s, "START_EVENT");
    act(s, "COMPLETE_EVENT");
    expect(s.workspace.event.lifecycle).toBe("COMPLETED");
    expect(countsFor(s.workspace).checkins).toBe(1);
  });
});

describe("live planning stays tied to operator inputs", () => {
  it("clears live concept and selection when its editable cost basis changes", () => {
    for (const mode of ["REAL", "SAMPLE"] as const) {
      const s = {
        workspace: createWorkspace(randomUUID(), mode),
        contactDigests: {},
      } satisfies StoredWorkspace;
      s.workspace.concepts = [
        { ...structuredClone(concepts[0]), origin: "MODEL_HYPOTHESIS" },
      ];
      s.workspace.event.lifecycle = "CONCEPT_READY";
      s.workspace.event.selectedConceptId = s.workspace.concepts[0].id;
      const brief = {
        ...s.workspace.brief,
        ambition: "Operator gathering",
        date: "2026-12-01",
        audience: "Operator audience",
        anchors: ["Test anchor"],
        budgetMinor: 160000,
        ticketPriceMinor: 0,
        overheadMinor: 20000,
        perGuestMinor: 800,
      };
      act(s, "SAVE_BRIEF", { brief });
      expect(s.workspace.concepts).toEqual([]);
      expect(s.workspace.event.selectedConceptId).toBeNull();
      expect(s.workspace.event.lifecycle).toBe("DRAFT");
    }
  });
  it("uses only selected inventory and operator timing for live sample schedules", () => {
    const s = fixture();
    s.workspace.concepts = [
      {
        ...structuredClone(concepts[0]),
        id: "live-test",
        origin: "MODEL_HYPOTHESIS",
        supplierIds: ["frame-club", "paper-sound"],
      },
    ];
    s.workspace.event.lifecycle = "CONCEPT_READY";
    Object.assign(
      s.workspace.suppliers.find((offer) => offer.id === "frame-club")!,
      { programStart: "19:00", setupStart: "17:30" },
    );
    Object.assign(
      s.workspace.suppliers.find((offer) => offer.id === "paper-sound")!,
      { programStart: "20:15", setupStart: "17:30" },
    );
    act(s, "SELECT_CONCEPT", { conceptId: "live-test" });
    const schedule = JSON.stringify(s.workspace.runOfShow);
    expect(schedule).toContain("Frame Club");
    expect(schedule).toContain("Paper & Sound");
    expect(schedule).not.toContain("Little Table");
    expect(schedule).not.toContain("Nila");
    expect(schedule).toContain("19:00–20:10");
    expect(schedule).toContain("20:15–21:45");
    expect(schedule).not.toContain("Operator must confirm screening rights");
  });
  it("rejects replacement supply already selected in the same production", () => {
    const s = fixture();
    prepared(s);
    expect(() =>
      act(s, "PROPOSE_CHANGE", {
        reason: "Replace with an already selected offer.",
        supplierId: "low-lights",
        replacementId: "little-table",
      }),
    ).toThrow("available replacement quote");
  });
  it("rejects a replacement without identifying the supplier being replaced", () => {
    const s = fixture();
    prepared(s);
    expect(() =>
      act(s, "PROPOSE_CHANGE", {
        reason: "Malformed replacement request.",
        replacementId: "sunday-people",
        terms: { title: "Updated proposal" },
      }),
    ).toThrow("Choose the selected supplier");
  });
  it("invalidates room and service tasks when date or access changes", () => {
    const s = fixture();
    prepared(s);
    for (const task of s.workspace.tasks)
      act(s, "COMPLETE_TASK", {
        taskId: task.id,
        evidence: "Sample production verified.",
      });
    act(s, "PROPOSE_CHANGE", {
      reason: "The access arrangement changes.",
      terms: { access: "Revised step-free access instructions." },
    });
    act(s, "APPROVE_CHANGE", {
      changeId: s.workspace.change!.id,
      termsHash: s.workspace.terms.hash,
    });
    expect(s.workspace.tasks.every((t) => !t.done)).toBe(true);
  });
});

describe("venue changes preserve physical and financial constraints", () => {
  it("rejects a replacement room below held capacity, sound needs or full-capacity budget", () => {
    const s = fixture();
    prepared(s);
    const c = interest(s, "held@example.test", 2);
    act(s, "BOOK", { commitmentId: c.id });
    expect(() =>
      act(s, "PROPOSE_CHANGE", {
        reason: "Move to a smaller room.",
        venue: { capacity: 1 },
      }),
    ).toThrow("held allocations");
    expect(() =>
      act(s, "PROPOSE_CHANGE", {
        reason: "Reduce permitted sound.",
        venue: { soundLimitDb: 70 },
      }),
    ).toThrow("sound limit");
    expect(() =>
      act(s, "PROPOSE_CHANGE", {
        reason: "Move to a much larger room.",
        venue: { capacity: 500 },
      }),
    ).toThrow("full capacity");
    expect(() =>
      act(s, "PROPOSE_CHANGE", {
        reason: "Curfew closes earlier.",
        venue: { curfew: "20:00" },
      }),
    ).toThrow("curfew");
  });
  it("binds numeric venue facts into the reviewed diff, approval and public terms hash", () => {
    const s = fixture();
    prepared(s);
    const previous = s.workspace.terms.hash;
    act(s, "PROPOSE_CHANGE", {
      reason: "Relocate with reviewed room constraints.",
      terms: { venue: "New sample room", address: "New sample address" },
      venue: {
        capacity: 50,
        soundLimitDb: 80,
        curfew: "23:00",
        timezone: "Europe/London",
      },
    });
    expect(
      s.workspace.change?.diff?.some(
        (d) => d.field === "capacity" && d.before === "48" && d.after === "50",
      ),
    ).toBe(true);
    act(s, "APPROVE_CHANGE", {
      changeId: s.workspace.change!.id,
      termsHash: previous,
    });
    expect(s.workspace.venue.capacity).toBe(50);
    expect(s.workspace.terms.capacity).toBe(50);
    expect(s.workspace.terms.soundLimitDb).toBe(80);
    expect(s.workspace.terms.curfew).toBe("23:00");
    expect(s.workspace.terms.hash).not.toBe(previous);
    expect(s.workspace.venue.availability).toBe("UNCONFIRMED");
    expect(s.workspace.requirements.every((r) => !r.confirmed)).toBe(true);
    expect(
      s.workspace.suppliers
        .filter((s) => ["low-lights", "little-table"].includes(s.id))
        .every((s) => s.status === "QUOTED"),
    ).toBe(true);
  });
});

describe("worker readiness needs observed heartbeat evidence", () => {
  it("does not infer ready from configured worker environment", () => {
    expect(workerHealth(null)).toEqual({
      worker: "unknown",
      heartbeatAt: null,
    });
    const now = Date.now();
    expect(workerHealth(new Date(now - 180001), now).worker).toBe("degraded");
    expect(workerHealth(new Date(now - 10000), now).worker).toBe("ready");
    expect(workerHealth(new Date(now + 60000), now).worker).toBe("degraded");
  });
});
