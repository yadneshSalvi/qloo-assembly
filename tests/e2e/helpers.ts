import { expect, type APIRequestContext, type Page } from "@playwright/test";
import type { ActionType, Workspace } from "@assembly/contracts";

const origin = "http://127.0.0.1:3102";
export async function readWorkspace(request: APIRequestContext) {
  const response = await request.get("/api/workspace");
  expect(response.ok()).toBeTruthy();
  return response.json() as Promise<Workspace>;
}
export async function ownerAction(
  request: APIRequestContext,
  type: ActionType,
  payload: Record<string, unknown> = {},
) {
  const w = await readWorkspace(request);
  const response = await request.post("/api/actions", {
    headers: { Origin: origin },
    data: {
      type,
      workspaceId: w.id,
      expectedVersion: w.version,
      idempotencyKey: crypto.randomUUID(),
      payload,
    },
  });
  const result = await response.json();
  expect(response.ok(), result.error?.message).toBeTruthy();
  return readWorkspace(request);
}
/** Explicit authored rehearsal setup. This helper never invokes live providers. */
export async function publishedSample(request: APIRequestContext) {
  await ownerAction(request, "RESEARCH", { mode: "SAMPLE" });
  await expect
    .poll(async () => (await readWorkspace(request)).run?.status, {
      timeout: 30000,
    })
    .toBe("COMPLETED");
  let w = await readWorkspace(request);
  w = await ownerAction(request, "SELECT_CONCEPT", {
    conceptId: w.concepts[0].id,
  });
  return ownerAction(request, "PUBLISH", { termsHash: w.terms.hash });
}
export async function acceptApproval(page: Page, buttonName: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: buttonName, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
export async function recordRemainingResponsibilities(
  page: Page,
  proof: string,
) {
  await expect(page.locator(".requirement-row").first()).toBeVisible();
  const pending = page.locator(".requirement-row:not(.done)");
  const count = await pending.count();
  for (let i = 0; i < count; i++) {
    const requirement = pending.first();
    await requirement
      .getByRole("button", { name: "Record check", exact: true })
      .click();
    await requirement
      .getByLabel("What did you check?", { exact: true })
      .fill(proof);
    await requirement
      .getByRole("button", { name: "Save responsibility check", exact: true })
      .click();
    await expect(pending).toHaveCount(count - i - 1);
  }
  await expect(pending).toHaveCount(0);
}
export async function completeRemainingTasks(page: Page) {
  const rows = page.locator(".task-row");
  await expect(rows.first()).toBeVisible();
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    const button = row.getByRole("button", { name: "Complete", exact: true });
    if (await button.count()) {
      await button.click();
      await row
        .getByLabel("Completion evidence")
        .fill(
          "Rehearsal operator checked the procedure and recorded completion.",
        );
      await row
        .getByRole("button", { name: "Record completed task", exact: true })
        .click();
      await expect(row).toHaveClass(/done/);
    }
  }
}
