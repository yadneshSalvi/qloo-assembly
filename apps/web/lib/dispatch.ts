import { createHash } from "node:crypto";
const metadataUrl =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";
let accessToken: { value: string; expiresAt: number } | null = null;
export function dispatchConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  if (!env.WORKER_URL) return null;
  const url = new URL(env.WORKER_URL);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Worker URL must contain only an origin.");
  if (env.WORKER_AUTH_MODE !== "cloud-run") {
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !env.WORKER_DISPATCH_TOKEN ||
      env.WORKER_DISPATCH_TOKEN.length < 32
    )
      throw new Error("Local worker dispatch is not configured.");
    return {
      mode: "local" as const,
      workerOrigin: url.origin,
      secret: env.WORKER_DISPATCH_TOKEN,
    };
  }
  const project = env.GOOGLE_CLOUD_PROJECT,
    location = env.ASSEMBLY_TASKS_LOCATION ?? "us-central1",
    queue = env.ASSEMBLY_TASKS_QUEUE ?? "assembly-research",
    invoker = env.ASSEMBLY_TASKS_INVOKER_SERVICE_ACCOUNT;
  if (
    url.protocol !== "https:" ||
    !project ||
    !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(project) ||
    !/^[a-z0-9-]{1,60}$/.test(location) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(queue) ||
    !invoker ||
    !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(invoker)
  )
    throw new Error("Cloud Tasks dispatch configuration is incomplete.");
  return {
    mode: "cloud-run" as const,
    workerOrigin: url.origin,
    parent: `projects/${project}/locations/${location}/queues/${queue}`,
    invoker,
  };
}
export function researchTaskPayload(
  config: Extract<
    NonNullable<ReturnType<typeof dispatchConfiguration>>,
    { mode: "cloud-run" }
  >,
  jobId: string,
) {
  return {
    task: {
      name: `${config.parent}/tasks/${createHash("sha256").update(jobId).digest("hex")}`,
      dispatchDeadline: "180s",
      httpRequest: {
        url: `${config.workerOrigin}/dispatch`,
        httpMethod: "POST",
        headers: { "Content-Type": "application/json" },
        body: Buffer.from(JSON.stringify({ jobId })).toString("base64"),
        oidcToken: {
          serviceAccountEmail: config.invoker,
          audience: config.workerOrigin,
        },
      },
    },
  };
}
/** Invoke only after the database action commits. A scheduled recovery dispatch handles delayed notifications. */
export async function dispatchResearch(
  jobId: string,
  fetcher: typeof fetch = fetch,
) {
  try {
    const config = dispatchConfiguration();
    if (!config) return;
    if (config.mode === "local") {
      const r = await fetcher(`${config.workerOrigin}/dispatch`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.secret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobId }),
        redirect: "error",
        signal: AbortSignal.timeout(1500),
        cache: "no-store",
      });
      await r.body?.cancel();
      return;
    }
    if (!accessToken || accessToken.expiresAt < Date.now() + 60000) {
      const r = await fetcher(metadataUrl, {
        headers: { "Metadata-Flavor": "Google" },
        redirect: "error",
        signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) throw new Error("Metadata authentication unavailable.");
      const value = (await r.json()) as Record<string, unknown>;
      if (
        typeof value.access_token !== "string" ||
        typeof value.expires_in !== "number" ||
        value.expires_in <= 0
      )
        throw new Error("Invalid metadata credentials.");
      accessToken = {
        value: value.access_token,
        expiresAt: Date.now() + value.expires_in * 1000,
      };
    }
    const r = await fetcher(
      `https://cloudtasks.googleapis.com/v2/${config.parent}/tasks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken.value}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(researchTaskPayload(config, jobId)),
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!r.ok && r.status !== 409)
      throw new Error("Cloud Tasks notification delayed.");
    await r.body?.cancel();
  } catch {
    // No cloud token, capability URL, provider response, or task payload is logged.
    // Accepted jobs remain durable and visible to the configured recovery scheduler.
  }
}
