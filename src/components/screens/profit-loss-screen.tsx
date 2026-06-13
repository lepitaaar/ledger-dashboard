"use client";

import { useCallback, useEffect, useState } from "react";
import { TrendingUp, DollarSign, PieChart, Search, FileText, Percent, AlertCircle } from "lucide-react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { buildQueryString, fetchJson } from "@/lib/client";
import { DATE_KEY_FORMAT, getTodayDateKey } from "@/lib/kst";
import { formatWon } from "@/lib/utils";
import { ErrorState } from "@/components/ui/state-panel";

type ProfitLossData = {
  periodRevenue: number;
  periodCostOfSales: number;
  periodExpectedProfit: number;
  profitMargin: number;
  overallCount: number;
  overallRevenue: number;
  includedCount: number;
  includedRevenue: number;
  excludedCount: number;
  excludedRevenue: number;
  coverageRatio: number;
};

type ProfitLossResponse = {
  data: ProfitLossData;
  meta: {
    appliedRange: { startKey: string; endKey: string };
  };
};

const presets = [
  { key: "1w", label: "최근 1주" },
  { key: "1m", label: "최근 1달" },
  { key: "3m", label: "최근 3달" },
];
const PROFIT_CIRCUMFERENCE = 2 * Math.PI * 80;
const COVERAGE_CIRCUMFERENCE = 2 * Math.PI * 34;

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function ProfitLossScreen(): JSX.Element {
  const today = getTodayDateKey();
  const oneMonthAgo = DateTime.now().setZone('Asia/Seoul').minus({ months: 1 }).toFormat(DATE_KEY_FORMAT);

  const [data, setData] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [startKey, setStartKey] = useState(oneMonthAgo);
  const [endKey, setEndKey] = useState(today);
  const profitRatio = clampRatio(data?.profitMargin ?? 0);
  const coverageRatio = clampRatio(data?.coverageRatio ?? 0);

  const loadProfitLoss = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = buildQueryString({
        startKey,
        endKey
      });
      const res = await fetchJson<ProfitLossResponse>(`/api/profit-loss?${query}`);
      setData(res.data);
    } catch (err) {
      const message = (err as Error).message || "손익 데이터를 가져오지 못했습니다.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [startKey, endKey]);

  useEffect(() => {
    void loadProfitLoss();
  }, [loadProfitLoss]);

  // 프리셋 핸들러
  const handlePreset = (presetKey: string) => {
    const end = DateTime.now().setZone('Asia/Seoul');
    let start = end;

    if (presetKey === "1w") {
      start = end.minus({ weeks: 1 });
    } else if (presetKey === "1m") {
      start = end.minus({ months: 1 });
    } else if (presetKey === "3m") {
      start = end.minus({ months: 3 });
    }

    setStartKey(start.toFormat(DATE_KEY_FORMAT));
    setEndKey(end.toFormat(DATE_KEY_FORMAT));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="분석"
        title="손익 분석"
        description="이동평균 원가를 기준으로 매출, 원가, 예상 매출총이익과 데이터 반영률을 분석합니다."
      />

      {/* Filters */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex items-center gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.key}
                variant="outline"
                size="sm"
                onClick={() => handlePreset(preset.key)}
                className="text-xs h-8 font-semibold bg-white"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">기간 분석</span>
            <DatePicker value={startKey} onChange={setStartKey} />
            <span className="text-slate-400">~</span>
            <DatePicker value={endKey} onChange={setEndKey} />
            <Button size="sm" onClick={() => void loadProfitLoss()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 ml-2">
              <Search className="mr-1 h-3.5 w-3.5" />
              조회
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState
            title="손익 데이터를 불러오지 못했습니다."
            description={error}
            onRetry={() => void loadProfitLoss()}
          />
        </Card>
      ) : data ? (
        <div className="space-y-6">
          {/* Main Financial Highlights */}
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="border border-indigo-100 bg-white shadow-sm hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">원가 반영 매출액</CardTitle>
                <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800">{formatWon(data.periodRevenue)} 원</div>
                <p className="text-xs text-slate-400 mt-1">이익 산출에 포함된 매출액 합계</p>
              </CardContent>
            </Card>

            <Card className="border border-indigo-100 bg-white shadow-sm hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">해당 매출 원가</CardTitle>
                <div className="rounded-full bg-purple-50 p-2 text-purple-600">
                  <DollarSign className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-purple-700">{formatWon(data.periodCostOfSales)} 원</div>
                <p className="text-xs text-slate-400 mt-1">경매 매입단가 기준 투입 원가</p>
              </CardContent>
            </Card>

            <Card className="border border-indigo-100 bg-white shadow-sm hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">예상 매출총이익</CardTitle>
                <div className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                  <PieChart className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-emerald-700">{formatWon(data.periodExpectedProfit)} 원</div>
                <p className="text-xs text-slate-400 mt-1">매출액 - 매출원가</p>
              </CardContent>
            </Card>

            <Card className="border border-indigo-100 bg-white shadow-sm hover:shadow-md transition-all">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500">매출총이익률 (마진)</CardTitle>
                <div className="rounded-full bg-pink-50 p-2 text-pink-600">
                  <Percent className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-pink-700">{(data.profitMargin * 100).toFixed(1)}%</div>
                <p className="text-xs text-slate-400 mt-1">매출액 대비 예상 이익 비율</p>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown Section with Visual Charts */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: Financial Breakdown Chart (SVG Visual) */}
            <Card className="border-border shadow-sm lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-slate-800">매출 및 비용 구조 분석</CardTitle>
                <CardDescription>매출원가와 예상 이익의 비율을 시각화합니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center space-y-6">
                  {/* SVG Bar Chart */}
                  <div className="w-full space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>매출원가 (Cost of Sales)</span>
                        <span>{formatWon(data.periodCostOfSales)} 원 ({(100 - (data.profitMargin * 100)).toFixed(1)}%)</span>
                      </div>
                      <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${Math.max(0, Math.min(100, (1 - data.profitMargin) * 100))}%` }}
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-l-full"
                        ></div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold text-slate-600">
                        <span>예상 매출총이익 (Gross Profit)</span>
                        <span>{formatWon(data.periodExpectedProfit)} 원 ({(data.profitMargin * 100).toFixed(1)}%)</span>
                      </div>
                      <div className="h-5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          style={{ width: `${Math.max(0, Math.min(100, data.profitMargin * 100))}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-l-full"
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* SVG Circle Gauge */}
                  <div className="relative mt-4 aspect-square w-48 shrink-0">
                    <svg
                      viewBox="0 0 192 192"
                      className="absolute inset-0 h-full w-full -rotate-90 overflow-visible"
                      role="img"
                      aria-label={`예상 이익률 ${(data.profitMargin * 100).toFixed(1)}%`}
                    >
                      <circle cx="96" cy="96" r="80" stroke="#f1f5f9" strokeWidth="16" fill="transparent" />
                      <circle
                        cx="96"
                        cy="96"
                        r="80"
                        stroke="url(#gradient)"
                        strokeWidth="16"
                        fill="transparent"
                        strokeDasharray={PROFIT_CIRCUMFERENCE}
                        strokeDashoffset={PROFIT_CIRCUMFERENCE * (1 - profitRatio)}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
                      <div className="text-3xl font-black text-slate-800">{(data.profitMargin * 100).toFixed(1)}%</div>
                      <div className="text-xs text-slate-400 font-semibold mt-1">예상 이익률</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Right: Coverage Ratio and Excluded Stats */}
            <Card className="border-border shadow-sm">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-800">원가 계산 커버리지</CardTitle>
                <CardDescription>전체 매출 건 중 매입 단가가 매칭되어 이익을 산출한 비율입니다.</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* SVG Progress Circle for Coverage */}
                <div className="flex items-center gap-4">
                  <div className="relative aspect-square w-20 shrink-0">
                    <svg
                      viewBox="0 0 80 80"
                      className="absolute inset-0 h-full w-full -rotate-90 overflow-visible"
                      role="img"
                      aria-label={`원가 계산 포함률 ${(data.coverageRatio * 100).toFixed(0)}%`}
                    >
                      <circle cx="40" cy="40" r="34" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                      <circle
                        cx="40"
                        cy="40"
                        r="34"
                        stroke="#6366f1"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={COVERAGE_CIRCUMFERENCE}
                        strokeDashoffset={COVERAGE_CIRCUMFERENCE * (1 - coverageRatio)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 z-10 flex items-center justify-center text-center text-sm font-extrabold text-indigo-700">
                      {(data.coverageRatio * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-800">원가 계산 포함률</h4>
                    <p className="text-xs text-slate-400 mt-0.5">총 {data.overallCount}건 중 {data.includedCount}건 반영</p>
                  </div>
                </div>

                {/* Excluded detail Cards */}
                <div className="space-y-4 pt-4 border-t border-slate-100 text-xs">
                  <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700 font-bold">
                      <AlertCircle className="h-4 w-4" />
                      원가 계산 제외 매출
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 mt-1">
                      <div>제외 건수: <span className="font-bold text-slate-800">{data.excludedCount} 건</span></div>
                      <div>제외 매출: <span className="font-bold text-slate-800">{formatWon(data.excludedRevenue)} 원</span></div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      * 미매칭 상품 코드나 기초재고 부족(품절) 등으로 원가 가정이 불가능한 거래 건수입니다. 품목 매칭을 확인해 주세요.
                    </p>
                  </div>

                  <div className="rounded-xl p-4 bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                      <FileText className="h-4 w-4" />
                      전체 거래 요약
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-600 mt-1">
                      <div>총 매출액: <span className="font-bold text-slate-800">{formatWon(data.overallRevenue)} 원</span></div>
                      <div>총 거래건: <span className="font-bold text-slate-800">{data.overallCount} 건</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-400 italic">
          선택된 기간의 분석 데이터를 가져올 수 없습니다.
        </div>
      )}
    </div>
  );
}
