ALTER TABLE "PaymentAttempt" ADD COLUMN "checkoutSessionId" TEXT;
ALTER TABLE "PaymentAttempt" ADD COLUMN "paymentIntentId" TEXT;
CREATE UNIQUE INDEX "PaymentAttempt_checkoutSessionId_key" ON "PaymentAttempt"("checkoutSessionId");
CREATE UNIQUE INDEX "PaymentAttempt_paymentIntentId_key" ON "PaymentAttempt"("paymentIntentId");
