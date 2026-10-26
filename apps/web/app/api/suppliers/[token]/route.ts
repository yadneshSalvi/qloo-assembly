import type { SupplierActionRequest } from "@assembly/contracts";
import {
  readSupplier,
  performSupplierAction,
  rateLimit,
} from "@assembly/domain";
import { body, json, reject } from "../../shared";
export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params;
    await rateLimit("supplier-read", token, 120);
    return json(await readSupplier(token));
  } catch (error) {
    return reject(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { token } = await context.params,
      input = await body(request);
    return json(
      await performSupplierAction(
        token,
        input as unknown as SupplierActionRequest,
      ),
    );
  } catch (error) {
    return reject(error);
  }
}
