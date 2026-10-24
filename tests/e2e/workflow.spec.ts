import { test, expect, type Page } from "@playwright/test";

async function acceptApproval(page: Page, buttonName: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: buttonName, exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
async function completeRemainingTasks(page: Page) {
  const rows = page.locator(".task-row");
  await expect(rows).toHaveCount(5);
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    const button = row.getByRole("button", { name: "Complete", exact: true });
    if (await button.count()) {
      await button.click();
      await row
        .getByLabel("Completion evidence")
        .fill(
          "Sample operator completed this check and recorded the venue procedure.",
        );
      await row
        .getByRole("button", { name: "Record completed task", exact: true })
        .click();
      await expect(row).toHaveClass(/done/);
    }
  }
}

test("an owner-approved sample goes from brief to bookings, recovery, and observed completion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo");
  await page
    .getByRole("link", { name: "Open my production desk", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Make room for something good." }),
  ).toBeVisible();
  await page.screenshot({
    path: ".artifacts/browser/studio-overview-1440.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Shape the brief", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore sample concepts", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Same room. Three different feelings." }),
  ).toBeVisible();
  await expect(page.locator(".concept-card")).toHaveCount(3);
  await page.screenshot({
    path: ".artifacts/browser/concepts-1440.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Choose this direction", exact: true })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Let people in on the idea", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review & publish sample", exact: true })
    .click();
  await acceptApproval(page, "Approve & publish sample");
  await page
    .getByRole("link", { name: "Open attendee experience", exact: true })
    .click();
  await page.getByLabel("Your sample name").fill("Morgan Sample");
  await page.getByLabel("Sample email address").fill("morgan@example.test");
  await page.getByLabel("People in your party").selectOption("2");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Save my sample interest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/commitments\//);
  const confirmationUrl = page.url();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Verify my sample contact", exact: true })
    .click();
  await expect(
    page.getByText("Verified conditional interest", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bookings aren’t open yet.", { exact: true }),
  ).toBeVisible();
  await page.goto("/studio/events/blue-hour/production");
  await expect(
    page.getByRole("heading", { name: "Good nights are in the details." }),
  ).toBeVisible();
  const offers = page.getByRole("button", {
    name: "Confirm sample offer",
    exact: true,
  });
  await expect(offers).toHaveCount(2);
  await offers.first().click();
  await expect(offers).toHaveCount(1);
  await offers.first().click();
  await expect(offers).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await page
      .getByRole("button", { name: "Record check", exact: true })
      .first()
      .click();
    await page
      .getByLabel("What did you check?")
      .fill(
        "Sample owner reviewed and accepted the stated responsibility and procedure.",
      );
    await page
      .getByRole("button", { name: "Save sample confirmation", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Record check", exact: true }),
    ).toHaveCount(2 - i);
  }
  await page
    .getByRole("button", { name: "Review greenlight", exact: true })
    .click();
  await acceptApproval(page, "Greenlight this version");
  await page
    .getByRole("button", { name: "Open sample bookings", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Mark the production ready",
      exact: true,
    }),
  ).toBeDisabled();
  await page.goto(confirmationUrl);
  await page
    .getByRole("button", { name: "Book 2 sample places", exact: true })
    .click();
  await expect(
    page.getByText("Sample place allocated", { exact: true }),
  ).toBeVisible();
  await page.goto("/studio/events/blue-hour/production");
  await completeRemainingTasks(page);
  await expect(
    page.getByRole("button", {
      name: "Mark the production ready",
      exact: true,
    }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Rehearse a disruption", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rehearse cancellation", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Review the change", exact: true })
    .click();
  await expect(
    page.getByText("Booking paused", { exact: true }).last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Confirm replacement offer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review & approve change", exact: true })
    .click();
  await acceptApproval(page, "Approve this exact change");
  await expect(
    page.getByRole("button", { name: "Resume sample booking", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: ".artifacts/browser/recovery-1440.png",
    fullPage: true,
  });
  await page.goto(confirmationUrl);
  await expect(
    page.getByText("New terms need your choice", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Accept the revised terms", exact: true })
    .click();
  await expect(
    page.getByText("Sample place allocated", { exact: true }),
  ).toBeVisible();
  await page.goto("/studio/events/blue-hour/changes/current");
  await page
    .getByRole("button", { name: "Resume sample booking", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Continue the production", exact: true })
    .click();
  await expect(page.locator(".task-row.done")).toHaveCount(2);
  await completeRemainingTasks(page);
  await page
    .getByRole("button", { name: "Mark the production ready", exact: true })
    .click();
  await page.getByRole("button", { name: "Check in", exact: true }).click();
  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Open the doors", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete the sample event", exact: true })
    .click();
  await page
    .getByRole("link", { name: "See the outcome", exact: true })
    .click();
  await expect(
    page.getByText("Sample production completed", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".result-metrics>div").nth(2)).toContainText("2");
  await expect(page.locator(".result-metrics>div").nth(3)).toContainText("£0");
  await page.reload();
  await expect(
    page.getByText("Sample production completed", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".artifacts/browser/outcome-1440.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1024, 1440]) {
  test(`primary public and studio views fit at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    for (const route of [
      "/",
      "/demo",
      "/studio",
      "/studio/events/blue-hour/brief",
      "/studio/venues/the-fold",
      "/events/blue-hour",
    ]) {
      await page.goto(route);
      if (route.includes("/studio"))
        await expect(
          page.getByText("Saved to your workspace", { exact: true }),
        ).toBeAttached();
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

test("keyboard evidence drawer restores focus and a stale owner cannot silently overwrite a saved brief", async ({
  page,
  context,
}) => {
  await page.goto("/studio/events/blue-hour/brief");
  const trigger = page.getByRole("button", {
    name: "See the thinking",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  // The drawer is controlled by two entry points, so restoration is explicitly tested.
  await expect(trigger).toBeFocused();
  const other = await context.newPage();
  await other.goto("/studio/events/blue-hour/brief");
  await expect(other.getByLabel("The ambition")).toBeVisible();
  await page
    .getByLabel("The ambition")
    .fill("An intimate evening with a new saved cultural direction.");
  await page.getByRole("button", { name: "Save brief", exact: true }).click();
  await expect(
    page.getByText("Brief saved. Your terms have a new version.", {
      exact: true,
    }),
  ).toBeVisible();
  await other.getByRole("button", { name: "Save brief", exact: true }).click();
  await expect(other.locator(".feedback-error[role=alert]")).toContainText(
    "This workspace changed.",
  );
});
