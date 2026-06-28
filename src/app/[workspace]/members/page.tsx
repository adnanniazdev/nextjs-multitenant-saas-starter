import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { withAdmin, withTenant } from "@/server/db/rls";
import {
  invitations,
  users,
  workspaceMembers,
  workspaces,
} from "@/server/db/schema";
import { MembersClient } from "./MembersClient";

interface MembersPageProps {
  params: Promise<{ workspace: string }>;
}

export default async function WorkspaceMembersPage({
  params,
}: MembersPageProps) {
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

  // Fetch the current logged in user
  const currentUser = await withAdmin(async (adminDb) => {
    return await adminDb.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });
  });

  if (!currentUser) {
    redirect("/sign-in");
  }

  // Fetch workspace members and invitations inside the RLS tenant context
  const data = await withTenant(workspace.id, async (tenantDb) => {
    // 1. Fetch members list joined with user profiles
    const membersList = await tenantDb
      .select({
        role: workspaceMembers.role,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspace.id));

    // 2. Fetch pending invitations
    const pendingInvites = await tenantDb
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.workspaceId, workspace.id),
          isNull(invitations.acceptedAt),
        ),
      );

    return {
      members: membersList.map((m) => ({
        role: m.role,
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatarUrl,
        },
      })),
      invitations: pendingInvites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expiresAt,
      })),
    };
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="border-b border-zinc-800 pb-5">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100 font-sans">
          Team Members
        </h1>
        <p className="text-zinc-400 mt-1">
          Manage team roles and invite users to access your tenant dashboard
          workspace.
        </p>
      </header>

      {/* Team settings wrapper */}
      <MembersClient
        workspaceSlug={workspace.slug}
        currentUserId={currentUser.id}
        initialMembers={data.members}
        initialInvitations={data.invitations}
      />
    </div>
  );
}
