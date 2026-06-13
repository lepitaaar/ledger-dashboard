import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';
import { recalculateInventory } from '../src/server/services/inventory';
import { ProductModel } from '../src/server/models/product';
import { AuctionPurchaseModel } from '../src/server/models/auction-purchase';
import { TransactionModel } from '../src/server/models/transaction';
import { InventoryMovementModel } from '../src/server/models/inventory-movement';

// Mongoose 모델들 모킹
vi.mock('../src/server/models/product', () => ({
  ProductModel: {
    findOne: vi.fn()
  }
}));

vi.mock('../src/server/models/auction-purchase', () => ({
  AuctionPurchaseModel: {
    find: vi.fn()
  }
}));

vi.mock('../src/server/models/transaction', () => ({
  TransactionModel: {
    find: vi.fn()
  }
}));

vi.mock('../src/server/models/inventory-movement', () => ({
  InventoryMovementModel: {
    deleteMany: vi.fn(),
    insertMany: vi.fn()
  }
}));

describe('Inventory Ledger Recalculation', () => {
  const session = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should calculate moving average cost correctly with purchases and sales', async () => {
    const mockProductId = new Types.ObjectId();

    // 1. Mock Product Baseline: 10 items at 1,000 won initial cost
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: () => ({
        _id: mockProductId,
        name: 'Test Cabbage',
        initialQty: 10,
        initialCost: 1000,
        deletedAt: null
      })
    } as any);

    // 2. Mock Purchases: Buy 10 items at 2,000 won
    vi.mocked(AuctionPurchaseModel.find).mockReturnValue({
      session: () => ({
        lean: () => [
          {
            _id: new Types.ObjectId(),
            productId: mockProductId,
            dateKey: '2026-01-05',
            trqt: 10,
            actoUpr: 2000,
            selAm: 20000,
            isActive: true
          }
        ]
      })
    } as any);

    // 3. Mock Transactions: Sell 15 items on 2026-01-10
    vi.mocked(TransactionModel.find).mockReturnValue({
      session: () => ({
        lean: () => [
          {
            _id: new Types.ObjectId(),
            productId: mockProductId,
            dateKey: '2026-01-10',
            qty: 15,
            unitPrice: 3000,
            amount: 45000,
            registeredTimeKST: '14:30:00',
            deletedAt: null
          }
        ]
      })
    } as any);

    let capturedMovements: any[] = [];
    vi.mocked(InventoryMovementModel.insertMany).mockImplementation((docs) => {
      capturedMovements = docs as unknown as any[];
      return Promise.resolve(docs as any);
    });

    // Run recalculation
    await recalculateInventory(mockProductId, session);

    // Assertions
    expect(InventoryMovementModel.deleteMany).toHaveBeenCalledWith(
      { productId: mockProductId },
      { session }
    );
    expect(InventoryMovementModel.insertMany).toHaveBeenCalled();

    // 기대 결과 타임라인:
    // 1. Initial (2026-01-01): qty=10, cost=1,000, total=10,000
    // 2. Purchase (2026-01-05): qty=+10, price=2,000. New Avg = (10*1000 + 20000) / 20 = 1,500. Total Qty = 20.
    // 3. Sale (2026-01-10): qty=-15, price=3,000, costApplied=1,500. Total Qty = 5. Avg = 1,500.
    expect(capturedMovements).toHaveLength(3);

    const initMove = capturedMovements[0];
    expect(initMove.type).toBe('initial');
    expect(initMove.endingQty).toBe(10);
    expect(initMove.endingMovingAvg).toBe(1000);

    const purchaseMove = capturedMovements[1];
    expect(purchaseMove.type).toBe('purchase');
    expect(purchaseMove.endingQty).toBe(20);
    expect(purchaseMove.endingMovingAvg).toBe(1500);

    const saleMove = capturedMovements[2];
    expect(saleMove.type).toBe('sale');
    expect(saleMove.endingQty).toBe(5);
    expect(saleMove.endingMovingAvg).toBe(1500);
    expect(saleMove.costApplied).toBe(1500);
    expect(saleMove.status).toBe('normal');
  });

  it('should flag insufficient_inventory when current stock drops below zero', async () => {
    const mockProductId = new Types.ObjectId();

    // 1. Mock Product Baseline: No initial stock
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: () => ({
        _id: mockProductId,
        name: 'Test Carrot',
        initialQty: 0,
        initialCost: 0,
        deletedAt: null
      })
    } as any);

    // 2. Mock Purchases: None
    vi.mocked(AuctionPurchaseModel.find).mockReturnValue({
      session: () => ({ lean: () => [] })
    } as any);

    // 3. Mock Transactions: Sell 5 items (Stock out!)
    vi.mocked(TransactionModel.find).mockReturnValue({
      session: () => ({
        lean: () => [
          {
            _id: new Types.ObjectId(),
            productId: mockProductId,
            dateKey: '2026-01-02',
            qty: 5,
            unitPrice: 2000,
            amount: 10000,
            registeredTimeKST: '10:00:00',
            deletedAt: null
          }
        ]
      })
    } as any);

    let capturedMovements: any[] = [];
    vi.mocked(InventoryMovementModel.insertMany).mockImplementation((docs) => {
      capturedMovements = docs as unknown as any[];
      return Promise.resolve(docs as any);
    });

    await recalculateInventory(mockProductId, session);

    expect(capturedMovements).toHaveLength(1);
    const saleMove = capturedMovements[0];
    expect(saleMove.type).toBe('sale');
    expect(saleMove.endingQty).toBe(-5);
    expect(saleMove.status).toBe('insufficient_inventory');
  });

  it('keeps cost calculation blocked after the first inventory shortage', async () => {
    const mockProductId = new Types.ObjectId();

    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: () => ({
        _id: mockProductId,
        name: 'Test Onion',
        initialQty: 0,
        initialCost: 0,
        deletedAt: null
      })
    } as any);

    vi.mocked(AuctionPurchaseModel.find).mockReturnValue({
      session: () => ({
        lean: () => [
          {
            _id: new Types.ObjectId(),
            dateKey: '2026-01-03',
            trqt: 10,
            actoUpr: 1000,
            selAm: 10000
          }
        ]
      })
    } as any);

    vi.mocked(TransactionModel.find).mockReturnValue({
      session: () => ({
        lean: () => [
          {
            _id: new Types.ObjectId(),
            dateKey: '2026-01-02',
            qty: 5,
            unitPrice: 2000,
            amount: 10000,
            registeredTimeKST: '10:00:00'
          },
          {
            _id: new Types.ObjectId(),
            dateKey: '2026-01-04',
            qty: 1,
            unitPrice: 2000,
            amount: 2000,
            registeredTimeKST: '10:00:00'
          }
        ]
      })
    } as any);

    let capturedMovements: any[] = [];
    vi.mocked(InventoryMovementModel.insertMany).mockImplementation((docs) => {
      capturedMovements = docs as unknown as any[];
      return Promise.resolve(docs as any);
    });

    await recalculateInventory(mockProductId, session);

    expect(capturedMovements.map(move => move.status)).toEqual([
      'insufficient_inventory',
      'insufficient_inventory',
      'insufficient_inventory'
    ]);
  });

  it('keeps the existing ledger when source loading fails', async () => {
    const mockProductId = new Types.ObjectId();
    vi.mocked(ProductModel.findOne).mockReturnValue({
      session: () => ({
        _id: mockProductId,
        initialQty: 0,
        initialCost: 0
      })
    } as any);
    vi.mocked(AuctionPurchaseModel.find).mockReturnValue({
      session: () => ({
        lean: () => Promise.reject(new Error('purchase read failed'))
      })
    } as any);

    await expect(recalculateInventory(mockProductId, session)).rejects.toThrow('purchase read failed');
    expect(InventoryMovementModel.deleteMany).not.toHaveBeenCalled();
    expect(InventoryMovementModel.insertMany).not.toHaveBeenCalled();
  });
});
