"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import {
  Check,
  CreditCard,
  ExternalLink,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PaymentForm } from "./PaymentForm";

// Initialize Stripe client-side SDK. Fallbacks gracefully if key is not yet set in .env
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
);

interface BillingClientProps {
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: "free" | "pro";
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
  };
}

export function BillingClient({ workspace }: BillingClientProps) {
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const subscriptionIntentMutation =
    trpc.billing.createSubscriptionIntent.useMutation();
  const portalMutation = trpc.billing.createPortal.useMutation();

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await subscriptionIntentMutation.mutateAsync({
        workspaceSlug: workspace.slug,
        priceId:
          process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "price_pro_tier_mock",
      });

      if (res.clientSecret) {
        setClientSecret(res.clientSecret);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to initiate Stripe elements checkout";
      alert(message);
    } finally {
      setLoading(false);
    }
  };

  const handleManagePortal = async () => {
    setLoading(true);
    try {
      // Create portal session redirecting to Stripe Customer Portal
      const res = await portalMutation.mutateAsync({
        workspaceSlug: workspace.slug,
      });
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to open Stripe Customer Portal";
      alert(message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current plan status panel */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">
            Current Tier
          </span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-zinc-100 capitalize">
              {workspace.plan} Plan
            </span>
            {workspace.plan === "pro" && (
              <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" />
                Active
              </span>
            )}
          </div>
          {workspace.plan === "pro" && workspace.currentPeriodEnd && (
            <p className="text-xs text-zinc-500 pt-1">
              Your subscription renews/ends on:{" "}
              <span className="text-zinc-400 font-medium">
                {new Date(workspace.currentPeriodEnd).toLocaleDateString()}
              </span>{" "}
              (Status:{" "}
              <span className="text-emerald-400 font-semibold capitalize">
                {workspace.subscriptionStatus}
              </span>
              )
            </p>
          )}
        </div>

        <div>
          {workspace.plan === "pro" ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleManagePortal}
              className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-800/50 text-zinc-100 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none border border-zinc-750"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Manage Billing & Invoices
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleUpgrade}
              className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-500/50 text-zinc-950 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 focus:outline-none shadow-md"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Upgrade Workspace to Pro
            </button>
          )}
        </div>
      </div>

      {/* Plan comparisons table card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Free Plan Card */}
        <article className="p-6 bg-zinc-900/60 border border-zinc-800 rounded-xl flex flex-col justify-between h-96 relative">
          <div>
            <span className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
              Free Plan
            </span>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">
                $0
              </span>
              <span className="text-sm text-zinc-500">/ month</span>
            </div>
            <p className="text-sm text-zinc-450 mt-4 leading-relaxed">
              Standard shared computing resources, perfect for testing, early
              proof of concepts, and startup portfolios.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                "Up to 5 API members",
                "Neon RLS partition database logs",
                "Rewritten subdomain context workspace",
                "5,000 monthly executions quota limits",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-zinc-400"
                >
                  <Check className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            disabled
            className="w-full mt-6 py-2.5 bg-zinc-800 text-zinc-500 text-sm font-semibold rounded-lg border border-zinc-800 cursor-not-allowed"
          >
            {workspace.plan === "free"
              ? "Currently Subscribed"
              : "Downgrade unavailable"}
          </button>
        </article>

        {/* Pro Plan Card */}
        <article className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col justify-between h-96 relative overflow-hidden group">
          <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500/10 to-transparent w-full h-full pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Pro Plan
              </span>
              <span className="text-[10px] font-bold text-zinc-950 bg-amber-500 px-2 py-0.5 rounded uppercase tracking-wider">
                Popular
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-zinc-100 tracking-tight">
                $29
              </span>
              <span className="text-sm text-zinc-500">/ month</span>
            </div>
            <p className="text-sm text-zinc-450 mt-4 leading-relaxed">
              For professional portfolios and production applications. Full
              capabilities with priority Stripe subscription billing logs.
            </p>

            <ul className="mt-6 space-y-2.5">
              {[
                "Unlimited API members",
                "Dedicated isolation DB policies",
                "Full Stripe invoice & billing portal logs",
                "Unlimited execution queries",
                "Priority uptime support logs",
              ].map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-zinc-300"
                >
                  <Check className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {workspace.plan === "pro" ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleManagePortal}
              className="w-full mt-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 transition-colors text-zinc-200 text-sm font-semibold rounded-lg border border-zinc-750 flex items-center justify-center gap-1.5 focus:outline-none"
            >
              Manage Subscription
              <ExternalLink className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleUpgrade}
              className="w-full mt-6 py-2.5 bg-amber-500 hover:bg-amber-600 transition-colors text-zinc-950 text-sm font-bold rounded-lg focus:outline-none shadow-lg flex items-center justify-center gap-1.5"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Upgrade to Pro
            </button>
          )}
        </article>
      </div>

      {/* Embedded Elements Modal Overlay */}
      {clientSecret && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 text-zinc-100 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-zinc-100 font-sans mb-1">
              Complete Upgrade
            </h2>
            <p className="text-sm text-zinc-400 mb-6">
              Enter your card details to upgrade{" "}
              <strong>{workspace.name}</strong> to the Pro plan.
            </p>
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#f59e0b",
                    colorBackground: "#09090b",
                    colorText: "#f4f4f5",
                    colorDanger: "#ef4444",
                    fontFamily: "Inter, system-ui, sans-serif",
                  },
                },
              }}
            >
              <PaymentForm onCancel={() => setClientSecret(null)} />
            </Elements>
          </div>
        </div>
      )}
    </div>
  );
}
