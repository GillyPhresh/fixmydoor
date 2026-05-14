CREATE TABLE "Session" (
  "sid" TEXT NOT NULL PRIMARY KEY,
  "data" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
