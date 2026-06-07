"use client";

import {
  AlertTriangle,
  Boxes,
  Landmark,
  RefreshCcw,
  Search,
  Settings,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table-shell";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar, FilterChip } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import { MoneyText } from "@/components/ui/money-text";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { fetchJson } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";

type InventoryStatusItem = {
  productId: string;
  productName: string;
  productUnit: string;
  initialQty: number;
  initialCost: number;
  currentQty: number;
  currentAvgCost: number;
  totalAssetValue: number;
  isInsufficient: boolean;
};

type InventoryResponse = {
  data: InventoryStatusItem[];
  meta: {
    baselineDateKey: string;
  };
};

type StockFilter = "all" | "insufficient";

export function InventoryScreen(): JSX.Element {
  const [items, setItems] = useState<InventoryStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [baselineDateKey, setBaselineDateKey] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryStatusItem | null>(null);
  const [initialQtyInput, setInitialQtyInput] = useState("0");
  const [initialCostInput, setInitialCostInput] = useState("0");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<InventoryResponse>("/api/inventory");
      setItems(response.data);
      setBaselineDateKey(response.meta.baselineDateKey);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "재고 데이터를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredItems = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((item) => {
      if (stockFilter === "insufficient" && !item.isInsufficient) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [item.productName, item.productUnit].some((value) =>
        value.toLowerCase().includes(normalizedKeyword),
      );
    });
  }, [items, keyword, stockFilter]);

  const totalStockQty = items.reduce(
    (sum, item) => sum + (item.currentQty || 0),
    0,
  );
  const totalAssetValue = items.reduce(
    (sum, item) => sum + (item.totalAssetValue || 0),
    0,
  );
  const insufficientCount = items.filter((item) => item.isInsufficient).length;

  const openBaselineDialog = (item: InventoryStatusItem): void => {
    setSelectedItem(item);
    setInitialQtyInput(String(item.initialQty));
    setInitialCostInput(String(item.initialCost));
  };

  const handleSaveBaseline = async (): Promise<void> => {
    if (!selectedItem) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.productId,
          initialQty: Number(initialQtyInput) || 0,
          initialCost: Number(initialCostInput) || 0,
        }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "기초재고 저장 실패");
      }

      toast.success(
        `"${selectedItem.productName}" 기초재고를 저장하고 재고 원장을 다시 계산했습니다.`,
      );
      setSelectedItem(null);
      await loadInventory();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "기초재고 저장 실패",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="상품 및 재고"
        title="재고 현황"
        description={`이동평균 원가 기준의 현재 재고와 부족 품목을 관리합니다.${
          baselineDateKey ? ` 기초재고 기준일은 ${baselineDateKey}입니다.` : ""
        }`}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => void loadInventory()}
          >
            <RefreshCcw className="h-4 w-4" />
            새로고침
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="총 보유 재고"
          value={`${formatCurrency(totalStockQty)}개`}
          description="전체 품목의 현재 수량 합계"
          icon={Boxes}
        />
        <MetricCard
          label="재고 자산 가치"
          value={<MoneyText value={totalAssetValue} />}
          description="현재 이동평균 원가 적용"
          icon={Landmark}
          tone="success"
        />
        <MetricCard
          label="재고 부족 품목"
          value={`${formatCurrency(insufficientCount)}개`}
          description="기초재고 또는 매입 연결 확인 필요"
          icon={AlertTriangle}
          tone={insufficientCount > 0 ? "danger" : "success"}
        />
      </div>

      <FilterBar
        footer={
          <div className="flex flex-wrap items-center gap-2">
            {stockFilter === "insufficient" ? (
              <FilterChip
                label="재고 부족만"
                onRemove={() => setStockFilter("all")}
              />
            ) : null}
            {keyword ? (
              <FilterChip label={`검색: ${keyword}`} onRemove={() => setKeyword("")} />
            ) : null}
            {stockFilter === "all" && !keyword ? (
              <p className="text-xs text-slate-500">
                부족 품목을 우선 필터링하거나 상품명과 단위로 검색할 수 있습니다.
              </p>
            ) : null}
          </div>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={stockFilter === "all" ? "default" : "outline"}
              onClick={() => setStockFilter("all")}
            >
              전체
            </Button>
            <Button
              type="button"
              size="sm"
              variant={stockFilter === "insufficient" ? "default" : "outline"}
              onClick={() => setStockFilter("insufficient")}
            >
              재고 부족
              {insufficientCount > 0 ? ` ${insufficientCount}` : ""}
            </Button>
          </div>
          <div className="relative sm:ml-auto sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="상품명 또는 단위 검색"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>
        </div>
      </FilterBar>

      <DataTableShell
        title="품목별 재고"
        description={`전체 ${formatCurrency(items.length)}개 중 ${formatCurrency(filteredItems.length)}개 표시`}
      >
        {error ? (
          <ErrorState
            title="재고 현황을 불러오지 못했습니다."
            description={error}
            onRetry={() => void loadInventory()}
          />
        ) : (
          <>
            <div className="hidden max-h-[720px] overflow-auto lg:block">
              <table className="w-full min-w-[1120px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-semibold text-slate-600 shadow-[0_1px_0_0_#e2e8f0]">
                  <tr>
                    <th className="px-5 py-3 text-left">상품명</th>
                    <th className="px-5 py-3 text-left">단위</th>
                    <th className="px-5 py-3 text-right">기초 수량</th>
                    <th className="px-5 py-3 text-right">기초 단가</th>
                    <th className="px-5 py-3 text-right">현재 수량</th>
                    <th className="px-5 py-3 text-right">이동평균 원가</th>
                    <th className="px-5 py-3 text-right">재고 자산</th>
                    <th className="px-5 py-3 text-center">상태</th>
                    <th className="px-5 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 7 }).map((_, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        {Array.from({ length: 9 }).map((__, cellIndex) => (
                          <td key={cellIndex} className="px-5 py-3">
                            <Skeleton className="h-5 w-full max-w-24" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filteredItems.length ? (
                    filteredItems.map((item) => (
                      <tr
                        key={item.productId}
                        className="border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                      >
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {item.productName}
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {item.productUnit || "-"}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {formatCurrency(item.initialQty)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <MoneyText value={item.initialCost} />
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          <span
                            className={
                              item.currentQty < 0 ? "text-red-600 tabular-nums" : "tabular-nums"
                            }
                          >
                            {formatCurrency(item.currentQty)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <MoneyText value={Math.round(item.currentAvgCost)} />
                        </td>
                        <td className="px-5 py-3 text-right font-bold">
                          <MoneyText value={item.totalAssetValue} />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <StatusBadge tone={item.isInsufficient ? "danger" : "success"}>
                            {item.isInsufficient ? "기초재고 필요" : "정상"}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openBaselineDialog(item)}
                          >
                            <Settings className="h-4 w-4" />
                            기초재고
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9}>
                        <EmptyState
                          title="조건에 맞는 재고 품목이 없습니다."
                          description="필터를 초기화하거나 먼저 상품을 등록해 주세요."
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-slate-100 lg:hidden">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-3 p-4">
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))
              ) : filteredItems.length ? (
                filteredItems.map((item) => (
                  <article key={item.productId} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {item.productName}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {item.productUnit || "단위 없음"}
                        </p>
                      </div>
                      <StatusBadge tone={item.isInsufficient ? "danger" : "success"}>
                        {item.isInsufficient ? "재고 부족" : "정상"}
                      </StatusBadge>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3">
                      <div>
                        <dt className="text-[11px] text-slate-400">현재 수량</dt>
                        <dd className="mt-1 text-sm font-bold tabular-nums">
                          {formatCurrency(item.currentQty)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-400">평균 원가</dt>
                        <dd className="mt-1 text-sm font-semibold">
                          {formatCurrency(Math.round(item.currentAvgCost))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-slate-400">재고 자산</dt>
                        <dd className="mt-1 text-sm font-semibold">
                          {formatCurrency(item.totalAssetValue)}
                        </dd>
                      </div>
                    </dl>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openBaselineDialog(item)}
                    >
                      <Settings className="h-4 w-4" />
                      기초재고 설정
                    </Button>
                  </article>
                ))
              ) : (
                <EmptyState
                  title="조건에 맞는 재고 품목이 없습니다."
                  description="필터를 초기화하거나 먼저 상품을 등록해 주세요."
                />
              )}
            </div>
          </>
        )}
      </DataTableShell>

      <Dialog
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>기초재고 설정</DialogTitle>
            <p className="text-sm leading-6 text-slate-500">
              {baselineDateKey || "시스템 기준일"}의 실보유 수량과 평균 매입단가를
              입력합니다. 저장하면 해당 품목의 재고 원장이 다시 계산됩니다.
            </p>
          </DialogHeader>
          {selectedItem ? (
            <div className="space-y-4 py-1">
              <div className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">대상 품목</p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  {selectedItem.productName}
                  {selectedItem.productUnit ? ` · ${selectedItem.productUnit}` : ""}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="initial-qty">기초 재고수량</Label>
                <Input
                  id="initial-qty"
                  type="number"
                  value={initialQtyInput}
                  onChange={(event) => setInitialQtyInput(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="initial-cost">기초 평균 매입단가</Label>
                <Input
                  id="initial-cost"
                  type="number"
                  value={initialCostInput}
                  onChange={(event) => setInitialCostInput(event.target.value)}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSelectedItem(null)}
            >
              취소
            </Button>
            <Button
              type="button"
              disabled={submitting}
              onClick={() => void handleSaveBaseline()}
            >
              {submitting ? "재계산 중..." : "저장 및 재계산"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
