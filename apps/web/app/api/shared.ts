import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ActionError } from "@assembly/domain";
export const cookieName = "assembly_demo";
export async function token() {
  return (await cookies()).get(cookieName)?.value ?? "";
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
export function reject(error: unknown) {
  if (error instanceof ActionError)
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      error.status,
    );
  console.error(
    "ASSEMBLY request failed",
    error instanceof Error ? error.name : "Unknown error",
  );
  return json(
    {
      error: {
        code: "dependency",
        message:
          "The saved workspace is temporarily unavailable. Please retry.",
      },
    },
    503,
  );
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = new Set(
    [new URL(request.url).origin, process.env.APP_ORIGIN].filter(Boolean),
  );
  if (
    !origin ||
    !allowed.has(origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new ActionError(
      "forbidden",
      "This request must come from the application.",
      403,
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ActionError("validation", "Use a JSON request.", 415);
  const text = await request.text();
  if (text.length > 32768)
    throw new ActionError("validation", "This request is too large.", 413);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ActionError("validation", "Invalid JSON.", 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new ActionError(
      "validation",
      "A structured request is required.",
      400,
    );
  return data as Record<string, unknown>;
}
