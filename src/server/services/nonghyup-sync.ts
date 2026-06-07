import { DateTime } from 'luxon';
import { fetchNonghyupAuctions, AuctionPurchaseItem } from './nonghyup-client';
import { AuctionPurchaseModel, AuctionPurchase } from '@/server/models/auction-purchase';
import { AuctionSyncRunModel } from '@/server/models/auction-sync-run';
import { AuctionProductMappingModel } from '@/server/models/auction-product-mapping';
import { AuctionSyncLockModel } from '@/server/models/auction-sync-lock';
import { TransactionModel } from '@/server/models/transaction';
import { ProductModel } from '@/server/models/product';
import { recalculateInventory } from './inventory';

export interface AuctionSyncResult {
  status: 'success' | 'failed';
  queryCount: number;
  insertedCount: number;
  updatedCount: number;
  canceledCount: number;
  failedCount: number;
  error: string | null;
  executionTimeMs: number;
}

function purchaseKey(purchase: Partial<AuctionPurchase>): string {
  return [
    purchase.dateKey,
    purchase.naBzplc,
    purchase.gbn,
    purchase.oslpNo,
    purchase.aucNo,
    purchase.naLatc
  ].join('_');
}

/**
 * 동기화 프로세스에 대한 분산 DB 락을 획득합니다.
 * 락은 최대 30분 동안 유효하며, 오래된 락만 원자적으로 대체합니다.
 */
async function acquireLock(): Promise<void> {
  const staleTime = new Date(Date.now() - 30 * 60 * 1000);

  await AuctionSyncLockModel.updateOne(
    { key: 'sync_lock' },
    { $setOnInsert: { isLocked: false, lockedAt: null } },
    { upsert: true }
  );

  const lock = await AuctionSyncLockModel.findOneAndUpdate(
    {
      key: 'sync_lock',
      $or: [
        { isLocked: false },
        { lockedAt: null },
        { lockedAt: { $lt: staleTime } }
      ]
    },
    { $set: { isLocked: true, lockedAt: new Date() } },
    { new: true }
  );

  if (!lock) {
    throw new Error('다른 동기화 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.');
  }
}

/**
 * 동기화 프로세스 락을 해제합니다.
 */
async function releaseLock(): Promise<void> {
  await AuctionSyncLockModel.updateOne(
    { key: 'sync_lock' },
    { isLocked: false, lockedAt: null }
  );
}

/**
 * 두개의 경매 매입 레코드가 동일한지 값을 비교합니다.
 */
function isSamePurchase(a: Partial<AuctionPurchase>, b: Partial<AuctionPurchase>): boolean {
  return (
    a.dateKey === b.dateKey &&
    a.naBzplc === b.naBzplc &&
    a.gbn === b.gbn &&
    a.oslpNo === b.oslpNo &&
    a.aucNo === b.aucNo &&
    a.naLatc === b.naLatc &&
    a.wmcLatcnm === b.wmcLatcnm &&
    a.wmSogmnm === b.wmSogmnm &&
    Number(a.wmWt) === Number(b.wmWt) &&
    a.grdWmBaseInfCnm === b.grdWmBaseInfCnm &&
    Number(a.budlCn) === Number(b.budlCn) &&
    a.szeWmBaseInfCnm === b.szeWmBaseInfCnm &&
    Number(a.trqt) === Number(b.trqt) &&
    Number(a.actoUpr) === Number(b.actoUpr) &&
    Number(a.selAm) === Number(b.selAm) &&
    (a.etcRmkCntn || null) === (b.etcRmkCntn || null)
  );
}

/**
 * 특정 일자의 경매 내역을 농협 API로부터 페이지네이션하여 모두 가져온 뒤 검증합니다.
 */
async function fetchAndValidateDailyAuctions(dateKey: string): Promise<{
  isValid: boolean;
  items: AuctionPurchaseItem[];
  queryCount: number;
  error?: string;
}> {
  let pageNo = 1;
  const inqCn = '20';
  const allItems: AuctionPurchaseItem[] = [];
  let queryCount = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const response = await fetchNonghyupAuctions(dateKey, pageNo, inqCn);
      const { cCnt, resultList } = response;

      queryCount = cCnt;

      // cCnt는 합계 행을 제외한 실제 낙찰 건수입니다.
      // resultList에는 데이터 상세와 마지막 행으로 "합계" 행이 섞여 있을 수 있습니다.
      const detailItems = resultList.filter(item => item.wmcLatcnm !== '합계');
      const sumItem = resultList.find(item => item.wmcLatcnm === '합계');

      allItems.push(...detailItems);

      // 더 가져올 데이터가 있는지 확인
      if (allItems.length >= cCnt || resultList.length === 0) {
        hasMore = false;

        // 최종 수집 건수 및 합계 검증
        if (allItems.length !== cCnt) {
          return {
            isValid: false,
            items: [],
            queryCount,
            error: `수집 데이터 건수 불일치: API 건수 ${cCnt}개이나 실제 ${allItems.length}개 로드됨`
          };
        }

        if (sumItem) {
          const sumTrqt = allItems.reduce((acc, cur) => acc + cur.trqt, 0);
          const sumSelAm = allItems.reduce((acc, cur) => acc + cur.selAm, 0);

          if (sumTrqt !== sumItem.trqt || sumSelAm !== sumItem.selAm) {
            return {
              isValid: false,
              items: [],
              queryCount,
              error: `합계 검증 실패: 수량 합(${sumTrqt} vs ${sumItem.trqt}), 금액 합(${sumSelAm} vs ${sumItem.selAm})`
            };
          }
        } else if (cCnt > 0) {
          // 데이터가 있는데 합계 행이 없으면 경고 후 실패 처리
          return {
            isValid: false,
            items: [],
            queryCount,
            error: '합계 검증 실패: 합계 행(wmcLatcnm === "합계")을 찾을 수 없습니다.'
          };
        }
      } else {
        if (detailItems.length === 0) {
          return {
            isValid: false,
            items: [],
            queryCount,
            error: `페이지네이션 중단: ${pageNo}페이지에서 상세 데이터가 추가되지 않았습니다.`
          };
        }
        pageNo++;
      }
    }

    return {
      isValid: true,
      items: allItems,
      queryCount
    };
  } catch (err) {
    return {
      isValid: false,
      items: [],
      queryCount: 0,
      error: `API 요청 에러: ${(err as Error).message}`
    };
  }
}

/**
 * 신규 매입건 및 거래 매출건의 상품 마스터 매핑을 연결하고 재고 원장을 갱신합니다.
 */
async function applyMappingAndRecalculate(affectedProductIds: Set<string>): Promise<void> {
  // 1. 미매핑된 경매 매입건에 대한 자동 상품 연결
  const unmappedPurchases = await AuctionPurchaseModel.find({ productId: null, isActive: true });
  for (const purchase of unmappedPurchases) {
    const mapping = await AuctionProductMappingModel.findOne({
      naBzplc: purchase.naBzplc,
      gbn: purchase.gbn,
      naLatc: purchase.naLatc
    });
    if (mapping) {
      purchase.productId = mapping.productId;
      await purchase.save();
      affectedProductIds.add(String(mapping.productId));
    }
  }

  // 2. 미매핑된 매출/반품 거래(Transaction)에 대해 상품명+규격이 정확히 일치할 때 자동 연결
  const unmappedTransactions = await TransactionModel.find({ productId: null, deletedAt: null });
  for (const tx of unmappedTransactions) {
    const product = await ProductModel.findOne({
      name: tx.productName,
      unit: tx.productUnit || undefined,
      deletedAt: null
    });
    if (product) {
      tx.productId = product._id;
      await tx.save();
      affectedProductIds.add(String(product._id));
    }
  }

  // 3. 변경사항이 발생한 모든 상품의 재고 원장 재계산
  for (const prodId of affectedProductIds) {
    await recalculateInventory(prodId);
  }
}

/**
 * 지정된 날짜 범위에 대해 농협 공판장 낙찰 데이터를 동기화합니다.
 * @param startKey 'YYYY-MM-DD'
 * @param endKey 'YYYY-MM-DD'
 */
export async function syncAuctionPurchases(startKey: string, endKey: string): Promise<AuctionSyncResult> {
  const startDt = DateTime.fromFormat(startKey, 'yyyy-MM-dd', { zone: 'Asia/Seoul' });
  const endDt = DateTime.fromFormat(endKey, 'yyyy-MM-dd', { zone: 'Asia/Seoul' });

  if (
    !startDt.isValid ||
    !endDt.isValid ||
    startDt.toFormat('yyyy-MM-dd') !== startKey ||
    endDt.toFormat('yyyy-MM-dd') !== endKey ||
    startDt > endDt
  ) {
    throw new Error('동기화 기간은 올바른 YYYY-MM-DD 형식이어야 하며 시작일이 종료일보다 늦을 수 없습니다.');
  }

  const startTime = Date.now();
  await acquireLock();

  // 실행 로그 인스턴스 생성
  const runLog = await AuctionSyncRunModel.create({
    startDateKey: startKey,
    endDateKey: endKey,
    status: 'running'
  });

  const affectedProductIds = new Set<string>();
  let totalQueryCount = 0;
  let totalInsertedCount = 0;
  let totalUpdatedCount = 0;
  let totalCanceledCount = 0;
  let totalFailedCount = 0;
  let firstError: string | null = null;

  try {
    // 날짜별 루프 생성
    const daysCount = Math.floor(endDt.diff(startDt, 'days').days) + 1;

    const dates: string[] = [];
    for (let i = 0; i < daysCount; i++) {
      dates.push(startDt.plus({ days: i }).toFormat('yyyy-MM-dd'));
    }

    // 월별로 묶어 한 날짜라도 검증에 실패하면 해당 월 요청 범위를 반영하지 않습니다.
    const groups: Record<string, string[]> = {};
    dates.forEach(d => {
      const monthKey = d.substring(0, 7); // 'YYYY-MM'
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(d);
    });

    for (const [monthKey, monthDates] of Object.entries(groups)) {
      // 1. 해당 월에 속하는 날짜들의 API 데이터 모두 수집
      const monthApiPurchases: Partial<AuctionPurchase>[] = [];
      let monthValid = true;

      for (const d of monthDates) {
        const result = await fetchAndValidateDailyAuctions(d);
        totalQueryCount += result.queryCount;

        if (!result.isValid) {
          totalFailedCount += result.queryCount || 1;
          monthValid = false;
          if (!firstError) firstError = result.error || '검증 실패';
          console.error(`[SyncService] ${d} 동기화 실패: ${result.error}`);
          break;
        }

        result.items.forEach(item => {
          monthApiPurchases.push({
            dateKey: d,
            naBzplc: item.naBzplc || '',
            gbn: item.gbn || '1',
            oslpNo: item.oslpNo,
            aucNo: item.aucNo,
            naLatc: item.naLatc,
            wmcLatcnm: item.wmcLatcnm,
            wmSogmnm: item.wmSogmnm,
            wmWt: item.wmWt,
            grdWmBaseInfCnm: item.grdWmBaseInfCnm,
            budlCn: item.budlCn,
            szeWmBaseInfCnm: item.szeWmBaseInfCnm,
            trqt: item.trqt,
            actoUpr: item.actoUpr,
            selAm: item.selAm,
            etcRmkCntn: item.etcRmkCntn,
            productId: null,
            isActive: true
          });
        });
      }

      // 해당 월의 모든 날짜 연동이 정상적으로 끝난 경우에만 반영
      if (monthValid) {
        // 취소된 과거 레코드도 함께 조회해 재활성화와 고유키 upsert를 안전하게 처리합니다.
        const dbPurchases = await AuctionPurchaseModel.find({
          dateKey: { $in: monthDates }
        }).lean<AuctionPurchase[]>();

        const dbByKey = new Map(dbPurchases.map(item => [purchaseKey(item), item]));
        const apiKeys = new Set(monthApiPurchases.map(purchaseKey));
        const activeDbPurchases = dbPurchases.filter(item => item.isActive);
        const isDifferent =
          activeDbPurchases.length !== monthApiPurchases.length ||
          monthApiPurchases.some((item) => {
            const existing = dbByKey.get(purchaseKey(item));
            return !existing || !existing.isActive || !isSamePurchase(item, existing);
          });

        if (!isDifferent) {
          console.log(`[SyncService] 월(${monthKey}) 데이터 변경 사항 없음. 업데이트를 생략합니다.`);
          continue;
        }

        console.log(`[SyncService] 월(${monthKey}) 데이터 불일치 감지. 고유키 기준으로 안전하게 반영합니다.`);

        const operations: Parameters<typeof AuctionPurchaseModel.bulkWrite>[0] = [];

        for (const apiItem of monthApiPurchases) {
          const key = purchaseKey(apiItem);
          const existing = dbByKey.get(key);
          const purchaseFields = { ...apiItem };
          delete purchaseFields.productId;

          if (!existing) {
            totalInsertedCount++;
          } else {
            if (!existing.isActive || !isSamePurchase(apiItem, existing)) {
              totalUpdatedCount++;
            }
            if (existing.productId) {
              affectedProductIds.add(String(existing.productId));
            }
          }

          operations.push({
            updateOne: {
              filter: {
                dateKey: apiItem.dateKey,
                naBzplc: apiItem.naBzplc,
                gbn: apiItem.gbn,
                oslpNo: apiItem.oslpNo,
                aucNo: apiItem.aucNo,
                naLatc: apiItem.naLatc
              },
              update: {
                $set: { ...purchaseFields, isActive: true },
                $setOnInsert: { productId: null }
              },
              upsert: true
            }
          });
        }

        for (const existing of activeDbPurchases) {
          if (!apiKeys.has(purchaseKey(existing))) {
            totalCanceledCount++;
            if (existing.productId) {
              affectedProductIds.add(String(existing.productId));
            }
            operations.push({
              updateOne: {
                filter: { _id: existing._id },
                update: { $set: { isActive: false } }
              }
            });
          }
        }

        if (operations.length > 0) {
          await AuctionPurchaseModel.bulkWrite(operations, { ordered: false });
        }
      }
    }

    // 맵핑 연결 및 재고 재계산 트리거 실행
    await applyMappingAndRecalculate(affectedProductIds);

    // 로그 업데이트 (성공)
    runLog.status = firstError ? 'failed' : 'success';
    runLog.queryCount = totalQueryCount;
    runLog.insertedCount = totalInsertedCount;
    runLog.updatedCount = totalUpdatedCount;
    runLog.canceledCount = totalCanceledCount;
    runLog.failedCount = totalFailedCount;
    runLog.error = firstError;
    runLog.executionTimeMs = Date.now() - startTime;
    await runLog.save();

    return {
      status: runLog.status,
      queryCount: totalQueryCount,
      insertedCount: totalInsertedCount,
      updatedCount: totalUpdatedCount,
      canceledCount: totalCanceledCount,
      failedCount: totalFailedCount,
      error: firstError,
      executionTimeMs: runLog.executionTimeMs
    };
  } catch (error) {
    console.error('[SyncService] 동기화 중 오류 발생:', error);
    runLog.status = 'failed';
    runLog.error = (error as Error).message;
    runLog.executionTimeMs = Date.now() - startTime;
    await runLog.save();
    throw error;
  } finally {
    await releaseLock();
  }
}
