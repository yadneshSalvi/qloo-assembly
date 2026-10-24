import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public and production screens pass automated critical/serious WCAG checks", async ({
  page,
}) => {
  for (const route of [
    "/",
    "/demo",
    "/studio",
    "/studio/events/blue-hour/brief",
    "/studio/venues/the-fold",
    "/events/blue-hour",
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
      route,
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
