import { ActionError, resetWorkspace } from "@assembly/domain";
import { body, json, reject, token } from "../../shared";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const input = await body(request);
    if (
      Object.keys(input).some(
        (k) =>
          !["workspaceId", "expectedVersion", "idempotencyKey"].includes(k),
      ) ||
      typeof input.workspaceId !== "string" ||
      !Number.isSafeInteger(input.expectedVersion) ||
      typeof input.idempotencyKey !== "string"
    )
      throw new ActionError(
        "validation",
        "A current version and request key are required.",
        400,
      );
    return json(
      await resetWorkspace(
        await token(),
        input.expectedVersion as number,
        input.idempotencyKey,
        input.workspaceId as string,
      ),
    );
  } catch (error) {
    return reject(error);
  }
}
