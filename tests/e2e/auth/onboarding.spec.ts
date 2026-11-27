import { expect, test } from "@playwright/test";

test.describe("Encore Auth & Onboarding", () => {
  test("allows public access to /discover without authentication", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "Discover Music" })).toBeVisible();
  });

  test("shows wallet sign-in and does not offer paused social sign-in", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Social and email sign-in are temporarily unavailable.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
  });

  test("does not issue a cookie for the disabled Pollar exchange", async ({ request }) => {
    const response = await request.post("/api/v1/auth/pollar/session", { data: {} });
    expect(response.status()).toBe(503);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("redirects unauthenticated users away from protected /studio/dashboard", async ({
    page
  }) => {
    await page.goto("/studio/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
