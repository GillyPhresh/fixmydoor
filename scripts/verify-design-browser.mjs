import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "@playwright/test";

const base = new URL(process.env.FMD_DESIGN_BASE || "http://127.0.0.1:4173");
assert.ok(["127.0.0.1", "localhost", "fixmydoor-staging-staging.up.railway.app"].includes(base.hostname));
const output = process.env.FMD_DESIGN_ARTIFACTS;
assert.ok(output, "Set FMD_DESIGN_ARTIFACTS to a directory outside the repository.");
await mkdir(output, { recursive: true });

const setup = process.env.FMD_DESIGN_BASIC_USER && process.env.FMD_DESIGN_BASIC_PASSWORD
  ? { username: process.env.FMD_DESIGN_BASIC_USER, password: process.env.FMD_DESIGN_BASIC_PASSWORD, origin: base.origin }
  : undefined;
const browser = await chromium.launch();
const widths = [320, 360, 375, 390, 430, 768, 1024, 1440, 1680];
const mobile = { width: 390, height: 844 };
const desktop = { width: 1440, height: 900 };
const context = await browser.newContext({ viewport: desktop, httpCredentials: setup, reducedMotion: "reduce", serviceWorkers: "block" });
await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue() : route.abort());
if (process.env.FMD_AXE_PATH) await context.addInitScript({ path: process.env.FMD_AXE_PATH });
await context.addInitScript(() => {
  localStorage.setItem("fixmydoor-cookie-choice-v2", "denied");
  localStorage.setItem("fixmydoor-human-check-v2", "verified");
  localStorage.setItem("fixmydoor-push-choice-v1", "denied");
});

async function open(page, path, locator) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded" });
  assert.equal(response?.status(), 200, path);
  await page.locator(locator).first().waitFor();
}

async function verifyWidths(page, label) {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    // Let responsive controls and carousel resize observers reconcile before measuring.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const overflowing = await page.evaluate(() => {
      const app = document.querySelector("#root");
      const rootOverflows = app.scrollWidth > app.clientWidth + 1;
      const pageCanScroll = !["hidden", "clip"].includes(getComputedStyle(document.documentElement).overflowX);
      return rootOverflows || (pageCanScroll && document.documentElement.scrollWidth > innerWidth + 1) || [...document.querySelectorAll(".fd-invoice .fd-status")].some(badge => {
      const rect = badge.getBoundingClientRect(); const card = badge.closest(".fd-invoice").getBoundingClientRect();
        return rect.left < card.left || rect.right > card.right;
      });
    });
    assert.equal(overflowing, false, label + " overflow at " + width + " px");
  }
  console.log(label + " layout passed at " + widths.join(", "));
}

async function capture(page, name, region) {
  for (const [mode, viewport] of [["desktop", desktop], ["mobile", mobile]]) {
    await page.setViewportSize(viewport);
    if (region) await page.locator(region).first().scrollIntoViewIfNeeded();
    else await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(output, "after-" + name + "-" + mode + ".png") });
  }
}

async function audit(page, name, selector) {
  if (!process.env.FMD_AXE_PATH) return;

  const result = await page.evaluate(async target => (await window.axe.run(target || document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
  })).violations.map(violation => ({ id: violation.id, impact: violation.impact, nodes: violation.nodes.length, targets: violation.nodes.slice(0, 4).map(node => node.target) })), selector);
  console.log("axe " + name + " " + JSON.stringify(result));
}

async function signIn(page, email, password) {
  const response = await page.request.post(new URL("/api/portal/auth/login", base).href, { data: { email, password } });
  assert.equal(response.status(), 200);
  await open(page, "/portal", ".portal-hero");
}

try {
  const p = await context.newPage();
  p.on("pageerror", error => console.error("Browser page error:", error.message));
  await open(p, "/", ".fd-hero h1");
  await p.getByRole("button", { name: "Dismiss promotion" }).click({ timeout: 2000 }).catch(() => {});
  await verifyWidths(p, "Homepage");
  await capture(p, "home");
  await audit(p, "home hero", ".fd-hero");
  await p.setViewportSize({ width: 1024, height: 900 });
  await p.getByRole("button", { name: "Toggle navigation menu" }).click();
  await p.getByRole("link", { name: "Client portal", exact: true }).last().waitFor();
  await p.getByRole("button", { name: "Toggle navigation menu" }).click();
  await p.locator(".fixmydoor-language-switcher").getByRole("button", { name: "FR", exact: true }).click();
  await p.getByRole("heading", { name: /Réparation de portes/ }).waitFor();
  await p.locator(".fixmydoor-language-switcher").getByRole("button", { name: "EN", exact: true }).click();
  await p.getByRole("button", { name: "Request a remote consultation", exact: true }).click();
  await p.locator("#booking-form [role=combobox]").first().getByText("Remote consultation").waitFor();
  await p.waitForFunction(() => document.activeElement?.getAttribute("name") === "name");
  await capture(p, "booking", "#booking-form h3");
  await open(p, "/door-repair", ".fd-service-hero");
  await verifyWidths(p, "Service page");
  await capture(p, "service");
  await open(p, "/technician-application", ".fd-recruit-intro h1");
  await verifyWidths(p, "Recruitment application");
  await capture(p, "recruitment");
  await audit(p, "recruitment", undefined);
  const applicant = "Synthetic Designer " + randomUUID().slice(0, 8);
  await p.locator("[name=name]").fill(applicant);
  await p.getByRole("button", { name: "Français", exact: true }).click();
  await p.getByRole("heading", { name: "Mettez votre savoir-faire à profit." }).waitFor();
  assert.equal(await p.locator("[name=name]").inputValue(), applicant);
  await capture(p, "recruitment-fr");
  await p.getByRole("button", { name: "English", exact: true }).click();
  await p.locator("[name=email]").fill("designer-" + randomUUID() + "@example.invalid");
  await p.locator("[name=city]").fill("Montréal");
  await p.locator("[name=province]").selectOption("QC");
  await p.locator("[name=experience]").fill("Synthetic furniture assembly and property maintenance experience.");
  await p.getByRole("button", { name: "Submit application", exact: true }).click();
  await p.getByRole("heading", { name: "Application received." }).waitFor();
  await audit(p, "confirmation", undefined);
  console.log("Recruitment EN/FR switch, form preservation and submission passed");

  if (process.env.FMD_DESIGN_STAFF_USER && process.env.FMD_DESIGN_STAFF_PASSWORD) {
    const login = await p.request.post(new URL("/api/auth/login", base).href, { data: { username: process.env.FMD_DESIGN_STAFF_USER, password: process.env.FMD_DESIGN_STAFF_PASSWORD } });
    assert.equal(login.status(), 200);
    await open(p, "/admin/recruitment", ".fd-applicant");
    const card = p.locator("article").filter({ has: p.getByRole("heading", { name: applicant, exact: true }) });
    await card.getByText("Open application", { exact: true }).click();
    await card.locator("[name=note]").fill("Synthetic design review, ready to interview.");
    await verifyWidths(p, "Recruitment staff review");
    await capture(p, "recruitment-staff", ".fd-review-list");
    await audit(p, "staff review", undefined);
    await card.getByRole("button", { name: "Save review", exact: true }).click();
    await p.getByText("Review saved.", { exact: true }).waitFor();
    await open(p, "/admin/commercial", ".cm-shell h1");
    await verifyWidths(p, "Service management");
    await capture(p, "commercial");
    await open(p, "/admin", ".fd-admin-header h1");
    await verifyWidths(p, "Staff dashboard");
    await capture(p, "admin");
  }

  if (process.env.FMD_DESIGN_PORTAL_PASSWORD) {
    for (const [name, email] of [["customer", "alex.morgan@example.invalid"], ["business", "manager@example.invalid"], ["technician", "jamie.lee@example.invalid"]]) {
      await signIn(p, email, process.env.FMD_DESIGN_PORTAL_PASSWORD);
      await verifyWidths(p, name + " portal");
      await capture(p, name);
      if (name !== "technician") {
        await p.getByRole("link", { name: "Invoices", exact: true }).click();
        const invoice = p.locator(".fd-invoice").filter({ hasText: "Payment history" }).first();
        await invoice.waitFor();
        await invoice.getByText("Invoice details", { exact: true }).click();
        await invoice.getByText("Payment history", { exact: true }).click();
        await verifyWidths(p, name + " invoice details");
        await capture(p, name + "-invoice", ".fd-invoice");
        await audit(p, name + " invoice", ".fd-invoice");
        await p.evaluate(() => {
          const open = window.open.bind(window);
          window.open = (...args) => {
            const receipt = open(...args);
            if (receipt) receipt.print = () => { receipt.document.documentElement.dataset.printInvoked = "true"; };
            return receipt;
          };
        });
        const popup = p.waitForEvent("popup");
        await invoice.getByRole("button", { name: "Print receipt", exact: true }).first().click();
        const receipt = await popup;
        await receipt.getByRole("heading", { name: "Payment receipt", exact: true }).waitFor();
        assert.equal(await receipt.locator("html").getAttribute("data-print-invoked"), "true");
        await receipt.close();
      }
    }
  }
} finally {
  await browser.close();
}
