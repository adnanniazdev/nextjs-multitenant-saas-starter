import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { withAdmin } from "../../db/rls";
import { invitations, workspaceMembers, workspaces } from "../../db/schema";
import { authedProcedure, router, workspaceProcedure } from "../trpc";

export const membersRouter = router({
  // Query: List all members of the workspace
  list: workspaceProcedure.query(async ({ ctx }) => {
    return await ctx.withTenantScope(async (tenantDb) => {
      return await tenantDb.query.workspaceMembers.findMany({
        where: eq(workspaceMembers.workspaceId, ctx.workspace.id),
        with: {
          user: true,
        },
      });
    });
  }),

  // Query: List all pending invitations in the workspace (Owner/Admin only)
  listInvitations: workspaceProcedure.query(async ({ ctx }) => {
    if (ctx.role !== "owner" && ctx.role !== "admin") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to view pending invitations.",
      });
    }

    return await ctx.withTenantScope(async (tenantDb) => {
      return await tenantDb.query.invitations.findMany({
        where: and(
          eq(invitations.workspaceId, ctx.workspace.id),
          isNull(invitations.acceptedAt),
        ),
      });
    });
  }),

  // Mutation: Revoke a pending invitation (Owner/Admin only)
  revokeInvitation: workspaceProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.role !== "owner" && ctx.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to revoke invitations.",
        });
      }

      await ctx.withTenantScope(async (tenantDb) => {
        await tenantDb
          .delete(invitations)
          .where(
            and(
              eq(invitations.id, input.invitationId),
              eq(invitations.workspaceId, ctx.workspace.id),
            ),
          );
      });

      return { success: true };
    }),

  // Mutation: Accept a workspace invitation using a token (authed but not workspace-locked)
  acceptInvite: authedProcedure
    .input(z.object({ token: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await withAdmin(async (adminDb) => {
        // Find invitation
        const invite = await adminDb.query.invitations.findFirst({
          where: eq(invitations.token, input.token),
        });

        if (!invite) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Invitation link is invalid.",
          });
        }

        if (invite.acceptedAt) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This invitation has already been accepted.",
          });
        }

        if (invite.expiresAt < new Date()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "This invitation has expired.",
          });
        }

        // Fetch user's email to make sure they are matching if desired,
        // but Clerk handles social identities. We will check if the user is already in the workspace
        const existingMember = await adminDb.query.workspaceMembers.findFirst({
          where: and(
            eq(workspaceMembers.workspaceId, invite.workspaceId),
            eq(workspaceMembers.userId, ctx.user.id),
          ),
        });

        if (existingMember) {
          // Already a member, mark invite as accepted anyway and redirect them
          await adminDb
            .update(invitations)
            .set({ acceptedAt: new Date() })
            .where(eq(invitations.id, invite.id));

          const workspace = await adminDb.query.workspaces.findFirst({
            where: eq(workspaces.id, invite.workspaceId),
          });

          return { success: true, workspaceSlug: workspace?.slug };
        }

        // Add member and mark invite as accepted
        await adminDb.insert(workspaceMembers).values({
          workspaceId: invite.workspaceId,
          userId: ctx.user.id,
          role: invite.role,
        });

        await adminDb
          .update(invitations)
          .set({ acceptedAt: new Date() })
          .where(eq(invitations.id, invite.id));

        const workspace = await adminDb.query.workspaces.findFirst({
          where: eq(workspaces.id, invite.workspaceId),
        });

        return { success: true, workspaceSlug: workspace?.slug };
      });
    }),
});
