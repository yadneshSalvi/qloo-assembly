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
          !["type", "payload", "expectedVersion", "idempotencyKey"].includes(k),
      ) ||
      typeof input.type !== "string"
    )
      throw new ActionError("validation", "Unknown request fields.", 400);
    return json(
      await performAction(await token(), input as unknown as ActionRequest),
    );
  } catch (error) {
    return reject(error);
  }
}
