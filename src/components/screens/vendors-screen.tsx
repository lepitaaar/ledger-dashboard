"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { VendorUpsertDialog } from "@/components/vendors/vendor-upsert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const [changingId, setChangingId] = useState<string | null>(null);
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null);
  const isUpsertModalOpen = isCreateModalOpen || Boolean(editingVendor);
  const upsertMode = editingVendor ? "edit" : "create";

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

  const handleCreateModalOpen = useCallback((): void => {
    setEditingVendor(null);
    setCreateModalOpen(true);
  }, [setCreateModalOpen]);

  const handleCreateModalClose = useCallback((): void => {
    setCreateModalOpen(false);
  }, [setCreateModalOpen]);

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
        const response = await fetchJson<VendorListResponse>(`/api/vendors?${query}`);
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
    [keyword, limit, page],
  );

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  const handleCreateSuccess = useCallback(async (): Promise<void> => {
    setKeywordInput("");
    setKeyword("");
    setPage(1);
    setCreateModalOpen(false);
    await loadVendors({ page: 1, keyword: "" });
  }, [loadVendors, setCreateModalOpen]);

  const handleEditModalClose = useCallback((): void => {
    setEditingVendor(null);
  }, []);

  const handleEditModalOpen = useCallback(
    (vendor: VendorRow): void => {
      setCreateModalOpen(false);
      setEditingVendor(vendor);
    },
    [setCreateModalOpen],
  );

  const handleEditSuccess = useCallback(async (): Promise<void> => {
    setEditingVendor(null);
    await loadVendors();
  }, [loadVendors]);

  const handleUpsertModalOpenChange = useCallback(
    (open: boolean): void => {
      if (open) {
        if (!editingVendor) {
          setCreateModalOpen(true);
        }
        return;
      }

      if (editingVendor) {
        handleEditModalClose();
        return;
      }

      handleCreateModalClose();
    },
    [
      editingVendor,
      handleCreateModalClose,
      handleEditModalClose,
      setCreateModalOpen,
    ],
  );

  const handleUpsertSuccess = useCallback(async (): Promise<void> => {
    if (editingVendor) {
      await handleEditSuccess();
      return;
    }

    await handleCreateSuccess();
  }, [editingVendor, handleCreateSuccess, handleEditSuccess]);

  const handleStatusChange = async (
    vendor: VendorRow,
    nextActive: boolean,
  ): Promise<void> => {
    setChangingId(vendor._id);

    try {
      await fetchJson<{ data: unknown }>("/api/vendors", {
        method: "PATCH",
        body: JSON.stringify({
          id: vendor._id,
          isActive: nextActive,
        }),
      });

      await loadVendors();
    } catch (statusError) {
      alert(
        statusError instanceof Error ? statusError.message : "상태 변경 실패",
      );
    } finally {
      setChangingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-slate-500">전체 거래처</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">
                {formatCurrency(total)}개
              </p>
            </div>
            <div className="rounded-full bg-blue-100 px-4 py-3 text-sm font-semibold text-blue-700">
              VENDORS
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="text-sm text-slate-500">거래 중</p>
              <p className="mt-1 text-2xl font-bold text-green-600">
                {formatCurrency(activeCount)}개
              </p>
            </div>
            <div className="rounded-full bg-green-100 px-4 py-3 text-sm font-semibold text-green-700">
              ACTIVE
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>거래처 관리</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
              <div className="flex w-full gap-2 md:w-[360px]">
                <Input
                  placeholder="업체명/대표자명/전화번호 검색"
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      setKeyword(keywordInput.trim());
                      setPage(1);
                    }
                  }}
                />
                <Button
                  type="button"
                  className="whitespace-nowrap"
                  onClick={() => {
                    setKeyword(keywordInput.trim());
                    setPage(1);
                  }}
                >
                  <Search className="mr-1 h-4 w-4" /> 검색
                </Button>
              </div>

              <Button type="button" onClick={handleCreateModalOpen}>
                신규 거래처 등록
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>업체명</TableHead>
                <TableHead>대표자명</TableHead>
                <TableHead>전화번호</TableHead>
                <TableHead className="text-right">이번 달 거래금액</TableHead>
                <TableHead className="text-center">상태</TableHead>
                <TableHead className="text-center">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-slate-500"
                  >
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : items.length ? (
                items.map((item) => (
                  <TableRow
                    key={item._id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() =>
                      router.push(`/dashboard/vendors/${item._id}`)
                    }
                  >
                    <TableCell className="font-medium text-primary">
                      {item.name}
                    </TableCell>
                    <TableCell>{item.representativeName}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      {formatCurrency(item.thisMonthAmount)}
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={item.isActive}
                          disabled={changingId === item._id}
                          onChange={(event) =>
                            void handleStatusChange(item, event.target.checked)
                          }
                        />
                        <span
                          className={
                            item.isActive ? "text-green-600" : "text-slate-500"
                          }
                        >
                          {item.isActive ? "거래중" : "중지"}
                        </span>
                      </label>
                    </TableCell>
                    <TableCell
                      className="text-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditModalOpen(item)}
                        >
                          수정
                        </Button>
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/dashboard/vendors/${item._id}`}>
                            보기
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-slate-500"
                  >
                    등록된 거래처가 없습니다.
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
    </div>
  );
}
