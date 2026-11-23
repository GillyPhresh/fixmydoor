export const stripeTestWebhookPath = "/api/payments/stripe-test/events";

export function stripeTestWebhookSecret(env = process.env) {
  if (env.STAGING_MODE !== "true" || env.FMD_STRIPE_TEST_ENABLED !== "true") return;
  const secret = env.FMD_STRIPE_TEST_WEBHOOK_SECRET;
  if (secret && /^whsec_[A-Za-z0-9_]{16,}$/.test(secret)) return secret;
}
