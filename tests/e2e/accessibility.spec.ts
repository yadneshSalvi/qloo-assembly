import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { publishedSample, readWorkspace } from "./helpers";
test("public and production screens pass automated critical/serious WCAG checks", async ({
  page,
}) => {
  const w = await publishedSample(page.request);
  const publicView = await (
    await page.request.get(`/api/public/events/${w.event.slug}`)
  ).json();
  const interest = await page.request.post(
    `/api/public/events/${w.event.slug}`,
    {
      headers: { Origin: "http://127.0.0.1:3102" },
      data: {
        type: "EXPRESS_INTEREST",
        expectedPublicVersion: publicView.version,
        termsVersion: publicView.terms.version,
        termsHash: publicView.terms.hash,
        idempotencyKey: crypto.randomUUID(),
        payload: { name: "Axe rehearsal", quantity: 1, consent: true },
      },
    },
  );
  expect(interest.ok()).toBeTruthy();
  const participant = await interest.json();
  const current = await readWorkspace(page.request);
  const invitation = await page.request.post("/api/supplier-links", {
    headers: { Origin: "http://127.0.0.1:3102" },
    data: {
      supplierId: "low-lights",
      workspaceId: current.id,
      expectedVersion: current.version,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(invitation.ok()).toBeTruthy();
  const supplier = await invitation.json();
  for (const route of [
    "/",
    "/demo",
    "/studio",
    "/studio/events/current/brief",
    "/studio/venue",
    "/studio/suppliers",
    "/studio/events/current/concepts",
    "/studio/events/current/production",
    "/studio/events/current/changes/current",
    `/events/${w.event.slug}`,
    `/commitments/${participant.token}`,
    `/collaborate/${supplier.token}`,
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    const failures = result.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact || ""),
    );
    expect(
      failures.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
      route.replace(/\/(commitments|collaborate)\/[a-f0-9]+/, "/$1/[private]"),
    ).toEqual([]);
  }
});
test("mobile navigation hides offscreen links and keyboard focus returns when dismissed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto("/studio");
  await expect(
    page.getByRole("heading", { name: "Make room for something good." }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Studio navigation", exact: true }),
  ).not.toBeVisible();
  const opener = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });
  await opener.click();
  await expect(
    page.getByRole("dialog", { name: "Production navigation" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("navigation", { name: "Studio navigation", exact: true }),
  ).not.toBeVisible();
  await expect(opener).toBeFocused();
});
