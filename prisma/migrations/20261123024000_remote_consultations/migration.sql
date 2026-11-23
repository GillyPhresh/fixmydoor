-- CreateTable
CREATE TABLE "RemoteConsultation" (
    "bookingId" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "availability" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "requiresPayment" BOOLEAN NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT '',
    "completedAt" DATETIME,
    CONSTRAINT "RemoteConsultation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RemoteConsultation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quotation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RemoteConsultation_quoteId_key" ON "RemoteConsultation"("quoteId");
