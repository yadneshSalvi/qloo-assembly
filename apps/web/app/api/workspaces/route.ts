import { cookies } from "next/headers";
import { listOwnedWorkspaces, readWorkspace } from "@assembly/domain";
import { json, reject, token } from "../shared";
export const runtime = "nodejs";
export async function GET() {
  try {
    return json({
      workspaces: await listOwnedWorkspaces(
        (await cookies()).get("assembly_owner")?.value ?? "",
      ),
      currentWorkspaceId: (await readWorkspace(await token()))?.id ?? null,
    });
  } catch (error) {
    return reject(error);
  }
}
