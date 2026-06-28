import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { withAdmin } from "@/server/db/rls";
import { workspaces } from "@/server/db/schema";
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
