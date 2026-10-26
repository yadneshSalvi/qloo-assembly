import { test, expect, type Page } from "@playwright/test";
import {
  acceptApproval,
  completeRemainingTasks,
  publishedSample,
  readWorkspace,
  recordRemainingResponsibilities,
} from "./helpers";

async function confirmAssignment(page: Page) {
  await page
    .getByLabel("Scope notes or confirmation evidence")
    .fill("Rehearsal supplier reviewed the exact date, fee and scope.");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Confirm availability & scope", exact: true })
    .click();
  await expect(
    page.getByText("Your response is recorded against these exact terms.", {
      exact: true,
    }),
  ).toBeVisible();
}

test("three independent sessions complete a rehearsal, recover lost supply and renew guest consent", async ({
  page: owner,
  browser,
}) => {
  test.setTimeout(210000);
  const errors: string[] = [];
  const guestContext = await browser.newContext();
  const supplierContext = await browser.newContext();
  const guest = await guestContext.newPage();
  const supplier = await supplierContext.newPage();
  for (const p of [owner, guest, supplier])
    p.on("pageerror", (e) => errors.push(e.message));

  await owner.goto("/demo");
  await owner
    .getByRole("button", { name: "Open my sample production", exact: true })
    .click();
  await expect(
    owner.getByRole("heading", { name: "Make room for something good." }),
  ).toBeVisible();
  await owner.screenshot({
    path: ".artifacts/browser/studio-overview-1440.png",
    fullPage: true,
  });
  await owner
    .getByRole("link", { name: "Shape the brief", exact: true })
    .click();
  await owner.getByRole("radio", { name: /Authored rehearsal/ }).check();
  await owner
    .getByRole("button", { name: "Explore authored concepts", exact: true })
    .click();
  await expect(owner.locator(".concept-card")).toHaveCount(3);
  await owner.screenshot({
    path: ".artifacts/browser/concepts-1440.png",
    fullPage: true,
  });
  await owner
    .getByRole("button", { name: "Choose this direction", exact: true })
    .first()
    .click();
  await owner
    .getByRole("link", { name: "Let people in on the idea", exact: true })
    .click();
  await owner
    .getByRole("button", { name: "Review & publish proposal", exact: true })
    .click();
  await acceptApproval(owner, "Approve & publish proposal");
  const publicPath = await owner
    .getByRole("link", { name: "Open attendee experience", exact: true })
    .getAttribute("href");
  expect(publicPath).toMatch(/^\/events\//);

  await guest.goto(new URL(publicPath!, owner.url()).toString());
  await expect(guest.getByText(/fictional rehearsal/i).first()).toBeVisible();
  await expect(guest.getByLabel(/email/i)).toHaveCount(0);
  await guest.screenshot({
    path: ".artifacts/browser/public-event-1440.png",
    fullPage: true,
  });
  await guest.getByLabel("Your sample name").fill("Morgan Rehearsal");
  await guest.getByLabel("People in your party").selectOption("2");
  await guest.getByRole("checkbox").check();
  await guest
    .getByRole("button", { name: "Save my sample interest", exact: true })
    .click();
  await expect(guest).toHaveURL(/\/commitments\//);
  await guest.getByRole("checkbox").check();
  await guest
    .getByRole("button", { name: "Confirm my choice", exact: true })
    .click();
  await expect(
    guest.getByText("Confirmed conditional interest", { exact: true }),
  ).toBeVisible();
  expect(
    (await guestContext.cookies()).some((c) =>
      ["assembly_owner", "assembly_demo"].includes(c.name),
    ),
  ).toBe(false);
  const privateResponse = guest.url();

  await owner.goto("/studio/events/current/production");
  const music = owner
    .locator(".supplier-row")
    .filter({ hasText: "Nila & The Low Lights" });
  await music
    .getByRole("button", { name: "Open supplier invitation", exact: true })
    .click();
  const assignment = await music
    .getByRole("link", { name: "Open scoped assignment" })
    .getAttribute("href");
  await supplier.goto(new URL(assignment!, owner.url()).toString());
  await expect(supplier.getByText("Morgan Rehearsal")).toHaveCount(0);
  await expect(
    supplier.getByRole("heading", { name: "A good night takes good people." }),
  ).toBeVisible();
  await supplier.screenshot({
    path: ".artifacts/browser/supplier-assignment-1440.png",
    fullPage: true,
  });
  await confirmAssignment(supplier);
  expect(
    (await supplierContext.cookies()).some((c) =>
      ["assembly_owner", "assembly_demo"].includes(c.name),
    ),
  ).toBe(false);
  await owner.reload();
  const food = owner
    .locator(".supplier-row")
    .filter({ hasText: "Little Table" });
  await food
    .getByRole("button", { name: "Record my confirmation", exact: true })
    .click();
  await food
    .getByLabel("What did you confirm, and with whom?")
    .fill(
      "Rehearsal operator reviewed the fictional quote and current service scope.",
    );
  await food
    .getByRole("button", { name: "Save operator attestation", exact: true })
    .click();
  await expect(
    food.getByRole("button", { name: "Renew my confirmation", exact: true }),
  ).toBeVisible();

  await expect(owner.locator(".requirement-row:not(.done)")).toHaveCount(3);
  await recordRemainingResponsibilities(
    owner,
    "Rehearsal owner reviewed this responsibility and its stated procedure.",
  );
  await owner
    .getByRole("button", { name: "Review greenlight", exact: true })
    .click();
  await acceptApproval(owner, "Greenlight this version");
  await owner
    .getByRole("button", { name: "Open sample bookings", exact: true })
    .click();
  await expect(
    owner.getByRole("button", {
      name: "Mark the production ready",
      exact: true,
    }),
  ).toBeDisabled();
  await guest.reload();
  await guest
    .getByRole("button", { name: "Book 2 sample places", exact: true })
    .click();
  await expect(
    guest.getByText("Sample places allocated", { exact: true }),
  ).toBeVisible();
  await owner.reload();
  await completeRemainingTasks(owner);

  // A supplier's independent withdrawal must pause booking before the owner acts.
  await supplier.reload();
  await supplier
    .getByRole("button", { name: "I’m unavailable", exact: true })
    .click();
  await supplier
    .getByLabel("Reason you are unavailable")
    .fill(
      "Rehearsal schedule conflict makes this exact assignment unavailable.",
    );
  await supplier.getByRole("checkbox").check();
  await supplier
    .getByRole("button", { name: "Record that I’m unavailable", exact: true })
    .click();
  await expect(supplier.getByText(/You are marked unavailable/)).toBeVisible();
  await guest.reload();
  await expect(guest.getByText(/paused/i).first()).toBeVisible();
  await owner.goto("/studio/events/current/changes/current");
  await owner.getByLabel("What changed?").selectOption("SUPPLIER");
  await owner
    .getByLabel("Why the change is needed")
    .fill(
      "The invited supplier reported a schedule conflict through their scoped link.",
    );
  await owner.getByLabel("Unavailable supplier").selectOption("low-lights");
  await owner.getByLabel("Proposed replacement").selectOption("sunday-people");
  await owner
    .getByRole("button", { name: "Save change for review", exact: true })
    .click();
  await expect(
    owner.getByRole("button", { name: "Review & approve change", exact: true }),
  ).toBeDisabled();
  const replacement = owner.locator(".replacement-assignment");
  await replacement
    .getByRole("button", { name: "Open supplier invitation", exact: true })
    .click();
  const replacementPath = await replacement
    .getByRole("link", { name: "Open scoped assignment" })
    .getAttribute("href");
  await supplier.goto(new URL(replacementPath!, owner.url()).toString());
  await confirmAssignment(supplier);
  await owner.reload();
  await owner
    .getByRole("button", { name: "Review & approve change", exact: true })
    .click();
  await acceptApproval(owner, "Approve this exact change");
  await expect(
    owner.getByRole("button", { name: "Resume this production", exact: true }),
  ).toBeDisabled();
  await owner.screenshot({
    path: ".artifacts/browser/recovery-1440.png",
    fullPage: true,
  });
  const pending = await readWorkspace(owner.request);
  expect(pending.bookings[0].status).toBe("RECONFIRM_REQUIRED");
  await guest.goto(privateResponse);
  await expect(
    guest.getByText("New terms need your choice", { exact: true }),
  ).toBeVisible();
  await guest.getByRole("checkbox").check();
  await guest
    .getByRole("button", { name: "Accept the revised terms", exact: true })
    .click();
  await expect(
    guest.getByText("Sample places allocated", { exact: true }),
  ).toBeVisible();
  await owner.reload();
  await owner
    .getByRole("link", { name: "Review production checks", exact: true })
    .click();
  await recordRemainingResponsibilities(
    owner,
    "Rehearsal owner reviewed the revised assignment and renewed this production responsibility.",
  );
  expect(
    (await readWorkspace(owner.request)).requirements.every((r) => r.confirmed),
  ).toBe(true);
  await owner.goto("/studio/events/current/changes/current");
  await owner
    .getByRole("button", { name: "Resume this production", exact: true })
    .click();
  await owner
    .getByRole("link", { name: "Continue production", exact: true })
    .click();
  await completeRemainingTasks(owner);
  await owner
    .getByRole("button", { name: "Mark the production ready", exact: true })
    .click();
  await owner.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(owner.getByText("Checked in", { exact: true })).toBeVisible();
  await owner
    .getByRole("button", { name: "Open the doors", exact: true })
    .click();
  await owner
    .getByRole("button", { name: "Complete the rehearsal", exact: true })
    .click();
  await owner
    .getByRole("link", { name: "See the outcome", exact: true })
    .click();
  await expect(
    owner.getByText("Sample production completed", { exact: true }),
  ).toBeVisible();
  await guest.reload();
  await guest.getByLabel("Your experience").selectOption("4");
  await guest
    .getByLabel("What should the host know?")
    .fill("Rehearsal feedback: the revised promise was clear.");
  await guest
    .getByRole("button", { name: "Save my feedback", exact: true })
    .click();
  await expect(guest.getByText(/You recorded 4\/5/)).toBeVisible();
  await owner.reload();
  await expect(
    owner.getByText("Rehearsal feedback: the revised promise was clear.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(owner.locator(".result-metrics>div").nth(2)).toContainText("2");
  await expect(owner.locator(".result-metrics>div").nth(3)).toContainText("£0");
  await owner.screenshot({
    path: ".artifacts/browser/outcome-1440.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  await guestContext.close();
  await supplierContext.close();
});

for (const width of [390, 768, 1024, 1440]) {
  test(`public and studio views fit at ${width}px`, async ({ page }) => {
    const w = await publishedSample(page.request);
    await page.setViewportSize({ width, height: 950 });
    for (const route of [
      "/",
      "/demo",
      "/studio",
      "/studio/events/current/brief",
      "/studio/venue",
      "/studio/suppliers",
      `/events/${w.event.slug}`,
    ]) {
      await page.goto(route);
      await expect(page.locator("h1")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `Horizontal overflow on ${route}`).toBe(false);
    }
    await page.screenshot({
      path: `.artifacts/browser/public-event-${width}.png`,
      fullPage: true,
    });
    if (width === 390) {
      await page.goto("/studio");
      await page
        .getByRole("button", { name: "Open navigation", exact: true })
        .click();
      await expect(
        page.getByRole("navigation", {
          name: "Studio navigation",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "Venue & availability", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "A room with its own character." }),
      ).toBeVisible();
      await page.screenshot({
        path: ".artifacts/browser/venue-390.png",
        fullPage: true,
      });
    }
  });
}

test("evidence keyboard focus and stale owner version protection", async ({
  page,
  context,
}) => {
  await page.goto("/studio/events/current/brief");
  const trigger = page.getByRole("button", {
    name: "See the thinking",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  const before = await readWorkspace(page.request);
  const other = await context.newPage();
  await other.goto("/studio/events/current/brief");
  await other
    .getByLabel("The ambition")
    .fill("An intimate evening with a new saved cultural direction.");
  await other.getByRole("button", { name: "Save brief", exact: true }).click();
  await expect(
    other.getByText("Brief saved. Your terms have a new version.", {
      exact: true,
    }),
  ).toBeVisible();
  const stale = await page.request.post("/api/actions", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      type: "SAVE_BRIEF",
      workspaceId: before.id,
      expectedVersion: before.version,
      idempotencyKey: crypto.randomUUID(),
      payload: { brief: before.brief },
    },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.code).toBe("stale_version");
});

test("saved productions preserve independent work and forged capabilities are rejected", async ({
  page,
  browser,
}) => {
  await page.goto("/demo");
  await page
    .getByRole("button", { name: "Start my own production", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A room with its own character." }),
  ).toBeVisible();
  const original = await readWorkspace(page.request);
  expect(original.mode).toBe("REAL");
  expect(original.suppliers).toHaveLength(0);
  await page.getByLabel("Venue name").fill("QA operator room");
  await page.getByLabel("Neighborhood & city").fill("QA district");
  await page
    .getByLabel("Address", { exact: true })
    .fill("Synthetic QA address");
  await page.getByLabel("Seated capacity").fill("30");
  await page
    .getByLabel("Access & guest needs")
    .fill("Test access procedure checked by the operator.");
  await page
    .getByLabel("Source of venue facts")
    .fill("Synthetic browser-test venue sheet; no real venue claimed.");
  await page
    .getByRole("button", { name: "Save venue details", exact: true })
    .click();
  await expect(
    page.getByText("Venue sheet saved", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Attest availability & allotment",
      exact: true,
    }),
  ).toBeDisabled();
  await page.goto("/studio/events/current/brief");
  await page
    .getByLabel("The ambition")
    .fill(
      "A small operator-funded conversation, with a clear scope and no payments.",
    );
  await page.getByLabel("New cultural anchor").fill("Shared stories");
  await page
    .getByRole("button", { name: "Add cultural anchor", exact: true })
    .click();
  await page.getByLabel("Date", { exact: true }).fill("2026-12-01");
  await page.getByLabel(/Total budget/).fill("1000");
  await page
    .getByLabel("Who is this for?")
    .fill("People who want a gentle shared conversation.");
  await expect(page.getByLabel(/Room & other fixed costs/)).toHaveValue("0");
  await expect(page.getByLabel(/Costs per guest/)).toHaveValue("0");
  await page.getByRole("button", { name: "Save brief", exact: true }).click();
  await expect(
    page.getByText(
      "Brief saved. Timing changed; reconfirm venue and supplier availability.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.goto("/studio/venue");
  await page
    .getByRole("button", {
      name: "Attest availability & allotment",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Availability attested by operator", { exact: true }),
  ).toBeVisible();
  await page.goto("/studio/suppliers");
  await page
    .getByRole("button", { name: "Add a supplier offer", exact: true })
    .click();
  const offer = page.getByRole("dialog");
  await offer.getByLabel("Supplier or collaborator name").fill("QA Workshop");
  await offer.getByLabel("Role in the evening").fill("Conversation workshop");
  await offer
    .getByLabel("What they bring")
    .fill("Synthetic test offer for a facilitated conversation.");
  await offer
    .getByLabel("Exact assignment & restrictions")
    .fill("One 45-minute facilitated session; no external rights implied.");
  await offer.getByLabel(/Fixed fee/).fill("120");
  await offer
    .getByLabel("Source of the quote")
    .fill("Synthetic operator quote used only for browser testing.");
  await offer
    .getByRole("button", { name: "Save this offer", exact: true })
    .click();
  await expect(offer).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "QA Workshop", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Operator-entered quote", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Your productions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "New sample rehearsal", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const sample = await readWorkspace(page.request);
  expect(sample.id).not.toBe(original.id);
  await page
    .getByRole("button", { name: "Your productions", exact: true })
    .click();
  await page
    .locator(".saved-desk")
    .filter({ hasText: original.event.title })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const restored = await readWorkspace(page.request);
  expect(restored.id).toBe(original.id);
  expect(restored.venue.name).toBe("QA operator room");
  expect(restored.suppliers[0].name).toBe("QA Workshop");
  const stranger = await browser.newContext();
  const denied = await stranger.request.post(
    "http://127.0.0.1:3102/api/workspace",
    {
      headers: { Origin: "http://127.0.0.1:3102" },
      data: { workspaceId: original.id },
    },
  );
  expect(denied.status()).toBe(401);
  const invalid = await stranger.request.get(
    `http://127.0.0.1:3102/api/participants/${"0".repeat(64)}`,
  );
  expect(invalid.status()).toBe(404);
  expect(
    (await stranger.cookies()).some((c) => c.name === "assembly_owner"),
  ).toBe(false);
  await stranger.close();
});
