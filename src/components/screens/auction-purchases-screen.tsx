"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, AlertCircle, CheckCircle2, Clock, Tag, User } from "lucide-react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import { buildQueryString, fetchJson } from "@/lib/client";
import { DATE_KEY_FORMAT, getTodayDateKey } from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";

type PurchaseRow = {
  _id: string;
  dateKey: string;
  naBzplc: string;
  gbn: string;
  oslpNo: number;
  aucNo: number;
  naLatc: string;
  wmcLatcnm: string;
  wmSogmnm: string;
  wmWt: number;
  grdWmBaseInfCnm: string;
  budlCn: number;
  szeWmBaseInfCnm: string;
  trqt: number;
  actoUpr: number;
  selAm: number;
  etcRmkCntn?: string;
  productId: string | null;
  productName: string | null;
  productUnit: string | null;
  isActive: boolean;
  hasAmountMismatch: boolean;
};

type SyncRun = {
  _id: string;
  startDateKey: string;
  endDateKey: string;
  status: 'running' | 'success' | 'failed';
  queryCount: number;
  insertedCount: number;
  updatedCount: number;
  canceledCount: number;
  failedCount: number;
  error?: string;
  executionTimeMs: number;
  createdAt: string;
};

type PurchaseListResponse = {
  data: PurchaseRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    periodTotalAmount: number;
    periodTotalQuantity: number;
    amountMismatchCount: number;
  };
};

type SyncHistoryResponse = {
  data: SyncRun[];
};

type ProductOption = {
  _id: string;
  name: string;
  unit?: string;
};

export function AuctionPurchasesScreen(): JSX.Element {
  const today = getTodayDateKey();
  const firstDayOfMonth = DateTime.now().setZone('Asia/Seoul').startOf('month').toFormat(DATE_KEY_FORMAT);

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [syncHistory, setSyncHistory] = useState<SyncRun[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [loading, setLoading] = useState(false);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Filters
  const [startKey, setStartKey] = useState(firstDayOfMonth);
  const [endKey, setEndKey] = useState(today);
  const [productId, setProductId] = useState("");
  const [mappingStatus, setMappingStatus] = useState("all"); // 'all' | 'mapped' | 'unmapped'
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [periodTotalAmount, setPeriodTotalAmount] = useState(0);
  const [periodTotalQuantity, setPeriodTotalQuantity] = useState(0);
  const [amountMismatchCount, setAmountMismatchCount] = useState(0);

  // Manual Sync Params
  const [syncStart, setSyncStart] = useState(today);
  const [syncEnd, setSyncEnd] = useState(today);
  const [syncSecret, setSyncSecret] = useState("");

  const productOptions = useMemo(() => {
    return [
      { value: "", label: "전체 상품" },
      ...products.map(p => ({ value: p._id, label: p.name + (p.unit ? ` (${p.unit})` : "") }))
    ];
  }, [products]);

  const loadMeta = useCallback(async () => {
    try {
      const productRes = await fetchJson<{ data: ProductOption[] }>("/api/products?page=1&limit=500");
      setProducts(productRes.data);
    } catch {
      toast.error("상품 데이터를 불러오지 못했습니다.");
    }
  }, []);

  const loadSyncHistory = useCallback(async () => {
    setSyncHistoryLoading(true);
    try {
      const res = await fetchJson<SyncHistoryResponse>("/api/auctions/sync");
      setSyncHistory(res.data);
    } catch {
      // 에러 로그는 콘솔로만
    } finally {
      setSyncHistoryLoading(false);
    }
  }, []);

  const loadPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const query = buildQueryString({
        page,
        limit: 50,
        startKey,
        endKey,
        productId: productId || undefined,
        mappingStatus: mappingStatus !== "all" ? mappingStatus : undefined,
        keyword: keyword || undefined
      });

      const res = await fetchJson<PurchaseListResponse>(`/api/auctions/purchases?${query}`);
      setRows(res.data);
      setTotalPages(res.meta.totalPages);
      setTotalCount(res.meta.total);
      setPeriodTotalAmount(res.meta.periodTotalAmount);
      setPeriodTotalQuantity(res.meta.periodTotalQuantity);
      setAmountMismatchCount(res.meta.amountMismatchCount);
    } catch (err) {
      toast.error((err as Error).message || "매입 내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, startKey, endKey, productId, mappingStatus, keyword]);

  useEffect(() => {
    void loadMeta();
    void loadSyncHistory();
  }, [loadMeta, loadSyncHistory]);

  useEffect(() => {
    void loadPurchases();
  }, [loadPurchases]);

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleSync = async () => {
    if (!syncSecret.trim()) {
      toast.warning("동기화 암호(Secret)를 입력해 주세요.");
      return;
    }

    setSyncLoading(true);

    try {
      const res = await fetch("/api/auctions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Secret": syncSecret
        },
        body: JSON.stringify({
          startDateKey: syncStart,
          endDateKey: syncEnd
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "동기화 실패");
      }

      toast.success(data.message || "동기화가 성공적으로 끝났습니다.");
      void loadSyncHistory();
      void loadPurchases();
    } catch (err) {
      toast.error((err as Error).message || "동기화에 실패했습니다.");
    } finally {
      setSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Gradient Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute -bottom-10 right-20 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>

        <div className="flex flex-col justify-between md:flex-row md:items-center">
          <div>
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">Nonghyup System Integration</span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">농협 경매 매입 관리</h1>
            <p className="mt-1 text-blue-100">농협 공판장 실시간 경매 낙찰 데이터를 동기화하고 매칭 상태를 검토합니다.</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-indigo-100 bg-white shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">총 매입 거래수</CardTitle>
            <div className="rounded-full bg-blue-50 p-2 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{formatCurrency(totalCount)} 건</div>
            <p className="text-xs text-slate-400 mt-1">지정 기간 내 유효 낙찰 내역</p>
          </CardContent>
        </Card>

        <Card className="border border-indigo-100 bg-white shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">총 매입 금액</CardTitle>
            <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
              <Tag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-700">{formatCurrency(periodTotalAmount)} 원</div>
            <p className="text-xs text-slate-400 mt-1">낙찰가와 수량의 실매입 합산</p>
          </CardContent>
        </Card>

        <Card className="border border-indigo-100 bg-white shadow-sm transition-all hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">평균 낙찰 단가</CardTitle>
            <div className="rounded-full bg-indigo-50 p-2 text-indigo-600">
              <User className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-indigo-800">
              {periodTotalQuantity > 0 ? formatCurrency(Math.round(periodTotalAmount / periodTotalQuantity)) : 0} 원
            </div>
            <p className={`mt-1 text-xs ${amountMismatchCount > 0 ? "font-semibold text-amber-600" : "text-slate-400"}`}>
              {amountMismatchCount > 0
                ? `수량 × 단가와 금액이 다른 ${amountMismatchCount}건 확인 필요`
                : "기간 전체 수량 기준 평균 매입 단가"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Data Table and Sync panel */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Left Side: Table & Filters */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-800">매입 필터링 및 조회</CardTitle>
              <CardDescription>기간 범위 및 상품 상태에 맞는 경매 목록을 보여줍니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-medium">조회 기간</span>
                  <div className="flex items-center gap-2">
                    <DatePicker value={startKey} onChange={(v) => { setStartKey(v); setPage(1); }} />
                    <span className="text-slate-400">~</span>
                    <DatePicker value={endKey} onChange={(v) => { setEndKey(v); setPage(1); }} />
                  </div>
                </div>

                <div className="flex flex-col gap-1 w-[200px]">
                  <span className="text-xs text-slate-500 font-medium">연결 상품 필터</span>
                  <Combobox
                    options={productOptions}
                    value={productId}
                    onSelect={(opt) => { setProductId(opt.value); setPage(1); }}
                    placeholder="상품명 선택..."
                    displayKey="label"
                    valueKey="value"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs text-slate-500 font-medium">매칭 여부</span>
                  <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                    {["all", "mapped", "unmapped"].map((status) => (
                      <button
                        key={status}
                        onClick={() => { setMappingStatus(status); setPage(1); }}
                        className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                          mappingStatus === status
                            ? "bg-white text-indigo-700 shadow-sm border border-slate-200"
                            : "text-slate-500 hover:text-indigo-600"
                        }`}
                      >
                        {status === "all" ? "전체" : status === "mapped" ? "매칭됨" : "미매칭"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="품목명 또는 출하자명을 검색하세요..."
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1"
                />
                <Button variant="default" onClick={handleSearch} className="bg-indigo-600 hover:bg-indigo-700">
                  <Search className="mr-1 h-4 w-4" />
                  검색
                </Button>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold">
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-3">경매일</th>
                      <th className="px-4 py-3">출하자</th>
                      <th className="px-4 py-3">경매품목(농협코드)</th>
                      <th className="px-4 py-3">규격 (등급/묶음/크기)</th>
                      <th className="px-4 py-3 text-right">수량</th>
                      <th className="px-4 py-3 text-right">낙찰가</th>
                      <th className="px-4 py-3 text-right">총액</th>
                      <th className="px-4 py-3">매칭상품</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-5 w-32" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-5 w-10 ml-auto" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                          <td className="px-4 py-3 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                          <td className="px-4 py-3"><Skeleton className="h-5 w-24" /></td>
                        </tr>
                      ))
                    ) : rows.length > 0 ? (
                      rows.map((row) => (
                        <tr
                          key={row._id}
                          className={`border-b border-slate-100 hover:bg-slate-50/80 transition-colors ${
                            !row.isActive ? "bg-slate-50 text-slate-400 line-through" : ""
                          }`}
                        >
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{row.dateKey}</td>
                          <td className="px-4 py-3 whitespace-nowrap">{row.wmSogmnm}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{row.wmcLatcnm}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{row.naLatc}</div>
                            {row.hasAmountMismatch && (
                              <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
                                <AlertCircle className="h-3 w-3" />
                                금액 불일치
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {row.grdWmBaseInfCnm}
                            </span>
                            <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {row.szeWmBaseInfCnm}
                            </span>
                            {row.budlCn > 0 && <span className="ml-1 text-xs font-mono">{row.budlCn}묶음</span>}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">{formatCurrency(row.trqt)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">{formatCurrency(row.actoUpr)}</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatCurrency(row.selAm)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.productId ? (
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold text-indigo-700">{row.productName}</span>
                                {row.productUnit && <span className="text-[10px] text-slate-500">{row.productUnit}</span>}
                              </div>
                            ) : (
                              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded border border-amber-200 font-semibold">
                                매칭 필요
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-slate-400 italic">
                          조회 기간 내 낙찰 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end pt-2">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Manual Sync & Logs */}
        <div className="space-y-6">
          {/* Sync Trigger Panel */}
          <Card className="border-border shadow-sm bg-gradient-to-b from-white to-slate-50">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <RefreshCw className={`h-5 w-5 ${syncLoading ? "animate-spin text-indigo-600" : "text-slate-500"}`} />
                경매 동기화
              </CardTitle>
              <CardDescription>농협 공판장 사이트에서 경매 데이터를 강제 수동 수집합니다.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">동기화 암호 (Secret)</label>
                <Input
                  type="password"
                  placeholder="Secret 키 입력..."
                  value={syncSecret}
                  onChange={(e) => setSyncSecret(e.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">시작일</label>
                  <DatePicker value={syncStart} onChange={setSyncStart} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-600">종료일</label>
                  <DatePicker value={syncEnd} onChange={setSyncEnd} />
                </div>
              </div>

              <Button
                variant="default"
                onClick={handleSync}
                disabled={syncLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold"
              >
                {syncLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    수집 중...
                  </>
                ) : (
                  "수동 동기화 실행"
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Sync History Logs */}
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">최근 동기화 로그</CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-y-auto divide-y divide-slate-100">
              {syncHistoryLoading ? (
                Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))
              ) : syncHistory.length > 0 ? (
                syncHistory.map((run) => (
                  <div key={run._id} className="p-4 hover:bg-slate-50 transition-colors text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-700">
                        {run.startDateKey === run.endDateKey
                          ? run.startDateKey
                          : `${run.startDateKey} ~ ${run.endDateKey}`}
                      </span>
                      {run.status === "success" ? (
                        <span className="flex items-center gap-1 font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" /> 성공
                        </span>
                      ) : run.status === "running" ? (
                        <span className="flex items-center gap-1 font-semibold text-blue-600 animate-pulse">
                          <Clock className="h-3 w-3" /> 진행중
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 font-semibold text-red-600">
                          <AlertCircle className="h-3 w-3" /> 실패
                        </span>
                      )}
                    </div>

                    {run.status === "success" && (
                      <div className="text-slate-500 grid grid-cols-2 gap-x-2 mt-1">
                        <div>조회건수: {run.queryCount}건</div>
                        <div>신규삽입: {run.insertedCount}건</div>
                        <div>교체/취소: {run.canceledCount}건</div>
                        <div>시간: {(run.executionTimeMs / 1000).toFixed(1)}초</div>
                      </div>
                    )}

                    {run.status === "failed" && run.error && (
                      <div className="text-red-500 mt-1 break-words font-mono text-[10px]">
                        오류: {run.error}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-400 mt-1">
                      실행시각: {DateTime.fromISO(run.createdAt).setZone('Asia/Seoul').toFormat('yyyy-MM-dd HH:mm:ss')}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-slate-400 italic text-xs">
                  최근 실행 기록이 없습니다.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
