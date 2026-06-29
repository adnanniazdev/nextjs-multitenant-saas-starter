"use server";

import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withAdmin, withTenant } from "../db/rls";
import { invitations, users, workspaceMembers, workspaces } from "../db/schema";
import { getOrCreateUser } from "../db/users";

// Form Validation Schemas
const CreateWorkspaceSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(30)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),
});

const InviteMemberSchema = z.object({
  workspaceSlug: z.string(),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "member"]),
});

const UpdateRoleSchema = z.object({
  workspaceSlug: z.string(),
  userId: z.string().uuid(),
  role: z.enum(["admin", "member"]), // Owner cannot be set dynamically; only one owner
});

const RemoveMemberSchema = z.object({
  workspaceSlug: z.string(),
  userId: z.string().uuid(),
});

/**
 * Server Action: Create a new workspace and assign the creator as the Owner.
 */
export async function createWorkspace(
  rawData: z.infer<typeof CreateWorkspaceSchema>,
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  const data = CreateWorkspaceSchema.parse(rawData);

  // 1. Resolve internal user ID (utilizing JIT provisioning fallback)
  const user = await getOrCreateUser(clerkUserId);

  if (!user) {
    throw new Error(
      "User profile not found in database and JIT provisioning failed.",
    );
  }

  // 2. Run transaction bypassing RLS (since workspace doesn't exist yet)
  try {
    const newWorkspace = await withAdmin(async (adminDb) => {
      // Check if slug is taken
      const existing = await adminDb.query.workspaces.findFirst({
        where: eq(workspaces.slug, data.slug),
      });

      if (existing) {
        throw new Error("Slug is already taken. Please choose another one.");
      }

      // Create workspace and add creator as owner
      const [workspace] = await adminDb
        .insert(workspaces)
        .values({
          name: data.name,
          slug: data.slug,
          plan: "free",
        })
        .returning();

      await adminDb.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      });

      return workspace;
    });

    revalidatePath("/workspaces");
    return { success: true, workspace: newWorkspace };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Invite a new teammate to a workspace.
 */
export async function inviteMember(
  rawData: z.infer<typeof InviteMemberSchema>,
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  const data = InviteMemberSchema.parse(rawData);

  // 1. Fetch user & workspace context (needs admin query to resolve workspace ID)
  const context = await withAdmin(async (adminDb) => {
    const userProfile = await adminDb.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });

    const w = await adminDb.query.workspaces.findFirst({
      where: eq(workspaces.slug, data.workspaceSlug),
    });

    if (!userProfile || !w) return null;

    // Check inviter's role
    const member = await adminDb.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, w.id),
        eq(workspaceMembers.userId, userProfile.id),
      ),
    });

    return { user: userProfile, workspace: w, inviterMember: member };
  });

  if (!context || !context.inviterMember) {
    throw new Error("Unauthorized workspace access.");
  }

  // Guard: Only Owner and Admin can invite members
  if (
    context.inviterMember.role !== "owner" &&
    context.inviterMember.role !== "admin"
  ) {
    throw new Error("Forbidden: You do not have permission to invite members.");
  }

  // 2. Perform invitations operations inside RLS scope for the workspace
  try {
    const inviteLink = await withTenant(
      context.workspace.id,
      async (tenantDb) => {
        // Check if user is already a member
        const existingUser = await tenantDb.query.users.findFirst({
          where: eq(users.email, data.email),
        });

        if (existingUser) {
          const isMember = await tenantDb.query.workspaceMembers.findFirst({
            where: and(
              eq(workspaceMembers.workspaceId, context.workspace.id),
              eq(workspaceMembers.userId, existingUser.id),
            ),
          });
          if (isMember) {
            throw new Error("User is already a member of this workspace.");
          }
        }

        // Check if a pending invite already exists
        const existingInvite = await tenantDb.query.invitations.findFirst({
          where: and(
            eq(invitations.workspaceId, context.workspace.id),
            eq(invitations.email, data.email),
            isNull(invitations.acceptedAt),
          ),
        });

        if (existingInvite && existingInvite.expiresAt > new Date()) {
          throw new Error(
            "A pending invitation already exists for this email.",
          );
        }

        const token = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        await tenantDb.insert(invitations).values({
          workspaceId: context.workspace.id,
          email: data.email,
          role: data.role,
          token,
          invitedBy: context.user.id,
          expiresAt,
        });

        return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/invite/${token}`;
      },
    );

    // Mock Email Output (Or trigger Resend SDK here)
    console.log(
      `[EMAIL SEND MOCK] Sending invitation to ${data.email} with link: ${inviteLink}`,
    );

    revalidatePath(`/[workspace]/settings/members`);
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to invite member";
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Server Action: Update a member's role in the workspace.
 */
export async function updateMemberRole(
  rawData: z.infer<typeof UpdateRoleSchema>,
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  const data = UpdateRoleSchema.parse(rawData);

  // 1. Fetch user & workspace context (admin bypass to resolve workspace ID)
  const context = await withAdmin(async (adminDb) => {
    const userProfile = await adminDb.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });

    const w = await adminDb.query.workspaces.findFirst({
      where: eq(workspaces.slug, data.workspaceSlug),
    });

    if (!userProfile || !w) return null;

    // Check operator's role
    const member = await adminDb.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, w.id),
        eq(workspaceMembers.userId, userProfile.id),
      ),
    });

    return { user: userProfile, workspace: w, operator: member };
  });

  if (!context || !context.operator) {
    throw new Error("Unauthorized workspace access.");
  }

  const { operator, workspace, user } = context;

  // Guard: Only Owner can change roles
  if (operator.role !== "owner") {
    throw new Error("Forbidden: Only workspace owners can modify roles.");
  }

  // Guard: Cannot change own role
  if (user.id === data.userId) {
    throw new Error("Forbidden: You cannot change your own role.");
  }

  // 2. Perform updates inside tenant RLS scope
  try {
    await withTenant(workspace.id, async (tenantDb) => {
      await tenantDb
        .update(workspaceMembers)
        .set({ role: data.role })
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspace.id),
            eq(workspaceMembers.userId, data.userId),
          ),
        );
    });

    revalidatePath(`/[workspace]/settings/members`);
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update role";
    return { success: false, error: message };
  }
}

/**
 * Server Action: Remove a member from the workspace.
 */
export async function removeMember(
  rawData: z.infer<typeof RemoveMemberSchema>,
) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) {
    throw new Error("Unauthorized");
  }

  const data = RemoveMemberSchema.parse(rawData);

  // 1. Fetch user & workspace context (admin bypass to resolve workspace ID)
  const context = await withAdmin(async (adminDb) => {
    const userProfile = await adminDb.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });

    const w = await adminDb.query.workspaces.findFirst({
      where: eq(workspaces.slug, data.workspaceSlug),
    });

    if (!userProfile || !w) return null;

    // Check operator's role
    const member = await adminDb.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, w.id),
        eq(workspaceMembers.userId, userProfile.id),
      ),
    });

    return { user: userProfile, workspace: w, operator: member };
  });

  if (!context || !context.operator) {
    throw new Error("Unauthorized workspace access.");
  }

  const { operator, workspace, user } = context;

  // Guard: Only Owner and Admin can remove members
  if (operator.role !== "owner" && operator.role !== "admin") {
    throw new Error("Forbidden: You do not have permission to remove members.");
  }

  // Guard: Cannot remove yourself
  if (user.id === data.userId) {
    throw new Error(
      "Forbidden: You cannot remove yourself from the workspace.",
    );
  }

  // 2. Perform removal inside tenant RLS scope
  try {
    await withTenant(workspace.id, async (tenantDb) => {
      // Check target member role
      const targetMember = await tenantDb.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, data.userId),
        ),
      });

      if (!targetMember) {
        throw new Error("Target user is not a member of this workspace.");
      }

      // Guard: Admin cannot remove an Owner
      if (targetMember.role === "owner") {
        throw new Error("Forbidden: Owners cannot be removed.");
      }

      // Guard: Admin cannot remove another Admin
      if (operator.role === "admin" && targetMember.role === "admin") {
        throw new Error("Forbidden: Admins cannot remove other admins.");
      }

      // Delete member
      await tenantDb
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspace.id),
            eq(workspaceMembers.userId, data.userId),
          ),
        );
    });

    revalidatePath(`/[workspace]/settings/members`);
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to remove member";
    return {
      success: false,
      error: message,
    };
  }
}
