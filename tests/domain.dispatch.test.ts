import { describe, expect, it } from "vitest";
import {
  dispatchConfiguration,
  researchTaskPayload,
} from "../apps/web/lib/dispatch";
describe("Cloud Tasks worker dispatch authority", () => {
  const env = {
    WORKER_URL: "https://assembly-worker-123.us-central1.run.app",
    WORKER_AUTH_MODE: "cloud-run",
    GOOGLE_CLOUD_PROJECT: "qloo-project",
    ASSEMBLY_TASKS_LOCATION: "us-central1",
    ASSEMBLY_TASKS_QUEUE: "assembly-research",
    ASSEMBLY_TASKS_INVOKER_SERVICE_ACCOUNT:
      "assembly-tasks@qloo-project.iam.gserviceaccount.com",
  };
  it("builds a deterministic narrowly scoped OIDC task", () => {
    const config = dispatchConfiguration(env)!;
    if (config.mode !== "cloud-run") throw new Error("Expected cloud dispatch");
    const a = researchTaskPayload(config, "test-job"),
      b = researchTaskPayload(config, "test-job");
    expect(a).toEqual(b);
    expect(a.task.httpRequest.url).toBe(`${config.workerOrigin}/dispatch`);
    expect(a.task.httpRequest.oidcToken.audience).toBe(config.workerOrigin);
    expect(
      JSON.parse(Buffer.from(a.task.httpRequest.body, "base64").toString()),
    ).toEqual({ jobId: "test-job" });
    expect(JSON.stringify(a)).not.toContain("Authorization");
  });
  it("rejects credentials, paths, or incomplete production configuration", () => {
    expect(() =>
      dispatchConfiguration({
        ...env,
        WORKER_URL: "https://user:password@worker.example",
      }),
    ).toThrow("origin");
    expect(() =>
      dispatchConfiguration({
        ...env,
        ASSEMBLY_TASKS_INVOKER_SERVICE_ACCOUNT: undefined,
      }),
    ).toThrow("incomplete");
    expect(() =>
      dispatchConfiguration({ ...env, WORKER_URL: "http://worker.example" }),
    ).toThrow("incomplete");
    expect(dispatchConfiguration({})).toBeNull();
  });
});
