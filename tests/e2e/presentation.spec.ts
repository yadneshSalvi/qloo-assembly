import { test, expect } from "@playwright/test";
import { presentationFixture } from "../fixtures/concept-presentation";

test("saved live proposals show readable ingredients and current evidence first", async ({
  page,
}) => {
  const workspace = presentationFixture();
  await page.route("**/api/workspace", (route) =>
    route.fulfill({ json: workspace }),
  );
  await page.goto("/studio/events/current/concepts");
  const card = page.locator(".concept-card").first();
  await expect(
    card.getByRole("heading", { name: "A Shared Frequency" }),
  ).toBeVisible();
  await expect(card.locator(".concept-description")).toHaveText(
    "A proposed evening of shared listening, with space to linger and exchange impressions.",
  );
  await expect(card.locator(".concept-ingredients")).toContainText(
    "Synthetic Cultural Reference",
  );
  await expect(card).not.toContainText("minor units");
  await expect(card.locator(".concept-budget")).toContainText("£");
  await page
    .getByRole("button", { name: "See the thinking", exact: true })
    .click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.locator(".evidence-item").first()).toContainText(
    "Synthetic cultural discovery",
  );
  await expect(
    drawer.getByText(/No affinity result or audience prediction/),
  ).not.toBeVisible();
  await expect(
    drawer.locator(".evidence-source").filter({ hasText: "Cost worksheet" }),
  ).toHaveText("Cost worksheet · GBP");
  await drawer.locator(".evidence-history summary").click();
  await expect(
    drawer.getByText(/No affinity result or audience prediction/),
  ).toBeVisible();
  await expect(
    drawer.getByText(/These notes describe the sample as it was recorded/),
  ).toBeVisible();
});
