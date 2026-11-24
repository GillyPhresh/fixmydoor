CREATE TABLE "TechnicianApplication" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "province" TEXT NOT NULL,
  "experience" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "reviewNote" TEXT NOT NULL DEFAULT '',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("email")
);
CREATE INDEX "TechnicianApplication_status_createdAt_idx" ON "TechnicianApplication"("status", "createdAt");
