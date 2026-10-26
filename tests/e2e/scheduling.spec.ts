import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  ActionError,
  applyAction,
  publicEvent,
  supplierCurrent,
  supplierView,
} from "@assembly/domain";
import type { ActionRequest, ActionType, Workspace } from "@assembly/contracts";
import { presentationFixture } from "../fixtures/concept-presentation";
import { recordRemainingResponsibilities } from "./helpers";

function act(
  workspace: Workspace,
  type: ActionType,
  payload: Record<string, unknown>,
) {
  return applyAction(
    { workspace, contactDigests: {} },
    {
      workspaceId: workspace.id,
      expectedVersion: workspace.version,
      idempotencyKey: randomUUID(),
      type,
      payload,
    },
  );
}
async function mockOwner(page: Page, workspace: Workspace) {
  await page.route("**/api/workspace", (route) =>
    route.fulfill({ json: workspace }),
  );
  await page.route("**/api/actions", (route) => {
    try {
      const result = applyAction(
        { workspace, contactDigests: {} },
        route.request().postDataJSON() as ActionRequest,
      );
      return route.fulfill({ json: result });
    } catch (error) {
      if (!(error instanceof ActionError)) throw error;
      return route.fulfill({
        status: error.status,
        json: {
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        },
      });
    }
  });
}
function timedFixture() {
  const w = presentationFixture();
  Object.assign(w.suppliers[0], {
    programStart: "19:00",
    durationMinutes: 50,
    setupStart: "17:30",
    setupMinutes: 60,
    canOverlap: false,
  });
  Object.assign(w.suppliers[1], {
    programStart: "20:00",
    durationMinutes: 45,
    setupStart: "17:30",
    setupMinutes: 45,
    canOverlap: false,
  });
  w.concepts[0].supplierIds = [w.suppliers[0].id, w.suppliers[1].id];
  w.concepts[0].composition!.inventoryIds = [...w.concepts[0].supplierIds];
  act(w, "SELECT_CONCEPT", { conceptId: w.concepts[0].id });
  return w;
}

test("editing typed offer times preserves selected cultural identities", async ({
  page,
}) => {
  const w = presentationFixture();
  const offer = w.suppliers[0];
  w.research = {
    anchors: [
      {
        id: "synthetic-anchor",
        entityId: "11111111-1111-4111-8111-111111111111",
        entityType: "artist",
        name: "Synthetic Cultural Reference",
        disambiguation: "Test fixture",
        confirmedAt: "2026-10-27T00:00:00.000Z",
        source: "CATALOG_SELECTION",
      },
    ],
    influences: [
      {
        supplierId: offer.id,
        entityId: "11111111-1111-4111-8111-111111111111",
        entityType: "artist",
        name: "Synthetic Cultural Reference",
        confirmedAt: "2026-10-27T00:00:00.000Z",
      },
    ],
    search: null,
    targetTypes: ["artist", "movie", "book"],
    trace: [],
    budget: { qlooUsed: 0, qlooLimit: 6, modelUsed: 0, modelLimit: 4 },
  };
  const identities = structuredClone({
    anchors: w.research.anchors,
    influences: w.research.influences,
  });
  await mockOwner(page, w);
  await page.goto("/studio/suppliers");
  const card = page.locator(".inventory-card").filter({
    has: page.getByRole("heading", { name: offer.name, exact: true }),
  });
  await card.getByRole("button", { name: "Edit offer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Program starts", { exact: true }).fill("19:00");
  await dialog.getByLabel("Setup starts", { exact: true }).fill("17:30");
  await dialog
    .getByRole("checkbox", { name: /This offer may run alongside/ })
    .check();
  const accessibility = await new AxeBuilder({ page })
    .include("[role=dialog]")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    accessibility.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? ""),
    ),
  ).toEqual([]);
  await dialog
    .getByRole("button", { name: "Save this offer", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(card).toContainText("19:00–19:50");
  await expect(card).toContainText("may run alongside other items");
  expect(w.suppliers.find((s) => s.id === offer.id)).toMatchObject({
    programStart: "19:00",
    setupStart: "17:30",
    canOverlap: true,
  });
  expect({
    anchors: w.research.anchors,
    influences: w.research.influences,
  }).toEqual(identities);
});

test("the exact operator, guest and supplier views agree on entered slots", async ({
  page,
}) => {
  const w = timedFixture();
  await mockOwner(page, w);
  await page.route(`**/api/public/events/${w.event.slug}`, (route) =>
    route.fulfill({ json: publicEvent(w) }),
  );
  await page.route("**/api/suppliers/synthetic-timing-link", (route) =>
    route.fulfill({ json: supplierView(w, w.suppliers[0].id) }),
  );
  await page.goto("/studio/events/current/demand");
  await page
    .getByRole("button", { name: "Review & publish proposal", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".terms-program-slots")).toContainText(
    "19:00–19:50",
  );
  await expect(dialog.locator(".terms-program-slots")).toContainText(
    "20:00–20:45",
  );
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Approve & publish proposal", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await page.goto(`/events/${w.event.slug}`);
  await expect(
    page.locator(".public-terms .terms-program-slots"),
  ).toContainText("19:00–19:50");
  await expect(page.locator(".public-run-of-show")).toContainText("20:00");
  await page.goto("/collaborate/synthetic-timing-link");
  await expect(
    page.getByText("Your program slot", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("dl").first()).toContainText("19:00–19:50");
  await expect(page.locator("dl").first()).toContainText("17:30–18:30");
  await expect(page.getByRole("checkbox")).toHaveAccessibleName(
    /program and setup times/,
  );
});

test("later doors are a visible program and setup proposal until exact approval", async ({
  page,
}) => {
  const w = timedFixture();
  for (const supplierId of w.concepts[0].supplierIds)
    act(w, "CONFIRM_SUPPLIER", { supplierId });
  act(w, "PUBLISH", { termsHash: w.terms.hash });
  const originalHash = w.terms.hash;
  await mockOwner(page, w);
  await page.goto("/studio/events/current/changes/current");
  await page
    .getByLabel("Why the change is needed", { exact: true })
    .fill(
      "Synthetic venue opening changes by thirty minutes; review supplier times.",
    );
  await page.getByLabel("Doors", { exact: true }).fill("19:00");
  await page.getByLabel("Finish", { exact: true }).fill("22:30");
  await expect(
    page.getByText(/Changing doors proposes the same shift/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save change for review", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "The exact differences.", exact: true }),
  ).toBeVisible();
  expect(w.terms.hash).toBe(originalHash);
  expect(w.suppliers[0].programStart).toBe("19:00");
  expect(w.suppliers[0].setupStart).toBe("17:30");
  await expect(
    page.locator(".diff-row").filter({ hasText: "Program times" }),
  ).toContainText("19:30–20:20");
  await expect(
    page.locator(".diff-row").filter({ hasText: "Setup times" }),
  ).toContainText("18:00–19:00");
  // Reopening a derived schedule must not submit internal schedule fields as editable prose.
  await page
    .getByRole("button", { name: "Revise this proposal", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save change for review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review & approve change", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.locator(".approval-diff").filter({ hasText: "Program times" }),
  ).toContainText("19:30–20:20");
  await expect(
    dialog.locator(".approval-diff").filter({ hasText: "Setup times" }),
  ).toContainText("18:00–19:00");
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Approve this exact change", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect(w.terms.hash).not.toBe(originalHash);
  expect(w.suppliers[0]).toMatchObject({
    programStart: "19:30",
    setupStart: "18:00",
    status: "QUOTED",
  });
  expect(w.terms.programSchedule?.[0].start).toBe("19:30");
});

test("recovery waits for renewed responsibilities after a generated program change", async ({
  page,
}) => {
  const w = timedFixture();
  act(w, "PUBLISH", { termsHash: w.terms.hash });
  for (const supplierId of w.concepts[0].supplierIds)
    act(w, "CONFIRM_SUPPLIER", { supplierId });
  for (const requirement of w.requirements)
    act(w, "CONFIRM_REQUIREMENT", {
      requirementId: requirement.id,
      proof:
        "Synthetic operator reviewed the original production responsibility.",
    });
  act(w, "GREENLIGHT", { termsHash: w.terms.hash });
  act(w, "OPEN_BOOKING", {});
  act(w, "PROPOSE_CHANGE", {
    reason:
      "Synthetic program introduction changed; review the revised responsibilities.",
    terms: {
      program: `${w.terms.program} A revised host introduction follows.`,
    },
  });
  act(w, "APPROVE_CHANGE", { termsHash: w.terms.hash, changeId: w.change!.id });
  expect(w.requirements.filter((r) => !r.confirmed)).toHaveLength(3);
  expect(w.concepts[0].supplierIds.every((id) => supplierCurrent(w, id))).toBe(
    true,
  );
  await mockOwner(page, w);
  await page.goto("/studio/events/current/changes/current");
  await expect(
    page.getByRole("button", { name: "Resume this production", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Before resuming, review 3 responsibility checks.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Review production checks", exact: true })
    .click();
  await recordRemainingResponsibilities(
    page,
    "Synthetic operator reviewed the revised program and renewed this responsibility.",
  );
  expect(w.requirements.every((r) => r.confirmed)).toBe(true);
  await page.goto("/studio/events/current/changes/current");
  const resume = page.getByRole("button", {
    name: "Resume this production",
    exact: true,
  });
  await expect(resume).toBeEnabled();
  await resume.click();
  await expect(
    page.getByRole("link", { name: "Continue production", exact: true }),
  ).toBeVisible();
  expect(w.event.bookingPaused).toBe(false);
});

test("live composition waits for two workable offers and leaves unused incomplete alternatives available", async ({
  page,
}) => {
  const w = presentationFixture();
  w.research = {
    anchors: [
      {
        id: "synthetic-anchor",
        entityId: "11111111-1111-4111-8111-111111111111",
        entityType: "artist",
        name: "Synthetic Cultural Reference",
        disambiguation: "Test fixture",
        confirmedAt: "2026-10-27T00:00:00.000Z",
        source: "CATALOG_SELECTION",
      },
    ],
    influences: [],
    search: null,
    targetTypes: ["artist", "movie", "book"],
    trace: [],
    budget: { qlooUsed: 0, qlooLimit: 6, modelUsed: 0, modelLimit: 4 },
  };
  await mockOwner(page, w);
  await page.goto("/studio/events/current/brief");
  const compose = page.getByRole("button", {
    name: "Compose with live evidence",
    exact: true,
  });
  await expect(compose).toBeDisabled();
  await expect(
    page.getByText("Complete two workable offers before composing.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page
      .locator(".schedule-review")
      .getByRole("link", { name: "Synthetic Sound Collective", exact: true }),
  ).toHaveAttribute("href", /\/studio\/suppliers#offer-/);
  Object.assign(w.suppliers[0], {
    programStart: "19:00",
    setupStart: "17:30",
    canOverlap: false,
  });
  await page.reload();
  await expect(compose).toBeDisabled();
  await expect(page.locator(".schedule-review")).toContainText(
    "1 of 2 offers are ready",
  );
  Object.assign(w.suppliers[1], {
    programStart: "20:00",
    setupStart: "17:30",
    canOverlap: false,
  });
  await page.reload();
  await expect(compose).toBeEnabled();
  await expect(page.locator(".schedule-review")).toContainText(
    "2 workable offers are ready to consider",
  );
  await expect(page.locator(".schedule-review")).toContainText(
    "alternatives still need review",
  );
  expect(w.run).toBeNull();
});
