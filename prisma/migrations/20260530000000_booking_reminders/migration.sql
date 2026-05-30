ALTER TABLE "Booking" ADD COLUMN "reminderAt" TEXT;
ALTER TABLE "Booking" ADD COLUMN "reminderWindow" TEXT;
ALTER TABLE "Booking" ADD COLUMN "reminderNote" TEXT;
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TEXT;

CREATE INDEX "Booking_reminderAt_idx" ON "Booking"("reminderAt");
