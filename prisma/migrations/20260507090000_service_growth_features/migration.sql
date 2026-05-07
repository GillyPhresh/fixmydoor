-- Add richer booking details for photos, product requests, tracking, and admin workflow.
ALTER TABLE "Booking" ADD COLUMN "customerToken" TEXT;
ALTER TABLE "Booking" ADD COLUMN "photos" TEXT;
ALTER TABLE "Booking" ADD COLUMN "dimensions" TEXT;
ALTER TABLE "Booking" ADD COLUMN "quantity" TEXT;
ALTER TABLE "Booking" ADD COLUMN "material" TEXT;
ALTER TABLE "Booking" ADD COLUMN "color" TEXT;
ALTER TABLE "Booking" ADD COLUMN "swingDirection" TEXT;
ALTER TABLE "Booking" ADD COLUMN "deliveryNeeded" TEXT;
ALTER TABLE "Booking" ADD COLUMN "installationNeeded" TEXT;
ALTER TABLE "Booking" ADD COLUMN "budget" TEXT;
ALTER TABLE "Booking" ADD COLUMN "customerConsent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Booking" ADD COLUMN "appointmentTime" TEXT;
ALTER TABLE "Booking" ADD COLUMN "quoteAmount" TEXT;
ALTER TABLE "Booking" ADD COLUMN "staffAssigned" TEXT;
ALTER TABLE "Booking" ADD COLUMN "adminNotes" TEXT;
ALTER TABLE "Booking" ADD COLUMN "statusHistory" TEXT;

CREATE UNIQUE INDEX "Booking_customerToken_key" ON "Booking"("customerToken");
CREATE INDEX "Booking_customerToken_idx" ON "Booking"("customerToken");

-- Reviews are now moderated. Existing reviews remain visible.
ALTER TABLE "Review" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Review" ADD COLUMN "adminNotes" TEXT;
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- Admin-managed content for product cards, project cards, and selected homepage sections.
CREATE TABLE "ContentItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "tag" TEXT,
  "image" TEXT,
  "accentImage" TEXT,
  "items" TEXT,
  "bookingValue" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "ContentItem_category_idx" ON "ContentItem"("category");
CREATE INDEX "ContentItem_active_idx" ON "ContentItem"("active");
CREATE INDEX "ContentItem_sortOrder_idx" ON "ContentItem"("sortOrder");
