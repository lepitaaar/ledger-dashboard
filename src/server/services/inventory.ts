import { Types } from 'mongoose';
import { INVENTORY_BASELINE_DATE_KEY } from '@/lib/inventory';
import { ProductModel } from '@/server/models/product';
import { AuctionPurchaseModel } from '@/server/models/auction-purchase';
import { TransactionModel } from '@/server/models/transaction';
import { InventoryMovementModel, InventoryMovement } from '@/server/models/inventory-movement';

interface CombinedMovement {
  _id: Types.ObjectId;
  type: 'purchase' | 'sale' | 'return';
  dateKey: string;
  timeKey: string;
  qty: number;         // trqt for purchase, qty for sales/returns
  unitPrice: number;   // actoUpr for purchase, unitPrice for sales/returns
  amount: number;      // selAm for purchase, amount for sales/returns
}

/**
 * 특정 상품에 대한 재고 원장(InventoryMovement)을 기준일부터 다시 계산하여 DB에 저장합니다.
 */
export async function recalculateInventory(productId: string | Types.ObjectId): Promise<void> {
  const prodId = new Types.ObjectId(productId);

  // 1. 해당 상품의 기존 재고 원장 삭제
  await InventoryMovementModel.deleteMany({ productId: prodId });

  // 2. 상품 기초 재고 가져오기
  const product = await ProductModel.findOne({ _id: prodId, deletedAt: null });
  if (!product) {
    return;
  }

  const initialQty = product.initialQty || 0;
  const initialCost = product.initialCost || 0;

  const movementsToSave: Partial<InventoryMovement>[] = [];

  let currentQty = 0;
  let currentAvgCost = 0;
  let isInsufficient = false;

  // 기초 재고가 설정되어 있다면 최초 이동 기록으로 추가
  if (initialQty > 0 || initialCost > 0) {
    currentQty = initialQty;
    currentAvgCost = initialCost;

    movementsToSave.push({
      productId: prodId,
      type: 'initial',
      referenceId: null,
      dateKey: INVENTORY_BASELINE_DATE_KEY,
      timeKey: '00:00:00',
      qtyChange: initialQty,
      unitPrice: initialCost,
      amount: initialQty * initialCost,
      costApplied: initialCost,
      endingQty: currentQty,
      endingMovingAvg: currentAvgCost,
      status: 'normal'
    });
  }

  // 3. 기준일 이후 경매 매입 내역 로드
  const purchases = await AuctionPurchaseModel.find({
    productId: prodId,
    isActive: true,
    dateKey: { $gte: INVENTORY_BASELINE_DATE_KEY }
  }).lean();

  // 4. 기준일 이후 매출/반품 거래 내역 로드
  const transactions = await TransactionModel.find({
    productId: prodId,
    deletedAt: null,
    dateKey: { $gte: INVENTORY_BASELINE_DATE_KEY }
  }).lean();

  // 5. 정렬 가능한 통합 이동 리스트 생성
  const combinedList: CombinedMovement[] = [];

  purchases.forEach((p) => {
    combinedList.push({
      _id: p._id as Types.ObjectId,
      type: 'purchase',
      dateKey: p.dateKey,
      timeKey: '00:00:00', // 매입은 해당 날짜의 처음에 오도록 고정
      qty: p.trqt,
      unitPrice: p.actoUpr,
      amount: p.selAm
    });
  });

  transactions.forEach((t) => {
    combinedList.push({
      _id: t._id as Types.ObjectId,
      type: t.qty < 0 ? 'return' : 'sale',
      dateKey: t.dateKey,
      timeKey: t.registeredTimeKST || '00:00:00',
      qty: t.qty,
      unitPrice: t.unitPrice,
      amount: t.amount
    });
  });

  // 6. 날짜 및 시간 순 정렬
  // 규칙: 날짜 오름차순 -> 시간 오름차순 -> 매입(type: 'purchase')이 매출(sale/return)보다 항상 앞에 오도록 정렬
  combinedList.sort((a, b) => {
    if (a.dateKey !== b.dateKey) {
      return a.dateKey.localeCompare(b.dateKey);
    }

    // 같은 날짜 내 정렬
    const aOrder = a.type === 'purchase' ? 0 : 1;
    const bOrder = b.type === 'purchase' ? 0 : 1;
    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.timeKey.localeCompare(b.timeKey);
  });

  // 7. 이동평균 및 재고수량 추적 루프
  for (const item of combinedList) {
    if (item.type === 'purchase') {
      const purchaseQty = item.qty;
      const purchaseAm = item.amount;
      const purchasePrice = item.unitPrice;

      if (currentQty < 0) {
        // 재고 부족 상태에서 매입이 발생한 경우, 이전 재고 부족분의 단가를 무시하고 새로 매입한 단가로 갱신
        currentAvgCost = purchasePrice;
      } else if (currentQty + purchaseQty > 0) {
        // 기존 재고가 0 이상이고 매입 후 총량이 0보다 큰 경우 이동평균 원가 공식 적용
        currentAvgCost = (currentQty * currentAvgCost + purchaseAm) / (currentQty + purchaseQty);
      }

      currentQty += purchaseQty;

      movementsToSave.push({
        productId: prodId,
        type: 'purchase',
        referenceId: item._id,
        dateKey: item.dateKey,
        timeKey: item.timeKey,
        qtyChange: purchaseQty,
        unitPrice: purchasePrice,
        amount: purchaseAm,
        costApplied: purchasePrice,
        endingQty: currentQty,
        endingMovingAvg: currentAvgCost,
        status: isInsufficient ? 'insufficient_inventory' : 'normal'
      });

    } else if (item.type === 'sale') {
      const saleQty = item.qty; // 양수값 (판매 개수)

      // 판매 시점에 재고가 판매량보다 부족한 경우
      if (currentQty < saleQty) {
        isInsufficient = true;
      }

      currentQty -= saleQty;

      movementsToSave.push({
        productId: prodId,
        type: 'sale',
        referenceId: item._id,
        dateKey: item.dateKey,
        timeKey: item.timeKey,
        qtyChange: -saleQty,
        unitPrice: item.unitPrice,
        amount: item.amount,
        costApplied: currentAvgCost,
        endingQty: currentQty,
        endingMovingAvg: currentAvgCost,
        status: isInsufficient ? 'insufficient_inventory' : 'normal'
      });

    } else if (item.type === 'return') {
      const returnQty = Math.abs(item.qty); // 반품 수량 (양수로 변환)

      currentQty += returnQty;

      movementsToSave.push({
        productId: prodId,
        type: 'return',
        referenceId: item._id,
        dateKey: item.dateKey,
        timeKey: item.timeKey,
        qtyChange: returnQty,
        unitPrice: item.unitPrice,
        amount: item.amount, // 음수 금액
        costApplied: currentAvgCost,
        endingQty: currentQty,
        endingMovingAvg: currentAvgCost,
        status: isInsufficient ? 'insufficient_inventory' : 'normal'
      });
    }
  }

  // 8. DB에 한꺼번에 기록
  if (movementsToSave.length > 0) {
    await InventoryMovementModel.insertMany(movementsToSave);
  }
}

/**
 * 시스템 내 모든 상품의 재고 원장을 재계산합니다.
 */
export async function recalculateAllInventory(): Promise<void> {
  const products = await ProductModel.find({ deletedAt: null }).select('_id').lean();
  for (const prod of products) {
    await recalculateInventory(prod._id as Types.ObjectId);
  }
}

export interface InventoryStatusItem {
  productId: string;
  productName: string;
  productUnit: string;
  initialQty: number;
  initialCost: number;
  currentQty: number;
  currentAvgCost: number;
  totalAssetValue: number;
  isInsufficient: boolean;
}

/**
 * 모든 상품의 현재 공동재고 상태를 반환합니다.
 */
export async function getInventoryStatus(): Promise<InventoryStatusItem[]> {
  const products = await ProductModel.find({ deletedAt: null }).sort({ name: 1 }).lean();
  const result: InventoryStatusItem[] = [];

  for (const prod of products) {
    // 가장 최신의 재고 변동 내역 조회
    const latestMove = await InventoryMovementModel.findOne({ productId: prod._id })
      .sort({ dateKey: -1, timeKey: -1, _id: -1 })
      .lean();

    const move = latestMove as unknown as InventoryMovement | null;
    const currentQty = move ? move.endingQty : (prod.initialQty || 0);
    const currentAvgCost = move ? move.endingMovingAvg : (prod.initialCost || 0);
    const isInsufficient = currentQty < 0 || (move ? move.status === 'insufficient_inventory' : false);

    result.push({
      productId: String(prod._id),
      productName: prod.name,
      productUnit: prod.unit || '',
      initialQty: prod.initialQty || 0,
      initialCost: prod.initialCost || 0,
      currentQty,
      currentAvgCost,
      totalAssetValue: currentQty > 0 ? Number((currentQty * currentAvgCost).toFixed(2)) : 0,
      isInsufficient
    });
  }

  return result;
}

export interface ProfitLossResult {
  periodRevenue: number;         // 기간 매출액 (정상 매출 + 정상 반품 합산)
  periodCostOfSales: number;     // 기간 매출원가
  periodExpectedProfit: number;  // 예상 매출총이익 (매출액 - 매출원가)
  profitMargin: number;          // 매출총이익률 (이익 / 매출액)

  overallCount: number;          // 총 판매 건수 (반품 포함)
  overallRevenue: number;        // 총 판매 금액 (반품 포함)
  includedCount: number;         // 이익 계산에 포함된 건수
  includedRevenue: number;       // 이익 계산에 포함된 매출액
  excludedCount: number;         // 계산에서 제외된 건수 (미매핑 또는 재고 부족)
  excludedRevenue: number;       // 계산에서 제외된 매출액
  coverageRatio: number;         // 원가 계산 포함률 (includedCount / overallCount)
}

/**
 * 특정 기간 동안의 손익 분석 통계를 가져옵니다.
 */
export async function getProfitLoss(startKey: string, endKey: string): Promise<ProfitLossResult> {
  // 1. 기간에 해당하는 모든 매출/반품 거래 조회
  // 매핑되지 않은 거래는 `InventoryMovement`가 없으므로 기존 `Transaction` 데이터와 아우터 조인을 해야 합니다.
  // 효율적인 계산을 위해 전체 거래와 `InventoryMovement`를 비교 집계합니다.
  const transactions = await TransactionModel.find({
    deletedAt: null,
    dateKey: { $gte: startKey, $lte: endKey }
  }).lean();

  const transactionIds = transactions.map(t => t._id);

  // 해당 거래들의 재고 변동 내역 조회
  const movements = await InventoryMovementModel.find({
    referenceId: { $in: transactionIds },
    type: { $in: ['sale', 'return'] }
  }).lean();

  const movementMap = new Map<string, typeof movements[0]>();
  movements.forEach(m => {
    if (m.referenceId) {
      movementMap.set(String(m.referenceId), m);
    }
  });

  let periodRevenue = 0;
  let periodCostOfSales = 0;

  const overallCount = transactions.length;
  let overallRevenue = 0;
  let includedCount = 0;
  let includedRevenue = 0;
  let excludedCount = 0;
  let excludedRevenue = 0;

  for (const t of transactions) {
    const tId = String(t._id);
    const amount = t.amount; // 매출: 양수, 반품: 음수
    overallRevenue += amount;

    const move = movementMap.get(tId);

    // 원가 계산 불가능 사유: 상품 매핑이 안 되었거나(move 없음) 혹은 재고 부족 상태(status: 'insufficient_inventory')
    if (!move || move.status === 'insufficient_inventory') {
      excludedCount++;
      excludedRevenue += amount;
    } else {
      includedCount++;
      includedRevenue += amount;

      // 매출액 누적
      periodRevenue += amount;

      // 매출원가 계산: 판매원가 = -qtyChange * costApplied
      // t.qty가 양수(매출)이면 qtyChange는 음수이므로 -qtyChange는 양수(판매 수량)가 됨
      // t.qty가 음수(반품)이면 qtyChange는 양수이므로 -qtyChange는 음수가 됨(반품 원가 감소)
      const costOfSale = -move.qtyChange * move.costApplied;
      periodCostOfSales += costOfSale;
    }
  }

  const periodExpectedProfit = periodRevenue - periodCostOfSales;
  const profitMargin = periodRevenue !== 0 ? periodExpectedProfit / periodRevenue : 0;
  const coverageRatio = overallCount > 0 ? includedCount / overallCount : 1.0;

  return {
    periodRevenue,
    periodCostOfSales,
    periodExpectedProfit,
    profitMargin,
    overallCount,
    overallRevenue,
    includedCount,
    includedRevenue,
    excludedCount,
    excludedRevenue,
    coverageRatio
  };
}
