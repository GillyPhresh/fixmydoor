import express from "express";
import session from "express-session";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import compression from "compression";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { saveBooking, validateBooking, validateBookingStatus } from "./bookings";
import { prisma } from "./prisma";
import { findAdminByUsername, initializeAdminUser, verifyPassword, hashPassword } from "./auth";
import { emailService } from "./email";
import type { Booking } from "@shared/types";

process.loadEnvFile?.();

declare module "express-session" {
  interface SessionData {
    adminId?: string;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  const app = express();
  const server = createServer(app);

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

  app.use(limiter);

  // Compression
  app.use(compression());

  // Session configuration
  const isProduction = process.env.NODE_ENV === "production";
  app.use(session({
    secret: sessionSecret as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // Use HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "strict",
    },
    name: "fixmydoor.sid", // Change default session name
  }));

  app.use(express.json({ limit: "10mb" })); // Limit request body size

  // Auth middleware
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.session.adminId) {
      return next();
    }
    res.status(401).json({ success: false, error: "Authentication required" });
  }

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Check database connectivity
      await prisma.$queryRaw`SELECT 1`;

      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(503).json({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Database connection failed",
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

  // Booking endpoints
  app.post("/api/bookings", async (req, res) => {
    const booking = req.body;
    if (!validateBooking(booking)) {
      return res.status(400).json({ success: false, error: "Invalid booking data" });
    }

    try {
      const savedBooking = await saveBooking(booking) as Booking;

      // Send confirmation email to customer (async, don't wait)
      emailService.sendBookingConfirmation(savedBooking).catch(err =>
        console.error("Failed to send customer confirmation:", err)
      );

      // Send notification to admin (async, don't wait)
      emailService.sendAdminNotification(savedBooking).catch(err =>
        console.error("Failed to send admin notification:", err)
      );

      return res.status(201).json({ success: true });
    } catch (error) {
      console.error("Booking creation error:", error);
      return res.status(500).json({ success: false, error: "Failed to create booking" });
    }
  });

  app.get("/api/bookings", requireAuth, async (req, res) => {
    try {
      const { search, status, page = "1", limit = "50" } = req.query;

      // Validate pagination parameters
      const pageNum = Math.max(1, parseInt(page as string) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));

      let where: any = {};

      if (search && typeof search === "string" && search.length > 0 && search.length <= 100) {
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

      return res.json({
        bookings,
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

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    // Validate ID format
    if (!id || typeof id !== "string" || id.length > 50) {
      return res.status(400).json({ success: false, error: "Invalid booking ID" });
    }

    if (!validateBookingStatus(status)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    try {
      const booking = await prisma.booking.update({
        where: { id },
        data: { status },
      });
      res.json(booking);
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
