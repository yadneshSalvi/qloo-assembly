import { ActionError, mintSupplierLink } from "@assembly/domain";
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
            "supplierId",
            "expectedVersion",
            "idempotencyKey",
          ].includes(k),
      ) ||
      typeof input.workspaceId !== "string" ||
      typeof input.supplierId !== "string" ||
      typeof input.idempotencyKey !== "string" ||
      !Number.isSafeInteger(input.expectedVersion)
    )
      throw new ActionError(
        "validation",
        "Choose a supplier and the current version.",
        400,
      );
    return json(
      await mintSupplierLink(
        await token(),
        input.supplierId,
        input.expectedVersion as number,
        input.idempotencyKey,
        input.workspaceId,
      ),
    );
  } catch (error) {
    return reject(error);
  }
}
