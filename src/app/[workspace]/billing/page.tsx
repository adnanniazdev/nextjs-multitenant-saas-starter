import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { withAdmin } from "@/server/db/rls";
import { workspaces } from "@/server/db/schema";
import { stripe } from "@/server/stripe";
import { BillingClient } from "./BillingClient";

interface BillingPageProps {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceBillingPage({
  params,
}: BillingPageProps) {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const { workspace: slug } = await params;

  // Resolve the workspace metadata bypassing RLS (metadata lookup)
  const workspace = await withAdmin(async (adminDb) => {
    return await adminDb.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });
  });

  if (!workspace) {
    notFound();
  }

  // JIT Sync Fallback: Proactively sync subscription details from Stripe SDK
  // This allows instant billing state updates during local testing without relying on webhooks
  if (workspace.stripeCustomerId) {
    try {
      const activeSubscriptions = await stripe.subscriptions.list({
        customer: workspace.stripeCustomerId,
        limit: 1,
      });

      const activeSub = activeSubscriptions.data[0];

      if (activeSub) {
        const isPro =
          activeSub.status === "active" || activeSub.status === "trialing";
        // Stripe 2025-03-31 API tracking: renewal period is nested under items.data[0]
        const currentPeriodEnd = new Date(
          activeSub.items.data[0].current_period_end * 1000,
        );

        await withAdmin(async (adminDb) => {
          await adminDb
            .update(workspaces)
            .set({
              plan: isPro ? "pro" : "free",
              subscriptionStatus: activeSub.status,
              currentPeriodEnd,
            })
            .where(eq(workspaces.id, workspace.id));
        });

        // Mutate local object to pass updated states to UI
        workspace.plan = isPro ? "pro" : "free";
        workspace.subscriptionStatus = activeSub.status;
        workspace.currentPeriodEnd = currentPeriodEnd;
      } else {
        // Reset to free tier if no active subscription is found
        await withAdmin(async (adminDb) => {
          await adminDb
            .update(workspaces)
            .set({
              plan: "free",
              subscriptionStatus: null,
              currentPeriodEnd: null,
            })
            .where(eq(workspaces.id, workspace.id));
        });

        workspace.plan = "free";
        workspace.subscriptionStatus = null;
        workspace.currentPeriodEnd = null;
      }
    } catch (err) {
      console.error("Failed to execute JIT Stripe subscription sync:", err);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-zinc-800 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 font-sans">
          Billing Settings
        </h1>
        <p className="text-zinc-400 mt-1">
          Manage your subscription plans, Stripe invoice receipts, and billing
          cycles.
        </p>
      </header>

      {/* Billing Client Panel */}
      <BillingClient
        workspace={{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          subscriptionStatus: workspace.subscriptionStatus,
          currentPeriodEnd: workspace.currentPeriodEnd,
        }}
      />
    </div>
  );
}
