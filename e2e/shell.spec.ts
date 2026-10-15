import { expect, test } from "@playwright/test";

test("the shell has a skip link and the ingredient page shows the disclaimer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
  await expect(page.locator("#main")).toBeVisible();

  await page.goto("/ingredients");
  await expect(page.getByText("Informational only, not a medical diagnosis.")).toBeVisible();
});
