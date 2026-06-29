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
    // We use the built-in 'set_config' function instead of the 'SET LOCAL' utility command.
    // This allows parameter binding and is compatible with PgBouncer transaction pooling.
    await tx.execute(
      sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
    );
    // biome-ignore lint/suspicious/noExplicitAny: tx must be cast to any to match query callback parameter
    return await callback(tx as any);
  });
}

/**
 * Executes database operations within a Postgres transaction, bypassing Row-Level Security (RLS)
 * by setting the transaction-local session variable 'app.bypass_rls' to 'true'.
 * Use this ONLY for administrative tasks (like routing resolution or background webhook syncs).
 *
 * @param callback Async function containing database queries to run with RLS bypassed
 */
export async function withAdmin<T>(
  callback: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return await db.transaction(async (tx) => {
    // Enable RLS bypass in the current transaction scope.
    await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`);
    // biome-ignore lint/suspicious/noExplicitAny: tx must be cast to any to match query callback parameter
    return await callback(tx as any);
  });
}
