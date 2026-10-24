import { createSession, readWorkspace } from "@assembly/domain";
import { cookieName, json, reject, token } from "../shared";
export const runtime = "nodejs";
export async function GET() {
  try {
    const current = await readWorkspace(await token());
    if (current) return json(current);
    const session = await createSession(),
      response = json(session.workspace);
    response.cookies.set(cookieName, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ORIGIN?.startsWith("https://") ?? false,
      path: "/",
      maxAge: 86400,
    });
    return response;
  } catch (error) {
    return reject(error);
  }
}
