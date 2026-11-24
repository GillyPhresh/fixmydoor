import assert from "node:assert/strict";
import test from "node:test";
import { createStripeTestCheckout } from "../server/stripe-test-checkout.ts";

const input = { attemptId: "synthetic_attempt", cents: 2500, portalUrl: "https://example.invalid/portal" };
const result = { id: "cs_test_Synthetic1", url: "https://checkout.stripe.com/c/pay/test", livemode: false, amount_total: 2500, currency: "cad" };

test("Stripe test checkout submits CAD cents and reuses the attempt idempotency key", async () => {
  let calls = 0;
  const checkout = createStripeTestCheckout("sk_test_Synthetic", async (url, options) => {
    assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
    assert.equal(options.headers["Idempotency-Key"], "fixmydoor-deposit-synthetic_attempt");
    assert.equal(options.body.get("line_items[0][price_data][unit_amount]"), "2500");
    assert.equal(options.body.get("line_items[0][price_data][currency]"), "cad");
    assert.equal(options.body.get("allowed_payment_method_types[0]"), "card");
    assert.equal(options.body.has("payment_method_types[0]"), false);
    calls++;
    return Response.json(result);
  });
  assert.deepEqual(await checkout(input), { id: result.id, url: result.url });
  await checkout(input);
  assert.equal(calls, 2);
});

test("Stripe test checkout refuses live keys and unexpected provider responses", async () => {
  assert.throws(() => createStripeTestCheckout("sk_live_Synthetic"), /test-mode/);
  for (const changes of [{ livemode: true }, { amount_total: 2400 }, { url: "https://example.invalid/checkout" }]) {
    await assert.rejects(createStripeTestCheckout("sk_test_Synthetic", async () => Response.json({ ...result, ...changes }))(input));
  }
});
