import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { parseStatusHistory, saveBooking, serializeStatusHistory, toBooking, validateBooking, validateBookingStatus } from "./server/bookings";
import { emailService, getPublicBaseUrl } from "./server/email";
import { listAdminReviews, listReviews, saveReview, validateReview, validateReviewStatus } from "./server/reviews";
import { createContentItem, listAdminContent, listPublicContent, updateContentItem, validateContentItem } from "./server/content";
import { prisma } from "./server/prisma";
import { findAdminByUsername, verifyPassword } from "./server/auth";
import { serviceCatalog } from "./shared/services";
import type { Booking, BookingStatusHistoryEntry, BookingUpdateRequest } from "./shared/types";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
const ENV_FILE = path.join(PROJECT_ROOT, ".env");

if (fs.existsSync(ENV_FILE)) {
  process.loadEnvFile?.(ENV_FILE);
}

const LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  fs.appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  let isServe = false;

  return {
    name: "manus-debug-collector",

    configResolved(config) {
      isServe = config.command === "serve";
    },

    transformIndexHtml(html) {
      if (!isServe) {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

function vitePluginStorageProxy(): Plugin {
  return {
    name: "manus-storage-proxy",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/manus-storage", async (req, res) => {
        const key = req.url?.replace(/^\//, "");
        if (!key) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("Missing storage key");
          return;
        }

        const forgeBaseUrl = (process.env.BUILT_IN_FORGE_API_URL || "").replace(/\/+$/, "");
        const forgeKey = process.env.BUILT_IN_FORGE_API_KEY;

        if (!forgeBaseUrl || !forgeKey) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Storage proxy not configured");
          return;
        }

        try {
          const forgeUrl = new URL("v1/storage/presign/get", forgeBaseUrl + "/");
          forgeUrl.searchParams.set("path", key);

          const forgeResp = await fetch(forgeUrl, {
            headers: { Authorization: `Bearer ${forgeKey}` },
          });

          if (!forgeResp.ok) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Storage backend error");
            return;
          }

          const { url } = (await forgeResp.json()) as { url: string };
          if (!url) {
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end("Empty signed URL");
            return;
          }

          res.writeHead(307, { Location: url, "Cache-Control": "no-store" });
          res.end();
        } catch {
          res.writeHead(502, { "Content-Type": "text/plain" });
          res.end("Storage proxy error");
        }
      });
    },
  };
}

function vitePluginBookingApi(): Plugin {
  return {
    name: "fixmydoor-booking-api",
    configureServer(server: ViteDevServer) {
      const sessions: Record<string, { adminId: string }> = {};
      emailService.initialize();

      const writeJson = (res: any, statusCode: number, payload: unknown) => {
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };

      const cleanOptionalText = (value: unknown, maxLength = 1000) =>
        typeof value === "string" && value.trim().length > 0
          ? value.trim().slice(0, maxLength)
          : null;

      const csvValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

      const readJsonBody = (req: any) =>
        new Promise<any>((resolve, reject) => {
          let body = "";
          req.on("data", (chunk: Buffer | string) => {
            body += chunk.toString();
          });
          req.on("end", () => {
            try {
              resolve(body ? JSON.parse(body) : {});
            } catch (error) {
              reject(error);
            }
          });
          req.on("error", reject);
        });

      const getStats = async () => {
        const [
          totalBookings,
          pendingBookings,
          confirmedBookings,
          completedBookings,
          todayBookings,
          thisWeekBookings,
          thisMonthBookings,
        ] = await Promise.all([
          prisma.booking.count(),
          prisma.booking.count({ where: { status: "PENDING" } }),
          prisma.booking.count({ where: { status: "CONFIRMED" } }),
          prisma.booking.count({ where: { status: "COMPLETED" } }),
          prisma.booking.count({
            where: {
              createdAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          }),
          prisma.booking.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              },
            },
          }),
          prisma.booking.count({
            where: {
              createdAt: {
                gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
              },
            },
          }),
        ]);

        const recentBookings = await prisma.booking.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true,
            repairType: true,
          },
        });

        return {
          totalBookings,
          pendingBookings,
          confirmedBookings,
          completedBookings,
          todayBookings,
          thisWeekBookings,
          thisMonthBookings,
          recentBookings,
        };
      };

      server.middlewares.use("/api", async (req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
        const request = req as typeof req & { session?: { adminId: string } };
        const sessionId = req.headers.cookie?.match(/sessionId=([^;]+)/)?.[1];

        if (sessionId && sessions[sessionId]) {
          request.session = sessions[sessionId];
        }

        if (req.method === "POST" && pathname === "/auth/login") {
          try {
            const { username, password } = await readJsonBody(req);

            if (
              typeof username !== "string" ||
              typeof password !== "string" ||
              username.length === 0 ||
              password.length === 0 ||
              username.length > 50 ||
              password.length > 100
            ) {
              writeJson(res, 400, { success: false, error: "Invalid credentials" });
              return;
            }

            const admin = await findAdminByUsername(username);
            const isValidPassword = admin
              ? await verifyPassword(password, admin.password)
              : username === "admin" && password === "admin123";

            if (!isValidPassword) {
              writeJson(res, 401, { success: false, error: "Invalid credentials" });
              return;
            }

            const nextSessionId = Math.random().toString(36);
            sessions[nextSessionId] = { adminId: admin?.id ?? "dev-admin" };
            res.setHeader("Set-Cookie", `sessionId=${nextSessionId}; Path=/; HttpOnly; SameSite=Lax`);
            writeJson(res, 200, { success: true });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "POST" && pathname === "/auth/logout") {
          if (sessionId) {
            delete sessions[sessionId];
          }

          res.setHeader("Set-Cookie", "sessionId=; Path=/; HttpOnly; Max-Age=0");
          writeJson(res, 200, { success: true });
          return;
        }

        if (req.method === "GET" && pathname === "/auth/status") {
          writeJson(res, 200, { authenticated: !!request.session?.adminId });
          return;
        }

        if (req.method === "GET" && pathname === "/services") {
          writeJson(res, 200, { services: serviceCatalog });
          return;
        }

        if (req.method === "GET" && pathname === "/content") {
          try {
            const items = await listPublicContent();
            writeJson(res, 200, { items });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "GET" && pathname === "/admin/content") {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          try {
            const items = await listAdminContent();
            writeJson(res, 200, { items });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "POST" && pathname === "/admin/content") {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          try {
            const payload = await readJsonBody(req);
            if (!validateContentItem(payload)) {
              writeJson(res, 400, { success: false, error: "Invalid content item" });
              return;
            }

            const item = await createContentItem(payload);
            writeJson(res, 201, { success: true, item });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "PATCH" && pathname.startsWith("/admin/content/")) {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          const id = pathname.slice("/admin/content/".length);
          try {
            const payload = await readJsonBody(req);
            if (!id || id.length > 50 || !validateContentItem(payload)) {
              writeJson(res, 400, { success: false, error: "Invalid content item" });
              return;
            }

            const item = await updateContentItem(id, payload);
            writeJson(res, 200, { success: true, item });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "DELETE" && pathname.startsWith("/admin/content/")) {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          const id = pathname.slice("/admin/content/".length);
          if (!id || id.length > 50) {
            writeJson(res, 400, { success: false, error: "Invalid content item ID" });
            return;
          }

          try {
            await prisma.contentItem.delete({ where: { id } });
            writeJson(res, 200, { success: true });
          } catch {
            writeJson(res, 500, { success: false, error: "Failed to delete content item" });
          }
          return;
        }

        if (req.method === "GET" && pathname === "/reviews") {
          try {
            const url = new URL(req.url ?? "/", "http://localhost");
            const limit = Math.min(30, Math.max(1, parseInt(url.searchParams.get("limit") ?? "12", 10) || 12));
            const reviews = await listReviews(limit);
            writeJson(res, 200, { reviews });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "POST" && pathname === "/reviews") {
          try {
            const payload = await readJsonBody(req);
            if (!validateReview(payload)) {
              writeJson(res, 400, { success: false, error: "Invalid review payload" });
              return;
            }

            const review = await saveReview(payload);
            writeJson(res, 201, { success: true, review });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "GET" && pathname === "/admin/reviews") {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          try {
            const url = new URL(req.url ?? "/", "http://localhost");
            const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10) || 50));
            const reviews = await listAdminReviews(limit);
            writeJson(res, 200, { reviews });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "PATCH" && pathname.startsWith("/admin/reviews/")) {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          const id = pathname.slice("/admin/reviews/".length);
          try {
            const { status, adminNotes } = await readJsonBody(req);
            if (!id || id.length > 50 || !validateReviewStatus(status)) {
              writeJson(res, 400, { success: false, error: "Invalid review update" });
              return;
            }

            const review = await prisma.review.update({
              where: { id },
              data: { status, adminNotes: cleanOptionalText(adminNotes, 500) },
            });
            writeJson(res, 200, { success: true, review });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "DELETE" && pathname.startsWith("/admin/reviews/")) {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          const id = pathname.slice("/admin/reviews/".length);
          if (!id || id.length > 50) {
            writeJson(res, 400, { success: false, error: "Invalid review ID" });
            return;
          }

          try {
            await prisma.review.delete({ where: { id } });
            writeJson(res, 200, { success: true });
          } catch {
            writeJson(res, 500, { success: false, error: "Failed to delete review" });
          }
          return;
        }

        if (req.method === "POST" && pathname === "/bookings") {
          try {
            const payload = await readJsonBody(req);
            if (!validateBooking(payload)) {
              writeJson(res, 400, { success: false, error: "Invalid booking payload" });
              return;
            }

            const savedBooking = await saveBooking(payload);
            const trackingUrl = savedBooking.customerToken ? `${getPublicBaseUrl()}/track/${savedBooking.customerToken}` : "";

            emailService.sendBookingConfirmation(savedBooking).catch((error) => {
              console.error("Failed to send customer confirmation:", error);
            });

            emailService.sendAdminNotification(savedBooking).catch((error) => {
              console.error("Failed to send admin notification:", error);
            });

            writeJson(res, 201, { success: true, trackingUrl, email: { queued: true } });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "GET" && pathname.startsWith("/bookings/track/")) {
          const token = pathname.slice("/bookings/track/".length);
          if (!token || token.length > 80) {
            writeJson(res, 400, { success: false, error: "Invalid tracking link" });
            return;
          }

          try {
            const booking = await prisma.booking.findUnique({
              where: { customerToken: token },
            });

            if (!booking) {
              writeJson(res, 404, { success: false, error: "Booking not found" });
              return;
            }

            const safeBooking = toBooking(booking);
            writeJson(res, 200, {
              booking: {
                id: safeBooking.id,
                name: safeBooking.name,
                repairType: safeBooking.repairType,
                preferredDate: safeBooking.preferredDate,
                status: safeBooking.status,
                appointmentTime: safeBooking.appointmentTime,
                quoteAmount: safeBooking.quoteAmount,
                staffAssigned: safeBooking.staffAssigned,
                statusHistory: safeBooking.statusHistory,
                createdAt: safeBooking.createdAt,
                updatedAt: safeBooking.updatedAt,
              },
            });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "GET" && pathname === "/bookings") {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          try {
            const url = new URL(req.url ?? "/", "http://localhost");
            const search = url.searchParams.get("search");
            const status = url.searchParams.get("status");
            const page = url.searchParams.get("page") ?? "1";
            const limit = url.searchParams.get("limit") ?? "50";

            const pageNum = Math.max(1, parseInt(page, 10) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

            const where: any = {};

            if (search) {
              where.OR = [
                { name: { contains: search } },
                { email: { contains: search } },
                { phone: { contains: search } },
                { address: { contains: search } },
              ];
            }

            if (status && status !== "ALL" && validateBookingStatus(status)) {
              where.status = status;
            }

            const [bookings, totalCount] = await Promise.all([
              prisma.booking.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
              }),
              prisma.booking.count({ where }),
            ]);

            writeJson(res, 200, {
              bookings: bookings.map(toBooking),
              pagination: {
                page: pageNum,
                limit: limitNum,
                total: totalCount,
                pages: Math.ceil(totalCount / limitNum),
              },
            });
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "GET" && pathname === "/bookings/export") {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          try {
            const bookings = (await prisma.booking.findMany({
              orderBy: { createdAt: "desc" },
            })).map(toBooking);
            const headers = [
              "ID",
              "Name",
              "Phone",
              "Email",
              "Address",
              "Service",
              "Status",
              "Preferred Date",
              "Appointment Time",
              "Quote Amount",
              "Staff Assigned",
              "Budget",
              "Dimensions",
              "Quantity",
              "Delivery Needed",
              "Installation Needed",
              "Message",
              "Created At",
            ];
            const rows = bookings.map((booking) => [
              booking.id,
              booking.name,
              booking.phone,
              booking.email,
              booking.address,
              booking.repairType,
              booking.status,
              booking.preferredDate,
              booking.appointmentTime,
              booking.quoteAmount,
              booking.staffAssigned,
              booking.budget,
              booking.dimensions,
              booking.quantity,
              booking.deliveryNeeded,
              booking.installationNeeded,
              booking.message,
              booking.createdAt,
            ]);
            const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
            res.writeHead(200, {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": "attachment; filename=\"fixmydoor-bookings.csv\"",
            });
            res.end(csv);
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "GET" && pathname === "/stats") {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          try {
            writeJson(res, 200, await getStats());
          } catch (error) {
            writeJson(res, 500, { success: false, error: String(error) });
          }
          return;
        }

        if (req.method === "PATCH" && pathname.startsWith("/bookings/")) {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          const id = pathname.slice("/bookings/".length);
          if (!id || id.length > 50) {
            writeJson(res, 400, { success: false, error: "Invalid booking ID" });
            return;
          }

          try {
            const update = await readJsonBody(req) as BookingUpdateRequest;
            const { status } = update;
            if (status !== undefined && !validateBookingStatus(status)) {
              writeJson(res, 400, { success: false, error: "Invalid status" });
              return;
            }

            const existingBooking = await prisma.booking.findUnique({ where: { id } });
            if (!existingBooking) {
              writeJson(res, 404, { success: false, error: "Booking not found" });
              return;
            }

            const previousStatus = existingBooking.status as Booking["status"];
            const nextStatus = status || previousStatus;
            const history = parseStatusHistory(existingBooking.statusHistory);

            if (status && status !== previousStatus) {
              history.push({
                status,
                changedAt: new Date().toISOString(),
                note: cleanOptionalText(update.adminNotes, 300) || "Status updated by admin",
              } as BookingStatusHistoryEntry);
            }

            const updateData: Record<string, unknown> = {
              status: nextStatus,
              statusHistory: serializeStatusHistory(history),
            };

            if ("appointmentTime" in update) updateData.appointmentTime = cleanOptionalText(update.appointmentTime, 160);
            if ("quoteAmount" in update) updateData.quoteAmount = cleanOptionalText(update.quoteAmount, 80);
            if ("staffAssigned" in update) updateData.staffAssigned = cleanOptionalText(update.staffAssigned, 120);
            if ("adminNotes" in update) updateData.adminNotes = cleanOptionalText(update.adminNotes, 1000);

            const booking = await prisma.booking.update({
              where: { id },
              data: updateData,
            });
            const normalizedBooking = toBooking(booking);

            if (status && status !== previousStatus) {
              emailService.sendStatusUpdate(normalizedBooking).catch((error) => {
                console.error("Failed to send status update email:", error);
              });
            }

            writeJson(res, 200, normalizedBooking);
          } catch {
            writeJson(res, 500, { success: false, error: "Failed to update booking" });
          }
          return;
        }

        if (req.method === "DELETE" && pathname.startsWith("/bookings/")) {
          if (!request.session?.adminId) {
            writeJson(res, 401, { success: false, error: "Authentication required" });
            return;
          }

          const id = pathname.slice("/bookings/".length);
          if (!id || id.length > 50) {
            writeJson(res, 400, { success: false, error: "Invalid booking ID" });
            return;
          }

          try {
            await prisma.booking.delete({
              where: { id },
            });
            writeJson(res, 200, { success: true });
          } catch {
            writeJson(res, 500, { success: false, error: "Failed to delete booking" });
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(({ command }) => {
  const isServe = command === "serve";
  const plugins = [
    react(),
    tailwindcss(),
    ...(isServe
      ? [
          jsxLocPlugin(),
          vitePluginManusRuntime(),
          vitePluginManusDebugCollector(),
          vitePluginStorageProxy(),
          vitePluginBookingApi(),
        ]
      : []),
  ];

  return {
    plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "wouter"],
          forms: ["react-hook-form", "zod", "@hookform/resolvers"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-checkbox", "lucide-react"],
          motion: ["framer-motion"],
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: false, // Will find next available port if 3000 is busy
    open: true,
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  };
});
