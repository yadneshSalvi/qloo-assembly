import { dispatchResearch } from "../../../lib/dispatch";
import type { ActionRequest } from "@assembly/contracts";
import { ActionError, performAction } from "@assembly/domain";
import { body, json, reject, token } from "../shared";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await body(request);
    if (
      Object.keys(input).some(
        (k) =>
          ![
            "workspaceId",
            "type",
            "payload",
            "expectedVersion",
            "idempotencyKey",
          ].includes(k),
      ) ||
      typeof input.type !== "string" ||
      typeof input.workspaceId !== "string"
    )
      throw new ActionError("validation", "Unknown request fields.", 400);
    const result = await performAction(
      await token(),
      input as unknown as ActionRequest,
    );
    if (
      ["RESEARCH", "SEARCH_CATALOG"].includes(String(input.type)) &&
      result.workspace.run?.status === "QUEUED"
    )
      await dispatchResearch(result.workspace.run.id);
    return json(result);
  } catch (error) {
    return reject(error);
  }
}
