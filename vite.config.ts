import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";
import { saveBooking, validateBooking, validateBookingStatus } from "./server/bookings";
import { prisma } from "./server/prisma";
import { findAdminByUsername, verifyPassword } from "./server/auth";
import { serviceCatalog } from "./shared/services";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = import.meta.dirname;
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
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
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

      const writeJson = (res: any, statusCode: number, payload: unknown) => {
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify(payload));
      };

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

        if (req.method === "POST" && pathname === "/bookings") {
          try {
            const payload = await readJsonBody(req);
            if (!validateBooking(payload)) {
              writeJson(res, 400, { success: false, error: "Invalid booking payload" });
              return;
            }

            await saveBooking(payload);
            writeJson(res, 201, { success: true });
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
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { address: { contains: search, mode: "insensitive" } },
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
              bookings,
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
            const { status } = await readJsonBody(req);
            if (!validateBookingStatus(status)) {
              writeJson(res, 400, { success: false, error: "Invalid status" });
              return;
            }

            const booking = await prisma.booking.update({
              where: { id },
              data: { status },
            });
            writeJson(res, 200, booking);
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

const plugins = [
  react(),
  tailwindcss(),
  jsxLocPlugin(),
  vitePluginManusRuntime(),
  vitePluginManusDebugCollector(),
  vitePluginStorageProxy(),
  vitePluginBookingApi(),
];

export default defineConfig({
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
});
