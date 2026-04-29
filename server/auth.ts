import bcrypt from "bcrypt";
import { prisma } from "./prisma";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAdminUser(username: string, password: string) {
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
      // Create default admin user
      await createAdminUser("admin", "admin123");
      console.log("Default admin user created: admin / admin123");
    }
  } catch (error) {
    console.error("Error initializing admin user:", error);
  }
}
