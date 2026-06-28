import { expect, test } from "@playwright/test";

test.describe("Onboarding Console Landing Page", () => {
  test("should load the landing page successfully with correct title", async ({
    page,
  }) => {
    // Navigate to the root onboarding console
    await page.goto("/");

    // Verify main SaaS title exists
    const heroTitle = page.locator("h1");
    await expect(heroTitle).toContainText("Multi-Tenant SaaS Starter");

    // Verify the Clerk Sign In button is present when unauthenticated
    const signInButton = page.locator("button", {
      hasText: "Sign In to Dashboard",
    });
    await expect(signInButton).toBeVisible();
  });
});
