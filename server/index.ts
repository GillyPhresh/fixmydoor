import express from "express";
import session from "express-session";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { saveBooking, validateBooking } from "./bookings";
import { prisma } from "./prisma";
import { findAdminByUsername, initializeAdminUser, verifyPassword } from "./auth";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Session configuration
  const isProduction = process.env.NODE_ENV === "production";
  app.use(session({
    secret: process.env.SESSION_SECRET || "fixmydoor-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // Use HTTPS in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "strict",
    },
  }));

  app.use(express.json());

  // Auth middleware
  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (req.session.adminId) {
      return next();
    }
    res.status(401).json({ success: false, error: "Authentication required" });
  }

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: "Username and password required" });
    }

    try {
      const admin = await findAdminByUsername(username);
      if (!admin || !(await verifyPassword(password, admin.password))) {
        return res.status(401).json({ success: false, error: "Invalid credentials" });
      }

      req.session.adminId = admin.id;
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ authenticated: !!req.session.adminId });
  });

  // Booking endpoints
  app.post("/api/bookings", async (req, res) => {
    const booking = req.body;
    if (!validateBooking(booking)) {
      return res.status(400).json({ success: false, error: "Invalid booking payload" });
    }

    try {
      await saveBooking(booking);
      return res.status(201).json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.get("/api/bookings", requireAuth, async (req, res) => {
    try {
      const { search, status } = req.query;
      let where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: "insensitive" } },
          { email: { contains: search as string, mode: "insensitive" } },
          { phone: { contains: search as string } },
          { address: { contains: search as string, mode: "insensitive" } },
        ];
      }

      if (status && status !== "ALL") {
        where.status = status;
      }

      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
      return res.json(bookings);
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
      const booking = await prisma.booking.update({
        where: { id },
        data: { status },
      });
      res.json(booking);
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to update booking" });
    }
  });

  app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
    const { id } = req.params;

    try {
      await prisma.booking.delete({
        where: { id },
      });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: "Failed to delete booking" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

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
