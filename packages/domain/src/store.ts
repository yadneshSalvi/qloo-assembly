import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import {
  DEFAULT_PROVIDER_DAILY_LIMITS,
  RESEARCH_CALL_LIMITS,
  type ActionRequest,
  type ActionResult,
  type Workspace,
  type PublicActionRequest,
  type PublicActionResult,
  type SupplierActionRequest,
  type ResearchSnapshot,
  type ClaimedResearchJob,
  type ResearchJobResult,
  type CulturalType,
} from "@assembly/contracts";
import { ActionError, applyAction, type StoredWorkspace } from "./actions";
import { concepts, createWorkspace } from "./seed";
import { supplierScheduleIssues } from "./scheduling";
import { databasePoolConfiguration } from "./database";
import {
  publicEvent,
  participantView,
  supplierView,
  supplierInvitationHash,
  validatePublicRequest,
  assertCurrentPublic,
  recordParticipantAction,
  auditParticipant,
} from "./participants";
const globalDb = globalThis as typeof globalThis & { assemblyPool?: Pool };
export const pool = (globalDb.assemblyPool ??= new Pool(
  databasePoolConfiguration(),
));
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const opaque = () => randomBytes(32).toString("hex");
const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
export const migration = `
CREATE TABLE IF NOT EXISTS assembly_workspaces (id uuid PRIMARY KEY,token_hash text UNIQUE NOT NULL,document jsonb NOT NULL,version integer NOT NULL CHECK(version>0),expires_at timestamptz NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS assembly_owner_workspaces (owner_hash text NOT NULL,workspace_id uuid NOT NULL UNIQUE REFERENCES assembly_workspaces(id) ON DELETE CASCADE,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(owner_hash,workspace_id));
CREATE TABLE IF NOT EXISTS assembly_idempotency (workspace_id uuid NOT NULL REFERENCES assembly_workspaces(id) ON DELETE CASCADE,key text NOT NULL,request_digest text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,key));
CREATE TABLE IF NOT EXISTS assembly_jobs (id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES assembly_workspaces(id) ON DELETE CASCADE,status text NOT NULL,attempts integer NOT NULL DEFAULT 0,lease_until timestamptz,last_error text,created_at timestamptz NOT NULL DEFAULT now(),completed_at timestamptz);
ALTER TABLE assembly_jobs DROP CONSTRAINT IF EXISTS assembly_jobs_status_check;
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS lease_token text;
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'RESEARCH';
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS input_hash text;
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS snapshot jsonb;
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS search jsonb;
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS qloo_used integer NOT NULL DEFAULT 0;
ALTER TABLE assembly_jobs ADD COLUMN IF NOT EXISTS model_used integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS assembly_job_queue ON assembly_jobs(status,created_at);
CREATE INDEX IF NOT EXISTS assembly_workspace_expiry ON assembly_workspaces(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS assembly_event_slug ON assembly_workspaces((document->'workspace'->'event'->>'slug')) WHERE document->'workspace'->'event'->>'slug' <> 'blue-hour';
CREATE TABLE IF NOT EXISTS assembly_capabilities (token_hash text PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES assembly_workspaces(id) ON DELETE CASCADE,kind text NOT NULL CHECK(kind IN ('PARTICIPANT','SUPPLIER')),resource_id text NOT NULL,actor_hash text,expires_at timestamptz NOT NULL,revoked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS assembly_capability_actor ON assembly_capabilities(workspace_id,actor_hash);
CREATE TABLE IF NOT EXISTS assembly_public_idempotency (workspace_id uuid NOT NULL REFERENCES assembly_workspaces(id) ON DELETE CASCADE,actor_hash text NOT NULL,key text NOT NULL,request_digest text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,actor_hash,key));
CREATE TABLE IF NOT EXISTS assembly_rate_limits (bucket text PRIMARY KEY,used integer NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS assembly_provider_usage (bucket text PRIMARY KEY,used integer NOT NULL);
CREATE TABLE IF NOT EXISTS assembly_provider_cache (key text PRIMARY KEY,result jsonb NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS assembly_worker_health (id text PRIMARY KEY,heartbeat_at timestamptz NOT NULL,detail text NOT NULL);
`;
export async function migrate() {
  await transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(775152)");
    await client.query(migration);
  });
}
async function transaction<T>(
  body: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await body(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function rateLimit(
  scope: string,
  identity: string,
  limit: number,
  windowSeconds = 60,
) {
  const window = Math.floor(Date.now() / (windowSeconds * 1000)),
    bucket = digest(`${scope}:${identity}:${window}`);
  const r = await pool.query<{ used: number }>(
    "INSERT INTO assembly_rate_limits(bucket,used,expires_at) VALUES($1,1,$2) ON CONFLICT(bucket) DO UPDATE SET used=assembly_rate_limits.used+1 RETURNING used",
    [bucket, new Date((window + 1) * windowSeconds * 1000)],
  );
  if (r.rows[0].used > limit)
    throw new ActionError(
      "capacity",
      "Too many requests. Please wait before retrying.",
      429,
    );
}
async function save(client: PoolClient, id: string, stored: StoredWorkspace) {
  await client.query(
    "UPDATE assembly_workspaces SET document=$2,version=$3,updated_at=now() WHERE id=$1",
    [id, stored, stored.workspace.version],
  );
}
export async function createSession(
  mode: Workspace["mode"] = "SAMPLE",
  ownerIdentity?: string,
): Promise<{ token: string; workspace: Workspace }> {
  if (!["SAMPLE", "REAL"].includes(mode))
    throw new ActionError(
      "validation",
      "Choose sample or real operations.",
      400,
    );
  const workspace = createWorkspace(randomUUID(), mode),
    token = ownerIdentity
      ? digest(`${ownerIdentity}:${workspace.id}:operator`)
      : opaque();
  await transaction(async (client) => {
    await client.query(
      "INSERT INTO assembly_workspaces(id,token_hash,document,version,expires_at) VALUES($1,$2,$3,$4,$5)",
      [
        workspace.id,
        digest(token),
        { workspace, contactDigests: {} },
        workspace.version,
        workspace.expiresAt,
      ],
    );
    if (ownerIdentity)
      await client.query(
        "INSERT INTO assembly_owner_workspaces(owner_hash,workspace_id) VALUES($1,$2)",
        [digest(ownerIdentity), workspace.id],
      );
  });
  return { token, workspace };
}
export async function readWorkspace(token: string): Promise<Workspace | null> {
  if (!validToken(token)) return null;
  const r = await pool.query<{ document: StoredWorkspace }>(
    "SELECT document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now()",
    [digest(token)],
  );
  return r.rows[0]?.document.workspace ?? null;
}
function validateOwnerRequest(r: ActionRequest) {
  if (
    !r ||
    typeof r.idempotencyKey !== "string" ||
    r.idempotencyKey.length < 8 ||
    r.idempotencyKey.length > 120 ||
    !Number.isSafeInteger(r.expectedVersion)
  )
    throw new ActionError(
      "validation",
      "A request key and current version are required.",
      400,
    );
}
export async function performAction(
  token: string,
  request: ActionRequest,
): Promise<ActionResult> {
  if (!validToken(token))
    throw new ActionError(
      "forbidden",
      "Open an operator workspace first.",
      401,
    );
  validateOwnerRequest(request);
  await rateLimit("owner", digest(token), 90);
  const requestDigest = digest(JSON.stringify(request));
  return transaction(async (client) => {
    const r = await client.query<{ id: string; document: StoredWorkspace }>(
        "SELECT id,document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [digest(token)],
      ),
      row = r.rows[0];
    if (!row)
      throw new ActionError(
        "forbidden",
        "This workspace expired. Open a fresh workspace.",
        401,
      );
    const prior = await client.query<{
      request_digest: string;
      result: { message: string; token?: string };
    }>(
      "SELECT request_digest,result FROM assembly_idempotency WHERE workspace_id=$1 AND key=$2",
      [row.id, request.idempotencyKey],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].request_digest !== requestDigest)
        throw new ActionError(
          "validation",
          "That request key was used for a different action.",
          409,
        );
      return { workspace: row.document.workspace, ...prior.rows[0].result };
    }
    const result = applyAction(row.document, request);
    if (
      ["RESEARCH", "SEARCH_CATALOG"].includes(request.type) &&
      result.workspace.run
    ) {
      const snapshot = researchSnapshot(result.workspace);
      const search =
        request.type === "SEARCH_CATALOG"
          ? {
              query: String(request.payload.query),
              entityType: request.payload.entityType,
            }
          : null;
      await client.query(
        "INSERT INTO assembly_jobs(id,workspace_id,status,kind,input_hash,snapshot,search) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [
          result.workspace.run.id,
          row.id,
          "QUEUED",
          request.type === "SEARCH_CATALOG" ? "SEARCH" : "RESEARCH",
          snapshot.inputHash,
          snapshot,
          search,
        ],
      );
    }
    if (request.type === "CANCEL_RESEARCH")
      await client.query(
        "UPDATE assembly_jobs SET status='CANCELLED',lease_token=NULL,lease_until=NULL WHERE workspace_id=$1 AND status IN ('QUEUED','RUNNING')",
        [row.id],
      );
    if (request.type === "CANCEL_EVENT")
      await client.query(
        "UPDATE assembly_jobs SET status='CANCELLED',lease_token=NULL,lease_until=NULL WHERE workspace_id=$1 AND status IN ('QUEUED','RUNNING')",
        [row.id],
      );
    await save(client, row.id, row.document);
    await client.query(
      "INSERT INTO assembly_idempotency(workspace_id,key,request_digest,result) VALUES($1,$2,$3,$4)",
      [
        row.id,
        request.idempotencyKey,
        requestDigest,
        {
          message: result.message,
          ...(result.token ? { token: result.token } : {}),
        },
      ],
    );
    return result;
  });
}
export async function resetWorkspace(
  token: string,
  expectedVersion: number,
  idempotencyKey: string,
  workspaceId?: string,
): Promise<Workspace> {
  validateOwnerRequest({ idempotencyKey, expectedVersion } as ActionRequest);
  return transaction(async (client) => {
    const r = await client.query<{ id: string; document: StoredWorkspace }>(
        "SELECT id,document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [digest(token)],
      ),
      row = r.rows[0];
    if (!row)
      throw new ActionError("forbidden", "Open a fresh workspace.", 401);
    if (workspaceId && workspaceId !== row.id)
      throw new ActionError(
        "stale_version",
        "The active event changed. Refresh the intended workspace.",
        409,
      );
    if (row.document.workspace.mode !== "SAMPLE")
      throw new ActionError(
        "forbidden",
        "Real events cannot be reset. Use explicit cancellation.",
        403,
      );
    const requestDigest = digest(
      JSON.stringify({ type: "RESET", expectedVersion, idempotencyKey }),
    );
    const prior = await client.query<{ request_digest: string }>(
      "SELECT request_digest FROM assembly_idempotency WHERE workspace_id=$1 AND key=$2",
      [row.id, idempotencyKey],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].request_digest !== requestDigest)
        throw new ActionError(
          "validation",
          "Reset key was reused with different terms.",
          409,
        );
      return row.document.workspace;
    }
    if (row.document.workspace.version !== expectedVersion)
      throw new ActionError(
        "stale_version",
        "Refresh before resetting this changed workspace.",
        409,
      );
    const workspace = createWorkspace(row.id);
    workspace.version = expectedVersion + 1;
    workspace.audit[0].version = workspace.version;
    await client.query("DELETE FROM assembly_jobs WHERE workspace_id=$1", [
      row.id,
    ]);
    await client.query(
      "DELETE FROM assembly_capabilities WHERE workspace_id=$1",
      [row.id],
    );
    await client.query(
      "DELETE FROM assembly_public_idempotency WHERE workspace_id=$1",
      [row.id],
    );
    await client.query(
      "UPDATE assembly_workspaces SET document=$2,version=$3,expires_at=$4,updated_at=now() WHERE id=$1",
      [
        row.id,
        { workspace, contactDigests: {} },
        workspace.version,
        workspace.expiresAt,
      ],
    );
    await client.query(
      "INSERT INTO assembly_idempotency(workspace_id,key,request_digest,result) VALUES($1,$2,$3,$4)",
      [row.id, idempotencyKey, requestDigest, { message: "Sample reset." }],
    );
    return workspace;
  });
}
async function bySlug(client: PoolClient, slug: string, lock = false) {
  if (!/^event-[a-f0-9]{24}$/.test(slug))
    throw new ActionError("not_found", "Event not found.", 404);
  const r = await client.query<{ id: string; document: StoredWorkspace }>(
    `SELECT id,document FROM assembly_workspaces WHERE document->'workspace'->'event'->>'slug'=$1 AND expires_at>now() ${lock ? "FOR UPDATE" : ""}`,
    [slug],
  );
  const row = r.rows[0];
  if (!row || !row.document.workspace.event.publishedAt)
    throw new ActionError("not_found", "This event is not published.", 404);
  return row;
}
export async function readPublicEvent(slug: string) {
  return transaction(async (client) =>
    publicEvent((await bySlug(client, slug)).document.workspace),
  );
}
async function byCapability(
  client: PoolClient,
  token: string,
  kind: "PARTICIPANT" | "SUPPLIER",
  lock = false,
) {
  if (!validToken(token))
    throw new ActionError("not_found", "This private link is not valid.", 404);
  // Always lock the workspace before reading the capability to keep one lock order with owner writes.
  const r = await client.query<{
    id: string;
    document: StoredWorkspace;
    resource_id: string;
  }>(
    `SELECT w.id,w.document,c.resource_id FROM assembly_workspaces w JOIN assembly_capabilities c ON c.workspace_id=w.id WHERE c.token_hash=$1 AND c.kind=$2 AND c.revoked_at IS NULL AND c.expires_at>now() AND w.expires_at>now() ${lock ? "FOR UPDATE OF w" : ""}`,
    [digest(token), kind],
  );
  if (!r.rows[0])
    throw new ActionError(
      "not_found",
      "This private link expired or was revoked.",
      404,
    );
  return r.rows[0];
}
export async function readParticipant(token: string) {
  return transaction(async (client) => {
    const r = await byCapability(client, token, "PARTICIPANT");
    return participantView(r.document.workspace, r.resource_id);
  });
}
export async function readSupplier(token: string) {
  return transaction(async (client) => {
    const r = await byCapability(client, token, "SUPPLIER");
    return supplierView(r.document.workspace, r.resource_id);
  });
}
async function replay(
  client: PoolClient,
  workspaceId: string,
  actor: string,
  key: string,
  requestDigest: string,
) {
  const r = await client.query<{
    request_digest: string;
    result: Record<string, unknown>;
  }>(
    "SELECT request_digest,result FROM assembly_public_idempotency WHERE workspace_id=$1 AND actor_hash=$2 AND key=$3",
    [workspaceId, actor, key],
  );
  if (r.rows[0] && r.rows[0].request_digest !== requestDigest)
    throw new ActionError(
      "validation",
      "That request key was already used for a different choice.",
      409,
    );
  return r.rows[0]?.result;
}
async function remember(
  client: PoolClient,
  workspaceId: string,
  actor: string,
  key: string,
  requestDigest: string,
  result: unknown,
) {
  await client.query(
    "INSERT INTO assembly_public_idempotency(workspace_id,actor_hash,key,request_digest,result) VALUES($1,$2,$3,$4,$5)",
    [workspaceId, actor, key, requestDigest, result],
  );
}
export async function expressPublicInterest(
  slug: string,
  browserIdentity: string,
  r: PublicActionRequest,
): Promise<PublicActionResult> {
  validatePublicRequest(r);
  if (r.type !== "EXPRESS_INTEREST" || !validToken(browserIdentity))
    throw new ActionError(
      "forbidden",
      "A browser response identity is required.",
      403,
    );
  const actor = digest(browserIdentity);
  await rateLimit("interest", actor, 15);
  await rateLimit("event-interest", slug, 200);
  return transaction(async (client) => {
    const row = await bySlug(client, slug, true),
      w = row.document.workspace,
      requestDigest = digest(JSON.stringify(r)),
      prior = await replay(
        client,
        row.id,
        actor,
        r.idempotencyKey,
        requestDigest,
      );
    // Derive a high-entropy response capability from the private browser secret and request key. Only its hash is persisted.
    const token = digest(
      `${browserIdentity}:${row.id}:${r.idempotencyKey}:response`,
    );
    if (prior)
      return {
        view: participantView(w, String(prior.commitmentId)),
        message: String(prior.message),
        token,
      };
    assertCurrentPublic(w, r);
    if (["COMPLETED", "CANCELLED", "LIVE"].includes(w.event.lifecycle))
      throw new ActionError(
        "dependency",
        "This event is no longer accepting interest.",
        422,
      );
    const p = r.payload;
    if (
      Object.keys(p).some(
        (k) => !["name", "quantity", "consent"].includes(k),
      ) ||
      p.consent !== true ||
      typeof p.name !== "string" ||
      !p.name.trim() ||
      p.name.length > 100 ||
      !Number.isSafeInteger(p.quantity) ||
      (p.quantity as number) < 1 ||
      (p.quantity as number) > 6
    )
      throw new ActionError(
        "validation",
        "Give a display name, one to six places, and accept the current exact terms.",
        400,
      );
    const duplicate = await client.query<{ resource_id: string }>(
      "SELECT resource_id FROM assembly_capabilities WHERE workspace_id=$1 AND kind=$2 AND actor_hash=$3 AND revoked_at IS NULL AND expires_at>now()",
      [row.id, "PARTICIPANT", actor],
    );
    if (
      duplicate.rows.some((x) =>
        w.commitments.some(
          (c) => c.id === x.resource_id && c.status !== "WITHDRAWN",
        ),
      )
    )
      throw new ActionError(
        "validation",
        "This browser already has an active choice. Use its private response link. Browser cookies limit duplicates; they do not verify a person.",
        409,
      );
    const cid = randomUUID();
    w.commitments.push({
      id: cid,
      displayName: p.name.trim(),
      emailMasked: "",
      token: "",
      quantity: p.quantity as number,
      termsVersion: w.terms.version,
      status: "PENDING",
      createdAt: new Date().toISOString(),
      verifiedAt: null,
    });
    await client.query(
      "INSERT INTO assembly_capabilities(token_hash,workspace_id,kind,resource_id,actor_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6)",
      [digest(token), row.id, "PARTICIPANT", cid, actor, w.expiresAt],
    );
    const message =
      "Interest saved. Keep your private response link, then confirm possession to record consent. No email or identity verification occurs.";
    auditParticipant(w, "PUBLIC_INTEREST", message);
    await save(client, row.id, row.document);
    await remember(client, row.id, actor, r.idempotencyKey, requestDigest, {
      commitmentId: cid,
      message,
    });
    return { view: participantView(w, cid), message, token };
  });
}
export async function performParticipantAction(
  token: string,
  r: PublicActionRequest,
): Promise<PublicActionResult> {
  validatePublicRequest(r);
  await rateLimit("participant", digest(token), 40);
  return transaction(async (client) => {
    const row = await byCapability(client, token, "PARTICIPANT", true),
      actor = digest(token),
      requestDigest = digest(JSON.stringify(r)),
      prior = await replay(
        client,
        row.id,
        actor,
        r.idempotencyKey,
        requestDigest,
      );
    if (prior)
      return {
        view: participantView(row.document.workspace, row.resource_id),
        message: String(prior.message),
      };
    const message = recordParticipantAction(row.document, row.resource_id, r);
    await save(client, row.id, row.document);
    await remember(client, row.id, actor, r.idempotencyKey, requestDigest, {
      message,
    });
    return {
      view: participantView(row.document.workspace, row.resource_id),
      message,
    };
  });
}
export async function mintSupplierLink(
  ownerToken: string,
  supplierId: string,
  expectedVersion: number,
  idempotencyKey: string,
  workspaceId?: string,
) {
  validateOwnerRequest({ expectedVersion, idempotencyKey } as ActionRequest);
  if (!validToken(ownerToken))
    throw new ActionError("forbidden", "Operator authority required.", 403);
  await rateLimit("invite", digest(ownerToken), 30);
  return transaction(async (client) => {
    const q = await client.query<{ id: string; document: StoredWorkspace }>(
        "SELECT id,document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [digest(ownerToken)],
      ),
      row = q.rows[0];
    if (!row)
      throw new ActionError("forbidden", "Operator authority required.", 403);
    const w = row.document.workspace;
    if (workspaceId && workspaceId !== w.id)
      throw new ActionError(
        "stale_version",
        "The active event changed. Refresh the intended workspace.",
        409,
      );
    if (w.version !== expectedVersion)
      throw new ActionError(
        "stale_version",
        "Refresh before creating an invitation.",
        409,
      );
    if (!w.suppliers.some((s) => s.id === supplierId))
      throw new ActionError("not_found", "Supplier not found.", 404);
    if (["CANCELLED", "COMPLETED"].includes(w.event.lifecycle))
      throw new ActionError(
        "dependency",
        "This event no longer accepts supply.",
        422,
      );
    // Retries derive the same opaque token; owner token never enters the invitation.
    const token = digest(
      `${ownerToken}:${row.id}:${supplierId}:${idempotencyKey}:supplier`,
    );
    await client.query(
      "INSERT INTO assembly_capabilities(token_hash,workspace_id,kind,resource_id,expires_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(token_hash) DO NOTHING",
      [digest(token), row.id, "SUPPLIER", supplierId, w.expiresAt],
    );
    return { supplierId, token, view: supplierView(w, supplierId) };
  });
}
export async function performSupplierAction(
  token: string,
  r: SupplierActionRequest,
) {
  if (
    !r ||
    typeof r.idempotencyKey !== "string" ||
    r.idempotencyKey.length < 8 ||
    r.idempotencyKey.length > 120 ||
    Object.keys(r).some(
      (k) =>
        ![
          "type",
          "expectedVersion",
          "termsHash",
          "invitationHash",
          "idempotencyKey",
          "payload",
        ].includes(k),
    ) ||
    !["CONFIRM", "DECLINE"].includes(r.type) ||
    !r.payload ||
    typeof r.payload !== "object" ||
    Array.isArray(r.payload)
  )
    throw new ActionError(
      "validation",
      "A current invitation and request key are required.",
      400,
    );
  await rateLimit("supplier", digest(token), 40);
  return transaction(async (client) => {
    const row = await byCapability(client, token, "SUPPLIER", true),
      w = row.document.workspace,
      actor = digest(token),
      requestDigest = digest(JSON.stringify(r)),
      prior = await replay(
        client,
        row.id,
        actor,
        r.idempotencyKey,
        requestDigest,
      );
    if (prior)
      return {
        view: supplierView(w, row.resource_id),
        message: String(prior.message),
      };
    const s = w.suppliers.find((s) => s.id === row.resource_id);
    if (!s)
      throw new ActionError("not_found", "This offer no longer exists.", 404);
    if (
      ["CANCELLED", "COMPLETED"].includes(w.event.lifecycle) ||
      (w.event.lifecycle === "LIVE" && r.type === "CONFIRM")
    )
      throw new ActionError(
        "dependency",
        "This event no longer accepts this supply response.",
        422,
      );
    if (
      r.expectedVersion !== (w.event.publicVersion ?? 1) ||
      r.termsHash !== w.terms.hash ||
      r.invitationHash !== supplierInvitationHash(w, s.id)
    )
      throw new ActionError(
        "stale_version",
        "The production was updated. Review the refreshed assignment before responding.",
        409,
      );
    if (
      Object.keys(r.payload).some((k) => !["validUntil", "note"].includes(k)) ||
      (r.payload.note !== undefined &&
        (typeof r.payload.note !== "string" || r.payload.note.length > 1500))
    )
      throw new ActionError("validation", "Check the response details.", 400);
    let message: string;
    if (r.type === "CONFIRM") {
      const timingIssues = supplierScheduleIssues(w, s);
      if (timingIssues.length)
        throw new ActionError(
          "dependency",
          "Review complete exact program and setup timing before confirming this offer.",
          422,
          timingIssues,
        );
      const expiry = r.payload.validUntil;
      if (
        typeof expiry !== "string" ||
        !Number.isFinite(Date.parse(expiry)) ||
        Date.parse(expiry) <= Date.now()
      )
        throw new ActionError(
          "validation",
          "Set a future confirmation expiry.",
          400,
        );
      s.status = "CONFIRMED";
      s.confirmedAt = new Date().toISOString();
      s.validUntil = expiry;
      s.confirmationMethod = "SUPPLIER_RESPONSE";
      s.confirmedTermsHash = w.terms.hash;
      s.confirmedOfferHash = supplierInvitationHash(w, s.id);
      s.confirmationNote = r.payload.note?.trim() ?? "";
      message =
        "A holder of this supplier invitation accepted the exact scope, fee and date. Supplier identity is not independently verified. No external message or payment was sent.";
    } else {
      s.status = "UNAVAILABLE";
      s.confirmedAt = null;
      s.confirmationMethod = "SUPPLIER_RESPONSE";
      s.confirmationNote = r.payload.note?.trim() ?? "";
      if (
        w.concepts
          .find((c) => c.id === w.event.selectedConceptId)
          ?.supplierIds.includes(s.id)
      ) {
        w.event.bookingPaused = true;
        w.event.operationalRisk = "SUPPLIER_LOSS";
        w.change = null;
      }
      message =
        "Supplier declined. Selected supply loss pauses bookings until an explicit replacement review is approved.";
    }
    auditParticipant(w, `SUPPLIER_${r.type}`, message);
    w.event.publicVersion = (w.event.publicVersion ?? 1) + 1;
    await save(client, row.id, row.document);
    await remember(client, row.id, actor, r.idempotencyKey, requestDigest, {
      message,
    });
    return { view: supplierView(w, s.id), message };
  });
}

/** Provider input allowlist. Never add attendee data or raw workspace serialization here. */
export function researchSnapshot(w: Workspace): ResearchSnapshot {
  const r = w.research;
  const clean: Omit<ResearchSnapshot, "inputHash"> = {
    workspaceId: w.id,
    brief: {
      ambition: w.brief.ambition,
      audience: w.brief.audience,
      notes: w.brief.notes,
      date: w.brief.date,
      doors: w.brief.doors,
      end: w.brief.end,
      budgetMinor: w.brief.budgetMinor,
      ticketPriceMinor: w.brief.ticketPriceMinor,
      overheadMinor: w.brief.overheadMinor,
      perGuestMinor: w.brief.perGuestMinor,
    },
    venue: {
      capacity: w.venue.capacity,
      soundLimitDb: w.venue.soundLimitDb,
      curfew: w.venue.curfew,
      availability: w.venue.availability,
    },
    inventory: w.suppliers.map((s) => ({
      id: s.id,
      role: s.discipline,
      label: s.name,
      feeMinor: s.feeMinor,
      status: s.status,
      scope: s.scope,
      influenceIds: (r?.influences ?? [])
        .filter((i) => i.supplierId === s.id)
        .map((i) => i.entityId),
      variableCostMinor: s.variableCostMinor,
      setupMinutes: s.setupMinutes,
      durationMinutes: s.durationMinutes,
      programStart: s.programStart,
      setupStart: s.setupStart,
      canOverlap: s.canOverlap,
      soundDb: s.soundDb,
      rightsConfirmed: s.rightsConfirmed,
      availabilityConfirmed:
        s.availabilityConfirmed ??
        (s.status === "CONFIRMED" &&
          !!s.validUntil &&
          Date.parse(s.validUntil) > Date.now()),
    })),
    anchors: r?.anchors ?? [],
    influences: r?.influences ?? [],
    targetTypes: r?.targetTypes ?? ["artist", "movie", "book"],
  };
  return { ...clean, inputHash: digest(JSON.stringify(clean)) };
}
type JobRow = {
  id: string;
  workspace_id: string;
  attempts: number;
  kind: "RESEARCH" | "SEARCH";
  input_hash: string;
  snapshot: ResearchSnapshot;
  search?: { query: string; entityType: CulturalType };
  lease_token: string;
  status: string;
  lease_until: Date;
  qloo_used: number;
  model_used: number;
};
let lastDatabaseHeartbeat = 0;
export async function claimJob(
  jobId?: string,
  workerId = "worker",
  leaseMs = 120000,
): Promise<ClaimedResearchJob | null> {
  if (Date.now() - lastDatabaseHeartbeat > 30000) {
    await workerHeartbeat(workerId, "Claiming durable research work");
    lastDatabaseHeartbeat = Date.now();
  }
  const job = await transaction(async (client) => {
    const q = await client.query<JobRow>(
        `SELECT j.* FROM assembly_jobs j JOIN assembly_workspaces w ON w.id=j.workspace_id WHERE (j.status='QUEUED' OR (j.status='RUNNING' AND j.lease_until<now())) AND w.expires_at>now() ${jobId ? "AND j.id=$1" : ""} ORDER BY j.created_at FOR UPDATE OF j SKIP LOCKED LIMIT 1`,
        jobId ? [jobId] : [],
      ),
      row = q.rows[0];
    if (!row) return null;
    const leaseToken = opaque();
    await client.query(
      "UPDATE assembly_jobs SET status='RUNNING',attempts=attempts+1,lease_token=$2,lease_until=now()+($3::integer*interval '1 millisecond') WHERE id=$1",
      [row.id, leaseToken, Math.min(Math.max(leaseMs, 30000), 600000)],
    );
    return { ...row, lease_token: leaseToken, attempts: row.attempts + 1 };
  });
  if (!job) return null;
  return {
    id: job.id,
    workspaceId: job.workspace_id,
    leaseToken: job.lease_token,
    attempts: job.attempts,
    inputHash: job.input_hash,
    kind: job.kind,
    snapshot: job.snapshot,
    ...(job.search ? { search: job.search } : {}),
  };
}
async function activeJob(client: PoolClient, id: string, leaseToken: string) {
  const q = await client.query<{ document: StoredWorkspace; id: string }>(
      "SELECT w.id,w.document FROM assembly_workspaces w JOIN assembly_jobs j ON j.workspace_id=w.id WHERE j.id=$1 AND w.expires_at>now() FOR UPDATE OF w",
      [id],
    ),
    row = q.rows[0];
  if (!row) return null;
  const j = await client.query<JobRow>(
      "SELECT * FROM assembly_jobs WHERE id=$1 FOR UPDATE",
      [id],
    ),
    job = j.rows[0];
  const w = row.document.workspace;
  if (
    !job ||
    job.status !== "RUNNING" ||
    job.lease_token !== leaseToken ||
    !job.lease_until ||
    new Date(job.lease_until).getTime() <= Date.now() ||
    w.run?.id !== id ||
    !["QUEUED", "RUNNING"].includes(w.run.status)
  )
    return null;
  if (job.input_hash !== researchSnapshot(w).inputHash) {
    await client.query(
      "UPDATE assembly_jobs SET status='CANCELLED',last_error='Research inputs changed',lease_until=NULL,lease_token=NULL,completed_at=now() WHERE id=$1",
      [id],
    );
    w.run.status = "FAILED";
    w.run.stage = "Inputs changed — start a new run";
    w.run.error =
      "Inventory or brief changed. No stale provider result was applied.";
    w.event.lifecycle = w.concepts.length ? "CONCEPT_READY" : "DRAFT";
    auditParticipant(w, "RESEARCH_STALE", w.run.error);
    await save(client, row.id, row.document);
    return null;
  }
  return { ...row, job };
}
export async function checkpointJob(
  id: string,
  leaseToken: string,
  stage: string,
  trace: import("@assembly/contracts").ResearchTrace[] = [],
): Promise<boolean> {
  if (typeof stage !== "string" || stage.length > 300)
    throw new ActionError("validation", "Invalid research progress.", 400);
  return transaction(async (client) => {
    const row = await activeJob(client, id, leaseToken);
    if (!row) return false;
    const w = row.document.workspace;
    w.run!.status = "RUNNING";
    w.run!.stage = stage;
    w.run!.milestones.push({ label: stage, at: new Date().toISOString() });
    w.run!.milestones = w.run!.milestones.slice(-30);
    if (w.research) {
      w.research.trace = [...w.research.trace, ...trace].slice(-60);
      if (row.job.kind === "SEARCH" && w.research.search)
        w.research.search.status = "RUNNING";
    }
    await client.query(
      "UPDATE assembly_jobs SET lease_until=now()+interval '120 seconds' WHERE id=$1",
      [id],
    );
    w.version++;
    await save(client, row.id, row.document);
    return true;
  });
}
export async function reserveProviderCall(
  id: string,
  leaseToken: string,
  provider: "qloo" | "model",
  units = 1,
) {
  if (
    !["qloo", "model"].includes(provider) ||
    !Number.isSafeInteger(units) ||
    units < 1 ||
    units > 3
  )
    throw new ActionError(
      "validation",
      "Invalid provider budget request.",
      400,
    );
  const reservation = await transaction(async (client) => {
    const row = await activeJob(client, id, leaseToken);
    if (!row) return null;
    if (row.job.attempts > 3)
      throw new ActionError(
        "capacity",
        "The research retry budget is exhausted.",
        429,
      );
    const used = provider === "qloo" ? row.job.qloo_used : row.job.model_used,
      perJob =
        row.job.kind === "SEARCH"
          ? provider === "qloo"
            ? 1
            : 0
          : RESEARCH_CALL_LIMITS[provider];
    if (used + units > perJob)
      throw new ActionError(
        "capacity",
        "This run reached its provider call budget.",
        429,
      );
    const day = new Date().toISOString().slice(0, 10),
      minute = Math.floor(Date.now() / 60000);
    const caps: [string, number][] = [
      [
        `${provider}:global:${day}`,
        Number(
          process.env[`${provider.toUpperCase()}_DAILY_CALL_LIMIT`] ??
            DEFAULT_PROVIDER_DAILY_LIMITS[provider].global,
        ),
      ],
      [
        `${provider}:${row.id}:${day}`,
        Number(
          process.env[`${provider.toUpperCase()}_WORKSPACE_DAILY_CALL_LIMIT`] ??
            DEFAULT_PROVIDER_DAILY_LIMITS[provider].workspace,
        ),
      ],
      [`${provider}:minute:${minute}`, provider === "qloo" ? 30 : 12],
    ];
    // Stable order prevents different workspaces taking provider budget locks in opposite orders.
    for (const [bucket, cap] of caps.sort((a, b) => a[0].localeCompare(b[0]))) {
      const usage = await client.query<{ used: number }>(
        "INSERT INTO assembly_provider_usage(bucket,used) VALUES($1,$2) ON CONFLICT(bucket) DO UPDATE SET used=assembly_provider_usage.used+EXCLUDED.used RETURNING used",
        [bucket, units],
      );
      if (!Number.isFinite(cap) || usage.rows[0].used > cap)
        throw new ActionError(
          "capacity",
          "Shared provider budget reached. Retry later or review the configured cap.",
          429,
        );
    }
    await client.query(
      `UPDATE assembly_jobs SET ${provider === "qloo" ? "qloo_used" : "model_used"}=${provider === "qloo" ? "qloo_used" : "model_used"}+$2 WHERE id=$1`,
      [id, units],
    );
    if (row.document.workspace.research) {
      const b = row.document.workspace.research.budget;
      if (provider === "qloo") b.qlooUsed += units;
      else b.modelUsed += units;
      await save(client, row.id, row.document);
    }
    return { used: used + units, limit: perJob };
  });
  if (!reservation)
    throw new ActionError(
      "stale_version",
      "Research was cancelled or superseded.",
      409,
    );
  return reservation;
}
export async function providerCacheGet(key: string): Promise<unknown | null> {
  const q = await pool.query<{ result: unknown }>(
    "SELECT result FROM assembly_provider_cache WHERE key=$1 AND expires_at>now()",
    [digest(key)],
  );
  return q.rows[0]?.result ?? null;
}
export async function providerCachePut(
  key: string,
  result: unknown,
  ttlMs = 3600000,
) {
  if (JSON.stringify(result).length > 200000)
    throw new ActionError(
      "validation",
      "Normalized provider result is too large.",
      400,
    );
  await pool.query(
    "INSERT INTO assembly_provider_cache(key,result,expires_at) VALUES($1,$2,$3) ON CONFLICT(key) DO UPDATE SET result=EXCLUDED.result,expires_at=EXCLUDED.expires_at",
    [
      digest(key),
      result,
      new Date(Date.now() + Math.min(Math.max(ttlMs, 1000), 86400000)),
    ],
  );
}
export async function completeJob(
  id: string,
  leaseToken: string,
  result: ResearchJobResult,
): Promise<boolean> {
  return transaction(async (client) => {
    const row = await activeJob(client, id, leaseToken);
    if (!row) return false;
    const w = row.document.workspace;
    if (row.job.kind === "SEARCH") {
      if (
        !result.search ||
        result.search.query !== row.job.search?.query ||
        result.search.entityType !== row.job.search?.entityType ||
        result.search.candidates.length > 20 ||
        result.search.candidates.some(
          (c) =>
            typeof c.entityId !== "string" ||
            !c.entityId ||
            c.entityType !== result.search!.entityType ||
            typeof c.name !== "string",
        )
      )
        throw new ActionError(
          "upstream",
          "The catalog returned an invalid search result.",
          502,
        );
      if (!w.research)
        throw new ActionError("dependency", "Research state is missing.");
      w.research.search = { ...result.search, id };
      w.research.catalogHistory = [
        ...(w.research.catalogHistory ?? []).filter((s) => s.id !== id),
        w.research.search,
      ].slice(-20);
      w.run!.stage =
        result.search.status === "EMPTY"
          ? "No catalog matches"
          : "Catalog matches ready";
      w.event.lifecycle = w.concepts.length ? "CONCEPT_READY" : "DRAFT";
    } else {
      if (
        !result.concepts?.length ||
        result.concepts.length > 3 ||
        result.concepts.some(
          (c) =>
            !Array.isArray(c.supplierIds) ||
            c.supplierIds.some(
              (sid) => !w.suppliers.some((s) => s.id === sid),
            ) ||
            !Number.isSafeInteger(c.fixedCostMinor) ||
            c.fixedCostMinor < 0 ||
            !Number.isSafeInteger(c.variableCostMinor) ||
            c.variableCostMinor < 0,
        )
      )
        throw new ActionError(
          "upstream",
          "The proposed concepts did not match operator inventory.",
          502,
        );
      if (
        w.run!.mode === "LIVE" &&
        result.concepts.some(
          (c) =>
            new Set(c.supplierIds).size !== c.supplierIds.length ||
            c.fixedCostMinor !==
              c.supplierIds.reduce(
                (n, sid) =>
                  n + (w.suppliers.find((s) => s.id === sid)?.feeMinor ?? 0),
                w.brief.overheadMinor ?? 0,
              ) ||
            c.variableCostMinor !== (w.brief.perGuestMinor ?? 0),
        )
      )
        throw new ActionError(
          "upstream",
          "Concept costs must equal the saved operator inventory and overhead; model numbers cannot override the worksheet.",
          502,
        );
      const evidenceIds = new Set((result.evidence ?? []).map((e) => e.id));
      if (
        w.run!.mode === "LIVE" &&
        (!evidenceIds.size ||
          result.concepts.some(
            (c) =>
              !c.evidenceIds.length ||
              c.evidenceIds.some((id) => !evidenceIds.has(id)) ||
              c.researchRunId !== id ||
              c.origin !== "MODEL_HYPOTHESIS",
          ))
      )
        throw new ActionError(
          "upstream",
          "Live concepts must cite evidence returned by this exact research run.",
          502,
        );
      w.concepts = structuredClone(result.concepts);
      w.evidence = [
        ...w.evidence.filter((e) => e.origin !== "QLOO_RESULT"),
        ...(result.evidence ?? []),
      ];
      w.event.lifecycle = "CONCEPT_READY";
      w.run!.stage = "Live evidence and concepts ready";
      w.qloo = {
        status: "LIVE",
        message:
          "Live Qloo cultural evidence. Operational inventory remains operator supplied; demand and availability are not inferred.",
        lastCheckedAt: new Date().toISOString(),
      };
    }
    w.run!.status = "COMPLETED";
    w.run!.error = null;
    if (w.research)
      w.research.trace = [
        ...new Map(
          [...w.research.trace, ...(result.trace ?? [])].map((t) => [t.id, t]),
        ).values(),
      ].slice(-60);
    auditParticipant(w, "RESEARCH_COMPLETED", result.summary ?? w.run!.stage);
    await save(client, row.id, row.document);
    await client.query(
      "UPDATE assembly_jobs SET status='COMPLETED',lease_until=NULL,lease_token=NULL,completed_at=now() WHERE id=$1",
      [id],
    );
    return true;
  });
}
export async function failJob(
  id: string,
  leaseToken: string,
  message: string,
  retryable = false,
): Promise<boolean> {
  return transaction(async (client) => {
    const row = await activeJob(client, id, leaseToken);
    if (!row) return false;
    const w = row.document.workspace,
      retry = retryable && row.job.attempts < 3;
    const safeMessage = String(message).slice(0, 1500);
    w.run!.status = retry ? "QUEUED" : "FAILED";
    w.run!.stage = retry ? "Retry queued" : "Research needs attention";
    w.run!.error = safeMessage;
    if (!retry)
      w.event.lifecycle = w.concepts.length ? "CONCEPT_READY" : "DRAFT";
    if (w.research?.search && row.job.kind === "SEARCH") {
      w.research.search.status = retry ? "QUEUED" : "FAILED";
      w.research.search.error = safeMessage;
    }
    auditParticipant(w, "RESEARCH_FAILED", safeMessage);
    await save(client, row.id, row.document);
    await client.query(
      "UPDATE assembly_jobs SET status=$2,last_error=$3,lease_until=NULL,lease_token=NULL,completed_at=CASE WHEN $2='FAILED' THEN now() ELSE NULL END WHERE id=$1",
      [id, retry ? "QUEUED" : "FAILED", safeMessage],
    );
    return true;
  });
}
/** Network handlers run after the claim transaction and before the guarded completion transaction. */
export async function processNextJob(
  handler?: (job: ClaimedResearchJob) => Promise<ResearchJobResult>,
  jobId?: string,
): Promise<boolean> {
  const job = await claimJob(jobId);
  if (!job) return false;
  const q = await pool.query<{ document: StoredWorkspace }>(
      "SELECT document FROM assembly_workspaces WHERE id=$1",
      [job.workspaceId],
    ),
    w = q.rows[0]?.document.workspace;
  if (!w || w.run?.id !== job.id) return true;
  if (job.attempts > 3) {
    await failJob(
      job.id,
      job.leaseToken,
      "The worker could not complete this run within its retry budget. Your brief is saved.",
    );
    return true;
  }
  if (w.run.mode === "SAMPLE") {
    // The sample engine has no provider calls and keeps its authored provenance.
    await transaction(async (client) => {
      const row = await activeJob(client, job.id, job.leaseToken);
      if (!row) return;
      const w = row.document.workspace,
        eligible = concepts.filter(
          (c) =>
            c.fixedCostMinor + c.variableCostMinor * w.venue.capacity <=
            w.brief.budgetMinor,
        ),
        at = new Date().toISOString();
      if (!eligible.length) {
        w.run!.status = "FAILED";
        w.run!.stage = "Needs a revised brief";
        w.run!.error =
          "No authored concept fits this capacity and budget. Adjust the brief and retry.";
        w.event.lifecycle = "DRAFT";
      } else {
        w.concepts = structuredClone(eligible);
        w.run!.status = "COMPLETED";
        w.run!.stage = "Authored concepts ready";
        w.run!.milestones = [
          { label: "Read the saved brief", at },
          { label: "Checked sample inventory and budget", at },
          { label: "Prepared authored editorial concepts", at },
        ];
        w.event.lifecycle = "CONCEPT_READY";
      }
      auditParticipant(
        w,
        "RESEARCH_COMPLETED",
        w.run!.error ??
          "The sample worker prepared budget-eligible authored concepts. No Qloo call occurred.",
      );
      await save(client, row.id, row.document);
      await client.query(
        "UPDATE assembly_jobs SET status=$2,lease_until=NULL,lease_token=NULL,completed_at=now() WHERE id=$1",
        [job.id, w.run!.status],
      );
    });
  } else if (handler) {
    try {
      await completeJob(job.id, job.leaseToken, await handler(job));
    } catch (error) {
      await failJob(
        job.id,
        job.leaseToken,
        error instanceof ActionError
          ? error.message
          : "Live research could not complete. Provider details were withheld; retry or review configuration.",
      );
    }
  } else
    await failJob(
      job.id,
      job.leaseToken,
      "Live research worker is not configured. Authored results were not substituted.",
    );
  return true;
}
export async function workerHeartbeat(
  id = "worker",
  detail = "Worker available",
) {
  await pool.query(
    "INSERT INTO assembly_worker_health(id,heartbeat_at,detail) VALUES($1,now(),$2) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),detail=EXCLUDED.detail",
    [id, detail.slice(0, 200)],
  );
}
export function workerHealth(
  heartbeat: Date | string | null | undefined,
  now = Date.now(),
) {
  const instant = heartbeat ? new Date(heartbeat).getTime() : NaN;
  return {
    worker: !Number.isFinite(instant)
      ? "unknown"
      : instant <= now + 30000 && now - instant < 180000
        ? "ready"
        : "degraded",
    heartbeatAt: Number.isFinite(instant)
      ? new Date(instant).toISOString()
      : null,
  };
}
export async function healthStatus() {
  await pool.query("SELECT 1");
  const q = await pool.query<{ heartbeat_at: Date }>(
    "SELECT heartbeat_at FROM assembly_worker_health ORDER BY heartbeat_at DESC LIMIT 1",
  );
  return { database: "ready", ...workerHealth(q.rows[0]?.heartbeat_at) };
}
export async function purgeExpired() {
  await pool.query("DELETE FROM assembly_workspaces WHERE expires_at<=now()");
  await pool.query("DELETE FROM assembly_rate_limits WHERE expires_at<now()");
  await pool.query(
    "DELETE FROM assembly_provider_cache WHERE expires_at<now()",
  );
}

export async function adoptOwnerWorkspace(
  ownerIdentity: string,
  currentToken: string,
) {
  if (!validToken(ownerIdentity) || !validToken(currentToken)) return null;
  return transaction(async (client) => {
    const q = await client.query<{ id: string; document: StoredWorkspace }>(
        "SELECT id,document FROM assembly_workspaces WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [digest(currentToken)],
      ),
      row = q.rows[0];
    if (!row) return null;
    const membership = await client.query<{ owner_hash: string }>(
      "SELECT owner_hash FROM assembly_owner_workspaces WHERE workspace_id=$1",
      [row.id],
    );
    if (
      membership.rows[0] &&
      membership.rows[0].owner_hash !== digest(ownerIdentity)
    )
      throw new ActionError(
        "forbidden",
        "This workspace belongs to a different owner session.",
        403,
      );
    await client.query(
      "INSERT INTO assembly_owner_workspaces(owner_hash,workspace_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [digest(ownerIdentity), row.id],
    );
    const token = digest(`${ownerIdentity}:${row.id}:operator`);
    await client.query(
      "UPDATE assembly_workspaces SET token_hash=$2 WHERE id=$1",
      [row.id, digest(token)],
    );
    return { token, workspace: row.document.workspace };
  });
}
export async function listOwnedWorkspaces(ownerIdentity: string) {
  if (!validToken(ownerIdentity))
    throw new ActionError("forbidden", "Open an operator session first.", 401);
  const q = await pool.query<{ document: StoredWorkspace; updated_at: Date }>(
    "SELECT w.document,w.updated_at FROM assembly_workspaces w JOIN assembly_owner_workspaces o ON o.workspace_id=w.id WHERE o.owner_hash=$1 AND w.expires_at>now() ORDER BY w.updated_at DESC",
    [digest(ownerIdentity)],
  );
  return q.rows.map((row) => {
    const w = row.document.workspace;
    return {
      id: w.id,
      title: w.event.title,
      mode: w.mode,
      lifecycle: w.event.lifecycle,
      updatedAt: new Date(row.updated_at).toISOString(),
      expiresAt: w.expiresAt,
    };
  });
}
export async function selectOwnedWorkspace(
  ownerIdentity: string,
  workspaceId: string,
) {
  if (!validToken(ownerIdentity) || !/^[-a-f0-9]{36}$/.test(workspaceId))
    throw new ActionError("forbidden", "Open an operator session first.", 401);
  return transaction(async (client) => {
    const q = await client.query<{ document: StoredWorkspace }>(
        "SELECT w.document FROM assembly_workspaces w JOIN assembly_owner_workspaces o ON o.workspace_id=w.id WHERE o.owner_hash=$1 AND w.id=$2 AND w.expires_at>now() FOR UPDATE OF w",
        [digest(ownerIdentity), workspaceId],
      ),
      row = q.rows[0];
    if (!row)
      throw new ActionError(
        "forbidden",
        "This event is not in your owner session.",
        403,
      );
    const token = digest(`${ownerIdentity}:${workspaceId}:operator`);
    await client.query(
      "UPDATE assembly_workspaces SET token_hash=$2 WHERE id=$1",
      [workspaceId, digest(token)],
    );
    return { token, workspace: row.document.workspace };
  });
}
