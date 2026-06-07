import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProductModel } from "@/server/models/product";
import { writeAuditLog } from "@/server/services/audit";
import { ensureProductByName } from "@/server/services/products";

vi.mock("@/server/models/product", () => ({
  ProductModel: {
    findOne: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/server/services/audit", () => ({
  writeAuditLog: vi.fn(),
}));

describe("ensureProductByName", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses an active product with the same name", async () => {
    const existing = { _id: "product-1", name: "대파", unit: "단" };
    vi.mocked(ProductModel.findOne).mockResolvedValue(existing as never);

    await expect(ensureProductByName(" 대파 ")).resolves.toBe(existing);
    expect(ProductModel.findOne).toHaveBeenCalledWith({
      name: "대파",
      deletedAt: null,
    });
    expect(ProductModel.create).not.toHaveBeenCalled();
  });

  it("creates a missing product without a specification", async () => {
    const created = {
      _id: "product-2",
      name: "새품목",
      toObject: () => ({ _id: "product-2", name: "새품목" }),
    };
    vi.mocked(ProductModel.findOne).mockResolvedValue(null);
    vi.mocked(ProductModel.create).mockResolvedValue(created as never);

    await expect(ensureProductByName("새품목")).resolves.toBe(created);
    expect(ProductModel.create).toHaveBeenCalledWith({
      name: "새품목",
      unit: undefined,
      initialQty: 0,
      initialCost: 0,
    });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create",
        entityType: "product",
        entityId: "product-2",
      }),
    );
  });
});
