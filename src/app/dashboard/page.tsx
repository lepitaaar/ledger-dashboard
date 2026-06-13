import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CircleDollarSign,
  FileText,
  ReceiptText,
  RefreshCcw,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { MoneyText } from "@/components/ui/money-text";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { connectMongo } from "@/lib/db";
import {
  getCurrentMonthDateRange,
  getTodayDateKey,
} from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";
import { AuctionPurchaseModel } from "@/server/models/auction-purchase";
import { PaymentModel } from "@/server/models/payment";
import { TransactionModel } from "@/server/models/transaction";
import { VendorModel } from "@/server/models/vendor";
import { getInventoryStatus } from "@/server/services/inventory";
import {
  listTransactions,
  type TransactionListItem,
} from "@/server/services/transactions";

export const dynamic = "force-dynamic";

type DashboardData = {
  todaySales: number | null;
  monthSales: number | null;
  outstandingAmount: number | null;
  lowStockCount: number | null;
  unmatchedCount: number | null;
  activeVendorCount: number | null;
  recentTransactions: TransactionListItem[] | null;
  errors: string[];
};

async function getDashboardData(): Promise<DashboardData> {
  await connectMongo();

  const today = getTodayDateKey();
  const monthRange = getCurrentMonthDateRange();

  const [
    todayTransactions,
    monthTransactions,
    recentTransactions,
    inventory,
    unmatchedCount,
    activeVendorCount,
    paymentAggregate,
    salesAggregate,
  ] = await Promise.allSettled([
    listTransactions({ startKey: today, endKey: today }, { page: 1, limit: 1 }),
    listTransactions(monthRange, { page: 1, limit: 1 }),
    listTransactions({}, { page: 1, limit: 6 }),
    getInventoryStatus(),
    AuctionPurchaseModel.countDocuments({ productId: null, isActive: true }),
    VendorModel.countDocuments({ deletedAt: null, isActive: true }),
    PaymentModel.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    TransactionModel.aggregate<{ total: number }>([
      { $match: { deletedAt: null } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const errors: string[] = [];
  const failed = (result: PromiseSettledResult<unknown>, label: string): boolean => {
    if (result.status === "rejected") {
      errors.push(label);
      return true;
    }
    return false;
  };

  failed(todayTransactions, "오늘 매출");
  failed(monthTransactions, "이번 달 매출");
  failed(recentTransactions, "최근 거래");
  failed(inventory, "재고");
  failed(unmatchedCount, "미매칭");
  failed(activeVendorCount, "활성 거래처");
  failed(paymentAggregate, "입금 합계");
  failed(salesAggregate, "매출 합계");

  const totalPayments = paymentAggregate.status === "fulfilled"
    ? Number(paymentAggregate.value[0]?.total ?? 0)
    : null;
  const totalSales = salesAggregate.status === "fulfilled"
    ? Number(salesAggregate.value[0]?.total ?? 0)
    : null;

  return {
    todaySales: todayTransactions.status === "fulfilled" ? todayTransactions.value.periodTotalAmount : null,
    monthSales: monthTransactions.status === "fulfilled" ? monthTransactions.value.periodTotalAmount : null,
    outstandingAmount: totalSales !== null && totalPayments !== null ? totalSales - totalPayments : null,
    lowStockCount: inventory.status === "fulfilled"
      ? inventory.value.filter((item) => item.isInsufficient).length
      : null,
    unmatchedCount: unmatchedCount.status === "fulfilled" ? unmatchedCount.value : null,
    activeVendorCount: activeVendorCount.status === "fulfilled" ? activeVendorCount.value : null,
    recentTransactions: recentTransactions.status === "fulfilled" ? recentTransactions.value.items : null,
    errors,
  };
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof ReceiptText;
  title: string;
  description: string;
}): JSX.Element {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-100 group-hover:text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-slate-900">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary" />
    </Link>
  );
}

export default async function DashboardPage(): Promise<JSX.Element> {
  let data: DashboardData | null = null;
  let error: string | null = null;

  try {
    data = await getDashboardData();
  } catch (loadError) {
    error =
      loadError instanceof Error
        ? loadError.message
        : "대시보드 데이터를 불러오지 못했습니다.";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="업무 요약"
        title="대시보드"
        description="매출, 미수금, 재고와 품목 매칭 상태를 한눈에 확인하고 주요 업무를 바로 시작합니다."
        actions={
          <Button asChild>
            <Link href="/dashboard/settlements/manage">
              <ReceiptText className="h-4 w-4" />
              거래 등록
            </Link>
          </Button>
        }
      />

      {error || data?.errors.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          일부 실시간 데이터를 불러오지 못했습니다.
          <span className="ml-2 text-xs text-amber-700">
            {error ?? data?.errors.join(", ")}
          </span>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="오늘 매출"
          value={data?.todaySales === null || data?.todaySales === undefined
            ? "조회 실패"
            : <MoneyText value={data.todaySales} />}
          description={`${getTodayDateKey()} 거래 기준`}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="이번 달 매출"
          value={data?.monthSales === null || data?.monthSales === undefined
            ? "조회 실패"
            : <MoneyText value={data.monthSales} />}
          description="이번 달 누적 매출"
          icon={TrendingUp}
          tone="success"
        />
        <MetricCard
          label="총 미수금"
          value={data?.outstandingAmount === null || data?.outstandingAmount === undefined
            ? "조회 실패"
            : <MoneyText value={data.outstandingAmount} />}
          description="누적 매출에서 입금액을 제외한 금액"
          icon={FileText}
          tone={data?.outstandingAmount === null || data?.outstandingAmount === undefined
            ? "warning"
            : data.outstandingAmount > 0 ? "warning" : "success"}
        />
        <MetricCard
          label="처리 필요"
          value={data?.lowStockCount === null || data?.lowStockCount === undefined ||
            data?.unmatchedCount === null || data?.unmatchedCount === undefined
            ? "조회 실패"
            : `${data.lowStockCount + data.unmatchedCount}건`}
          description={`재고 부족 ${data?.lowStockCount ?? "-"} · 미매칭 ${data?.unmatchedCount ?? "-"}`}
          icon={AlertTriangle}
          tone={(data?.lowStockCount ?? 0) + (data?.unmatchedCount ?? 0) > 0 ? "danger" : "success"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
        <DataTableShell
          title="최근 거래"
          description="가장 최근 등록된 거래 6건"
          toolbar={
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/transactions">
                전체 보기
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        >
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600">
                <tr>
                  <th className="px-5 py-3 text-left">날짜</th>
                  <th className="px-5 py-3 text-left">거래처</th>
                  <th className="px-5 py-3 text-left">상품</th>
                  <th className="px-5 py-3 text-center">매출액</th>
                </tr>
              </thead>
              <tbody>
                {!data || data.recentTransactions === null ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-sm text-red-600">
                      최근 거래를 불러오지 못했습니다.
                    </td>
                  </tr>
                ) : data.recentTransactions.length ? (
                  data.recentTransactions.map((item) => (
                    <tr key={item._id} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                        {item.dateKey}
                      </td>
                      <td className="px-5 py-3 font-medium text-slate-900">
                        <Link
                          href={`/dashboard/vendors/${item.vendorId}`}
                          className="font-semibold hover:text-primary hover:underline"
                        >
                          {item.vendorName}
                        </Link>
                      </td>
                      <td className="max-w-60 truncate px-5 py-3 text-slate-600">
                        {item.productName}
                      </td>
                      <td className="px-5 py-3 text-center font-semibold">
                        <MoneyText value={item.amount} suffix="" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                      최근 거래가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-100 md:hidden">
            {!data || data.recentTransactions === null ? (
              <p className="px-5 py-12 text-center text-sm text-red-600">
                최근 거래를 불러오지 못했습니다.
              </p>
            ) : data.recentTransactions.length ? (
              data.recentTransactions.map((item) => (
                <div key={item._id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/dashboard/vendors/${item.vendorId}`}
                        className="text-sm font-semibold text-slate-900 hover:text-primary hover:underline"
                      >
                        {item.vendorName}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{item.productName}</p>
                    </div>
                    <MoneyText value={item.amount} className="text-sm font-bold" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item.dateKey}</span>
                    <StatusBadge tone={item.productId ? "success" : "warning"}>
                      {item.productId ? "매칭 완료" : "미매칭"}
                    </StatusBadge>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-5 py-12 text-center text-sm text-slate-500">최근 거래가 없습니다.</p>
            )}
          </div>
        </DataTableShell>

        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">빠른 작업</h2>
            </div>
            <div className="space-y-2">
              <QuickAction
                href="/dashboard/settlements/manage"
                icon={ReceiptText}
                title="거래 등록"
                description="거래 내역을 입력하고 계산서를 준비합니다."
              />
              <QuickAction
                href="/dashboard/settlements"
                icon={FileText}
                title="계산서 관리"
                description="계산서 목록과 발행 내역을 확인합니다."
              />
              <QuickAction
                href="/dashboard/vendors"
                icon={Users}
                title="입금 기록"
                description="거래처 상세에서 입금 내역을 등록합니다."
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
            <p className="text-sm font-bold text-slate-300">
              운영 상태
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <Users className="h-4 w-4 text-blue-300" />
                <p className="mt-2 text-xl font-bold tabular-nums">
                  {data?.activeVendorCount === null || data?.activeVendorCount === undefined
                    ? "-"
                    : formatCurrency(data.activeVendorCount)}
                </p>
                <p className="text-sm text-slate-300">활성 거래처</p>
              </div>
              <div>
                <Boxes className="h-4 w-4 text-amber-300" />
                <p className="mt-2 text-xl font-bold tabular-nums">
                  {data?.lowStockCount === null || data?.lowStockCount === undefined
                    ? "-"
                    : formatCurrency(data.lowStockCount)}
                </p>
                <p className="text-sm text-slate-300">재고 부족</p>
              </div>
              <div>
                <RefreshCcw className="h-4 w-4 text-emerald-300" />
                <p className="mt-2 text-xl font-bold tabular-nums">
                  {data?.unmatchedCount === null || data?.unmatchedCount === undefined
                    ? "-"
                    : formatCurrency(data.unmatchedCount)}
                </p>
                <p className="text-sm text-slate-300">미매칭</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
