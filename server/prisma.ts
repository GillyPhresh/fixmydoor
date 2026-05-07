import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  process.env.DATABASE_URL = "file:/data/fixmydoor.db";
}

export const prisma = new PrismaClient();
