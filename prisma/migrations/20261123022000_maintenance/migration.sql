-- CreateTable
CREATE TABLE "MaintenanceAgreement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "startOn" TEXT NOT NULL,
    "endOn" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "staff" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "authorization" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceAgreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agreementId" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "dueOn" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    CONSTRAINT "MaintenanceOccurrence_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "MaintenanceAgreement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceOccurrence_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quotation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MaintenanceAgreement_propertyId_status_idx" ON "MaintenanceAgreement"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceOccurrence_quoteId_key" ON "MaintenanceOccurrence"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceOccurrence_agreementId_period_key" ON "MaintenanceOccurrence"("agreementId", "period");
