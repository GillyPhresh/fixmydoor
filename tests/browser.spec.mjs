import { test, expect } from "@playwright/test";
import sharp from "sharp";
const base = process.env.FMD_BROWSER_URL;
if (
  !base ||
  !/^https?:\/\/(127\.0\.0\.1|localhost|fixmydoor-staging-staging\.up\.railway\.app)(:|\/|$)/.test(
    base
  )
)
  throw new Error("Explicit isolated browser URL required");
test.use({
  baseURL: base,
  httpCredentials: process.env.FMD_BASIC_USER
    ? {
        username: process.env.FMD_BASIC_USER,
        password: process.env.FMD_BASIC_PASSWORD,
      }
    : undefined,
});
for (const viewport of [
  { width: 1440, height: 1000 },
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
]) {
  test(`homepage, navigation, booking layout and French at ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", route =>
      new URL(route.request().url()).origin === new URL(base).origin
        ? route.continue()
        : route.abort()
    );
    await page.goto("/");
    await expect(page.locator("#booking-form")).toBeAttached();
    await expect(page.locator("body")).not.toHaveText(
      /Loading FixMyDoor Services\.\.\./
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      )
    ).toBe(true);
    if (viewport.width < 768) {
      await page
        .getByRole("button", { name: "Toggle navigation menu" })
        .click();
      await expect(page.locator("nav")).toBeVisible();
    }
    await page.locator("#booking-form").scrollIntoViewIfNeeded();
    await expect(
      page.getByRole("button", { name: "Send Request", exact: true })
    ).toBeVisible();
    await page.screenshot({ path: `test-results/home-${viewport.width}.png` });
    await page.goto("/?lang=fr");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr", {
      timeout: 20000,
    });
    expect(errors).toEqual([]);
  });
}
test("real browser bookings with and without photo, admin and private tracking", async ({
  page,
  context,
}) => {
  await page.route("**/*", route =>
    new URL(route.request().url()).origin === new URL(base).origin
      ? route.continue()
      : route.abort()
  );
  let tracking;
  for (const withPhoto of [false, true]) {
    await page.goto("/");
    const form = page.locator("#booking-form");
    await form.scrollIntoViewIfNeeded();
    await page
      .getByRole("button", { name: "Send Request", exact: true })
      .click();
    await expect(page.getByPlaceholder("Your full name")).toBeVisible();
    await page
      .getByPlaceholder("Your full name")
      .fill(`Browser Synthetic ${withPhoto ? "Photo" : "Plain"}`);
    await page.locator('input[name="phone"]').fill("5145550110");
    await page
      .getByPlaceholder("your.email@example.com")
      .fill(`browser-${Date.now()}@example.invalid`);
    await page
      .getByPlaceholder("Where is the job located?")
      .fill("1 Synthetic Staging Street");
    await page.locator("#repair-type-trigger").click();
    await page
      .getByRole("option", { name: /Door Repair/i })
      .first()
      .click();
    if (withPhoto) {
      const bytes = await sharp({
        create: { width: 30, height: 24, channels: 3, background: "orange" },
      })
        .jpeg()
        .toBuffer();
      await page
        .locator("input[type=file]")
        .setInputFiles({
          name: "synthetic.jpg",
          mimeType: "image/jpeg",
          buffer: bytes,
        });
      await expect(page.getByAltText("Uploaded preview 1")).toBeVisible();
    }
    await form.getByRole("checkbox").check();
    const response = page.waitForResponse(
      r => r.url().endsWith("/api/bookings") && r.request().method() === "POST"
    );
    await page
      .getByRole("button", { name: "Send Request", exact: true })
      .click();
    const result = await response;
    expect(result.status()).toBe(201);
    tracking = (await result.json()).trackingUrl;
  }
  await page.goto("/admin");
  await page
    .getByLabel("Username", { exact: true })
    .fill(process.env.FMD_ADMIN_USER);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.FMD_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Admin Dashboard" })
  ).toBeVisible();
  const records = await context.request.get("/api/bookings");
  expect(records.status()).toBe(200);
  const all = (await records.json()).bookings;
  const photo = all.find(b => b.name === "Browser Synthetic Photo");
  expect(photo.photos.length).toBe(1);
  const file = await context.request.get(
    `/api/admin/bookings/${photo.id}/photos/0`
  );
  expect(file.status()).toBe(200);
  await page.screenshot({ path: "test-results/admin-desktop.png" });
  await page.goto(tracking);
  await expect(
    page.getByText(/request|received|status/i).first()
  ).toBeVisible();
  const token = tracking.split("/").at(-1);
  const api = await context.request.get(`/api/bookings/track/${token}`);
  expect(api.status()).toBe(200);
  expect(await api.text()).not.toMatch(
    /adminNotes|staffAssigned|photos|customerToken/
  );
  expect(api.headers()["cache-control"]).toContain("no-store");
});
test("failed photograph upload blocks submission until selection is cleared", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#booking-form").scrollIntoViewIfNeeded();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("synthetic invalid image"),
    });
  await expect(
    page.getByRole("alert").filter({ hasText: "Photo upload failed" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send Request", exact: true })
  ).toBeDisabled();
  await page.getByRole("button", { name: "Clear photos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Send Request", exact: true })
  ).toBeEnabled();
});
