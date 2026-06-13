"use client";

import {
  Banknote,
  FileSpreadsheet,
  ListChecks,
  RotateCcw,
  Search,
  Sigma,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { DatePicker } from "@/components/ui/date-picker";
import {
  ActiveFilterChips,
  FilterBar,
  FilterChip,
} from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import { MoneyText } from "@/components/ui/money-text";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, EmptyState } from "@/components/ui/state-panel";
import { buildQueryString, fetchJson } from "@/lib/client";
import {
  getDateRangeByPreset,
  getTodayDateKey,
  type DatePreset,
} from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";

type VendorOption = {
  _id: string;
  name: string;
};

type ProductOption = {
  _id: string;
  name: string;
  unit?: string;
};

type TransactionRow = {
  _id: string;
  dateKey: string;
  vendorId: string;
  vendorName: string;
  productId: string | null;
  productName: string;
  productUnit?: string;
  unitPrice: number;
  qty: number;
  amount: number;
  registeredTimeKST: string;
  expectedProfit: number | null;
  movementStatus: "normal" | "insufficient_inventory" | "unmapped";
};

type TransactionListResponse = {
  data: TransactionRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    periodTotalAmount: number;
    appliedRange: { startKey: string; endKey: string } | null;
  };
};

type VendorListResponse = {
  data: VendorOption[];
};

type ProductListResponse = {
  data: ProductOption[];
};

type TransactionsScreenProps = {
  initialRows?: TransactionRow[];
  initialMeta?: TransactionListResponse["meta"] | null;
  initialVendors?: VendorOption[];
  initialProducts?: ProductOption[];
  initialError?: string | null;
};

const quickPresets: Array<{ key: DatePreset; label: string }> = [
  { key: "today", label: "오늘" },
  { key: "1w", label: "최근 1주" },
  { key: "1m", label: "최근 1개월" },
  { key: "3m", label: "최근 3개월" },
];

function normalizeRange(
  startKey: string,
  endKey: string,
): { startKey: string; endKey: string } {
  return startKey <= endKey
    ? { startKey, endKey }
    : { startKey: endKey, endKey: startKey };
}

export function TransactionsScreen({
  initialRows = [],
  initialMeta = null,
  initialVendors,
  initialProducts,
  initialError = null,
}: TransactionsScreenProps): JSX.Element {
  const today = getTodayDateKey();
  const initialRange = initialMeta?.appliedRange ?? {
    startKey: today,
    endKey: today,
  };

  const [vendors, setVendors] = useState<VendorOption[]>(initialVendors ?? []);
  const [products, setProducts] = useState<ProductOption[]>(initialProducts ?? []);
  const [rows, setRows] = useState<TransactionRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [page, setPage] = useState(initialMeta?.page ?? 1);
  const limit = 50;
  const [total, setTotal] = useState(initialMeta?.total ?? initialRows.length);
  const [totalPages, setTotalPages] = useState(initialMeta?.totalPages ?? 1);
  const [periodTotalAmount, setPeriodTotalAmount] = useState(
    initialMeta?.periodTotalAmount ?? 0,
  );
  const [preset, setPreset] = useState<DatePreset | "custom">("today");
  const [startKey, setStartKey] = useState(initialRange.startKey);
  const [endKey, setEndKey] = useState(initialRange.endKey);
  const [vendorFilter, setVendorFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const skipInitialMetaLoadRef = useRef(
    initialVendors !== undefined && initialProducts !== undefined,
  );
  const skipInitialTransactionsLoadRef = useRef(Boolean(initialMeta));
  const transactionsAbortRef = useRef<AbortController | null>(null);

  const vendorOptions = useMemo(
    () => [
      { value: "", label: "전체 거래처" },
      ...vendors.map((vendor) => ({ value: vendor._id, label: vendor.name })),
    ],
    [vendors],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "전체 상품" },
      ...products.map((product) => ({ value: product.name, label: product.name })),
    ],
    [products],
  );

  const effectiveRange = useMemo(
    () => normalizeRange(startKey, endKey),
    [startKey, endKey],
  );
  const selectedVendor = vendors.find((vendor) => vendor._id === vendorFilter);
  const averageAmount = total > 0 ? periodTotalAmount / total : 0;

  const loadMeta = useCallback(async () => {
    try {
      const [vendorRes, productRes] = await Promise.all([
        fetchJson<VendorListResponse>("/api/vendors?page=1&limit=500"),
        fetchJson<ProductListResponse>("/api/products?page=1&limit=500"),
      ]);
      setVendors(vendorRes.data);
      setProducts(productRes.data);
    } catch (metaError) {
      toast.error(
        metaError instanceof Error ? metaError.message : "필터 데이터 조회 실패",
      );
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    transactionsAbortRef.current?.abort();
    const controller = new AbortController();
    transactionsAbortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const query = buildQueryString({
        page,
        limit,
        vendorId: vendorFilter || undefined,
        productName: productFilter || undefined,
        keyword: keyword || undefined,
        startKey: effectiveRange.startKey,
        endKey: effectiveRange.endKey,
      });
      const response = await fetchJson<TransactionListResponse>(
        `/api/transactions?${query}`,
        { signal: controller.signal },
      );

      if (controller.signal.aborted) return;
      setRows(response.data);
      setTotal(response.meta.total);
      setTotalPages(response.meta.totalPages);
      setPeriodTotalAmount(response.meta.periodTotalAmount);
    } catch (loadError) {
      if (controller.signal.aborted) return;
      setError(
        loadError instanceof Error ? loadError.message : "거래 조회 실패",
      );
    } finally {
      if (transactionsAbortRef.current === controller) {
        transactionsAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [
    effectiveRange.endKey,
    effectiveRange.startKey,
    keyword,
    page,
    productFilter,
    vendorFilter,
  ]);

  useEffect(() => {
    if (skipInitialMetaLoadRef.current) {
      skipInitialMetaLoadRef.current = false;
      return;
    }
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (skipInitialTransactionsLoadRef.current) {
      skipInitialTransactionsLoadRef.current = false;
      return;
    }
    void loadTransactions();
    return () => transactionsAbortRef.current?.abort();
  }, [loadTransactions]);

  const handlePreset = (nextPreset: DatePreset): void => {
    const range = getDateRangeByPreset(nextPreset);
    setPreset(nextPreset);
    setStartKey(range.startKey);
    setEndKey(range.endKey);
    setPage(1);
  };

  const handleCustomDate = (type: "start" | "end", value: string): void => {
    setPreset("custom");
    if (type === "start") {
      setStartKey(value);
    } else {
      setEndKey(value);
    }
    setPage(1);
  };

  const handleSearch = (): void => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const resetFilters = (): void => {
    setPreset("today");
    setStartKey(today);
    setEndKey(today);
    setVendorFilter("");
    setProductFilter("");
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };

  const handleExcelDownload = async (): Promise<void> => {
    try {
      const query = buildQueryString({
        vendorId: vendorFilter || undefined,
        productName: productFilter || undefined,
        keyword: keyword || undefined,
        startKey: effectiveRange.startKey,
        endKey: effectiveRange.endKey,
      });
      const response = await fetch(`/api/transactions/export?${query}`);

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(payload?.message ?? "엑셀 다운로드 실패");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition");
      const fileNameMatch = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i);
      const fileName = fileNameMatch
        ? decodeURIComponent(fileNameMatch[1])
        : "transactions.xlsx";
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (downloadError) {
      toast.error(
        downloadError instanceof Error
          ? downloadError.message
          : "엑셀 다운로드 실패",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="매출 관리"
        title="거래 조회"
        description="기간과 거래처, 상품 조건으로 거래를 조회하고 매출 내역을 확인합니다."
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExcelDownload()}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            엑셀 다운로드
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="기간 매출"
          value={<MoneyText value={periodTotalAmount} />}
          description={`${effectiveRange.startKey} ~ ${effectiveRange.endKey}`}
          icon={Banknote}
        />
        <MetricCard
          label="거래 건수"
          value={`${formatCurrency(total)}건`}
          description="현재 조건에 포함된 거래"
          icon={ListChecks}
          tone="success"
        />
        <MetricCard
          label="평균 거래액"
          value={<MoneyText value={Math.round(averageAmount)} />}
          description="기간 매출을 거래 건수로 계산"
          icon={Sigma}
          tone="warning"
        />
      </div>

      <FilterBar
        footer={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <ActiveFilterChips>
              <FilterChip
                label={`${effectiveRange.startKey} ~ ${effectiveRange.endKey}`}
              />
              {selectedVendor ? (
                <FilterChip
                  label={`거래처: ${selectedVendor.name}`}
                  onRemove={() => {
                    setVendorFilter("");
                    setPage(1);
                  }}
                />
              ) : null}
              {productFilter ? (
                <FilterChip
                  label={`상품: ${productFilter}`}
                  onRemove={() => {
                    setProductFilter("");
                    setPage(1);
                  }}
                />
              ) : null}
              {keyword ? (
                <FilterChip
                  label={`검색: ${keyword}`}
                  onRemove={() => {
                    setKeyword("");
                    setKeywordInput("");
                    setPage(1);
                  }}
                />
              ) : null}
            </ActiveFilterChips>
            <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw className="h-3.5 w-3.5" />
              초기화
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          {quickPresets.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={preset === item.key ? "default" : "outline"}
              onClick={() => handlePreset(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[160px_160px_minmax(180px,0.8fr)_minmax(180px,0.8fr)_minmax(240px,1.2fr)]">
          <div className="space-y-2">
            <Label htmlFor="transaction-start-date">시작 날짜</Label>
            <DatePicker
              id="transaction-start-date"
              value={startKey}
              onChange={(value) => handleCustomDate("start", value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-end-date">종료 날짜</Label>
            <DatePicker
              id="transaction-end-date"
              value={endKey}
              onChange={(value) => handleCustomDate("end", value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-vendor">거래처</Label>
            <Combobox
              id="transaction-vendor"
              ariaLabel="거래처 선택"
              options={vendorOptions}
              value={vendorFilter}
              onSelect={(option) => {
                setVendorFilter(option.value);
                setPage(1);
              }}
              placeholder="전체 거래처"
              displayKey="label"
              valueKey="value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-product">상품</Label>
            <Combobox
              id="transaction-product"
              ariaLabel="상품 선택"
              options={productOptions}
              value={productFilter}
              onSelect={(option) => {
                setProductFilter(option.value);
                setPage(1);
              }}
              placeholder="전체 상품"
              displayKey="label"
              valueKey="value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction-keyword">검색어</Label>
            <div className="flex gap-2">
              <Input
                id="transaction-keyword"
                placeholder="업체명 또는 상품명"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearch();
                  }
                }}
              />
              <Button type="button" className="shrink-0 whitespace-nowrap" onClick={handleSearch}>
                <Search className="h-4 w-4" />
                검색
              </Button>
            </div>
          </div>
        </div>
      </FilterBar>

      <DataTableShell
        title="거래 내역"
        description={`조회 결과 ${formatCurrency(total)}건`}
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            total={total}
            pageSize={limit}
          />
        }
      >
        {error ? (
          <ErrorState
            title="거래 내역을 불러오지 못했습니다."
            description={error}
            onRetry={() => void loadTransactions()}
          />
        ) : (
          <>
            <div className="hidden max-h-[720px] overflow-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="px-4 py-3 text-left">날짜</th>
                    <th className="px-4 py-3 text-left">거래처</th>
                    <th className="px-4 py-3 text-left">상품</th>
                    <th className="px-4 py-3 text-right">단가</th>
                    <th className="px-4 py-3 text-right">수량</th>
                    <th className="px-4 py-3 text-right">매출액</th>
                    <th className="px-4 py-3 text-left">등록 시간</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 7 }).map((_, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        {Array.from({ length: 7 }).map((__, cellIndex) => (
                          <td key={cellIndex} className="px-4 py-3">
                            <Skeleton className="h-5 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length ? (
                    rows.map((row) => (
                        <tr
                          key={row._id}
                          className="border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                        >
                          <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                            {row.dateKey}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/dashboard/vendors/${row.vendorId}`}
                              className="font-semibold text-slate-900 hover:text-primary hover:underline"
                            >
                              {row.vendorName}
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-800">
                              {row.productName}
                              {row.productUnit ? (
                                <span className="ml-1 font-normal text-slate-400">
                                  {row.productUnit}
                                </span>
                              ) : null}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(row.unitPrice)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {formatCurrency(row.qty)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold">
                            <MoneyText value={row.amount} suffix="" />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {row.registeredTimeKST}
                          </td>
                        </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          title="조회된 거래가 없습니다."
                          description="기간이나 검색 조건을 변경해 다시 조회해 보세요."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-3 p-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-6 w-full" />
                  </div>
                ))
              ) : rows.length ? (
                rows.map((row) => (
                    <article key={row._id} className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/vendors/${row.vendorId}`}
                            className="truncate text-sm font-bold text-slate-900"
                          >
                            {row.vendorName}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {row.productName}
                            {row.productUnit ? ` · ${row.productUnit}` : ""}
                          </p>
                        </div>
                        <MoneyText value={row.amount} className="text-sm font-bold" />
                      </div>
                      <dl className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3">
                        <div>
                          <dt className="text-[11px] text-slate-400">단가</dt>
                          <dd className="mt-0.5 text-xs font-semibold tabular-nums">
                            {formatCurrency(row.unitPrice)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-400">수량</dt>
                          <dd className="mt-0.5 text-xs font-semibold tabular-nums">
                            {formatCurrency(row.qty)}
                          </dd>
                        </div>
                      </dl>
                      <p className="text-xs text-slate-400">
                        {row.dateKey} · {row.registeredTimeKST}
                      </p>
                    </article>
                ))
              ) : (
                <EmptyState
                  title="조회된 거래가 없습니다."
                  description="기간이나 검색 조건을 변경해 다시 조회해 보세요."
                />
              )}
            </div>
          </>
        )}
      </DataTableShell>
    </div>
  );
}
