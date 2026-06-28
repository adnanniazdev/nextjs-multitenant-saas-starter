import { auth } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { db } from "@/server/db";
import { withAdmin } from "@/server/db/rls";
import { users, workspaceMembers, workspaces } from "@/server/db/schema";

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { userId: clerkUserId } = await auth();

  // Guard: User must be authenticated
  if (!clerkUserId) {
    redirect("/sign-in");
  }

  const { workspace: slug } = await params;

  // 1. Fetch user profile from PostgreSQL
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  });

  if (!user) {
    // Fallback if Clerk webhook hasn't finished syncing user profile yet
    redirect("/sign-in");
  }

  // 2. Fetch workspace by slug using administrative context (bypassing RLS read policy)
  // because we don't have the workspaceId to set in RLS session variable yet.
  const workspace = await withAdmin(async (adminDb) => {
    return await adminDb.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug),
    });
  });

  if (!workspace) {
    notFound();
  }

  // 3. Verify user membership in workspace
  const member = await withAdmin(async (adminDb) => {
    return await adminDb.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspace.id),
        eq(workspaceMembers.userId, user.id),
      ),
    });
  });

  // Guard: User must be a member of this tenant workspace
  if (!member) {
    redirect("/workspaces");
  }

  // 4. Retrieve all workspaces this user is a member of for the switcher
  const userWorkspaces = await withAdmin(async (adminDb) => {
    return await adminDb
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
      })
      .from(workspaces)
      .innerJoin(
        workspaceMembers,
        eq(workspaceMembers.workspaceId, workspaces.id),
      )
      .where(eq(workspaceMembers.userId, user.id));
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <Sidebar
        currentWorkspace={{
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        }}
        workspaces={userWorkspaces}
      />
      <main className="flex-1 flex flex-col h-full overflow-y-auto bg-zinc-950">
        <div className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
}
