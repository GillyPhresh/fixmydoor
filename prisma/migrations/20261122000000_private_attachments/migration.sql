CREATE TABLE "Attachment" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "owner" TEXT,
  "bookingId" TEXT REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "image" BLOB NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Attachment_owner_createdAt_idx" ON "Attachment"("owner", "createdAt");
CREATE INDEX "Attachment_bookingId_idx" ON "Attachment"("bookingId");
