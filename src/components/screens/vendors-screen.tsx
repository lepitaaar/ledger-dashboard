"use client";

import {
  Building2,
  CircleCheck,
  CirclePause,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { DataTableShell } from "@/components/ui/data-table-shell";
import { FilterBar, FilterChip } from "@/components/ui/filter-bar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MetricCard } from "@/components/ui/metric-card";
import { MoneyText } from "@/components/ui/money-text";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { VendorUpsertDialog } from "@/components/vendors/vendor-upsert-dialog";
import { buildQueryString, fetchJson } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";

type VendorRow = {
  _id: string;
  name: string;
  representativeName: string;
  phone: string;
  isActive: boolean;
  thisMonthAmount: number;
  createdAt: string;
};

type VendorListResponse = {
  data: VendorRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    activeCount: number;
  };
};

export function VendorsScreen(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCreateModalOpen = searchParams.get("modal") === "create";

  const [items, setItems] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const isUpsertModalOpen = isCreateModalOpen || Boolean(editingVendor);
  const upsertMode = editingVendor ? "edit" : "create";
  const deletingVendor = items.find((item) => item._id === deletingId);

  const setCreateModalOpen = useCallback(
    (open: boolean): void => {
      const params = new URLSearchParams(searchParams.toString());
      if (open) {
        params.set("modal", "create");
      } else {
        params.delete("modal");
      }
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const loadVendors = useCallback(
    async (options?: { page?: number; keyword?: string }) => {
      const targetPage = options?.page ?? page;
      const targetKeyword = options?.keyword ?? keyword;
      setLoading(true);
      setError(null);

      try {
        const query = buildQueryString({
          page: targetPage,
          limit,
          keyword: targetKeyword || undefined,
        });
        const response = await fetchJson<VendorListResponse>(
          `/api/vendors?${query}`,
        );
        setItems(response.data);
        setTotal(response.meta.total);
        setActiveCount(response.meta.activeCount);
        setTotalPages(response.meta.totalPages);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "거래처 목록 조회 실패",
        );
      } finally {
        setLoading(false);
      }
    },
    [keyword, page],
  );

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const handleSearch = (): void => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const resetSearch = (): void => {
    setKeywordInput("");
    setKeyword("");
    setPage(1);
  };

  const handleCreateSuccess = useCallback(async (): Promise<void> => {
    setKeywordInput("");
    setKeyword("");
    setPage(1);
    setCreateModalOpen(false);
    await loadVendors({ page: 1, keyword: "" });
  }, [loadVendors, setCreateModalOpen]);

  const handleUpsertModalOpenChange = useCallback(
    (open: boolean): void => {
      if (open) {
        if (!editingVendor) {
          setCreateModalOpen(true);
        }
        return;
      }

      if (editingVendor) {
        setEditingVendor(null);
      } else {
        setCreateModalOpen(false);
      }
    },
    [editingVendor, setCreateModalOpen],
  );

  const handleUpsertSuccess = useCallback(async (): Promise<void> => {
    if (editingVendor) {
      setEditingVendor(null);
      await loadVendors();
      return;
    }
    await handleCreateSuccess();
  }, [editingVendor, handleCreateSuccess, loadVendors]);

  const confirmDelete = async (id: string): Promise<void> => {
    try {
      await fetchJson<{ data: unknown }>("/api/vendors", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await loadVendors();
      toast.success("거래처가 삭제되었습니다.");
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "삭제 실패",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="매출 관리"
        title="거래처 관리"
        description="거래처 정보와 이번 달 거래액, 운영 상태를 확인하고 상세 원장을 관리합니다."
        actions={
          <Button type="button" onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" />
            신규 거래처
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="전체 거래처"
          value={`${formatCurrency(total)}개`}
          description="현재 검색 조건 기준"
          icon={Building2}
        />
        <MetricCard
          label="활성 거래처"
          value={`${formatCurrency(activeCount)}개`}
          description="거래 가능한 상태"
          icon={CircleCheck}
          tone="success"
        />
        <MetricCard
          label="비활성 거래처"
          value={`${formatCurrency(Math.max(0, total - activeCount))}개`}
          description="운영이 중지된 상태"
          icon={CirclePause}
          tone={total - activeCount > 0 ? "warning" : "default"}
        />
      </div>

      <FilterBar
        footer={
          keyword ? (
            <div className="flex items-center justify-between gap-3">
              <FilterChip label={`검색: ${keyword}`} onRemove={resetSearch} />
              <Button type="button" variant="ghost" size="sm" onClick={resetSearch}>
                <RotateCcw className="h-3.5 w-3.5" />
                초기화
              </Button>
            </div>
          ) : (
            <p className="text-sm font-medium text-slate-600">
              업체명, 대표자명 또는 연락처로 검색할 수 있습니다.
            </p>
          )
        }
      >
        <div className="space-y-2">
          <Label htmlFor="vendor-keyword">거래처 검색</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="vendor-keyword"
              className="sm:max-w-md"
              placeholder="업체명, 대표자명 또는 연락처"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSearch();
                }
              }}
            />
            <Button type="button" onClick={handleSearch}>
              <Search className="h-4 w-4" />
              검색
            </Button>
          </div>
        </div>
      </FilterBar>

      <DataTableShell
        title="거래처 목록"
        description={`검색 결과 ${formatCurrency(total)}개`}
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
            title="거래처 목록을 불러오지 못했습니다."
            description={error}
            onRetry={() => void loadVendors()}
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="bg-slate-50/90 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left">업체명</th>
                    <th className="px-5 py-3 text-left">대표자</th>
                    <th className="px-5 py-3 text-left">연락처</th>
                    <th className="px-5 py-3 text-right">이번 달 거래액</th>
                    <th className="px-5 py-3 text-center">상태</th>
                    <th className="px-5 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} className="border-t border-slate-100">
                        {Array.from({ length: 6 }).map((__, cellIndex) => (
                          <td key={cellIndex} className="px-5 py-3">
                            <Skeleton className="h-5 w-full max-w-28" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : items.length ? (
                    items.map((item) => (
                      <tr
                        key={item._id}
                        className="cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50/80"
                        onClick={() => router.push(`/dashboard/vendors/${item._id}`)}
                      >
                        <td className="px-5 py-3 font-semibold text-slate-900">
                          {item.name}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {item.representativeName || "-"}
                        </td>
                        <td className="px-5 py-3 text-slate-600 tabular-nums">
                          {item.phone || "-"}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold">
                          <MoneyText value={item.thisMonthAmount} />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                            {item.isActive ? "활성" : "비활성"}
                          </StatusBadge>
                        </td>
                        <td
                          className="px-5 py-3"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCreateModalOpen(false);
                                setEditingVendor(item);
                              }}
                            >
                              수정
                            </Button>
                            <Button asChild variant="ghost" size="sm">
                              <Link href={`/dashboard/vendors/${item._id}`}>상세</Link>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              onClick={() => setDeletingId(item._id)}
                            >
                              삭제
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          title="등록된 거래처가 없습니다."
                          description="신규 거래처를 등록하거나 검색 조건을 변경해 주세요."
                          action={
                            <Button type="button" size="sm" onClick={() => setCreateModalOpen(true)}>
                              <Plus className="h-4 w-4" />
                              거래처 등록
                            </Button>
                          }
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
                    <Skeleton className="h-5 w-36" />
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))
              ) : items.length ? (
                items.map((item) => (
                  <article key={item._id} className="space-y-3 p-4">
                    <Link
                      href={`/dashboard/vendors/${item._id}`}
                      className="flex items-start justify-between gap-3"
                    >
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{item.name}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {[item.representativeName, item.phone]
                            .filter(Boolean)
                            .join(" · ") || "연락처 정보 없음"}
                        </p>
                      </div>
                      <StatusBadge tone={item.isActive ? "success" : "neutral"}>
                        {item.isActive ? "활성" : "비활성"}
                      </StatusBadge>
                    </Link>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                      <span className="text-xs text-slate-500">이번 달 거래액</span>
                      <MoneyText value={item.thisMonthAmount} className="text-sm font-bold" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCreateModalOpen(false);
                          setEditingVendor(item);
                        }}
                      >
                        수정
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/vendors/${item._id}`}>상세</Link>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setDeletingId(item._id)}
                      >
                        삭제
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyState
                  title="등록된 거래처가 없습니다."
                  description="신규 거래처를 등록하거나 검색 조건을 변경해 주세요."
                />
              )}
            </div>
          </>
        )}
      </DataTableShell>

      <VendorUpsertDialog
        open={isUpsertModalOpen}
        mode={upsertMode}
        initialValues={
          editingVendor
            ? {
                id: editingVendor._id,
                name: editingVendor.name,
                representativeName: editingVendor.representativeName,
                phone: editingVendor.phone,
              }
            : null
        }
        onOpenChange={handleUpsertModalOpenChange}
        onSuccess={handleUpsertSuccess}
      />

      <AlertDialog
        open={Boolean(deletingId)}
        onOpenChange={(open) => !open && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>거래처 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingVendor
                ? `"${deletingVendor.name}" 거래처를 삭제합니다. 기존 거래 내역은 유지되지만 거래처 목록에서는 더 이상 선택할 수 없습니다.`
                : "선택한 거래처를 삭제합니다. 이 작업은 되돌릴 수 없습니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && void confirmDelete(deletingId)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
