"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildQueryString, fetchJson } from "@/lib/client";
import { getTodayDateKey } from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";

type VendorDetailResponse = {
  data: {
    vendor: {
      _id: string;
      name: string;
      representativeName: string;
      phone: string;
      isActive: boolean;
    };
    metrics: {
      monthlySalesAmount: number;
      monthlyPaymentAmount: number;
      totalSalesAmount: number;
      totalPaymentAmount: number;
      outstandingAmount: number;
    };
    history: Array<{
      id: string;
      dateKey: string;
      type: "매출" | "입금";
      amount: number;
      balance: number;
      note: string;
      timeKST: string;
    }>;
  };
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function VendorDetailScreen({
  vendorId,
}: {
  vendorId: string;
}): JSX.Element {
  const [data, setData] = useState<VendorDetailResponse["data"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = 20;
  const [totalPages, setTotalPages] = useState(1);

  const [paymentDateKey, setPaymentDateKey] = useState(getTodayDateKey());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = buildQueryString({ page, limit });
      const response = await fetchJson<VendorDetailResponse>(
        `/api/vendors/${vendorId}?${query}`,
      );
      setData(response.data);
      setTotalPages(response.meta.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "거래처 상세 조회 실패",
      );
    } finally {
      setLoading(false);
    }
  }, [vendorId, page, limit]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const submitPayment = async (): Promise<void> => {
    const amount = Number(paymentAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("입금액은 0보다 큰 숫자여야 합니다.");
      return;
    }

    setSavingPayment(true);

    try {
      await fetchJson<{ data: unknown }>(`/api/vendors/${vendorId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          dateKey: paymentDateKey,
          amount,
        }),
      });

      setPaymentAmount("");
      setPage(1);
      await loadDetail();
    } catch (submitError) {
      alert(
        submitError instanceof Error
          ? submitError.message
          : "입금 기록 저장 실패",
      );
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading && !data) {
    return <p className="text-sm text-slate-500">불러오는 중...</p>;
  }

  if (error && !data) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">데이터가 없습니다.</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-xl">{data.vendor.name}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                대표자: {data.vendor.representativeName} | 전화번호:{" "}
                {data.vendor.phone}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-1 text-xs font-semibold ${
                  data.vendor.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-slate-200 text-slate-600"
                }`}
              >
                {data.vendor.isActive ? "거래중" : "거래중지"}
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/vendors">목록으로</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">금월 총 거래금액</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {formatCurrency(data.metrics.monthlySalesAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">금월 입금금액</p>
            <p className="mt-2 text-2xl font-bold text-blue-600">
              {formatCurrency(data.metrics.monthlyPaymentAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">총 미수금액</p>
            <p className="mt-2 text-2xl font-bold text-red-600">
              {formatCurrency(data.metrics.outstandingAmount)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              전체 매출 {formatCurrency(data.metrics.totalSalesAmount)} - 전체
              입금 {formatCurrency(data.metrics.totalPaymentAmount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>입금 기록 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
            <div className="space-y-1 md:col-span-5">
              <Label htmlFor="paymentDate">입금일자</Label>
              <DatePicker
                id="paymentDate"
                value={paymentDateKey}
                onChange={setPaymentDateKey}
              />
            </div>
            <div className="space-y-1 md:col-span-5">
              <Label htmlFor="paymentAmount">입금액</Label>
              <Input
                id="paymentAmount"
                inputMode="numeric"
                placeholder="예: 2000000"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button
                className="w-full"
                onClick={() => void submitPayment()}
                disabled={savingPayment}
              >
                {savingPayment ? "저장중..." : "저장"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>상세 거래 내역</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead className="text-center">구분</TableHead>
                <TableHead className="text-right">금액</TableHead>
                <TableHead className="text-right">잔액</TableHead>
                <TableHead>비고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.history.length ? (
                data.history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.dateKey}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`rounded px-2 py-1 text-xs font-semibold ${
                          row.type === "매출"
                            ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {row.type}
                      </span>
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium ${row.amount < 0 ? "text-red-600" : "text-slate-900"}`}
                    >
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-900">
                      {formatCurrency(row.balance)}
                    </TableCell>
                    <TableCell className="text-slate-500">{row.note}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-20 text-center text-slate-500"
                  >
                    거래/입금 이력이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((prev) => prev - 1)}
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
