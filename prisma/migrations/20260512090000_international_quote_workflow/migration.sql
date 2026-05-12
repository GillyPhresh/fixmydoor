ALTER TABLE "Booking" ADD COLUMN "city" TEXT;
ALTER TABLE "Booking" ADD COLUMN "country" TEXT;
ALTER TABLE "Booking" ADD COLUMN "timeZone" TEXT;
ALTER TABLE "Booking" ADD COLUMN "preferredContactMethod" TEXT;
ALTER TABLE "Booking" ADD COLUMN "urgency" TEXT;
ALTER TABLE "Booking" ADD COLUMN "requestScope" TEXT;
ALTER TABLE "Booking" ADD COLUMN "currency" TEXT;
ALTER TABLE "Booking" ADD COLUMN "quoteNotes" TEXT;
ALTER TABLE "Booking" ADD COLUMN "invoiceStatus" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentStatus" TEXT;

CREATE INDEX "Booking_country_idx" ON "Booking"("country");
CREATE INDEX "Booking_urgency_idx" ON "Booking"("urgency");
CREATE INDEX "Booking_invoiceStatus_idx" ON "Booking"("invoiceStatus");
CREATE INDEX "Booking_paymentStatus_idx" ON "Booking"("paymentStatus");
