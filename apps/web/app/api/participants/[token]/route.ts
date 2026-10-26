import type { PublicActionRequest } from "@assembly/contracts";
import {
  readParticipant,
  performParticipantAction,
  rateLimit,
} from "@assembly/domain";
import { body, json, reject } from "../../shared";
export const runtime = "nodejs";
type Context = { params: Promise<{ token: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params;
    await rateLimit("response-read", token, 120);
    return json(await readParticipant(token));
  } catch (error) {
    return reject(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { token } = await context.params,
      input = await body(request);
    return json(
      await performParticipantAction(
        token,
        input as unknown as PublicActionRequest,
      ),
    );
  } catch (error) {
    return reject(error);
  }
}
