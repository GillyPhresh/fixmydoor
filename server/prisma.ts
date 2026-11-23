import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  process.env.DATABASE_URL = "file:/data/fixmydoor.db";
}

// SQLite permits one writer. Queue session touches and business transactions
// on the same connection so a read transaction can safely upgrade to a write.
const databaseUrl = process.env.DATABASE_URL;
const sqliteUrl =
  databaseUrl?.startsWith("file:") && !/[?&]connection_limit=/.test(databaseUrl)
    ? databaseUrl +
      (databaseUrl.includes("?") ? "&" : "?") +
      "connection_limit=1"
    : databaseUrl;
export const prisma = new PrismaClient(
  sqliteUrl ? { datasources: { db: { url: sqliteUrl } } } : undefined
);
