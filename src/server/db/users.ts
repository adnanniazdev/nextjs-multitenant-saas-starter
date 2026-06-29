import { currentUser as getClerkUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { withAdmin } from "./rls";
import { users } from "./schema";

/**
 * Retrieves the database user profile associated with a Clerk user ID.
 * If the profile does not exist (e.g. webhooks have not synchronized yet),
 * it queries Clerk's API and provisions the user profile on-the-fly (JIT provisioning).
 *
 * @param clerkUserId The Clerk user ID string (user_...)
 */
export async function getOrCreateUser(clerkUserId: string) {
  // 1. Check if user profile already exists
  let dbUser = await withAdmin(async (adminDb) => {
    return await adminDb.query.users.findFirst({
      where: eq(users.clerkId, clerkUserId),
    });
  });

  // 2. Fallback: JIT Provisioning using Clerk API metadata
  if (!dbUser) {
    try {
      const clerkUser = await getClerkUser();
      if (!clerkUser) return null;

      const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
      const name =
        `${clerkUser.firstName ?? ""} ${clerkUser.lastName ?? ""}`.trim() ||
        clerkUser.username ||
        "User";
      const avatarUrl = clerkUser.imageUrl ?? "";

      dbUser = await withAdmin(async (adminDb) => {
        const [inserted] = await adminDb
          .insert(users)
          .values({
            clerkId: clerkUserId,
            email,
            name,
            avatarUrl,
          })
          .returning();
        return inserted ?? null;
      });
    } catch (error) {
      console.error("Failed JIT provisioning fallback for Clerk user:", error);
      return null;
    }
  }

  return dbUser;
}
