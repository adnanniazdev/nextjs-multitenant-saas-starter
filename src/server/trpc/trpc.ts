import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { withAdmin } from "../db/rls";
import { users, workspaceMembers, workspaces } from "../db/schema";
import type { Context } from "./context";

// Initialize tRPC
const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware that requires the user to be authenticated via Clerk
 * and ensures they have a synced profile in the local PostgreSQL database.
 */
export const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  // Fetch the local user profile
  const user = await ctx.db.query.users.findFirst({
    where: eq(users.clerkId, ctx.userId),
  });

  if (!user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "User profile not found in local database.",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      user,
    },
  });
});

/**
 * Middleware that guarantees tenant-level isolation:
 * 1. Checks if the requested workspace (via slug input) exists.
 * 2. Confirms the authenticated user is a member of the workspace.
 * 3. Injects `withTenantScope` to automate setting local Postgres RLS variables for all queries.
 */
export const workspaceProcedure = authedProcedure
  .input(z.object({ workspaceSlug: z.string() }))
  .use(async ({ ctx, input, next }) => {
    // 1. Fetch workspace using administrative bypass (since RLS is active)
    const workspace = await withAdmin(async (adminDb) => {
      return await adminDb.query.workspaces.findFirst({
        where: eq(workspaces.slug, input.workspaceSlug),
      });
    });

    if (!workspace) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Workspace not found.",
      });
    }

    // 2. Fetch membership
    const member = await withAdmin(async (adminDb) => {
      return await adminDb.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, ctx.user.id),
        ),
      });
    });

    if (!member) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this workspace.",
      });
    }

    // 3. Define transaction runner that automatically scopes RLS session variable
    const withTenantScope = async <T>(
      callback: (tx: typeof ctx.db) => Promise<T>,
    ): Promise<T> => {
      return await ctx.db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT set_config('app.current_tenant_id', ${workspace.id}, true)`,
        );
        // biome-ignore lint/suspicious/noExplicitAny: tx must be cast to any to match query callback parameter
        return await callback(tx as any);
      });
    };

    return next({
      ctx: {
        ...ctx,
        workspace,
        role: member.role,
        withTenantScope,
      },
    });
  });
