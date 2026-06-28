import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing from environment variables.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  // biome-ignore lint/suspicious/noExplicitAny: apiVersion requires cast due to Stripe version type mismatch
  apiVersion: "2023-10-16" as any,
});
