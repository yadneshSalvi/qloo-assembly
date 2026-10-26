import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ActionType } from "@assembly/contracts";
try {
  loadEnvFile(".env.local");
} catch {
  /* CI supplies database. */
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
describe.skipIf(!enabled)(
  "durable research authority and budgets without provider network",
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
      const s = await d.createSession();
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
        type,
        workspaceId: w.id,
        payload,
        expectedVersion: w.version,
        idempotencyKey: randomUUID(),
      });
    }
    async function search(token: string, query = "test artist") {
      const r = await act(token, "SEARCH_CATALOG", {
        query,
        entityType: "artist",
      });
      return r.workspace.run!.id;
    }
    async function finishSearch(id: string, name = "Test artist") {
      const j = (await d.claimJob(id))!;
      expect(j).not.toBeNull();
      await d.completeJob(id, j.leaseToken, {
        search: {
          id,
          query: j.search!.query,
          entityType: "artist",
          status: "COMPLETED",
          candidates: [
            {
              entityId: `test-${id}`,
              entityType: "artist",
              name,
              disambiguation: "Explicit mocked catalog fixture",
            },
          ],
          capturedAt: new Date().toISOString(),
          error: null,
        },
      });
      return j;
    }
    it("claims once across workers and rejects stale lease completion", async () => {
      const s = await session(),
        id = await search(s.token);
      const claims = await Promise.all([
        d.claimJob(id, "worker-a"),
        d.claimJob(id, "worker-b"),
      ]);
      expect(claims.filter(Boolean)).toHaveLength(1);
      const first = claims.find(Boolean)!;
      await d.pool.query(
        "UPDATE assembly_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
        [id],
      );
      const second = (await d.claimJob(id, "worker-b"))!;
      expect(second.leaseToken).not.toBe(first.leaseToken);
      expect(await d.checkpointJob(id, first.leaseToken, "Stale lease")).toBe(
        false,
      );
      expect(
        await d.checkpointJob(id, second.leaseToken, "Current lease"),
      ).toBe(true);
      const row = await d.pool.query<{ lease_until: Date }>(
        "SELECT lease_until FROM assembly_jobs WHERE id=$1",
        [id],
      );
      expect(
        new Date(row.rows[0].lease_until).getTime() - Date.now(),
      ).toBeGreaterThan(110000);
    });
    it("precharges one search call and rejects duplicate excess before any provider call", async () => {
      const s = await session(),
        id = await search(s.token),
        j = (await d.claimJob(id))!;
      expect(await d.reserveProviderCall(id, j.leaseToken, "qloo")).toEqual({
        used: 1,
        limit: 1,
      });
      await expect(
        d.reserveProviderCall(id, j.leaseToken, "qloo"),
      ).rejects.toThrow("provider call budget");
      const r = await d.pool.query<{ qloo_used: number }>(
        "SELECT qloo_used FROM assembly_jobs WHERE id=$1",
        [id],
      );
      expect(r.rows[0].qloo_used).toBe(1);
    });
    it("precharges the fourth model call and rejects a fifth before provider dispatch", async () => {
      const s = await session();
      for (const [id, programStart] of [
        ["typed-budget-a", "19:00"],
        ["typed-budget-b", "20:00"],
      ])
        await act(s.token, "UPSERT_SUPPLIER", {
          supplier: {
            id,
            name: `Synthetic ${id}`,
            discipline: "Synthetic test performance",
            feeMinor: 1000,
            description: "Synthetic fixture offer, no real supplier claimed.",
            critical: true,
            source: "Synthetic quote solely for durable budget testing.",
            influence: "",
            scope: "Synthetic typed performance for the saved budget test.",
            validUntil: new Date(Date.now() + 86400000).toISOString(),
            programStart,
            durationMinutes: 30,
            setupStart: "17:30",
            setupMinutes: 30,
            canOverlap: false,
            soundDb: 60,
          },
        });
      const catalogId = await search(s.token);
      await finishSearch(catalogId);
      const candidate = (await d.readWorkspace(s.token))!.research!.search!
        .candidates[0];
      await act(s.token, "SELECT_ANCHORS", {
        anchors: [candidate],
        targetTypes: ["artist", "movie"],
      });
      const queued = await act(s.token, "RESEARCH", { mode: "LIVE" });
      expect(queued.workspace.research!.budget.modelLimit).toBe(4);
      const id = queued.workspace.run!.id;
      const j = (await d.claimJob(id))!;
      for (let used = 1; used <= 4; used++) {
        expect(await d.reserveProviderCall(id, j.leaseToken, "model")).toEqual({
          used,
          limit: 4,
        });
      }
      await expect(
        d.reserveProviderCall(id, j.leaseToken, "model"),
      ).rejects.toThrow("provider call budget");
      const row = await d.pool.query<{ model_used: number }>(
        "SELECT model_used FROM assembly_jobs WHERE id=$1",
        [id],
      );
      expect(row.rows[0].model_used).toBe(4);
      const latest = (await d.readWorkspace(s.token))!;
      expect(latest.research!.budget).toMatchObject({
        modelUsed: 4,
        modelLimit: 4,
      });
      await act(s.token, "CANCEL_RESEARCH");
    });
    it("cancellation revokes leases and blocks late evidence/results", async () => {
      const s = await session(),
        id = await search(s.token),
        j = (await d.claimJob(id))!;
      await act(s.token, "CANCEL_RESEARCH");
      expect(await d.checkpointJob(id, j.leaseToken, "Should not apply")).toBe(
        false,
      );
      await expect(
        d.reserveProviderCall(id, j.leaseToken, "qloo"),
      ).rejects.toThrow("cancelled or superseded");
      expect(
        await d.completeJob(id, j.leaseToken, { summary: "Late result" }),
      ).toBe(false);
      const w = (await d.readWorkspace(s.token))!;
      expect(w.run?.status).toBe("CANCELLED");
      expect(w.research?.search?.status).toBe("CANCELLED");
      expect(w.evidence.every((e) => e.origin !== "QLOO_RESULT")).toBe(true);
    });
    it("changed inventory invalidates the job snapshot before spending or applying results", async () => {
      const s = await session(),
        id = await search(s.token),
        j = (await d.claimJob(id))!;
      await act(s.token, "UPSERT_SUPPLIER", {
        supplier: {
          id: "extra",
          name: "Extra operator offer",
          discipline: "Music",
          feeMinor: 1000,
          description: "Explicit test quote",
          critical: true,
          source: "Operator fixture quote",
          influence: "",
          scope: "Test-only scope with private details withheld.",
          validUntil: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      await expect(
        d.reserveProviderCall(id, j.leaseToken, "qloo"),
      ).rejects.toThrow("cancelled or superseded");
      const w = (await d.readWorkspace(s.token))!;
      expect(w.run?.status).toBe("FAILED");
      expect(w.run?.error).toContain("No stale provider result");
      expect(JSON.stringify(j.snapshot)).not.toContain("token");
      expect(JSON.stringify(j.snapshot)).not.toContain("address");
      expect(JSON.stringify(j.snapshot)).not.toContain("commitments");
    });
    it("catalog history composes exact matches across searches and rejects invented identifiers", async () => {
      const s = await session(),
        a = await search(s.token, "first search");
      await finishSearch(a, "First Artist");
      const b = await search(s.token, "second search");
      await finishSearch(b, "Second Artist");
      let w = (await d.readWorkspace(s.token))!;
      expect(w.research?.catalogHistory).toHaveLength(2);
      const candidates = w.research!.catalogHistory!.flatMap(
        (s) => s.candidates,
      );
      await act(s.token, "SELECT_ANCHORS", {
        anchors: candidates,
        targetTypes: ["artist", "movie"],
      });
      w = (await d.readWorkspace(s.token))!;
      expect(w.research!.anchors.map((a) => a.name)).toEqual([
        "First Artist",
        "Second Artist",
      ]);
      await expect(
        act(s.token, "SELECT_ANCHORS", {
          anchors: [{ entityId: "invented-id" }],
        }),
      ).rejects.toThrow("exact candidate");
    });
    it("reset removes queued jobs and invalidates previous public links", async () => {
      const s = await session(),
        id = await search(s.token);
      const w = (await d.readWorkspace(s.token))!,
        oldSlug = w.event.slug;
      await d.resetWorkspace(s.token, w.version, randomUUID());
      expect(await d.claimJob(id)).toBeNull();
      expect((await d.readWorkspace(s.token))!.event.slug).not.toBe(oldSlug);
      await expect(d.readPublicEvent(oldSlug)).rejects.toThrow("not published");
    });
  },
);
