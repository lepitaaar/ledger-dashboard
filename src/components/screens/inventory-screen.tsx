"use client";

import { useCallback, useEffect, useState } from "react";
import { ShoppingBag, Landmark, AlertTriangle, Settings, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
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

export function InventoryScreen(): JSX.Element {
  const [items, setItems] = useState<InventoryStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit Baseline dialog state
  const [selectedItem, setSelectedItem] = useState<InventoryStatusItem | null>(null);
  const [initialQtyInput, setInitialQtyInput] = useState("0");
  const [initialCostInput, setInitialCostInput] = useState("0");

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<{ data: InventoryStatusItem[] }>("/api/inventory");
      setItems(res.data);
    } catch (err) {
      toast.error((err as Error).message || "재고 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  // 기초재고 저장 핸들러
  const handleSaveBaseline = async () => {
    if (!selectedItem) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedItem.productId,
          initialQty: Number(initialQtyInput) || 0,
          initialCost: Number(initialCostInput) || 0
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "기초재고 저장 실패");

      toast.success(`"${selectedItem.productName}" 기초재고가 성공적으로 업데이트되었습니다. 재고 원장이 재계산됩니다.`);
      setSelectedItem(null);
      void loadInventory();
    } catch (err) {
      toast.error((err as Error).message || "기초재고 저장 에러");
    } finally {
      setSubmitting(false);
    }
  };

  // 통계 집계
  const totalStockQty = items.reduce((acc, cur) => acc + (cur.currentQty || 0), 0);
  const totalAssetVal = items.reduce((acc, cur) => acc + (cur.totalAssetValue || 0), 0);
  const stockoutCount = items.filter(item => item.isInsufficient).length;

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-700 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
        <div className="flex flex-col justify-between md:flex-row md:items-center">
          <div>
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">Joint Inventory Manager</span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">공동재고 현황판</h1>
            <p className="mt-1 text-indigo-100">2026-01-01 기준 기초재고 설정 및 이동평균 원가 기준 실시간 공동재고를 추적합니다.</p>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border border-violet-100 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">총 보유 재고 수량</CardTitle>
            <div className="rounded-full bg-violet-50 p-2 text-violet-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-slate-800">{formatCurrency(totalStockQty)} 개</div>
            <p className="text-xs text-slate-400 mt-1">공판장 매입 및 판매 출고가 누적된 순 재고</p>
          </CardContent>
        </Card>

        <Card className="border border-violet-100 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">총 재고 자산 가치</CardTitle>
            <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
              <Landmark className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-emerald-700">{formatCurrency(totalAssetVal)} 원</div>
            <p className="text-xs text-slate-400 mt-1">각 품목별 최신 이동평균 원가를 적용한 자산 금액</p>
          </CardContent>
        </Card>

        <Card className="border border-violet-100 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-slate-500">재고 부족 품목</CardTitle>
            <div className={`rounded-full p-2 ${stockoutCount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-black ${stockoutCount > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              {stockoutCount} 개 품목
            </div>
            <p className="text-xs text-slate-400 mt-1">기초재고 입력 혹은 매입 데이터 연결이 추가로 필요합니다.</p>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Table */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold">
                <tr className="border-b border-slate-200">
                  <th className="px-5 py-3.5">상품명</th>
                  <th className="px-5 py-3.5">규격/단위</th>
                  <th className="px-5 py-3.5 text-right bg-slate-100/50">기초 재고량 (2026-01-01)</th>
                  <th className="px-5 py-3.5 text-right bg-slate-100/50">기초 단가 (2026-01-01)</th>
                  <th className="px-5 py-3.5 text-right font-bold">현재 재고량</th>
                  <th className="px-5 py-3.5 text-right">이동평균 원가</th>
                  <th className="px-5 py-3.5 text-right font-bold text-slate-900">재고 자산 총액</th>
                  <th className="px-5 py-3.5 text-center">재고 상태</th>
                  <th className="px-5 py-3.5 text-center">설정</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-slate-100">
                      <td className="px-5 py-3"><Skeleton className="h-5 w-32" /></td>
                      <td className="px-5 py-3"><Skeleton className="h-5 w-16" /></td>
                      <td className="px-5 py-3 text-right"><Skeleton className="h-5 w-12 ml-auto" /></td>
                      <td className="px-5 py-3 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                      <td className="px-5 py-3 text-right"><Skeleton className="h-5 w-16 ml-auto" /></td>
                      <td className="px-5 py-3 text-right"><Skeleton className="h-5 w-20 ml-auto" /></td>
                      <td className="px-5 py-3 text-right"><Skeleton className="h-5 w-24 ml-auto" /></td>
                      <td className="px-5 py-3 text-center"><Skeleton className="h-5 w-16 mx-auto" /></td>
                      <td className="px-5 py-3 text-center"><Skeleton className="h-5 w-8 mx-auto" /></td>
                    </tr>
                  ))
                ) : items.length > 0 ? (
                  items.map((row) => (
                    <tr key={row.productId} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-slate-800">{row.productName}</td>
                      <td className="px-5 py-3.5 text-slate-500">{row.productUnit || "-"}</td>
                      <td className="px-5 py-3.5 text-right font-mono bg-slate-50/50">{formatCurrency(row.initialQty)}</td>
                      <td className="px-5 py-3.5 text-right font-mono bg-slate-50/50">{formatCurrency(row.initialCost)} 원</td>
                      <td className={`px-5 py-3.5 text-right font-bold font-mono ${row.currentQty < 0 ? "text-rose-600" : "text-slate-700"}`}>
                        {formatCurrency(row.currentQty)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">{formatCurrency(Math.round(row.currentAvgCost))} 원</td>
                      <td className="px-5 py-3.5 text-right font-bold text-slate-900 font-mono">{formatCurrency(row.totalAssetValue)} 원</td>
                      <td className="px-5 py-3.5 text-center">
                        {row.isInsufficient ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="h-3 w-3" /> 기초재고 필요
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle className="h-3 w-3" /> 정상 운영
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedItem(row);
                            setInitialQtyInput(String(row.initialQty));
                            setInitialCostInput(String(row.initialCost));
                          }}
                          className="text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 italic">
                      보유 중인 상품 마스터가 없습니다. 먼저 상품을 등록해 주세요.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Baseline Dialog */}
      <Dialog open={selectedItem !== null} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>기초 재고 설정</DialogTitle>
            <CardDescription className="mt-1">2026-01-01 기준 실보유 재고량을 입력하여 재고 부족을 보정하고 정확한 원가를 산정합니다.</CardDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <span className="font-semibold text-slate-500">품목명:</span>{" "}
                <span className="font-bold text-slate-800">{selectedItem.productName}</span>
                {selectedItem.productUnit && <span className="text-slate-500"> ({selectedItem.productUnit})</span>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="initial-qty">기초 재고수량</Label>
                <Input
                  id="initial-qty"
                  type="number"
                  value={initialQtyInput}
                  onChange={(e) => setInitialQtyInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="initial-cost">기초 매입단가 (평균 원가)</Label>
                <Input
                  id="initial-cost"
                  type="number"
                  value={initialCostInput}
                  onChange={(e) => setInitialCostInput(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>취소</Button>
            <Button
              disabled={submitting}
              onClick={() => void handleSaveBaseline()}
              className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
            >
              저장 및 재계산
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
