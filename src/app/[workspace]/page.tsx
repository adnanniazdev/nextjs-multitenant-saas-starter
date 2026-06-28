import { eq, sql } from "drizzle-orm";
import {
  Activity,
  ArrowUpRight,
  Database,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { notFound } from "next/navigation";
import { withAdmin, withTenant } from "@/server/db/rls";
import { workspaceMembers, workspaces } from "@/server/db/schema";

interface DashboardPageProps {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceDashboard({
  params,
}: DashboardPageProps) {
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

  // Retrieve isolated workspace metrics under RLS tenant scope
  const stats = await withTenant(workspace.id, async (tenantDb) => {
    const memberCountResult = await tenantDb
      .select({ count: sql<number>`count(*)` })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspace.id));

    return {
      memberCount: memberCountResult[0]?.count ?? 0,
    };
  });

  // Premium mock metrics for visual aesthetics
  const metrics = [
    {
      name: "Total Team Members",
      value: stats.memberCount.toString(),
      change: "+1 new this week",
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      name: "API Invocations",
      value: workspace.plan === "pro" ? "142,892" : "2,410",
      change:
        workspace.plan === "pro" ? "+14.2% growth" : "24% of monthly quota",
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      name: "Neon DB Storage",
      value: workspace.plan === "pro" ? "1.84 GB" : "12.4 MB",
      change:
        workspace.plan === "pro"
          ? "Unbounded RLS active"
          : "500MB quota limits",
      icon: Database,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100 font-sans">
            {workspace.name} Dashboard
          </h1>
          <p className="text-zinc-400 mt-1">
            Workspace context rewritten from subdomains. Domain isolation:{" "}
            <code className="text-zinc-300 font-mono text-sm px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
              {workspace.slug}.lvh.me
            </code>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
              workspace.plan === "pro"
                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {workspace.plan} Plan
          </span>
        </div>
      </header>

      {/* Metrics Grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {metrics.map((m) => (
          <article
            key={m.name}
            className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-750 transition-all group"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400 font-medium">
                {m.name}
              </span>
              <div className={`p-2.5 rounded-lg ${m.bg}`}>
                <m.icon className={`w-5 h-5 ${m.color}`} />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold text-zinc-100 tracking-tight">
                {m.value}
              </span>
              <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1 font-medium">
                <TrendingUp className="w-3 h-3 text-zinc-500" />
                {m.change}
              </p>
            </div>
          </article>
        ))}
      </section>

      {/* Feature Walkthrough Showcase */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
          <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            Workspace Isolation Details
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed mb-4">
            This dashboard uses strict PostgreSQL Row-Level Security (RLS) data
            partitioning. Under the hood, all database transactions are executed
            inside Drizzle's session context bound to this specific workspace
            ID:
          </p>
          <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-850 font-mono text-xs text-zinc-300 space-y-2">
            <div>
              <span className="text-zinc-500">
                {"// Active Tenant RLS Scope ID:"}
              </span>
              <p className="text-emerald-400 mt-1 truncate">{workspace.id}</p>
            </div>
            <div className="border-t border-zinc-900 pt-2">
              <span className="text-zinc-500">
                {"// SQL Security isolation policy:"}
              </span>
              <p className="text-zinc-400 mt-1">
                CREATE POLICY tenant_isolation_policy ON workspaces FOR ALL
                USING (tenant_id = app.current_tenant_id());
              </p>
            </div>
          </div>
        </article>

        <article className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 mb-3 flex items-center gap-2">
              Tenant Plan Status
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {workspace.plan === "pro"
                ? "Congratulations! Your workspace has access to all enterprise tier functions. You have billing integration, unlimited storage, and priority support. Manage your billing details in the billing settings tab."
                : "Your workspace is currently operating under the free tiers. Invocations are capped at 5,000 monthly, and data logs are cleared after 14 days. Upgrade to Pro using Stripe checkout today."}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
            <div className="text-xs text-zinc-500">
              Subscription Status:{" "}
              <span className="text-zinc-300 font-semibold uppercase">
                {workspace.subscriptionStatus ?? "none"}
              </span>
            </div>
            <a
              href="/billing"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              {workspace.plan === "pro"
                ? "Manage Subscription"
                : "Upgrade to Pro"}
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>
      </section>
    </div>
  );
}
