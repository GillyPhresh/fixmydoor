import { prisma } from "./prisma";
import { assertStripeCheckoutMatchesAttempt, type VerifiedStripeEvent } from "./stripe-test-events";

type CheckoutEvent = Exclude<VerifiedStripeEvent, { kind: "REFUND" }>;

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

export async function reconcileStripeTestRefund(event: Extract<VerifiedStripeEvent, { kind: "REFUND" }>) {
  return prisma.$transaction(async tx => {
    const attempt = await tx.paymentAttempt.findUniqueOrThrow({
      where: { paymentIntentId: event.paymentIntentId },
      include: { invoice: true },
    });
    const invoice = attempt.invoice;
    if (attempt.provider !== "STRIPE_TEST" || attempt.status !== "SUCCEEDED" || attempt.currency !== "CAD" || invoice.currency !== "CAD" ||
        attempt.cents !== event.cents || event.cumulativeRefundCents > attempt.cents) {
      throw new Error("Stripe refund does not match the settled payment.");
    }
    const previous = await tx.paymentEvent.findUnique({ where: { id: event.eventId } });
    if (previous) {
      if (previous.attemptId !== attempt.id || previous.kind !== "REFUND" || previous.cents !== event.cumulativeRefundCents) {
        throw new Error("Stripe refund contradicts an existing event.");
      }
      return;
    }
    const delta = event.cumulativeRefundCents - attempt.refundedCents;
    if (delta > 0) {
      const paidCents = invoice.paidCents - delta;
      if (paidCents < 0 || !["ISSUED", "PARTIALLY_PAID", "PAID"].includes(invoice.status)) {
        throw new Error("Stripe refund requires manual reconciliation.");
      }
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { paidCents, status: paidCents ? "PARTIALLY_PAID" : "ISSUED" },
      });
      await tx.invoicePayment.create({
        data: { invoiceId: invoice.id, method: "STRIPE_TEST_REFUND", reference: event.eventId, cents: -delta, actor: "stripe-test-webhook" },
      });
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { refundedCents: event.cumulativeRefundCents } });
    }
    await tx.paymentEvent.create({
      data: { id: event.eventId, attemptId: attempt.id, kind: "REFUND", cents: event.cumulativeRefundCents },
    });
  });
}
