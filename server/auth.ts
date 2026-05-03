import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12); // Increased rounds for better security
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAdminUser(username: string, password: string) {
  // Validate password strength
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters long");
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    throw new Error("Password must contain at least one uppercase letter, one lowercase letter, and one number");
  }

  const hashedPassword = await hashPassword(password);
  return prisma.admin.create({
    data: {
      username,
      password: hashedPassword,
    },
  });
}

export async function findAdminByUsername(username: string) {
  return prisma.admin.findUnique({
    where: { username },
  });
}

export async function initializeAdminUser() {
  try {
    const existingAdmin = await prisma.admin.findFirst();
    if (!existingAdmin) {
      // Only create default admin if explicitly requested via environment variable
      const createDefaultAdmin = process.env.CREATE_DEFAULT_ADMIN === "true";
      if (createDefaultAdmin) {
        const defaultUsername = process.env.DEFAULT_ADMIN_USERNAME || "admin";
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD;

        if (!defaultPassword) {
          console.error("DEFAULT_ADMIN_PASSWORD environment variable is required when CREATE_DEFAULT_ADMIN=true");
          return;
        }

        await createAdminUser(defaultUsername, defaultPassword);
        console.log(`Default admin user created: ${defaultUsername}`);
        console.log("[WARNING] Change the default password immediately after first login.");
      } else {
        console.log("No admin user exists. Set CREATE_DEFAULT_ADMIN=true and provide DEFAULT_ADMIN_PASSWORD to create one.");
      }
    }
  } catch (error) {
    console.error("Error initializing admin user:", error);
  }
}
