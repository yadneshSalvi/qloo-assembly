import { healthStatus } from "@assembly/domain";
import { json, reject } from "../shared";
export const runtime = "nodejs";
export async function GET() {
  try {
    const status = await healthStatus();
    return json({
      status: "ready",
      ...status,
      researchReady: status.worker === "ready",
    });
  } catch (error) {
    return reject(error);
  }
}
