"use client";

import Link from "next/link";
import { FileSpreadsheet, Search } from "lucide-react";
import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { buildQueryString, fetchJson } from "@/lib/client";
import { DATE_KEY_FORMAT, KST_ZONE, getTodayDateKey } from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";

type DatePreset = "today" | "1w" | "1m" | "3m";

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
  productName: string;
  productUnit?: string;
  unitPrice: number;
  qty: number;
  amount: number;
  registeredTimeKST: string;
};

type TransactionListResponse = {
  data: TransactionRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    todayTotalAmount: number;
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
  { key: "today", label: "당일" },
  { key: "1w", label: "1주일" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
];

function getForwardDateRangeByPreset(
  preset: DatePreset,
  baseDateKey: string = getTodayDateKey(),
): {
  startKey: string;
  endKey: string;
} {
  const base = DateTime.fromFormat(baseDateKey, DATE_KEY_FORMAT, {
    zone: KST_ZONE,
  }).startOf("day");

  if (!base.isValid) {
    const fallback = getTodayDateKey();
    return { startKey: fallback, endKey: fallback };
  }

  if (preset === "today") {
    const key = base.toFormat(DATE_KEY_FORMAT);
    return { startKey: key, endKey: key };
  }

  if (preset === "1w") {
    return {
      startKey: base.toFormat(DATE_KEY_FORMAT),
      endKey: base.plus({ weeks: 1 }).toFormat(DATE_KEY_FORMAT),
    };
  }

  if (preset === "1m") {
    return {
      startKey: base.toFormat(DATE_KEY_FORMAT),
      endKey: base.plus({ months: 1 }).toFormat(DATE_KEY_FORMAT),
    };
  }

  return {
    startKey: base.toFormat(DATE_KEY_FORMAT),
    endKey: base.plus({ months: 3 }).toFormat(DATE_KEY_FORMAT),
  };
}

function normalizeRange(
  startKey: string,
  endKey: string,
): { startKey: string; endKey: string } {
  if (startKey <= endKey) {
    return { startKey, endKey };
  }

  return { startKey: endKey, endKey: startKey };
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
  const [products, setProducts] = useState<ProductOption[]>(
    initialProducts ?? [],
  );
  const [rows, setRows] = useState<TransactionRow[]>(initialRows);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const [page, setPage] = useState(initialMeta?.page ?? 1);
  const limit = 50;
  const [totalPages, setTotalPages] = useState(initialMeta?.totalPages ?? 1);
  const [todayTotalAmount, setTodayTotalAmount] = useState(
    initialMeta?.todayTotalAmount ?? 0,
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

  const effectiveRange = useMemo(
    () => normalizeRange(startKey, endKey),
    [startKey, endKey],
  );

  const loadMeta = useCallback(async () => {
    try {
      const [vendorRes, productRes] = await Promise.all([
        fetchJson<VendorListResponse>("/api/vendors?page=1&limit=500"),
        fetchJson<ProductListResponse>("/api/products?page=1&limit=500"),
      ]);

      setVendors(vendorRes.data);
      setProducts(productRes.data);
    } catch (metaError) {
      alert(
        metaError instanceof Error
          ? metaError.message
          : "필터 데이터 조회 실패",
      );
    }
  }, []);

  const loadTransactions = useCallback(async () => {
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
      );

      setRows(response.data);
      setTotalPages(response.meta.totalPages);
      setTodayTotalAmount(response.meta.todayTotalAmount);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "거래 조회 실패",
      );
    } finally {
      setLoading(false);
    }
  }, [
    effectiveRange.endKey,
    effectiveRange.startKey,
    keyword,
    limit,
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
  }, [loadTransactions]);

  const handlePreset = (nextPreset: DatePreset): void => {
    const range = getForwardDateRangeByPreset(nextPreset);
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
      const fileNameMatch = contentDisposition?.match(
        /filename\*=UTF-8''([^;]+)/i,
      );
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
      alert(
        downloadError instanceof Error
          ? downloadError.message
          : "엑셀 다운로드 실패",
      );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>거래 조회</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {quickPresets.map((item) => (
              <Button
                key={item.key}
                type="button"
                variant={preset === item.key ? "default" : "outline"}
                className="h-9"
                onClick={() => handlePreset(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_180px_1fr_120px]">
            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              value={vendorFilter}
              onChange={(event) => {
                setVendorFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">전체 업체명</option>
              {vendors.map((vendor) => (
                <option key={vendor._id} value={vendor._id}>
                  {vendor.name}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-border bg-white px-3 text-sm"
              value={productFilter}
              onChange={(event) => {
                setProductFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">전체 상품명</option>
              {products.map((product) => (
                <option key={product._id} value={product.name}>
                  {product.name}
                </option>
              ))}
            </select>

            <Input
              placeholder="검색어를 입력하세요 (상품명, 업체명 등)"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />

            <Button
              type="button"
              variant="outline"
              className="whitespace-nowrap"
              onClick={handleSearch}
            >
              <Search className="mr-1 h-4 w-4" />
              검색
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="text-sm text-slate-600">기간</span>
            <DatePicker
              value={startKey}
              onChange={(value) => handleCustomDate("start", value)}
            />
            <span className="text-slate-500">~</span>
            <DatePicker
              value={endKey}
              onChange={(value) => handleCustomDate("end", value)}
            />

            <div className="ml-auto">
              <Button
                type="button"
                variant="success"
                className="whitespace-nowrap"
                onClick={() => void handleExcelDownload()}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                엑셀 다운로드
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th
                    rowSpan={2}
                    className="border border-slate-200 px-3 py-3 text-left"
                  >
                    날짜
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-200 px-3 py-3 text-left"
                  >
                    업체명
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-200 px-3 py-3 text-left"
                  >
                    상품명
                  </th>
                  <th
                    colSpan={3}
                    className="border border-slate-200 bg-slate-100 px-3 py-3 text-center"
                  >
                    매출 정보
                  </th>
                  <th
                    rowSpan={2}
                    className="border border-slate-200 px-3 py-3 text-left"
                  >
                    등록한 시간
                  </th>
                </tr>
                <tr>
                  <th className="border border-slate-200 px-3 py-3 text-right">
                    단가
                  </th>
                  <th className="border border-slate-200 px-3 py-3 text-center">
                    수량
                  </th>
                  <th className="border border-slate-200 px-3 py-3 text-right">
                    매출액
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-24 border border-slate-200 text-center text-slate-500"
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => (
                    <tr key={row._id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2">
                        {row.dateKey}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 font-medium">
                        <Link
                          href={`/dashboard/vendors/${row.vendorId}`}
                          className="text-blue-700 hover:underline"
                        >
                          {row.vendorName}
                        </Link>
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-slate-800">
                        {row.productName}
                        {row.productUnit ? ` (${row.productUnit})` : ""}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-right">
                        {formatCurrency(row.unitPrice)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-center">
                        {formatCurrency(row.qty)}
                      </td>
                      <td
                        className={`border border-slate-200 px-3 py-2 text-right font-bold ${
                          row.amount < 0 ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="border border-slate-200 px-3 py-2 text-xs text-slate-500">
                        {row.registeredTimeKST}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="h-24 border border-slate-200 text-center text-slate-500"
                    >
                      조회된 거래가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td
                    colSpan={5}
                    className="border border-slate-200 px-3 py-3 text-right text-sm font-semibold text-slate-700"
                  >
                    오늘 매출 총계:
                  </td>
                  <td className="border border-slate-200 px-3 py-3 text-right text-base font-bold text-primary">
                    {formatCurrency(todayTotalAmount)}
                  </td>
                  <td className="border border-slate-200" />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            >
              이전
            </Button>
            <span className="text-sm text-slate-600">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => prev + 1)}
            >
              다음
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
