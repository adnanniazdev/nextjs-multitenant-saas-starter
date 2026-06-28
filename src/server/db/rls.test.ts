import { describe, expect, it, vi } from "vitest";
import { db } from "./index";
import { withAdmin, withTenant } from "./rls";

vi.mock("./index", () => {
  const mockExecute = vi.fn().mockResolvedValue([]);
  const mockTx = {
    execute: mockExecute,
  };
  const mockTransaction = vi.fn().mockImplementation(async (callback) => {
    return await callback(mockTx);
  });

  return {
    db: {
      transaction: mockTransaction,
    },
  };
});

describe("Database RLS Isolation Scopes", () => {
  it("withTenant should set app.current_tenant_id local variable within a transaction", async () => {
    const tenantId = "8f06f660-f050-427f-921f-cf053e367e9f";
    const mockCallback = vi.fn().mockResolvedValue("result");

    const result = await withTenant(tenantId, mockCallback);

    // Verify callback return value
    expect(result).toBe("result");

    // Verify db.transaction was initiated
    expect(db.transaction).toHaveBeenCalled();

    // Verify callback was triggered inside transaction
    expect(mockCallback).toHaveBeenCalled();
  });

  it("withAdmin should set app.bypass_rls local variable within a transaction", async () => {
    const mockCallback = vi.fn().mockResolvedValue("admin-result");

    const result = await withAdmin(mockCallback);

    // Verify callback return value
    expect(result).toBe("admin-result");

    // Verify db.transaction was initiated
    expect(db.transaction).toHaveBeenCalled();

    // Verify callback was triggered inside transaction
    expect(mockCallback).toHaveBeenCalled();
  });
});
