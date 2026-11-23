import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";

export function sandboxKey() {
  if (process.env.STAGING_MODE !== "true" && process.env.NODE_ENV !== "test")
    return;
  const key = process.env.FMD_SANDBOX_SIGNING_SECRET;
  return key && key.length >= 32 ? key : undefined;
}
const message = z
  .object({
    id: z.string().min(1).max(120),
    attemptId: z.string().min(1).max(120),
    currency: z.literal("CAD"),
    cents: z.number().int().positive().max(2000000000),
    kind: z.enum(["SUCCEEDED", "FAILED", "CANCELLED", "REFUND"]),
  })
  .strict();
class Conflict extends Error {}
export function registerSandboxWebhook(app: express.Express) {
  app.post(
    "/api/payment-sandbox/events",
    express.raw({ type: "application/json", limit: "16kb" }),
    async (req, res) => {
      const key = sandboxKey();
      if (!key) {
        res.sendStatus(404);
        return;
      }
      const timestamp = req.get("x-fmd-timestamp") || "",
        sig = req.get("x-fmd-signature") || "";
      if (
        !Buffer.isBuffer(req.body) ||
        !/^\d{10}$/.test(timestamp) ||
        Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
        !/^([0-9a-f]{64})$/.test(sig)
      ) {
        res.sendStatus(403);
        return;
      }
      const expected = createHmac("sha256", key)
        .update(timestamp + ".")
        .update(req.body)
        .digest();
      if (!timingSafeEqual(expected, Buffer.from(sig, "hex"))) {
        res.sendStatus(403);
        return;
      }
      try {
        const e = message.parse(JSON.parse(req.body.toString("utf8")));
        await prisma.$transaction(async tx => {
          const previous = await tx.paymentEvent.findUnique({
            where: { id: e.id },
          });
          if (previous) {
            if (
              previous.attemptId !== e.attemptId ||
              previous.kind !== e.kind ||
              previous.cents !== e.cents
            )
              throw new Conflict();
            return;
          }
          const a = await tx.paymentAttempt.findUnique({
            where: { id: e.attemptId },
            include: { invoice: true },
          });
          if (!a || a.provider !== "SYNTHETIC" || a.currency !== e.currency)
            throw new Conflict();
          let delta = 0;
          if (e.kind === "REFUND") {
            if (a.status !== "SUCCEEDED" || e.cents > a.cents - a.refundedCents)
              throw new Conflict();
            delta = -e.cents;
          } else {
            if (a.status !== "PENDING" || e.cents !== a.cents)
              throw new Conflict();
            if (e.kind === "SUCCEEDED") delta = e.cents;
          }
          if (delta) {
            const paid = a.invoice.paidCents + delta;
            if (
              paid < 0 ||
              paid > a.invoice.totalCents ||
              !["ISSUED", "PAID", "PARTIALLY_PAID"].includes(a.invoice.status)
            )
              throw new Conflict();
            await tx.invoice.update({
              where: { id: a.invoiceId },
              data: {
                paidCents: paid,
                status:
                  paid === a.invoice.totalCents
                    ? "PAID"
                    : paid
                      ? "PARTIALLY_PAID"
                      : "ISSUED",
              },
            });
            await tx.invoicePayment.create({
              data: {
                invoiceId: a.invoiceId,
                cents: delta,
                reference: e.id,
                method: "SYNTHETIC",
                actor: "sandbox-adapter",
              },
            });
          }
          await tx.paymentAttempt.update({
            where: { id: a.id },
            data:
              e.kind === "REFUND"
                ? { refundedCents: { increment: e.cents } }
                : { status: e.kind },
          });
          await tx.paymentEvent.create({
            data: { id: e.id, attemptId: a.id, kind: e.kind, cents: e.cents },
          });
        });
        res.sendStatus(204);
      } catch (e) {
        res.sendStatus(
          e instanceof Conflict
            ? 409
            : e instanceof SyntaxError || e instanceof z.ZodError
              ? 400
              : 503
        );
      }
    }
  );
}
