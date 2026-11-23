import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { assertStripeCheckoutMatchesAttempt, verifyStripeTestEvent } from "../server/stripe-test-events.ts";

const secret = "whsec_synthetic_fixture";
const now = 1_800_000_000;
const event = {
  id: "evt_Synthetic",
  type: "checkout.session.completed",
  livemode: false,
  data: { object: {
    id: "cs_test_Synthetic", object: "checkout.session", livemode: false,
    currency: "cad", amount_total: 2500, client_reference_id: "attempt-1",
    payment_status: "paid", payment_intent: "pi_Synthetic",
  } },
};

function signed(value = event, timestamp = now) {
  const body = Buffer.from(JSON.stringify(value));
  const digest = createHmac("sha256", secret).update(timestamp + ".").update(body).digest("hex");
  return [body, "t=" + timestamp + ",v1=" + digest, secret, now];
}

test("Stripe events authenticate the exact raw body and enforce the time window", () => {
  const args = signed();
  assert.equal(verifyStripeTestEvent(...args).kind, "SUCCEEDED");
  assert.equal(verifyStripeTestEvent(...args).cents, 2500);
  assert.throws(() => verifyStripeTestEvent(Buffer.concat([args[0], Buffer.from(" ")]), ...args.slice(1)), /signature/);
  assert.throws(() => verifyStripeTestEvent(...signed(event, now - 301)), /signature/);
  assert.throws(() => verifyStripeTestEvent(...signed(event, now + 301)), /signature/);
});

test("Stripe events never treat an unpaid Checkout Session or live event as settlement", () => {
  const unpaid = { ...event, data: { object: { ...event.data.object, payment_status: "unpaid", payment_intent: null } } };
  assert.equal(verifyStripeTestEvent(...signed(unpaid)), null);
  assert.equal(verifyStripeTestEvent(...signed({ ...unpaid, type: "checkout.session.expired" })).kind, "EXPIRED");
  assert.throws(() => verifyStripeTestEvent(...signed({ ...event, livemode: true })));
});

test("a signed payment cannot settle a different session, attempt, provider, or amount", () => {
  const checkout = verifyStripeTestEvent(...signed());
  const attempt = { id: "attempt-1", provider: "STRIPE_TEST", currency: "CAD", cents: 2500, checkoutSessionId: "cs_test_Synthetic" };
  assert.doesNotThrow(() => assertStripeCheckoutMatchesAttempt(checkout, attempt));
  for (const change of [{ id: "different" }, { provider: "SYNTHETIC" }, { currency: "USD" }, { cents: 2400 }, { checkoutSessionId: null }, { checkoutSessionId: "cs_test_Other" }]) {
    assert.throws(() => assertStripeCheckoutMatchesAttempt(checkout, { ...attempt, ...change }), /does not match/);
  }
});
