import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  ActionError,
  adoptOwnerWorkspace,
  createSession,
  readWorkspace,
  selectOwnedWorkspace,
  rateLimit,
} from "@assembly/domain";
import { body, cookieName, json, reject, token } from "../shared";
export const runtime = "nodejs";
const ownerCookie = "assembly_owner";
function ownerIdentity() {
  return randomBytes(32).toString("hex");
}
function setSession(
  response: ReturnType<typeof json>,
  session: { token: string; workspace: { mode: string } },
  owner: string,
) {
  const options = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
    path: "/",
    maxAge: 90 * 86400,
  };
  response.cookies.set(cookieName, session.token, options);
  response.cookies.set(ownerCookie, owner, options);
  return response;
}
export async function GET(request: Request) {
  try {
    const jar = await cookies(),
      existingOwner = jar.get(ownerCookie)?.value,
      owner =
        existingOwner && /^[a-f0-9]{64}$/.test(existingOwner)
          ? existingOwner
          : ownerIdentity();
    const current = await readWorkspace(await token());
    if (current) {
      const adopted = await adoptOwnerWorkspace(owner, await token());
      if (adopted) return setSession(json(adopted.workspace), adopted, owner);
    }
    await rateLimit(
      "sessions",
      request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
        "local",
      20,
      3600,
    );
    await rateLimit("sessions-global", "all", 500, 3600);
    const session = await createSession("SAMPLE", owner);
    return setSession(json(session.workspace), session, owner);
  } catch (error) {
    return reject(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = await body(request),
      jar = await cookies(),
      savedOwner = jar.get(ownerCookie)?.value,
      owner =
        savedOwner && /^[a-f0-9]{64}$/.test(savedOwner)
          ? savedOwner
          : ownerIdentity();
    if (
      Object.keys(input).some((k) => !["mode", "workspaceId"].includes(k)) ||
      ("mode" in input && "workspaceId" in input)
    )
      throw new ActionError(
        "validation",
        "Choose a new mode or an existing workspace.",
        400,
      );
    if (typeof input.workspaceId === "string") {
      if (!savedOwner)
        throw new ActionError(
          "forbidden",
          "Open an operator session first.",
          401,
        );
      const session = await selectOwnedWorkspace(owner, input.workspaceId);
      return setSession(json(session.workspace), session, owner);
    }
    if (input.mode !== "REAL" && input.mode !== "SAMPLE")
      throw new ActionError(
        "validation",
        "Choose sample or real operations.",
        400,
      );
    await rateLimit("create-workspaces", owner, 10, 3600);
    await rateLimit(
      "sessions",
      request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
        "local",
      20,
      3600,
    );
    await rateLimit("sessions-global", "all", 500, 3600);
    if (!savedOwner) await adoptOwnerWorkspace(owner, await token());
    const session = await createSession(input.mode, owner);
    return setSession(json(session.workspace), session, owner);
  } catch (error) {
    return reject(error);
  }
}
