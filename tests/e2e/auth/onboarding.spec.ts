import { expect, test } from "@playwright/test";

test.describe("Encore Auth & Onboarding", () => {
  test("allows public access to /discover without authentication", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByRole("heading", { name: "Discover Music" })).toBeVisible();
  });

  test("renders Web2 and Solana wallet login options on /login", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });

  test("redirects unauthenticated users away from protected /studio/dashboard", async ({
    page
  }) => {
    await page.goto("/studio/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
