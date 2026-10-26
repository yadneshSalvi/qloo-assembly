import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { PublicActionRequest } from "@assembly/contracts";
import {
  readPublicEvent,
  expressPublicInterest,
  rateLimit,
} from "@assembly/domain";
import { body, json, reject } from "../../../shared";
export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };
async function identity(slug: string) {
  const name = `assembly_guest_${slug.slice(0, 40)}`,
    value = (await cookies()).get(name)?.value;
  return {
    name,
    value:
      value && /^[a-f0-9]{64}$/.test(value)
        ? value
        : randomBytes(32).toString("hex"),
  };
}
function browserCookie(
  response: ReturnType<typeof json>,
  guest: { name: string; value: string },
) {
  response.cookies.set(guest.name, guest.value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 90 * 86400,
  });
  return response;
}
export async function GET(request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    await rateLimit(
      "public-read",
      request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
        "local",
      240,
    );
    const guest = await identity(slug);
    return browserCookie(json(await readPublicEvent(slug)), guest);
  } catch (error) {
    return reject(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { slug } = await context.params,
      guest = await identity(slug),
      input = await body(request);
    return browserCookie(
      json(
        await expressPublicInterest(
          slug,
          guest.value,
          input as unknown as PublicActionRequest,
        ),
      ),
      guest,
    );
  } catch (error) {
    return reject(error);
  }
}
