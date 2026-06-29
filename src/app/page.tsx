import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { ConsoleClient } from "@/components/features/ConsoleClient";
import { withAdmin } from "@/server/db/rls";
import { workspaceMembers, workspaces } from "@/server/db/schema";
import { getOrCreateUser } from "@/server/db/users";

export default async function Home() {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return (
      <main className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-50 font-sans">
        <ConsoleClient isAuthenticated={false} userWorkspaces={[]} />
      </main>
    );
  }

  // 1. Resolve or provision user profile dynamically (JIT fallback)
  const user = await getOrCreateUser(clerkUserId);

  if (!user) {
    // If webhook hasn't written user record yet, treat as empty list
    return (
      <main className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-50 font-sans">
        <ConsoleClient isAuthenticated={true} userWorkspaces={[]} />
      </main>
    );
  }

  // 2. Fetch all workspaces user is a member of bypassing RLS
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
    <main className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-50 font-sans">
      <ConsoleClient isAuthenticated={true} userWorkspaces={userWorkspaces} />
    </main>
  );
}
