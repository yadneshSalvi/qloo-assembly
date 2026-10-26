import { describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import {
  assessFeasibility,
  buildGroundedConcepts,
  executeResearchJob,
  modelSafeSnapshot,
  ProposalValidationError,
  type ConceptDraft,
  type ResearchRuntime,
} from "@assembly/research";
import {
  officialQlooArguments,
  parseInsightsResults,
  parseSearchResults,
  ProviderError,
} from "@assembly/qloo";
import type {
  ClaimedResearchJob,
  ResearchEvidence,
  ResearchSnapshot,
} from "@assembly/contracts";

const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222";
const snapshot = (): ResearchSnapshot => ({
  workspaceId: "workspace-one",
  inputHash: "input-one",
  brief: {
    ambition: "An intimate gathering connecting music and ideas.",
    audience: "Curious local adults",
    notes: "Warm sound and time to talk.",
    date: "2026-11-14",
    doors: "18:30",
    end: "22:00",
    budgetMinor: 150000,
    ticketPriceMinor: 3000,
  },
  venue: {
    capacity: 40,
    soundLimitDb: 78,
    curfew: "22:30",
    availability: "UNCONFIRMED",
  },
  inventory: [
    {
      id: "offer-one",
      role: "Live music",
      label: "Private supplier name",
      feeMinor: 30000,
      status: "QUOTED",
      scope: "Private contact details must not be sent",
      influenceIds: [b],
    },
    {
      id: "offer-two",
      role: "Visual arts",
      label: "Private artist",
      feeMinor: 20000,
      status: "QUOTED",
      scope: "Private scope",
      influenceIds: [],
    },
  ],
  anchors: [
    {
      id: "anchor-one",
      entityId: a,
      entityType: "artist",
      name: "Synthetic Anchor",
      disambiguation: "",
      confirmedAt: "2026-10-27T00:00:00Z",
      source: "CATALOG_SELECTION",
    },
  ],
  influences: [
    {
      supplierId: "offer-one",
      entityId: b,
      entityType: "artist",
      name: "Synthetic Influence",
      confirmedAt: "2026-10-27T00:00:00Z",
    },
  ],
  targetTypes: ["artist", "movie", "book"],
});
const job = (
  kind: ClaimedResearchJob["kind"] = "RESEARCH",
): ClaimedResearchJob => ({
  id: "job-one",
  workspaceId: "workspace-one",
  leaseToken: "lease-one",
  attempts: 1,
  inputHash: "input-one",
  kind,
  snapshot: snapshot(),
  ...(kind === "SEARCH"
    ? { search: { query: "Synthetic Artist", entityType: "artist" as const } }
    : {}),
});
const draft = (
  format: ConceptDraft["format"],
  evidenceIds: string[],
): ConceptDraft => ({
  title: `Shared ${format}`,
  subtitle: "An evening of thoughtful connections.",
  format,
  rationale:
    "A creative interpretation of the returned cultural evidence using the saved operator brief.",
  culturalReferences: [
    {
      evidenceId: evidenceIds[0],
      entityId: b,
      purpose: (
        {
          listening: "atmosphere",
          conversation: "conversation",
          participatory: "participation",
        } as const
      )[format],
    },
  ],
  inventoryIds: [format === "participatory" ? "offer-two" : "offer-one"],
});
const usage = {
  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 100, text: 100, reasoning: 0 },
};
function mockModel(
  options: {
    hallucinate?: boolean;
    empty?: boolean;
    malformedDiscovery?: boolean;
    invalidProposals?: number;
    observe?: (step: number) => void;
  } = {},
) {
  let step = 0;
  return new MockLanguageModelV4({
    doGenerate: async (input) => {
      options.observe?.(step);
      let toolName: string, payload: unknown;
      if (step === 0) {
        toolName = "inspectInventory";
        payload = {};
      } else if (step === 1) {
        toolName = "discoverCulturalOptions";
        payload = {
          targetTypes: options.malformedDiscovery
            ? []
            : ["artist", "movie", "book"],
        };
      } else {
        toolName = "proposeConcepts";
        const ids = options.hallucinate
          ? ["fabricated-evidence"]
          : [
              ...new Set(
                JSON.stringify(input.prompt).match(/qloo-[a-f0-9]{24}/g) ?? [],
              ),
            ];
        const concepts = ["listening", "conversation", "participatory"].map(
          (format) =>
            draft(
              format as ConceptDraft["format"],
              ids.length ? ids : ["no-evidence"],
            ),
        );
        if (step - 2 < (options.invalidProposals ?? 0))
          concepts[0].rationale += " Featuring REJECTED_MODEL_TEXT_001.";
        payload = { concepts };
      }
      step++;
      return {
        content: [
          {
            type: "tool-call",
            toolCallId: `call-${step}`,
            toolName,
            input: JSON.stringify(payload),
          },
        ],
        finishReason: { unified: "tool-calls", raw: "tool_calls" },
        usage,
        warnings: [],
      };
    },
  });
}
function runtime(overrides: Partial<ResearchRuntime> = {}) {
  const cache = new Map<string, unknown>();
  const reserve = vi.fn(async () => undefined);
  const transport = vi.fn(
    async (
      request: Parameters<NonNullable<ResearchRuntime["transport"]>>[0],
    ) =>
      request.operation === "search"
        ? [
            {
              entity_id: a.toUpperCase(),
              name: "Synthetic Artist",
              types: ["urn:entity:artist"],
              disambiguation: "Artist identity",
              private_payload: "DROP THIS",
            },
          ]
        : [
            {
              entity_id: b,
              name: `Synthetic ${request.entityType}`,
              type: "urn:entity",
              subtype: `urn:entity:${request.entityType}`,
              query: { affinity: 0.42 },
              private_payload: "DROP THIS",
            },
          ],
  );
  return {
    checkpoint: vi.fn(async () => true),
    reserve,
    cacheGet: vi.fn(async (key: string) => cache.get(key) ?? null),
    cachePut: vi.fn(async (key: string, value: unknown) => {
      cache.set(key, value);
    }),
    transport,
    model: mockModel(),
    cache,
    ...overrides,
  };
}

describe("official harness API boundary", () => {
  it("normalizes uppercase IDs and canonical search choices without selecting an identity", async () => {
    const result = await executeResearchJob(job("SEARCH"), runtime());
    expect(result.search?.candidates[0].entityId).toBe(a);
    expect(result.search?.status).toBe("COMPLETED");
    expect(result.concepts).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("DROP THIS");
  });
  it("rejects unsupported categories, wrong-category, duplicate and malformed results", () => {
    expect(() =>
      officialQlooArguments({
        operation: "search",
        entityType: "phone" as "artist",
        query: "x",
      }),
    ).toThrow();
    expect(() =>
      parseSearchResults(
        [{ entity_id: a, name: "x", types: ["urn:entity:book"] }],
        "artist",
      ),
    ).toThrow();
    expect(() =>
      parseSearchResults(
        [
          { entity_id: a, name: "x", types: ["urn:entity:artist"] },
          { entity_id: a, name: "x", types: ["urn:entity:artist"] },
        ],
        "artist",
      ),
    ).toThrow();
    expect(() =>
      parseSearchResults({ results: "malformed" }, "artist"),
    ).toThrow();
  });
  it("uses one restricted Insights command, without hydration or omitted-rank invention", () => {
    const request = {
      operation: "insights" as const,
      entityType: "artist" as const,
      signals: [a],
      candidates: [a, b],
      take: 2,
    };
    const args = officialQlooArguments(request);
    expect(args.slice(0, 2)).toEqual(["api", "insights"]);
    expect(args).not.toContain("rank");
    const rows = parseInsightsResults(
      [
        {
          entity_id: b,
          type: "urn:entity",
          subtype: "urn:entity:artist",
          query: { affinity: 0.2 },
        },
      ],
      request,
      new Map([[b, "Synthetic Influence"]]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].entityId).toBe(b);
    expect(() =>
      parseInsightsResults(
        [
          {
            entity_id: "33333333-3333-4333-8333-333333333333",
            name: "Outside",
            type: "urn:entity:artist",
          },
        ],
        request,
      ),
    ).toThrow();
  });
  it("reports honest empty catalog results and caches normalized fields only", async () => {
    const r = runtime({ transport: vi.fn(async () => []) });
    const result = await executeResearchJob(job("SEARCH"), r);
    expect(result.search?.status).toBe("EMPTY");
    expect(result.search?.candidates).toEqual([]);
    expect(r.reserve).toHaveBeenCalledTimes(1);
  });
});

describe("bounded typed event research", () => {
  it("checks the entered 19:00–19:50 and 20:00–20:45 slots without inventing timing", () => {
    const s = snapshot();
    Object.assign(s.inventory[0], {
      programStart: "19:00",
      durationMinutes: 50,
      setupStart: "18:00",
      setupMinutes: 20,
    });
    Object.assign(s.inventory[1], {
      programStart: "20:00",
      durationMinutes: 45,
      setupStart: "19:30",
      setupMinutes: 20,
    });
    const before = JSON.stringify(s);
    const result = assessFeasibility(s, ["offer-one", "offer-two"]);
    expect(result.feasible).toBe(true);
    expect(result.violations).toEqual([]);
    expect(
      result.unresolved.some((item) =>
        /program start|setup start|setup duration/.test(item),
      ),
    ).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    const safe = modelSafeSnapshot(s);
    expect(safe.inventory[0]).toMatchObject({
      programStart: "19:00",
      durationMinutes: 50,
      setupStart: "18:00",
      setupMinutes: 20,
      canOverlap: false,
    });
    expect(JSON.stringify(safe)).not.toContain("Private supplier name");
    expect(JSON.stringify(safe)).not.toContain("Private contact details");
  });
  it("rejects overlapping exclusive slots but accepts an explicitly simultaneous service", () => {
    const s = snapshot();
    Object.assign(s.inventory[0], {
      programStart: "19:00",
      durationMinutes: 180,
      setupMinutes: 0,
    });
    Object.assign(s.inventory[1], {
      programStart: "19:15",
      durationMinutes: 165,
      setupMinutes: 0,
    });
    const exclusive = assessFeasibility(s, ["offer-one", "offer-two"]);
    expect(exclusive.feasible).toBe(false);
    expect(exclusive.violations.some((item) => item.includes("overlap"))).toBe(
      true,
    );
    expect(JSON.stringify(exclusive)).not.toContain("Private supplier name");
    s.inventory[1].canOverlap = true;
    const service = assessFeasibility(s, ["offer-one", "offer-two"]);
    expect(service.feasible).toBe(true);
    expect(service.violations).toEqual([]);
    expect(modelSafeSnapshot(s).inventory[1].canOverlap).toBe(true);
  });
  it("rejects actual program slots outside the event window and setup finishing after its own program starts", () => {
    const s = snapshot();
    Object.assign(s.inventory[0], {
      programStart: "21:30",
      durationMinutes: 45,
      setupMinutes: 0,
    });
    expect(
      assessFeasibility(s, ["offer-one"]).violations.some((item) =>
        item.includes("between doors and the event end"),
      ),
    ).toBe(true);
    s.inventory[0].programStart = "18:00";
    expect(assessFeasibility(s, ["offer-one"]).feasible).toBe(false);
    Object.assign(s.inventory[0], {
      programStart: "19:00",
      durationMinutes: 50,
      setupStart: "18:55",
      setupMinutes: 20,
    });
    const lateSetup = assessFeasibility(s, ["offer-one"]);
    expect(lateSetup.feasible).toBe(false);
    expect(
      lateSetup.violations.some((item) =>
        item.includes("setup must finish before"),
      ),
    ).toBe(true);
  });
  it("leaves missing program/setup times unresolved while rejecting known impossible durations", () => {
    const s = snapshot();
    Object.assign(s.inventory[0], { durationMinutes: 50, setupMinutes: 20 });
    const missing = assessFeasibility(s, ["offer-one"]);
    expect(missing.feasible).toBe(true);
    expect(
      missing.unresolved.some((item) => item.includes("exact program start")),
    ).toBe(true);
    expect(
      missing.unresolved.some((item) => item.includes("exact setup start")),
    ).toBe(true);
    expect(modelSafeSnapshot(s).inventory[0]).toMatchObject({
      programStart: null,
      setupStart: null,
    });
    expect(s.inventory[0].programStart).toBeUndefined();
    s.inventory[0].durationMinutes = 500;
    expect(assessFeasibility(s, ["offer-one"]).feasible).toBe(false);
    s.inventory[0].durationMinutes = -1;
    expect(assessFeasibility(s, ["offer-one"]).feasible).toBe(false);
    delete s.inventory[0].durationMinutes;
    const noDuration = assessFeasibility(s, ["offer-one"]);
    expect(noDuration.feasible).toBe(true);
    expect(
      noDuration.unresolved.some((item) =>
        item.includes("exact program start and duration"),
      ),
    ).toBe(true);
  });
  it("runs three real tool-loop steps, 3 discovery plus 1 influence requests, and exact cost checks", async () => {
    const r = runtime();
    const result = await executeResearchJob(job(), r);
    expect(result.concepts).toHaveLength(3);
    expect(result.evidence).toHaveLength(4);
    expect(r.transport).toHaveBeenCalledTimes(4);
    expect(r.reserve).toHaveBeenCalledTimes(7);
    expect(result.concepts?.[0].fixedCostMinor).toBe(30000);
    expect(
      result.evidence?.find((item) => item.purpose === "SUPPLIER_INFLUENCE")
        ?.boundary,
    ).toContain("no direct supplier affinity");
    expect(JSON.stringify(result)).not.toContain("DROP THIS");
    expect(JSON.stringify(result.trace)).not.toContain("reasoning");
    expect((r.model as MockLanguageModelV4).doGenerateCalls).toHaveLength(3);
  });
  it("repairs one invalid proposal in exactly one precharged fourth step without refetching evidence", async () => {
    let modelReservations = 0;
    const model = mockModel({
      invalidProposals: 1,
      observe: (step) => {
        expect(modelReservations).toBe(step + 1);
      },
    });
    const reserve = vi.fn(async (provider: "qloo" | "model") => {
      if (provider === "model") modelReservations++;
    });
    const r = runtime({ model, reserve });
    const result = await executeResearchJob(job(), r);
    expect(result.concepts).toHaveLength(3);
    expect(model.doGenerateCalls).toHaveLength(4);
    expect(modelReservations).toBe(4);
    expect(r.transport).toHaveBeenCalledTimes(4);
    expect(reserve).toHaveBeenCalledTimes(8);
    expect(model.doGenerateCalls[3].tools?.map((tool) => tool.name)).toEqual([
      "proposeConcepts",
    ]);
    const feedback = model.doGenerateCalls[3].prompt
      .filter((message) => message.role === "tool")
      .flatMap((message) => message.content)
      .filter(
        (part) =>
          part.type === "tool-result" && part.toolName === "proposeConcepts",
      );
    const serialized = JSON.stringify(feedback);
    expect(serialized).toContain("creative_claim");
    expect(serialized).toContain("appearance_or_endorsement_phrase");
    expect(serialized).toContain("concepts.0.rationale");
    expect(serialized).toContain("Remove featuring");
    expect(serialized).not.toContain("REJECTED_MODEL_TEXT_001");
    expect(JSON.stringify(result.trace)).not.toContain(
      "REJECTED_MODEL_TEXT_001",
    );
    expect(
      result.trace?.filter((item) => item.stage === "Proposal needs revision"),
    ).toHaveLength(1);
  });
  it("fails after two invalid proposals and exactly four model steps with no extra Qloo request", async () => {
    const model = mockModel({ invalidProposals: 2 });
    const r = runtime({ model });
    await expect(executeResearchJob(job(), r)).rejects.toMatchObject({
      code: "GROUNDING",
      rejection: {
        category: "creative_claim",
        reason: "appearance_or_endorsement_phrase",
        path: "concepts.0.rationale",
      },
    });
    expect(model.doGenerateCalls).toHaveLength(4);
    expect(r.transport).toHaveBeenCalledTimes(4);
    expect(r.reserve).toHaveBeenCalledTimes(8);
  });
  it("never opens a fourth step for malformed discovery or a provider failure", async () => {
    const malformed = mockModel({ malformedDiscovery: true }),
      r = runtime({ model: malformed });
    await expect(executeResearchJob(job(), r)).rejects.toMatchObject({
      code: "GROUNDING",
    });
    expect(malformed.doGenerateCalls.length).toBeLessThanOrEqual(3);
    expect(r.transport).not.toHaveBeenCalled();
    const providerModel = mockModel(),
      failed = runtime({
        model: providerModel,
        transport: vi.fn(async () => {
          throw new ProviderError("UPSTREAM", "Synthetic provider failure.");
        }),
      });
    await expect(executeResearchJob(job(), failed)).rejects.toMatchObject({
      code: "UPSTREAM",
    });
    expect(providerModel.doGenerateCalls).toHaveLength(2);
    expect(failed.transport).toHaveBeenCalledTimes(1);
  });
  it("does not dispatch a repair model call when its durable budget reservation fails", async () => {
    let models = 0;
    const model = mockModel({ invalidProposals: 1 });
    const r = runtime({
      model,
      reserve: vi.fn(async (provider) => {
        if (provider === "model" && ++models === 4)
          throw new ProviderError(
            "BUDGET",
            "Synthetic exhausted repair allowance.",
          );
      }),
    });
    await expect(executeResearchJob(job(), r)).rejects.toMatchObject({
      code: "BUDGET",
    });
    expect(model.doGenerateCalls).toHaveLength(3);
    expect(r.transport).toHaveBeenCalledTimes(4);
  });
  it("fresh cache suppresses every repeat Qloo charge and preserves original capture time", async () => {
    const r = runtime();
    const first = await executeResearchJob(job(), r);
    const next = { ...r, model: mockModel() };
    const second = await executeResearchJob(job(), next);
    expect(r.transport).toHaveBeenCalledTimes(4);
    expect(second.evidence?.[0].capturedAt).toBe(
      first.evidence?.[0].capturedAt,
    );
    expect(second.trace?.some((item) => item.cacheHit)).toBe(true);
  });
  it("never accepts hallucinated evidence IDs or substitutes sample concepts after failure", async () => {
    await expect(
      executeResearchJob(
        job(),
        runtime({ model: mockModel({ hallucinate: true }) }),
      ),
    ).rejects.toMatchObject({ code: "GROUNDING" });
    await expect(
      executeResearchJob(job(), runtime({ transport: vi.fn(async () => []) })),
    ).rejects.toMatchObject({ code: "GROUNDING" });
  });
  it("checks cancellation and stale inputs before a provider call", async () => {
    const abort = new AbortController();
    abort.abort();
    const r = runtime({ signal: abort.signal });
    await expect(executeResearchJob(job("SEARCH"), r)).rejects.toThrow();
    expect(r.transport).not.toHaveBeenCalled();
    const stale = runtime({ checkpoint: vi.fn(async () => false) });
    await expect(
      executeResearchJob(job("SEARCH"), stale),
    ).rejects.toMatchObject({ code: "STALE" });
    expect(stale.transport).not.toHaveBeenCalled();
  });
  it("precharges and stops on budget, timeout or malformed provider failure without retry", async () => {
    const budget = runtime({
      reserve: vi.fn(async () => {
        throw new ProviderError("BUDGET", "Daily allowance exhausted.");
      }),
    });
    await expect(
      executeResearchJob(job("SEARCH"), budget),
    ).rejects.toMatchObject({ code: "BUDGET" });
    expect(budget.transport).not.toHaveBeenCalled();
    const timeout = runtime({
      transport: vi.fn(async () => {
        throw new ProviderError("TIMEOUT", "Deadline reached.");
      }),
    });
    await expect(
      executeResearchJob(job("SEARCH"), timeout),
    ).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(timeout.transport).toHaveBeenCalledTimes(1);
    await expect(
      executeResearchJob(
        job("SEARCH"),
        runtime({ transport: vi.fn(async () => "raw error") }),
      ),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });
  it("keeps contacts, supplier names, scopes, tokens and addresses outside model inputs", () => {
    const safe = modelSafeSnapshot(snapshot());
    expect(JSON.stringify(safe)).not.toContain("Private supplier");
    expect(JSON.stringify(safe)).not.toContain("Private contact");
    const bad = snapshot();
    bad.brief.notes =
      "Email owner@example.test or call +44 7700 900123 at 123 Main Street";
    const sanitized = modelSafeSnapshot(bad);
    expect(sanitized.brief.notes).not.toContain("owner@example");
    expect(sanitized.brief.notes).not.toContain("7700");
    expect(sanitized.brief.notes).not.toContain("123 Main Street");
  });
  it("rejects cost, sound, time, unknown IDs, unavailable supply and fabricated inventory IDs", () => {
    const s = snapshot();
    s.brief.budgetMinor = 100;
    s.inventory[0].soundDb = 90;
    s.inventory[0].durationMinutes = 500;
    s.inventory[0].status = "UNAVAILABLE";
    const f = assessFeasibility(s, ["offer-one"]);
    expect(f.feasible).toBe(false);
    expect(f.violations.length).toBeGreaterThanOrEqual(4);
    expect(assessFeasibility(snapshot(), ["fake"]).feasible).toBe(false);
    const evidence = [
      {
        id: "evidence-one",
        entityIds: [b],
        category: "artist",
        rankings: [
          {
            entityId: b,
            name: "Synthetic Influence",
            position: 1,
            affinity: 0.4,
          },
        ],
      },
    ] as ResearchEvidence[];
    const drafts = ["listening", "conversation", "participatory"].map(
      (format) => draft(format as ConceptDraft["format"], ["evidence-one"]),
    );
    drafts[0].inventoryIds = ["fake"];
    expect(() => buildGroundedConcepts(snapshot(), evidence, drafts)).toThrow();
  });
  it("accepts a host-funded free event within the explicit budget without a break-even requirement", () => {
    const s = snapshot();
    s.brief.ticketPriceMinor = 0;
    s.brief.overheadMinor = 20000;
    s.brief.perGuestMinor = 800;
    const worksheet = assessFeasibility(s, ["offer-one"]);
    expect(worksheet.feasible).toBe(true);
    expect(worksheet.totalCostMinor).toBe(82000);
    expect(worksheet.maximumIncomeMinor).toBe(0);
    expect(worksheet.breakEven).toBeNull();
    s.brief.budgetMinor = 81000;
    expect(assessFeasibility(s, ["offer-one"]).feasible).toBe(false);
  });
  it("rejects model-written operational facts, forged costs, evidence and supply IDs without mutating operator facts", () => {
    const s = snapshot(),
      before = JSON.stringify(s);
    const evidence = [
      {
        id: "evidence-one",
        entityIds: [b],
        category: "artist",
        rankings: [
          {
            entityId: b,
            name: "Synthetic Influence",
            position: 1,
            affinity: 0.4,
          },
        ],
      },
    ] as ResearchEvidence[];
    const drafts = () =>
      ["listening", "conversation", "participatory"].map((format) =>
        draft(format as ConceptDraft["format"], ["evidence-one"]),
      );
    for (const extra of [
      { fixedCostMinor: 1 },
      { capacity: 999 },
      { curfew: "23:59" },
    ]) {
      const values = drafts();
      Object.assign(values[0], extra);
      expect(() => buildGroundedConcepts(s, evidence, values)).toThrow();
    }
    for (const claim of [
      "This supplier is booked for this event.",
      "A licensed screening with all rights secured.",
      "We have capacity for 999 guests.",
      "The curfew is 23:59 for this event.",
      "The cost is £1 and attendance is 99%.",
    ]) {
      const values = drafts();
      values[0].rationale = `${values[0].rationale} ${claim}`;
      expect(() => buildGroundedConcepts(s, evidence, values)).toThrow();
    }
    const forgedEvidence = drafts();
    forgedEvidence[0].culturalReferences[0].evidenceId = "invented-evidence";
    expect(() => buildGroundedConcepts(s, evidence, forgedEvidence)).toThrow();
    const forgedSupply = drafts();
    forgedSupply[0].inventoryIds = ["nonexistent-supplier"];
    expect(() => buildGroundedConcepts(s, evidence, forgedSupply)).toThrow();
    expect(JSON.stringify(s)).toBe(before);
  });
  it("rejects underpopulated inventory before any model or Qloo call", async () => {
    const input = job();
    input.snapshot.inventory = input.snapshot.inventory.slice(0, 1);
    const r = runtime();
    await expect(executeResearchJob(input, r)).rejects.toMatchObject({
      code: "INPUT",
    });
    expect(r.transport).not.toHaveBeenCalled();
    expect(r.reserve).not.toHaveBeenCalled();
  });
  it("rejects invented performer prose fields and renders factual copy only from chosen IDs and purposes", () => {
    const s = snapshot(),
      other = "33333333-3333-4333-8333-333333333333";
    const evidence = [
      {
        id: "evidence-one",
        entityIds: [b, other],
        category: "artist",
        purpose: "DISCOVERY",
        rankings: [
          {
            entityId: b,
            name: "Synthetic Influence",
            position: 1,
            affinity: 0.4,
          },
          {
            entityId: other,
            name: "Other Canonical Reference",
            position: 2,
            affinity: 0.3,
          },
        ],
      },
    ] as ResearchEvidence[];
    const drafts = () =>
      ["listening", "conversation", "participatory"].map((format) =>
        draft(format as ConceptDraft["format"], ["evidence-one"]),
      );
    for (const extra of [
      { description: "A performance by Completely Invented Star." },
      { ingredients: ["Completely Invented Star performs"] },
      { programName: "Completely Invented Star live" },
    ]) {
      const values = drafts();
      Object.assign(values[0], extra);
      expect(() => buildGroundedConcepts(s, evidence, values)).toThrow();
    }
    const narrativeClaim = drafts();
    narrativeClaim[0].rationale +=
      " A performance by Completely Invented Star.";
    expect(() => buildGroundedConcepts(s, evidence, narrativeClaim)).toThrow();
    const values = drafts();
    values[1].culturalReferences[0].entityId = other;
    const result = buildGroundedConcepts(s, evidence, values);
    expect(result[0].ingredients.join(" ")).toContain(
      "Atmosphere reference: Synthetic Influence",
    );
    expect(result[1].ingredients.join(" ")).toContain(
      "Conversation prompt: Other Canonical Reference",
    );
    expect(result[1].ingredients.join(" ")).not.toContain(
      "Synthetic Influence",
    );
    expect(result[2].ingredients.join(" ")).toContain(
      "Private artist (Visual arts)",
    );
    expect(
      result.every((concept) =>
        concept.description.startsWith("A proposed evening"),
      ),
    ).toBe(true);
    expect(
      JSON.stringify(result.map((concept) => concept.ingredients)),
    ).not.toContain("minor units");
    expect(
      result[2].ingredients.some((item) => item.includes("Creative prompt:")),
    ).toBe(true);
    expect(result[0].rationale).toMatch(
      /^Creative rationale \(model hypothesis\):/,
    );
    expect(result[0].subtitle).toMatch(/^Creative hypothesis/);
    expect(JSON.stringify(result)).not.toContain("Completely Invented Star");
    const forged = drafts();
    forged[0].culturalReferences[0].entityId =
      "44444444-4444-4444-8444-444444444444";
    expect(() => buildGroundedConcepts(s, evidence, forged)).toThrow();
    const mismatched = drafts();
    mismatched[0].culturalReferences[0].purpose = "participation";
    expect(() => buildGroundedConcepts(s, evidence, mismatched)).toThrow();
  });
  it("collects safe creative-copy feedback across all nine fields for the single repair", () => {
    const evidence = [
      {
        id: "evidence-one",
        entityIds: [b],
        category: "artist",
        purpose: "DISCOVERY",
        rankings: [
          {
            entityId: b,
            name: "Synthetic Influence",
            position: 1,
            affinity: 0.4,
          },
        ],
      },
    ] as ResearchEvidence[];
    const values = ["listening", "conversation", "participatory"].map(
      (format) => ({
        ...draft(format as ConceptDraft["format"], ["evidence-one"]),
        title: `Featuring ${format}`,
        subtitle: "Available creative possibility.",
        rationale:
          "A feeling featuring REJECTED_MODEL_TEXT_002 across this proposed gathering.",
      }),
    );
    try {
      buildGroundedConcepts(snapshot(), evidence, values);
      throw new Error("Expected proposal rejection.");
    } catch (error) {
      expect(error).toBeInstanceOf(ProposalValidationError);
      const issues = (error as ProposalValidationError).issues;
      expect(issues).toHaveLength(9);
      expect(new Set(issues.map((issue) => issue.path)).size).toBe(9);
      expect(
        issues.some(
          (issue) => issue.reason === "operational_availability_or_rights_term",
        ),
      ).toBe(true);
      expect(
        issues.some(
          (issue) => issue.reason === "appearance_or_endorsement_phrase",
        ),
      ).toBe(true);
      expect(JSON.stringify(issues)).not.toContain("REJECTED_MODEL_TEXT_002");
    }
  });
});
