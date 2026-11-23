import { z } from "zod";

const checkoutResponse = z.object({
  id: z.string().regex(/^cs_test_[a-zA-Z0-9]+$/),
  url: z.url(),
  livemode: z.literal(false),
  amount_total: z.number().int(),
  currency: z.literal("cad"),
});

type CheckoutRequest = {
  attemptId: string;
  cents: number;
  portalUrl: string;
};

export function createStripeTestCheckout(secret: string, request: typeof fetch = fetch) {
  if (!/^(?:sk|rk)_test_[a-zA-Z0-9]+$/.test(secret)) {
    throw new Error("A Stripe test-mode secret key is required.");
  }

  return async ({ attemptId, cents, portalUrl }: CheckoutRequest) => {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(attemptId) || !Number.isSafeInteger(cents) || cents < 50 || cents > 99_999_999) {
      throw new RangeError("Invalid checkout attempt or amount.");
    }
    const returnUrl = new URL(portalUrl);
    if (returnUrl.protocol !== "https:" || returnUrl.username || returnUrl.password || returnUrl.search || returnUrl.hash || returnUrl.pathname !== "/portal") {
      throw new Error("Expected a configured HTTPS portal URL.");
    }

    const form = new URLSearchParams({
      mode: "payment",
      success_url: returnUrl.href,
      cancel_url: returnUrl.href,
      client_reference_id: attemptId,
      "payment_method_types[0]": "card",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "cad",
      "line_items[0][price_data][unit_amount]": String(cents),
      "line_items[0][price_data][product_data][name]": "FixMyDoor quotation deposit",
    });
    const response = await request("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: "Bearer " + secret,
        "Stripe-Version": "2026-11-18.endive",
        "Idempotency-Key": "fixmydoor-deposit-" + attemptId,
      },
      body: form,
    });
    if (!response.ok) throw new Error("Stripe rejected the checkout request.");
    const session = checkoutResponse.parse(await response.json());
    const checkoutUrl = new URL(session.url);
    if (session.amount_total !== cents || checkoutUrl.origin !== "https://checkout.stripe.com" || checkoutUrl.username || checkoutUrl.password) {
      throw new Error("Unexpected Stripe checkout response.");
    }
    return { id: session.id, url: checkoutUrl.href };
  };
}
