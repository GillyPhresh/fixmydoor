import express from "express";
import session from "express-session";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { randomUUID } from "crypto";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { parseStatusHistory, saveBooking, serializeStatusHistory, toBooking, validateBooking, validateBookingStatus } from "./bookings";
import { listAdminReviews, listReviews, saveReview, validateReview, validateReviewStatus } from "./reviews";
import { createContentItem, listAdminContent, listPublicContent, updateContentItem, validateContentItem } from "./content";
import { prisma } from "./prisma";
import { findAdminByUsername, initializeAdminUser, verifyPassword, hashPassword } from "./auth";
import { emailService } from "./email";
import type { Booking, BookingStatusHistoryEntry, BookingUpdateRequest } from "@shared/types";
import { serviceCatalog } from "@shared/services";

if (fs.existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = process.env.UPLOAD_DIR || (process.env.NODE_ENV === "production" ? "/data/uploads" : path.resolve(process.cwd(), "uploads"));
const mediaTypes: Record<string, { extension: string; kind: "image" | "video" }> = {
  "image/png": { extension: "png", kind: "image" },
  "image/jpeg": { extension: "jpg", kind: "image" },
  "image/jpg": { extension: "jpg", kind: "image" },
  "image/webp": { extension: "webp", kind: "image" },
  "video/mp4": { extension: "mp4", kind: "video" },
  "video/webm": { extension: "webm", kind: "video" },
  "video/ogg": { extension: "ogg", kind: "video" },
};

function saveDataUrlMedia(dataUrl: unknown, options: { allowVideo: boolean; maxBytes: number }) {
  if (typeof dataUrl !== "string") {
    throw new Error("Missing media data");
  }

  const match = dataUrl.match(/^data:([^;]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error("Invalid media data");
  }

  const mimeType = match[1].toLowerCase();
  const mediaType = mediaTypes[mimeType];
  if (!mediaType || (!options.allowVideo && mediaType.kind === "video")) {
    throw new Error("Unsupported media type");
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > options.maxBytes) {
    throw new Error("Media file is too large");
  }

  fs.mkdirSync(uploadDir, { recursive: true });
  const fileName = `${Date.now()}-${randomUUID()}.${mediaType.extension}`;
  fs.writeFileSync(path.join(uploadDir, fileName), buffer, { flag: "wx" });

  return `/uploads/${fileName}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isInternationalBooking(booking: Booking) {
  const country = (booking.country || "").trim().toLowerCase();
  const scope = (booking.requestScope || "").trim().toLowerCase();
  return Boolean(
    scope.includes("international") ||
    (country && !["canada", "ca", "can"].includes(country))
  );
}

function matchesWorkflowFilter(booking: Booking, workflow: string) {
  switch (workflow) {
    case "INTERNATIONAL":
      return isInternationalBooking(booking);
    case "URGENT":
      return /urgent|same-day|emergency/i.test(booking.urgency || "");
    case "NEEDS_QUOTE":
      return !booking.quoteAmount;
    case "QUOTED":
      return Boolean(booking.quoteAmount);
    case "SCHEDULED":
      return Boolean(booking.appointmentTime);
    case "PAYMENT_PENDING":
      return Boolean(booking.quoteAmount) && !/^\s*paid\s*$/i.test(booking.paymentStatus || "");
    default:
      return true;
  }
}

async function executeSchemaStatement(sql: string) {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch (error: any) {
    const message = String(error?.message || error);
    if (!/duplicate column name|already exists/i.test(message)) {
      throw error;
    }
  }
}

async function ensureDatabaseCompatibility() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "Booking" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "phone" TEXT NOT NULL,
      "email" TEXT NOT NULL DEFAULT '',
      "address" TEXT NOT NULL,
      "city" TEXT,
      "country" TEXT,
      "timeZone" TEXT,
      "preferredContactMethod" TEXT,
      "urgency" TEXT,
      "requestScope" TEXT,
      "currency" TEXT,
      "repairType" TEXT NOT NULL,
      "preferredDate" TEXT,
      "message" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "customerToken" TEXT,
      "photos" TEXT,
      "dimensions" TEXT,
      "quantity" TEXT,
      "material" TEXT,
      "color" TEXT,
      "swingDirection" TEXT,
      "deliveryNeeded" TEXT,
      "installationNeeded" TEXT,
      "budget" TEXT,
      "customerConsent" BOOLEAN NOT NULL DEFAULT 0,
      "appointmentTime" TEXT,
      "quoteAmount" TEXT,
      "quoteNotes" TEXT,
      "invoiceStatus" TEXT,
      "paymentStatus" TEXT,
      "staffAssigned" TEXT,
      "adminNotes" TEXT,
      "statusHistory" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Booking" ADD COLUMN "email" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "Booking" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PENDING'`,
    `ALTER TABLE "Booking" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `ALTER TABLE "Booking" ADD COLUMN "customerToken" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "photos" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "dimensions" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "quantity" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "material" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "color" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "swingDirection" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "deliveryNeeded" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "installationNeeded" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "budget" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "customerConsent" BOOLEAN NOT NULL DEFAULT 0`,
    `ALTER TABLE "Booking" ADD COLUMN "appointmentTime" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "quoteAmount" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "quoteNotes" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "invoiceStatus" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "paymentStatus" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "staffAssigned" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "adminNotes" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "statusHistory" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "city" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "country" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "timeZone" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "preferredContactMethod" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "urgency" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "requestScope" TEXT`,
    `ALTER TABLE "Booking" ADD COLUMN "currency" TEXT`,
    `CREATE TABLE IF NOT EXISTS "Admin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "username" TEXT NOT NULL,
      "password" TEXT NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Session" (
      "sid" TEXT NOT NULL PRIMARY KEY,
      "data" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Session" ADD COLUMN "createdAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `ALTER TABLE "Session" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `CREATE TABLE IF NOT EXISTS "Review" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "location" TEXT,
      "rating" INTEGER NOT NULL DEFAULT 5,
      "quote" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'APPROVED',
      "adminNotes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "Review" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED'`,
    `ALTER TABLE "Review" ADD COLUMN "adminNotes" TEXT`,
    `CREATE TABLE IF NOT EXISTS "ContentItem" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "category" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "tag" TEXT,
      "image" TEXT,
      "accentImage" TEXT,
      "items" TEXT,
      "bookingValue" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "active" BOOLEAN NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "ContentItem" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00'`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Admin_username_key" ON "Admin"("username")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Booking_customerToken_key" ON "Booking"("customerToken")`,
    `CREATE INDEX IF NOT EXISTS "Booking_status_idx" ON "Booking"("status")`,
    `CREATE INDEX IF NOT EXISTS "Booking_createdAt_idx" ON "Booking"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Booking_name_idx" ON "Booking"("name")`,
    `CREATE INDEX IF NOT EXISTS "Booking_email_idx" ON "Booking"("email")`,
    `CREATE INDEX IF NOT EXISTS "Booking_phone_idx" ON "Booking"("phone")`,
    `CREATE INDEX IF NOT EXISTS "Booking_customerToken_idx" ON "Booking"("customerToken")`,
    `CREATE INDEX IF NOT EXISTS "Booking_country_idx" ON "Booking"("country")`,
    `CREATE INDEX IF NOT EXISTS "Booking_urgency_idx" ON "Booking"("urgency")`,
    `CREATE INDEX IF NOT EXISTS "Booking_invoiceStatus_idx" ON "Booking"("invoiceStatus")`,
    `CREATE INDEX IF NOT EXISTS "Booking_paymentStatus_idx" ON "Booking"("paymentStatus")`,
    `CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt")`,
    `CREATE INDEX IF NOT EXISTS "Review_createdAt_idx" ON "Review"("createdAt")`,
    `CREATE INDEX IF NOT EXISTS "Review_rating_idx" ON "Review"("rating")`,
    `CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review"("status")`,
    `CREATE INDEX IF NOT EXISTS "ContentItem_category_idx" ON "ContentItem"("category")`,
    `CREATE INDEX IF NOT EXISTS "ContentItem_active_idx" ON "ContentItem"("active")`,
    `CREATE INDEX IF NOT EXISTS "ContentItem_sortOrder_idx" ON "ContentItem"("sortOrder")`,
  ];

  for (const statement of statements) {
    await executeSchemaStatement(statement);
  }
}

class PrismaSessionStore extends session.Store {
  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void) {
    prisma.session.findUnique({ where: { sid } })
      .then(async (record) => {
        if (!record) {
          callback(null, null);
          return;
        }

        if (record.expiresAt <= new Date()) {
          await prisma.session.delete({ where: { sid } }).catch(() => undefined);
          callback(null, null);
          return;
        }

        callback(null, JSON.parse(record.data));
      })
      .catch((error) => callback(error));
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    prisma.session.upsert({
      where: { sid },
      create: { sid, data: JSON.stringify(sessionData), expiresAt },
      update: { data: JSON.stringify(sessionData), expiresAt },
    })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (err?: any) => void) {
    prisma.session.deleteMany({ where: { sid } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void) {
    const expiresAt = sessionData.cookie?.expires
      ? new Date(sessionData.cookie.expires)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    prisma.session.updateMany({ where: { sid }, data: { expiresAt } })
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }
}

function normalizeOrigin(value?: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return "";
  }
}

function allowedOriginsForRequest(req: express.Request) {
  const host = req.get("host");
  const origins = new Set([
    normalizeOrigin(process.env.PUBLIC_SITE_URL),
    normalizeOrigin(process.env.ADMIN_URL),
    normalizeOrigin(process.env.VITE_PUBLIC_SITE_URL),
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ].filter(Boolean));

  if (host) {
    origins.add(`${req.protocol}://${host}`);
  }

  return origins;
}

function renderQuoteInvoiceHtml(booking: Booking, nonce: string) {
  const lineItems = (booking.quoteNotes || "Labour, materials, sourcing, delivery, or installation details will be confirmed by FixMyDoor.").split(/\r?\n/).filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FixMyDoor Quote / Invoice - ${escapeHtml(booking.id)}</title>
  <style>
    body { margin: 0; background: #f7efe4; color: #2f241c; font-family: Arial, sans-serif; }
    .page { max-width: 860px; margin: 24px auto; background: #fffaf2; border: 1px solid #ead8bf; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 60px rgba(47,36,28,.14); }
    header { display: flex; justify-content: space-between; gap: 24px; align-items: center; background: #2f241c; color: white; padding: 28px; }
    header img { width: 160px; max-width: 40vw; background: white; border-radius: 16px; padding: 8px 12px; }
    main { padding: 28px; }
    h1, h2, h3 { margin: 0; color: #6B4423; }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
    .box { background: #f5f1e8; border-radius: 16px; padding: 14px; }
    .label { color: #7b6758; font-size: 12px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .value { margin-top: 6px; font-weight: 700; }
    .total { margin: 20px 0; padding: 20px; border-radius: 18px; background: #2f241c; color: white; display: flex; justify-content: space-between; gap: 16px; align-items: center; }
    .total strong { font-size: 28px; }
    ul { margin: 12px 0 0; padding-left: 20px; line-height: 1.7; }
    .actions { margin-top: 24px; display: flex; gap: 10px; }
    button { border: 0; border-radius: 12px; background: #b46532; color: white; padding: 12px 16px; font-weight: 800; cursor: pointer; }
    @media print { body { background: white; } .page { margin: 0; box-shadow: none; border: 0; } .actions { display: none; } }
    @media (max-width: 640px) { header, .grid { grid-template-columns: 1fr; display: grid; } }
  </style>
</head>
<body>
  <section class="page">
    <header>
      <div>
        <img src="/img5150-transparent.png" alt="FixMyDoor" />
        <p>Door & Furniture Repair Services</p>
      </div>
      <div>
        <h1 style="color:white;">Quote / Invoice</h1>
        <p>Booking ID: ${escapeHtml(booking.id)}</p>
        <p>Date: ${escapeHtml(new Date().toLocaleDateString())}</p>
      </div>
    </header>
    <main>
      <div class="grid">
        <div class="box"><div class="label">Customer</div><div class="value">${escapeHtml(booking.name)}</div></div>
        <div class="box"><div class="label">Contact</div><div class="value">${escapeHtml(booking.phone)}<br>${escapeHtml(booking.email)}</div></div>
        <div class="box"><div class="label">Location</div><div class="value">${escapeHtml([booking.city, booking.country].filter(Boolean).join(", ") || booking.address)}</div></div>
        <div class="box"><div class="label">Request</div><div class="value">${escapeHtml(booking.repairType)}</div></div>
        <div class="box"><div class="label">Invoice Status</div><div class="value">${escapeHtml(booking.invoiceStatus || "Not issued")}</div></div>
        <div class="box"><div class="label">Payment Status</div><div class="value">${escapeHtml(booking.paymentStatus || "Not paid")}</div></div>
      </div>
      <div class="total"><span>Estimated Amount</span><strong>${escapeHtml(booking.quoteAmount || "To be confirmed")}</strong></div>
      <div class="box">
        <h2>Quote Details</h2>
        <ul>${lineItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </div>
      <div class="box" style="margin-top:14px;">
        <h3>Notes</h3>
        <p>This quote/invoice is prepared from the booking details. Final cost may change if measurements, parts, delivery, or installation requirements change.</p>
        <p><strong>FixMyDoor Services</strong><br>info.fixmydoor@gmail.com<br>+1 (438) 347-1823</p>
      </div>
      <div class="actions"><button id="print-quote" type="button">Print / Save PDF</button></div>
    </main>
  </section>
  <script nonce="${nonce}">
    document.getElementById("print-quote")?.addEventListener("click", () => window.print());
  </script>
</body>
</html>`;
}

// Validate Database URL for production
if (!process.env.DATABASE_URL) {
  console.error("[ERROR] DATABASE_URL environment variable is missing.");
}

// Validate critical environment variables
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || sessionSecret.length < 32) {
  console.error("[ERROR] SESSION_SECRET must be set and at least 32 characters long");
  console.error("Generate a secure secret with: openssl rand -base64 32");
  process.exit(1);
}

async function startServer() {
  // Run database migrations in production
  if (process.env.NODE_ENV === "production") {
    try {
      console.log("Running database migrations...");
      execSync("npx prisma migrate deploy", { stdio: "inherit" });
      console.log("Database migrations completed.");
    } catch (error) {
      console.error("Database migration failed:", error);
      // Don't exit - the app might still work if schema is up to date
    }
  }

  try {
    console.log("Checking database compatibility...");
    await ensureDatabaseCompatibility();
    console.log("Database compatibility check completed.");
  } catch (error) {
    console.error("Database compatibility check failed:", error);
    throw error;
  }

  const app = express();
  const server = createServer(app);
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  // Initialize admin user
  await initializeAdminUser();

  // Initialize email service
  emailService.initialize();

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "http:"],
        mediaSrc: ["'self'", "data:", "https:", "http:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: "Too many login attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Too many uploads from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);

  // Compression
  app.use(compression());

  app.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    const origin = normalizeOrigin(req.get("origin"));
    if (!origin || allowedOriginsForRequest(req).has(origin)) {
      return next();
    }

    return res.status(403).json({ success: false, error: "Request origin is not allowed" });
  });

  // Session configuration
  app.use(session({
    store: new PrismaSessionStore(),
    secret: sessionSecret as string,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      secure: isProduction, // Use HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
    name: "fixmydoor.sid", // Change default session name
  }));

  prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((error) => {
    console.error("Expired session cleanup failed:", error);
  });
  const sessionCleanupTimer = setInterval(() => {
    prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch((error) => {
      console.error("Expired session cleanup failed:", error);
    });
  }, 60 * 60 * 1000);
  sessionCleanupTimer.unref?.();

  app.use(express.json({ limit: "8mb" })); // Limit request body size
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir, {
    maxAge: isProduction ? "30d" : 0,
  }));
  app.use("/api/media", uploadLimiter);
  app.use("/api/admin/media", uploadLimiter);

  // Auth middleware
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.session.adminId) {
      return next();
    }
    res.status(401).json({ success: false, error: "Authentication required" });
  }

  function cleanOptionalText(value: unknown, maxLength = 1000) {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim().slice(0, maxLength)
      : null;
  }

  function csvValue(value: unknown) {
    const safeValue = String(value ?? "").replace(/"/g, '""');
    return `"${safeValue}"`;
  }

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    const payload = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      checks: {
        database: "connected",
      },
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.json(payload);
    } catch (error) {
      console.error("Health check failed:", error);

      return res.json({
        ...payload,
        status: "degraded",
        checks: {
          database: "unavailable",
        },
      });
    }
  });

  // Auth routes with rate limiting
  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required" });
    }

    // Input validation
    if (typeof username !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, error: "Invalid input format" });
    }

    if (username.length > 50 || password.length > 100) {
      return res.status(400).json({ success: false, error: "Input too long" });
    }

    try {
      const admin = await findAdminByUsername(username);
      if (!admin) {
        // Don't reveal if username exists - constant time response
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50)); // Random delay
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      const isValidPassword = await verifyPassword(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      req.session.adminId = admin.id;
      res.json({ success: true });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: "Logout failed" });
      }
      res.clearCookie("fixmydoor.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ authenticated: !!req.session.adminId });
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Current and new password required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: "New password must be at least 8 characters long" });
    }

    try {
      const admin = await prisma.admin.findUnique({
        where: { id: req.session.adminId },
      });

      if (!admin || !(await verifyPassword(currentPassword, admin.password))) {
        return res.status(401).json({ success: false, error: "Current password is incorrect" });
      }

      const hashedPassword = await hashPassword(newPassword);
      await prisma.admin.update({
        where: { id: admin.id },
        data: { password: hashedPassword },
      });

      res.json({ success: true, message: "Password changed successfully" });
    } catch (error) {
      console.error("Password change error:", error);
      res.status(500).json({ success: false, error: "Failed to change password" });
    }
  });

  app.post("/api/admin/email-test", requireAuth, async (_req, res) => {
    try {
      const sent = await emailService.sendTestEmail();
      if (!sent) {
        return res.status(500).json({
          success: false,
          error: "Email test failed. Check SMTP_HOST, SMTP_USER, SMTP_PASS, FROM_EMAIL, BUSINESS_EMAIL, and ADMIN_EMAIL in Railway.",
        });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error("Email test error:", error);
      return res.status(500).json({ success: false, error: "Email test failed" });
    }
  });

  // Booking endpoints
  app.get("/api/services", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ services: serviceCatalog });
  });

  app.get("/api/content", async (_req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const items = await listPublicContent();
      return res.json({ items });
    } catch (error) {
      console.error("Content load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load content" });
    }
  });

  app.post("/api/media", async (req, res) => {
    try {
      const url = saveDataUrlMedia(req.body?.dataUrl, { allowVideo: false, maxBytes: 1_800_000 });
      return res.status(201).json({ success: true, url });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error?.message || "Invalid media upload" });
    }
  });

  app.post("/api/admin/media", requireAuth, async (req, res) => {
    try {
      const url = saveDataUrlMedia(req.body?.dataUrl, { allowVideo: true, maxBytes: 5_500_000 });
      return res.status(201).json({ success: true, url });
    } catch (error: any) {
      return res.status(400).json({ success: false, error: error?.message || "Invalid media upload" });
    }
  });

  app.get("/api/admin/content", requireAuth, async (_req, res) => {
    try {
      const items = await listAdminContent();
      return res.json({ items });
    } catch (error) {
      console.error("Admin content load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load content" });
    }
  });

  app.post("/api/admin/content", requireAuth, async (req, res) => {
    if (!validateContentItem(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid content item" });
    }

    try {
      const item = await createContentItem(req.body);
      return res.status(201).json({ success: true, item });
    } catch (error) {
      console.error("Content creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to create content item" });
    }
  });

  app.patch("/api/admin/content/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 50 || !validateContentItem(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid content item" });
    }

    try {
      const item = await updateContentItem(id, req.body);
      return res.json({ success: true, item });
    } catch (error) {
      console.error("Content update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update content item" });
    }
  });

  app.delete("/api/admin/content/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    if (!id || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid content item ID" });
    }

    try {
      await prisma.contentItem.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("Content deletion error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete content item" });
    }
  });

  app.get("/api/reviews", async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      const limit = Math.min(30, Math.max(1, parseInt(req.query.limit as string, 10) || 12));
      const reviews = await listReviews(limit);
      return res.json({ reviews });
    } catch (error) {
      console.error("Review load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load reviews" });
    }
  });

  app.post("/api/reviews", async (req, res) => {
    if (!validateReview(req.body)) {
      return res.status(400).json({ success: false, error: "Invalid review data" });
    }

    try {
      const review = await saveReview(req.body);
      return res.status(201).json({ success: true, review });
    } catch (error) {
      console.error("Review creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to save review" });
    }
  });

  app.get("/api/admin/reviews", requireAuth, async (req, res) => {
    try {
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const reviews = await listAdminReviews(limit);
      return res.json({ reviews });
    } catch (error) {
      console.error("Admin review load error:", error);
      return res.status(500).json({ success: false, error: "Failed to load reviews" });
    }
  });

  app.patch("/api/admin/reviews/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!id || id.length > 50 || !validateReviewStatus(status)) {
      return res.status(400).json({ success: false, error: "Invalid review update" });
    }

    try {
      const review = await prisma.review.update({
        where: { id },
        data: {
          status,
          adminNotes: cleanOptionalText(adminNotes, 500),
        },
      });
      return res.json({ success: true, review });
    } catch (error) {
      console.error("Review update error:", error);
      return res.status(500).json({ success: false, error: "Failed to update review" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!id || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid review ID" });
    }

    try {
      await prisma.review.delete({ where: { id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("Review deletion error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete review" });
    }
  });

  app.post("/api/bookings", async (req, res) => {
    const booking = req.body;
    if (!validateBooking(booking)) {
      return res.status(400).json({ success: false, error: "Invalid booking data" });
    }

    try {
      const savedBooking = await saveBooking(booking) as Booking;

      Promise.allSettled([
        emailService.sendBookingConfirmation(savedBooking),
        emailService.sendAdminNotification(savedBooking),
      ]).then((results) => {
        const [customerResult, adminResult] = results;
        const customerEmailSent = customerResult.status === "fulfilled" && customerResult.value === true;
        const adminEmailSent = adminResult.status === "fulfilled" && adminResult.value === true;

        if (!customerEmailSent || !adminEmailSent) {
          console.error("Booking saved, but one or more emails failed.", {
            bookingId: savedBooking.id,
            customerEmailSent,
            adminEmailSent,
          });
        }
      });

      return res.status(201).json({
        success: true,
        email: {
          queued: true,
        },
      });
    } catch (error) {
      console.error("Booking creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to create booking" });
    }
  });

  app.get("/api/bookings/track/:token", async (req, res) => {
    const { token } = req.params;
    if (!token || token.length > 80) {
      return res.status(400).json({ success: false, error: "Invalid tracking link" });
    }

    try {
      const booking = await prisma.booking.findUnique({
        where: { customerToken: token },
      });

      if (!booking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
      }

      const safeBooking = toBooking(booking);
      return res.json({
        booking: {
          id: safeBooking.id,
          name: safeBooking.name,
          repairType: safeBooking.repairType,
          preferredDate: safeBooking.preferredDate,
          status: safeBooking.status,
          appointmentTime: safeBooking.appointmentTime,
          quoteAmount: safeBooking.quoteAmount,
          invoiceStatus: safeBooking.invoiceStatus,
          paymentStatus: safeBooking.paymentStatus,
          staffAssigned: safeBooking.staffAssigned,
          statusHistory: safeBooking.statusHistory,
          createdAt: safeBooking.createdAt,
          updatedAt: safeBooking.updatedAt,
        },
      });
    } catch (error) {
      console.error("Booking tracking error:", error);
      return res.status(500).json({ success: false, error: "Failed to load booking status" });
    }
  });

  app.get("/api/bookings", requireAuth, async (req, res) => {
    try {
      const { search, status, workflow = "ALL", page = "1", limit = "50" } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));

      let where: any = {};

      if (search && typeof search === "string" && search.length > 0 && search.length <= 100) {
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

      const workflowFilter = typeof workflow === "string" ? workflow : "ALL";
      let bookings: any[] = [];
      let totalCount = 0;

      if (workflowFilter && workflowFilter !== "ALL") {
        const allMatchingBookings = (await prisma.booking.findMany({
          where,
          orderBy: { createdAt: "desc" },
        })).map(toBooking).filter((booking) => matchesWorkflowFilter(booking, workflowFilter));

        totalCount = allMatchingBookings.length;
        bookings = allMatchingBookings.slice((pageNum - 1) * limitNum, pageNum * limitNum);
      } else {
        const [pagedBookings, count] = await Promise.all([
          prisma.booking.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip: (pageNum - 1) * limitNum,
            take: limitNum,
          }),
          prisma.booking.count({ where }),
        ]);

        bookings = pagedBookings;
        totalCount = count;
      }

      return res.json({
        bookings: bookings.map((booking) => "statusHistory" in booking && Array.isArray(booking.statusHistory) ? booking : toBooking(booking)),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          pages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching bookings:", error);
      return res.status(500).json({ success: false, error: "Failed to load bookings" });
    }
  });

  app.get("/api/bookings/export", requireAuth, async (_req, res) => {
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
        "City",
        "Country",
        "Time Zone",
        "Preferred Contact",
        "Urgency",
        "Request Scope",
        "Service",
        "Status",
        "Preferred Date",
        "Appointment Time",
        "Quote Amount",
        "Invoice Status",
        "Payment Status",
        "Staff Assigned",
        "Currency",
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
        booking.city,
        booking.country,
        booking.timeZone,
        booking.preferredContactMethod,
        booking.urgency,
        booking.requestScope,
        booking.repairType,
        booking.status,
        booking.preferredDate,
        booking.appointmentTime,
        booking.quoteAmount,
        booking.invoiceStatus,
        booking.paymentStatus,
        booking.staffAssigned,
        booking.currency,
        booking.budget,
        booking.dimensions,
        booking.quantity,
        booking.deliveryNeeded,
        booking.installationNeeded,
        booking.message,
        booking.createdAt,
      ]);

      const csv = [headers, ...rows]
        .map((row) => row.map(csvValue).join(","))
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=\"fixmydoor-bookings.csv\"");
      return res.send(csv);
    } catch (error) {
      console.error("Booking export error:", error);
      return res.status(500).json({ success: false, error: "Failed to export bookings" });
    }
  });

  app.get("/api/bookings/:id/quote", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).send("Invalid booking ID");
    }

    try {
      const booking = await prisma.booking.findUnique({ where: { id } });
      if (!booking) {
        return res.status(404).send("Booking not found");
      }

      const nonce = randomUUID().replace(/-/g, "");
      res.setHeader(
        "Content-Security-Policy",
        `default-src 'self'; img-src 'self' data: https: http:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'`,
      );
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(renderQuoteInvoiceHtml(toBooking(booking), nonce));
    } catch (error) {
      console.error("Quote invoice render error:", error);
      return res.status(500).send("Failed to render quote/invoice");
    }
  });

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const update = req.body as BookingUpdateRequest;
    const { status } = update;

    // Validate ID format
    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    if (status !== undefined && !validateBookingStatus(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    try {
      const existingBooking = await prisma.booking.findUnique({ where: { id } });
      if (!existingBooking) {
        return res.status(404).json({ success: false, error: "Booking not found" });
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
      if ("quoteNotes" in update) updateData.quoteNotes = cleanOptionalText(update.quoteNotes, 1000);
      if ("invoiceStatus" in update) updateData.invoiceStatus = cleanOptionalText(update.invoiceStatus, 80);
      if ("paymentStatus" in update) updateData.paymentStatus = cleanOptionalText(update.paymentStatus, 80);
      if ("staffAssigned" in update) updateData.staffAssigned = cleanOptionalText(update.staffAssigned, 120);
      if ("adminNotes" in update) updateData.adminNotes = cleanOptionalText(update.adminNotes, 1000);

      const booking = await prisma.booking.update({
        where: { id },
        data: updateData,
      });
      const normalizedBooking = toBooking(booking);

      if (status && status !== previousStatus) {
        emailService.sendStatusUpdate(normalizedBooking).catch(err =>
          console.error("Failed to send status update email:", err)
        );
      }

      res.json(normalizedBooking);
    } catch (error) {
      console.error("Error updating booking:", error);
      res.status(500).json({ success: false, error: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    try {
      await prisma.booking.delete({
        where: { id },
      });
      return res.json({ success: true });
    } catch (error) {
      console.error("Error deleting booking:", error);
      return res.status(500).json({ success: false, error: "Failed to delete booking" });
    }
  });

  app.get("/api/stats", requireAuth, async (req, res) => {
    try {
      const [
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        internationalBookings,
        urgentBookings,
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
            OR: [
              { requestScope: { contains: "International" } },
              { country: { notIn: ["Canada", "canada", "CA", "ca", ""] } },
            ],
          } as any,
        }),
        prisma.booking.count({
          where: {
            OR: [
              { urgency: { contains: "Urgent" } },
              { urgency: { contains: "Emergency" } },
              { urgency: { contains: "Same-day" } },
            ],
          } as any,
        }),
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

      // Get recent bookings
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

      res.json({
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        internationalBookings,
        urgentBookings,
        todayBookings,
        thisWeekBookings,
        thisMonthBookings,
        recentBookings,
      });
    } catch (error) {
      console.error("Stats fetch error:", error);
      res.status(500).json({ success: false, error: "Failed to fetch statistics" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath, {
    maxAge: isProduction ? "1y" : 0, // Cache static assets for 1 year in production
    setHeaders: (res, path) => {
      if (isProduction && path.endsWith(".js")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (isProduction && path.endsWith(".css")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      }
    },
  }));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
