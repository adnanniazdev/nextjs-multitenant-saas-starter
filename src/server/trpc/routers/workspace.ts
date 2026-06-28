import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { withAdmin } from "../../db/rls";
import { workspaceMembers, workspaces } from "../../db/schema";
import { authedProcedure, router, workspaceProcedure } from "../trpc";

export const workspaceRouter = router({
  // Query: Get all workspaces that the authenticated user is a member of
  getAll: authedProcedure.query(async ({ ctx }) => {
    return await withAdmin(async (adminDb) => {
      const memberships = await adminDb.query.workspaceMembers.findMany({
        where: eq(workspaceMembers.userId, ctx.user.id),
        with: {
          workspace: true,
        },
      });
      return memberships.map((m) => m.workspace);
    });
  }),

  // Query: Get detailed information about a single workspace by slug
  getBySlug: workspaceProcedure.query(async ({ ctx }) => {
    return await ctx.withTenantScope(async (tenantDb) => {
      const workspaceInfo = await tenantDb.query.workspaces.findFirst({
        where: eq(workspaces.id, ctx.workspace.id),
      });

      const membersList = await tenantDb.query.workspaceMembers.findMany({
        where: eq(workspaceMembers.workspaceId, ctx.workspace.id),
      });

      return {
        ...workspaceInfo,
        memberCount: membersList.length,
      };
    });
  }),

  // Mutation: Delete the workspace (Owner-only privilege)
  delete: workspaceProcedure.mutation(async ({ ctx }) => {
    if (ctx.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the workspace owner can delete this workspace.",
      });
    }

    // Delete the workspace inside the tenant's RLS transaction scope
    await ctx.withTenantScope(async (tenantDb) => {
      await tenantDb
        .delete(workspaces)
        .where(eq(workspaces.id, ctx.workspace.id));
    });

    return { success: true };
  }),
});
