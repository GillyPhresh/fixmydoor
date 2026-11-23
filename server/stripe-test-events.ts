import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const eventEnvelope = z.object({
  id: z.string().regex(/^evt_[a-zA-Z0-9]+$/),
  type: z.string(),
  livemode: z.literal(false),
  data: z.object({ object: z.unknown() }),
});

const session = z.object({
  id: z.string().regex(/^cs_test_[a-zA-Z0-9]+$/),
  object: z.literal("checkout.session"),
  livemode: z.literal(false),
  currency: z.literal("cad"),
  amount_total: z.number().int().positive(),
  client_reference_id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
  payment_status: z.enum(["paid", "unpaid", "no_payment_required"]),
  payment_intent: z.string().regex(/^pi_[a-zA-Z0-9]+$/).nullable(),
});

export function verifyStripeTestEvent(
  body: Buffer,
  signature: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret.startsWith("whsec_") || signature.length > 4096) {
    throw new Error("Invalid Stripe signature.");
  }
  const fields = signature.split(",");
  const timestamps = fields.filter(field => field.startsWith("t="));
  const timestamp = timestamps[0]?.slice(2) ?? "";
  if (timestamps.length !== 1 || !/^\d{10}$/.test(timestamp) || Math.abs(nowSeconds - Number(timestamp)) > 300) {
    throw new Error("Invalid Stripe signature.");
  }
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(body).digest();
  const authenticated = fields.some(field => /^v1=[a-f0-9]{64}$/.test(field) &&
    timingSafeEqual(expected, Buffer.from(field.slice(3), "hex")));
  if (!authenticated) throw new Error("Invalid Stripe signature.");

  const event = eventEnvelope.parse(JSON.parse(body.toString("utf8")));
  if (!["checkout.session.completed", "checkout.session.expired", "checkout.session.async_payment_failed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
    return null;
  }
  const checkout = session.parse(event.data.object);
  const successful = event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded";
  if (successful && (checkout.payment_status !== "paid" || !checkout.payment_intent)) return null;
  if (!successful && checkout.payment_status === "paid") return null;
  return {
    eventId: event.id,
    attemptId: checkout.client_reference_id,
    sessionId: checkout.id,
    paymentIntentId: checkout.payment_intent,
    cents: checkout.amount_total,
    kind: successful ? "SUCCEEDED" as const : event.type === "checkout.session.expired" ? "EXPIRED" as const : "FAILED" as const,
  };
}
