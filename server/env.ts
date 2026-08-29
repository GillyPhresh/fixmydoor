import { existsSync } from "fs";

if (existsSync(".env")) {
  process.loadEnvFile?.(".env");
}

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  process.env.DATABASE_URL = "file:/data/fixmydoor.db";
}
