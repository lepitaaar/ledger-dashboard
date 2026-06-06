"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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

type VendorDetailScreenProps = {
  vendorId: string;
  initialData?: VendorDetailResponse["data"] | null;
  initialMeta?: VendorDetailResponse["meta"] | null;
  initialError?: string | null;
};

export function VendorDetailScreen({
  vendorId,
  initialData = null,
  initialMeta = null,
  initialError = null,
}: VendorDetailScreenProps): JSX.Element {
  const [data, setData] = useState<VendorDetailResponse["data"] | null>(
    initialData,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const [page, setPage] = useState(initialMeta?.page ?? 1);
  const limit = 20;
  const [totalPages, setTotalPages] = useState(initialMeta?.totalPages ?? 1);
  const skipInitialFetchRef = useRef(Boolean(initialData));

  const [paymentDateKey, setPaymentDateKey] = useState(getTodayDateKey());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async (): Promise<void> => {
    setDeleting(true);
    try {
      await fetchJson<{ data: unknown }>("/api/vendors", {
        method: "DELETE",
        body: JSON.stringify({ id: vendorId }),
      });
      toast.success("거래처가 삭제되었습니다.");
      router.push("/dashboard/vendors");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "삭제 실패",
      );
      setDeleting(false);
      setIsConfirmOpen(false);
    }
  };

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
    if (skipInitialFetchRef.current) {
      skipInitialFetchRef.current = false;
      return;
    }
    void loadDetail();
  }, [loadDetail]);

  const submitPayment = async (): Promise<void> => {
    const amount = Number(paymentAmount.replace(/,/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("입금액은 0보다 큰 숫자여야 합니다.");
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
      toast.error(
        submitError instanceof Error
          ? submitError.message
          : "입금 기록 저장 실패",
      );
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
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
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsConfirmOpen(true)}
              >
                거래처 삭제
              </Button>
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
                      <Badge variant={row.type === "매출" ? "destructive" : "secondary"}>
                        {row.type}
                      </Badge>
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

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>거래처 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              해당 거래처를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleting}
            >
              {deleting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
