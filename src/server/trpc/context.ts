import { auth } from "@clerk/nextjs/server";
import { db } from "@/server/db";

/**
 * Creates the context for every tRPC request.
 * Exposes Clerk authentication credentials and the Drizzle database client.
 */
export async function createTRPCContext() {
  const { userId, orgId } = await auth();
  return {
    userId,
    orgId,
    db,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
