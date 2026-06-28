import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Executes database operations within a Postgres transaction, enforcing Row-Level Security (RLS)
 * by setting the transaction-local session variable 'app.current_tenant_id' to the workspace UUID.
 *
 * @param tenantId The UUID string of the workspace/tenant
 * @param callback Async function containing database queries to run under this tenant's scope
 */
export async function withTenant<T>(
  tenantId: string,
  callback: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Inject the current tenant ID into the transaction context.
    // SET LOCAL is scoped strictly to the transaction block, preventing data leakage across pooled connections.
    await tx.execute(sql`SET LOCAL app.current_tenant_id = ${tenantId}::uuid`);
    // biome-ignore lint/suspicious/noExplicitAny: tx must be cast to any to match query callback parameter
    return await callback(tx as any);
  });
}
