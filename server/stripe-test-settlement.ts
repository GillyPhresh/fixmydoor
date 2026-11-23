import { prisma } from "./prisma";
import { assertStripeCheckoutMatchesAttempt, verifyStripeTestEvent } from "./stripe-test-events";

type CheckoutEvent = NonNullable<ReturnType<typeof verifyStripeTestEvent>>;

export async function settleVerifiedStripeCheckout(event: CheckoutEvent) {
  return prisma.$transaction(async tx => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: event.attemptId },
      include: { invoice: true },
    });
    assertStripeCheckoutMatchesAttempt(event, attempt);

    const previous = await tx.paymentEvent.findUnique({ where: { id: event.eventId } });
    if (previous) {
      if (previous.attemptId !== attempt.id || previous.kind !== event.kind || previous.cents !== event.cents) {
        throw new Error("Stripe event contradicts an existing payment event.");
      }
      return "duplicate";
    }

    if (attempt.status === "SUCCEEDED") {
      if (event.kind === "SUCCEEDED" && attempt.paymentIntentId !== event.paymentIntentId) {
        throw new Error("Stripe payment intent does not match the settled attempt.");
      }
      return "already-settled";
    }

    if (event.kind === "SUCCEEDED") {
      const invoice = attempt.invoice;
      if (!event.paymentIntentId || !["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) ||
          invoice.currency !== "CAD" || event.cents > invoice.totalCents - invoice.paidCents) {
        throw new Error("Stripe payment requires manual reconciliation.");
      }
      const paidCents = invoice.paidCents + event.cents;
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paidCents, status: paidCents === invoice.totalCents ? "PAID" : "PARTIALLY_PAID" },
      });
      await tx.invoicePayment.create({
        data: { invoiceId: invoice.id, cents: event.cents, method: "STRIPE_TEST", reference: event.paymentIntentId, actor: "stripe-test-webhook" },
      });
    }
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: event.kind,
        ...(event.kind === "SUCCEEDED" ? { paymentIntentId: event.paymentIntentId } : {}),
      },
    });
    await tx.paymentEvent.create({
      data: { id: event.eventId, attemptId: attempt.id, kind: event.kind, cents: event.cents },
    });
    return "recorded";
  });
}
