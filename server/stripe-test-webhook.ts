import express from "express";
import { verifyStripeTestEvent } from "./stripe-test-events";
import { reconcileStripeTestRefund, settleVerifiedStripeCheckout } from "./stripe-test-settlement";

import { stripeTestWebhookPath, stripeTestWebhookSecret } from "./stripe-test-config";

export function registerStripeTestWebhook(app: express.Express) {
  app.post(stripeTestWebhookPath, express.raw({ type: "application/json", limit: "64kb", inflate: false }), async (req, res) => {
    res.set("Cache-Control", "private, no-store");
    const secret = stripeTestWebhookSecret();
    if (!secret) {
      res.sendStatus(404);
      return;
    }
    const signature = req.get("stripe-signature");
    if (!signature || !Buffer.isBuffer(req.body)) {
      res.sendStatus(400);
      return;
    }
    let event: ReturnType<typeof verifyStripeTestEvent>;
    try {
      event = verifyStripeTestEvent(req.body, signature, secret);
    } catch {
      res.sendStatus(400);
      return;
    }
    if (event) {
      try {
        if (event.kind === "REFUND") await reconcileStripeTestRefund(event);
        else await settleVerifiedStripeCheckout(event);
      } catch {
        // Keep provider delivery retryable. A failure never changes the ledger partially.
        console.warn("Stripe test Checkout settlement requires reconciliation.");
        res.sendStatus(503);
        return;
      }
    }
    res.sendStatus(204);
  });
}
