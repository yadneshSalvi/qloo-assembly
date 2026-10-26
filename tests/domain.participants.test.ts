import { randomBytes, randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  countsFor,
  type ActionType,
  type PublicActionRequest,
  type Workspace,
} from "@assembly/contracts";
try {
  loadEnvFile(".env.local");
} catch {
  /* CI supplies database environment. */
}
// Keep database suites isolated from a running development worker and from each other.
if (
  process.env.ASSEMBLY_DB_TEST === "1" &&
  process.env.DATABASE_URL?.includes("127.0.0.1:55432/assembly")
)
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace(
    /\/assembly(?:\?.*)?$/,
    "/assembly_test",
  );
let databaseTestLock: import("pg").PoolClient;
const enabled = process.env.ASSEMBLY_DB_TEST === "1",
  created: string[] = [];
let d: typeof import("@assembly/domain");
const browser = () => randomBytes(32).toString("hex");
const expiry = () => new Date(Date.now() + 86400000).toISOString();
describe.skipIf(!enabled)(
  "independent participant and supplier capabilities",
  () => {
    beforeAll(async () => {
      d = await import("@assembly/domain");
      databaseTestLock = await d.pool.connect();
      await databaseTestLock.query("SELECT pg_advisory_lock(775151)");
      await d.migrate();
    });
    afterAll(async () => {
      if (created.length)
        await d.pool.query(
          "DELETE FROM assembly_workspaces WHERE id=ANY($1::uuid[])",
          [created],
        );
      await databaseTestLock.query("SELECT pg_advisory_unlock(775151)");
      databaseTestLock.release();
      await d.pool.end();
    });
    async function session() {
      const s = await d.createSession("REAL");
      created.push(s.workspace.id);
      return s;
    }
    async function act(
      token: string,
      type: ActionType,
      payload: Record<string, unknown> = {},
    ) {
      const w = (await d.readWorkspace(token))!;
      return d.performAction(token, {
        workspaceId: w.id,
        type,
        payload,
        expectedVersion: w.version,
        idempotencyKey: randomUUID(),
      });
    }
    async function fixture(capacity = 2) {
      const s = await session();
      const w = s.workspace;
      // Explicit test-only operator fixture, never a claimed live result or actual event.
      w.venue = {
        ...w.venue,
        name: "Test operator room",
        address: "Test address",
        neighborhood: "Test district",
        capacity,
        soundLimitDb: 70,
        curfew: "23:00",
        access: "Step-free test access",
        source: "Operator fixture inventory",
        availability: "AVAILABLE",
        confirmedAt: new Date().toISOString(),
        validUntil: expiry(),
      };
      w.brief = {
        ...w.brief,
        date: "2026-12-01",
        doors: "18:00",
        end: "21:00",
        ambition: "Test gathering",
        audience: "Test audience",
        budgetMinor: 100000,
        ticketPriceMinor: 0,
        overheadMinor: 0,
        perGuestMinor: 0,
      };
      w.suppliers = [
        {
          id: "operator-offer",
          programStart: "18:30",
          durationMinutes: 60,
          setupStart: "17:30",
          setupMinutes: 30,
          canOverlap: false,
          name: "Test Supplier",
          discipline: "Workshop",
          initials: "TS",
          feeMinor: 1000,
          description: "Operator fixture offer",
          status: "QUOTED",
          critical: true,
          confirmedAt: null,
          source: "Operator fixture quote",
          influence: "",
          scope: "One workshop on 2026-12-01, 18:30–19:30",
          token: "",
          validUntil: expiry(),
        },
      ];
      w.concepts = [
        {
          id: "operator-agenda",
          number: "01",
          title: "Test gathering",
          subtitle: "Operator test agenda",
          category: "WORKSHOP",
          description: "Test-only supplied agenda",
          color: "#123456",
          art: "soft-signal",
          fixedCostMinor: 1000,
          variableCostMinor: 0,
          ticketPriceMinor: 0,
          ingredients: ["Workshop"],
          rationale: "Test fixture",
          evidenceIds: [],
          supplierIds: ["operator-offer"],
          origin: "MODEL_HYPOTHESIS",
        },
      ];
      w.terms = {
        ...w.terms,
        date: w.brief.date,
        doors: w.brief.doors,
        end: w.brief.end,
        venue: w.venue.name,
        address: w.venue.address,
        access: w.venue.access,
        capacity: w.venue.capacity,
        soundLimitDb: w.venue.soundLimitDb,
        curfew: w.venue.curfew,
        timezone: w.venue.timezone,
      };
      w.terms.hash = d.hashTerms(w.terms);
      w.event.lifecycle = "CONCEPT_READY";
      await d.pool.query(
        "UPDATE assembly_workspaces SET document=$2 WHERE id=$1",
        [w.id, { workspace: w, contactDigests: {} }],
      );
      await act(s.token, "SELECT_CONCEPT", { conceptId: "operator-agenda" });
      let current = (await d.readWorkspace(s.token))!;
      await act(s.token, "PUBLISH", { termsHash: current.terms.hash });
      current = (await d.readWorkspace(s.token))!;
      return { ...s, workspace: current };
    }
    function req(
      w: Pick<Workspace, "terms" | "event">,
      type: PublicActionRequest["type"],
      payload: Record<string, unknown> = {},
    ): PublicActionRequest {
      return {
        type,
        expectedPublicVersion: w.event.publicVersion ?? 1,
        termsVersion: w.terms.version,
        termsHash: w.terms.hash,
        idempotencyKey: randomUUID(),
        payload,
      };
    }
    async function interest(
      s: { token: string; workspace: Workspace },
      name = "Private Guest",
      quantity = 1,
    ) {
      const w = (await d.readWorkspace(s.token))!;
      return d.expressPublicInterest(
        w.event.slug,
        browser(),
        req(w, "EXPRESS_INTEREST", { name, quantity, consent: true }),
      );
    }
    async function participant(
      token: string,
      type: PublicActionRequest["type"],
      payload: Record<string, unknown> = {},
    ) {
      const v = await d.readParticipant(token);
      return d.performParticipantAction(token, {
        type,
        expectedPublicVersion: v.event.version,
        termsVersion: v.event.terms.version,
        termsHash: v.event.terms.hash,
        idempotencyKey: randomUUID(),
        payload,
      });
    }
    async function open(s: { token: string }) {
      await act(s.token, "CONFIRM_SUPPLIER", {
        supplierId: "operator-offer",
        validUntil: expiry(),
        note: "Operator independently recorded source evidence.",
      });
      let w = (await d.readWorkspace(s.token))!;
      for (const r of w.requirements)
        await act(s.token, "CONFIRM_REQUIREMENT", {
          requirementId: r.id,
          proof: "Operator fixture evidence reviewed.",
        });
      w = (await d.readWorkspace(s.token))!;
      await act(s.token, "GREENLIGHT", { termsHash: w.terms.hash });
      await act(s.token, "OPEN_BOOKING");
    }
    it("starts blank, preserves mode boundaries and rejects owner audience mutation", async () => {
      const s = await session();
      expect(s.workspace.mode).toBe("REAL");
      expect(s.workspace.suppliers).toEqual([]);
      expect(s.workspace.concepts).toEqual([]);
      expect(s.workspace.evidence).toEqual([]);
      expect(s.workspace.venue.availability).toBe("UNCONFIRMED");
      expect(Date.parse(s.workspace.expiresAt) - Date.now()).toBeGreaterThan(
        89 * 86400000,
      );
      await expect(
        act(s.token, "EXPRESS_INTEREST", { name: "Invented owner guest" }),
      ).rejects.toThrow("private response link");
      await expect(
        d.resetWorkspace(s.token, s.workspace.version, randomUUID()),
      ).rejects.toThrow("cannot be reset");
    });
    it("keeps exact schedule comparisons and approval hashes stable across real JSONB round trips", async () => {
      const s = await fixture();
      let w = (await d.readWorkspace(s.token))!;
      expect(w.terms.programSchedule).toEqual([
        {
          supplierId: "operator-offer",
          name: "Test Supplier",
          start: "18:30",
          end: "19:30",
          canOverlap: false,
        },
      ]);
      expect(d.hashTerms(w.terms)).toBe(w.terms.hash);
      const originalHash = w.terms.hash;
      const originalInvitation = d.supplierInvitationHash(w, "operator-offer");
      await act(s.token, "PROPOSE_CHANGE", {
        reason:
          "The operator proposes a later opening with all exact slots shifted for review.",
        terms: { doors: "18:30", end: "21:30" },
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.terms.hash).toBe(originalHash);
      expect(w.change?.hashFormat).toBe("canonical-json-v1");
      expect(w.change?.termsPatch?.programSchedule?.[0].start).toBe("19:00");
      expect(w.suppliers[0].programStart).toBe("18:30");
      await act(s.token, "APPROVE_CHANGE", {
        changeId: w.change!.id,
        termsHash: w.terms.hash,
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.terms.programSchedule?.[0]).toMatchObject({
        start: "19:00",
        end: "20:00",
      });
      expect(w.suppliers[0]).toMatchObject({
        programStart: "19:00",
        setupStart: "18:00",
      });
      expect(d.hashTerms(w.terms)).toBe(w.terms.hash);
      expect(w.terms.hash).not.toBe(originalHash);
      expect(d.supplierInvitationHash(w, "operator-offer")).not.toBe(
        originalInvitation,
      );
      const approvedHash = w.terms.hash;
      expect((await d.readPublicEvent(w.event.slug)).terms.hash).toBe(
        approvedHash,
      );
      expect((await d.readWorkspace(s.token))!.terms.hash).toBe(approvedHash);
    });
    it("redacts all other attendees and owner/supplier authority from public and response views", async () => {
      const s = await fixture();
      const a = await interest(s, "Alice private"),
        b = await interest(s, "Bob private");
      const publicView = await d.readPublicEvent(s.workspace.event.slug),
        view = await d.readParticipant(a.token!);
      expect(JSON.stringify(publicView)).not.toContain("Alice private");
      expect(JSON.stringify(publicView)).not.toContain("Bob private");
      expect(JSON.stringify(view)).toContain("Alice private");
      expect(JSON.stringify(view)).not.toContain("Bob private");
      for (const forbidden of [
        "contactDigests",
        "approvals",
        "audit",
        "source",
        "token_hash",
        "confirmedOfferHash",
      ])
        expect(JSON.stringify(view)).not.toContain(forbidden);
      expect(JSON.stringify(view)).not.toContain(b.token!);
      expect(await d.readWorkspace(a.token!)).toBeNull();
      await expect(d.readSupplier(a.token!)).rejects.toThrow(
        "expired or was revoked",
      );
      const stored = await d.pool.query<{ document: unknown }>(
        "SELECT document FROM assembly_workspaces WHERE id=$1",
        [s.workspace.id],
      );
      expect(JSON.stringify(stored.rows[0].document)).not.toContain(a.token!);
      const caps = await d.pool.query<{ token_hash: string }>(
        "SELECT token_hash FROM assembly_capabilities WHERE workspace_id=$1",
        [s.workspace.id],
      );
      expect(
        caps.rows.every(
          (c) => c.token_hash !== a.token && c.token_hash !== b.token,
        ),
      ).toBe(true);
    });
    it("requires link possession, keeps browser duplicates bounded and replays safely", async () => {
      const s = await fixture(),
        identity = browser(),
        r = req(s.workspace, "EXPRESS_INTEREST", {
          name: "Guest",
          quantity: 1,
          consent: true,
        });
      const a = await d.expressPublicInterest(
          s.workspace.event.slug,
          identity,
          r,
        ),
        again = await d.expressPublicInterest(
          s.workspace.event.slug,
          identity,
          r,
        );
      expect(again.token).toBe(a.token);
      expect(again.view.commitment.id).toBe(a.view.commitment.id);
      expect(a.view.commitment.status).toBe("PENDING");
      await expect(
        d.expressPublicInterest(s.workspace.event.slug, identity, {
          ...r,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow("already has an active choice");
      await expect(
        d.expressPublicInterest(s.workspace.event.slug, identity, {
          ...r,
          payload: { ...r.payload, name: "Changed" },
        }),
      ).rejects.toThrow("different choice");
      const confirmed = await participant(a.token!, "CONFIRM", {
        consent: true,
      });
      expect(confirmed.view.commitment.status).toBe("VERIFIED");
      expect(confirmed.view.commitment.verifiedAt).not.toBeNull();
    });
    it("supplier capability accepts exact own offer and cannot mutate attendees or another supplier", async () => {
      const s = await fixture(),
        w = (await d.readWorkspace(s.token))!,
        invite = await d.mintSupplierLink(
          s.token,
          "operator-offer",
          w.version,
          randomUUID(),
        );
      const v = await d.readSupplier(invite.token);
      expect(v.supplier.name).toBe("Test Supplier");
      expect("suppliers" in v).toBe(false);
      expect("workspace" in v).toBe(false);
      await expect(
        d.performSupplierAction(invite.token, {
          type: "CONFIRM",
          expectedVersion: v.version,
          termsHash: "stale",
          invitationHash: v.invitationHash,
          idempotencyKey: randomUUID(),
          payload: { validUntil: expiry() },
        }),
      ).rejects.toThrow(
        "The production was updated. Review the refreshed assignment before responding.",
      );
      await d.performSupplierAction(invite.token, {
        type: "CONFIRM",
        expectedVersion: v.version,
        termsHash: v.termsHash,
        invitationHash: v.invitationHash,
        idempotencyKey: randomUUID(),
        payload: {
          validUntil: expiry(),
          note: "Accepted exact scope, date and fee.",
        },
      });
      const current = (await d.readWorkspace(s.token))!;
      expect(current.suppliers[0].confirmationMethod).toBe("SUPPLIER_RESPONSE");
      expect(d.supplierCurrent(current, "operator-offer")).toBe(true);
      await expect(
        d.performParticipantAction(
          invite.token,
          req(current, "CONFIRM", { consent: true }),
        ),
      ).rejects.toThrow("expired or was revoked");
      const latest = await d.readSupplier(invite.token);
      await d.performSupplierAction(invite.token, {
        type: "DECLINE",
        expectedVersion: latest.version,
        termsHash: latest.termsHash,
        invitationHash: latest.invitationHash,
        idempotencyKey: randomUUID(),
        payload: { note: "No longer available." },
      });
      expect((await d.readWorkspace(s.token))!.event.bookingPaused).toBe(true);
    });
    it("serializes independent attendee requests for the final seat", async () => {
      const s = await fixture(1);
      await open(s);
      const a = await interest(s, "A"),
        b = await interest(s, "B");
      await participant(a.token!, "CONFIRM", { consent: true });
      await participant(b.token!, "CONFIRM", { consent: true });
      const r = await Promise.allSettled([
        participant(a.token!, "FREE_BOOK"),
        participant(b.token!, "FREE_BOOK"),
      ]);
      expect(r.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(countsFor((await d.readWorkspace(s.token))!).remaining).toBe(0);
      const winner = r[0].status === "fulfilled" ? a : b;
      await participant(winner.token!, "WITHDRAW");
      expect(countsFor((await d.readWorkspace(s.token))!).remaining).toBe(1);
    });
    it("requires explicit material approval and renewed consent while preserving held seats", async () => {
      const s = await fixture(2);
      await open(s);
      const a = await interest(s, "Guest", 2);
      await participant(a.token!, "CONFIRM", { consent: true });
      await participant(a.token!, "FREE_BOOK");
      let w = (await d.readWorkspace(s.token))!;
      const old = req(w, "RECONFIRM", { consent: true });
      await act(s.token, "PROPOSE_CHANGE", {
        reason: "Workshop format has changed.",
        terms: { program: "A revised operator workshop" },
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.change?.diff).toEqual([
        {
          field: "program",
          before: w.terms.program,
          after: "A revised operator workshop",
        },
      ]);
      expect(w.terms.program).not.toBe("A revised operator workshop");
      await act(s.token, "APPROVE_CHANGE", {
        changeId: w.change!.id,
        termsHash: w.terms.hash,
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.commitments[0].status).toBe("RECONFIRM_REQUIRED");
      expect(countsFor(w).remaining).toBe(0);
      expect(countsFor(w).bookings).toBe(0);
      await expect(d.performParticipantAction(a.token!, old)).rejects.toThrow(
        "changed",
      );
      await participant(a.token!, "RECONFIRM", { consent: true });
      for (const r of w.requirements)
        await act(s.token, "CONFIRM_REQUIREMENT", {
          requirementId: r.id,
          proof: "Changed production evidence reviewed.",
        });
      await act(s.token, "RESUME_BOOKING");
      expect(countsFor((await d.readWorkspace(s.token))!).bookings).toBe(2);
      await act(s.token, "PROPOSE_CHANGE", {
        reason: "The program changes a second time.",
        terms: { program: "Second revised workshop" },
      });
      w = (await d.readWorkspace(s.token))!;
      await act(s.token, "APPROVE_CHANGE", {
        changeId: w.change!.id,
        termsHash: w.terms.hash,
      });
      await participant(a.token!, "WITHDRAW");
      expect(countsFor((await d.readWorkspace(s.token))!).remaining).toBe(2);
    });
    it("blocked recovery accepts any selected supply loss and deterministic new replacement", async () => {
      const s = await fixture();
      await open(s);
      await act(s.token, "DISRUPT", { supplierId: "operator-offer" });
      let w = (await d.readWorkspace(s.token))!;
      expect(w.change!.replacementId).toBe("");
      await expect(
        act(s.token, "APPROVE_CHANGE", {
          changeId: w.change!.id,
          termsHash: w.terms.hash,
        }),
      ).rejects.toThrow("replacement availability");
      await act(s.token, "UPSERT_SUPPLIER", {
        supplier: {
          id: "new-offer",
          programStart: "19:00",
          durationMinutes: 60,
          setupStart: "17:30",
          setupMinutes: 30,
          canOverlap: false,
          name: "New operator supplier",
          discipline: "Workshop",
          feeMinor: 1500,
          description: "Replacement operator quote",
          critical: true,
          source: "New supplier quote evidence",
          influence: "",
          scope: "Same date and time workshop",
          validUntil: expiry(),
        },
      });
      await act(s.token, "PROPOSE_CHANGE", {
        reason: "Replace lost operator supply.",
        supplierId: "operator-offer",
        replacementId: "new-offer",
      });
      await act(s.token, "CONFIRM_SUPPLIER", {
        supplierId: "new-offer",
        validUntil: expiry(),
        note: "Operator records the replacement confirmation.",
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.change!.costDeltaMinor).toBe(500);
      await act(s.token, "APPROVE_CHANGE", {
        changeId: w.change!.id,
        termsHash: w.terms.hash,
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.concepts[0].fixedCostMinor).toBe(1500);
      expect(w.concepts[0].supplierIds).toEqual(["new-offer"]);
    });
    it("cancellation is exact, audited and releases all booked places", async () => {
      const s = await fixture();
      await open(s);
      const a = await interest(s);
      await participant(a.token!, "CONFIRM", { consent: true });
      await participant(a.token!, "FREE_BOOK");
      const w = (await d.readWorkspace(s.token))!;
      await expect(
        act(s.token, "CANCEL_EVENT", {
          termsHash: "stale",
          reason: "Cancellation evidence",
        }),
      ).rejects.toThrow("changed");
      await act(s.token, "CANCEL_EVENT", {
        termsHash: w.terms.hash,
        reason: "Operator cancellation due to venue closure.",
      });
      const v = await d.readParticipant(a.token!);
      expect(v.event.event.lifecycle).toBe("CANCELLED");
      expect(v.booking?.status).toBe("CANCELLED");
      expect(v.event.counts.remaining).toBe(2);
      await expect(participant(a.token!, "FREE_BOOK")).rejects.toThrow(
        "no longer accepting",
      );
    });
    it("records observed completion and optional attendee feedback as separate facts", async () => {
      const s = await fixture();
      await open(s);
      const a = await interest(s);
      await participant(a.token!, "CONFIRM", { consent: true });
      await participant(a.token!, "FREE_BOOK");
      await expect(
        participant(a.token!, "SUBMIT_FEEDBACK", {
          rating: 5,
          comment: "Too early",
        }),
      ).rejects.toThrow("after the event");
      let w = (await d.readWorkspace(s.token))!;
      for (const task of w.tasks)
        await act(s.token, "COMPLETE_TASK", {
          taskId: task.id,
          evidence:
            "Operator records completion of the actual production task.",
        });
      await act(s.token, "MARK_READY");
      w = (await d.readWorkspace(s.token))!;
      await act(s.token, "CHECK_IN", { bookingId: w.bookings[0].id });
      await act(s.token, "START_EVENT");
      await act(s.token, "COMPLETE_EVENT", {
        evidence: "Operator observed the workshop finish and the room clear.",
      });
      const response = await participant(a.token!, "SUBMIT_FEEDBACK", {
        rating: 4,
        comment: "Private attendee feedback.",
      });
      expect(response.view.feedback?.rating).toBe(4);
      w = (await d.readWorkspace(s.token))!;
      expect(w.completion?.origin).toBe("OPERATOR_ASSERTION");
      expect(w.feedback?.[0].origin).toBe("PARTICIPANT_RESPONSE");
      await expect(
        participant(a.token!, "SUBMIT_FEEDBACK", {
          rating: 5,
          comment: "Duplicate",
        }),
      ).rejects.toThrow("already been saved");
    });
    it("stops new bookings when previously confirmed production evidence expires", async () => {
      const s = await fixture();
      await open(s);
      const a = await interest(s);
      await participant(a.token!, "CONFIRM", { consent: true });
      const w = (await d.readWorkspace(s.token))!;
      w.venue.validUntil = new Date(Date.now() - 1000).toISOString();
      await d.pool.query(
        "UPDATE assembly_workspaces SET document=$2 WHERE id=$1",
        [w.id, { workspace: w, contactDigests: {} }],
      );
      expect((await d.readPublicEvent(w.event.slug)).event.bookingPaused).toBe(
        true,
      );
      await expect(participant(a.token!, "FREE_BOOK")).rejects.toThrow(
        "confirmation has expired",
      );
      expect(countsFor((await d.readWorkspace(s.token))!).bookings).toBe(0);
    });
    it("owner membership keeps past productions reachable and binds commands to event identity", async () => {
      const owner = browser(),
        s = await d.createSession("REAL", owner),
        t = await d.createSession("SAMPLE", owner);
      created.push(s.workspace.id, t.workspace.id);
      expect((await d.listOwnedWorkspaces(owner)).map((w) => w.id)).toEqual(
        expect.arrayContaining([s.workspace.id, t.workspace.id]),
      );
      const switched = await d.selectOwnedWorkspace(owner, s.workspace.id);
      expect(switched.workspace.id).toBe(s.workspace.id);
      await expect(
        d.selectOwnedWorkspace(browser(), s.workspace.id),
      ).rejects.toThrow("not in your owner session");
      await expect(
        d.performAction(switched.token, {
          workspaceId: t.workspace.id,
          type: "CONFIRM_AVAILABILITY",
          payload: {},
          expectedVersion: s.workspace.version,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow("active event changed");
    });
  },
);
