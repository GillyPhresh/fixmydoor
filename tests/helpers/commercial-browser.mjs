import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
export async function verifyCommercialBrowser(base, cookie, jobId) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: 850 },
        serviceWorkers: "block",
      });
      try {
        await context.route("**/*", route =>
          new URL(route.request().url()).origin === base
            ? route.continue()
            : route.abort()
        );
        const cut = cookie.indexOf("=");
        await context.addCookies([
          {
            name: cookie.slice(0, cut),
            value: cookie.slice(cut + 1),
            url: base,
          },
        ]);
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        const response = await page.goto(base + "/admin/commercial");
        assert.equal(response.status(), 200);
        const customerName = "Property team " + width;
        await page.getByRole("link", { name: "New customer" }).click();
        await page.getByLabel("Customer name").fill(customerName);
        await page
          .getByLabel("Email", { exact: true })
          .fill("team@example.invalid");
        await page.getByLabel("Category").selectOption("Business");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: customerName })
        ).toBeVisible();
        await page.getByRole("link", { name: "Add property" }).click();
        for (const [field, value] of [
          ["Property name", "Demo office"],
          ["Street address", "1 Example Street"],
          ["City", "Montréal"],
          ["Province or region", "QC"],
        ]) {
          await page.getByLabel(field, { exact: true }).fill(value);
        }
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(
          page.getByRole("heading", { name: "Demo office" })
        ).toBeVisible();
        await page.getByRole("link", { name: "Edit property" }).click();
        await page
          .getByLabel("Maintenance notes")
          .fill("Internal property test");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        await expect(page.getByText("Internal property test")).toBeVisible();
        await page
          .getByRole("link", { name: "Remote consultations", exact: true })
          .click();
        await page.getByRole("link", { name: "Remote fixture · Door" }).click();
        assert.ok(page.url().endsWith(jobId));
        await page.getByRole("link", { name: "Customer profile" }).click();
        await expect(
          page.getByRole("heading", { name: "Facility Manager" })
        ).toBeVisible();
        await page.getByRole("link", { name: "Warehouse" }).click();
        await page.getByRole("link", { name: "New quotation" }).click();
        await page
          .getByLabel("Service description")
          .fill("Browser quote " + width);
        await page.getByLabel("Item description").fill("Door review");
        await page.getByLabel("Unit price (CAD)").fill("12.34");
        await page.getByLabel("Staff notes").fill("Private quote margin");
        await page.getByLabel("Valid through").fill("2099-01-01");
        await page.getByRole("button", { name: "Save draft" }).click();
        await expect(page.locator(".cm-print")).toContainText("12.34");
        await page.emulateMedia({ media: "print" });
        await expect(page.getByText("Private quote margin")).toBeHidden();
        await expect(page.locator(".cm-print")).toBeVisible();
        await page.emulateMedia({ media: "screen" });
        await page.getByRole("button", { name: "Français" }).click();
        await expect(
          page.getByRole("heading", { name: "Gestion des services" })
        ).toBeVisible();
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
          )
        );
        await page.goto(base + "/");
        await page
          .getByRole("combobox", { name: "Appointment preference" })
          .click();
        await page.getByRole("option", { name: "Remote consultation" }).click();
        await expect(
          page.getByText("We will contact you to arrange your consultation.")
        ).toBeVisible();
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
}
