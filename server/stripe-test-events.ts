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
  if (event.type === "charge.refunded") {
    const charge = z.object({
      object: z.literal("charge"),
      livemode: z.literal(false),
      currency: z.literal("cad"),
      paid: z.literal(true),
      amount: z.number().int().positive(),
      amount_refunded: z.number().int().positive(),
      payment_intent: z.string().regex(/^pi_[a-zA-Z0-9]+$/),
    }).parse(event.data.object);
    if (charge.amount_refunded > charge.amount) throw new Error("Invalid refund amount.");
    return { kind: "REFUND" as const, eventId: event.id, paymentIntentId: charge.payment_intent, cents: charge.amount, cumulativeRefundCents: charge.amount_refunded };
  }
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

export type VerifiedStripeEvent = NonNullable<ReturnType<typeof verifyStripeTestEvent>>;
type VerifiedCheckoutEvent = Exclude<VerifiedStripeEvent, { kind: "REFUND" }>;

export function assertStripeCheckoutMatchesAttempt(
  event: VerifiedCheckoutEvent,
  attempt: { id: string; provider: string; currency: string; cents: number; checkoutSessionId: string | null },
) {
  if (
    attempt.provider !== "STRIPE_TEST" ||
    attempt.currency !== "CAD" ||
    attempt.id !== event.attemptId ||
    attempt.checkoutSessionId !== event.sessionId ||
    attempt.cents !== event.cents
  ) {
    throw new Error("Stripe event does not match its stored checkout attempt.");
  }
}
