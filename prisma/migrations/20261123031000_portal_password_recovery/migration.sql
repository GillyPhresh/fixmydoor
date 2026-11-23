ALTER TABLE "PortalAccount" ADD COLUMN "credentialVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PortalPasswordReset" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalPasswordReset_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PortalAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PortalPasswordReset_tokenHash_key" ON "PortalPasswordReset"("tokenHash");
CREATE INDEX "PortalPasswordReset_accountId_expiresAt_idx" ON "PortalPasswordReset"("accountId", "expiresAt");
CREATE INDEX "PortalPasswordReset_expiresAt_consumedAt_idx" ON "PortalPasswordReset"("expiresAt", "consumedAt");
