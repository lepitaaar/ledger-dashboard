"use client";

import { Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { ProductUpsertDialog } from "@/components/products/product-upsert-dialog";
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

type ProductRow = {
  _id: string;
  name: string;
  unit?: string;
  createdAt: string;
};

type ProductListResponse = {
  data: ProductRow[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export function ProductsScreen(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isCreateModalOpen = searchParams.get("modal") === "create";

  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const limit = 20;
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");

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
    setCreateModalOpen(true);
  }, [setCreateModalOpen]);

  const loadProducts = useCallback(async (options?: { page?: number; keyword?: string }) => {
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

      const response = await fetchJson<ProductListResponse>(
        `/api/products?${query}`,
      );
      setItems(response.data);
      setTotalPages(response.meta.totalPages);
      setTotal(response.meta.total);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "상품 목록 조회 실패",
      );
    } finally {
      setLoading(false);
    }
  }, [page, limit, keyword]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleCreateSuccess = useCallback(async (): Promise<void> => {
    setKeywordInput("");
    setKeyword("");
    setPage(1);
    setCreateModalOpen(false);
    await loadProducts({ page: 1, keyword: "" });
  }, [loadProducts, setCreateModalOpen]);

  const handleDelete = async (id: string): Promise<void> => {
    if (!window.confirm("해당 상품을 삭제하시겠습니까?")) {
      return;
    }

    try {
      await fetchJson<{ data: unknown }>("/api/products", {
        method: "DELETE",
        body: JSON.stringify({ id }),
      });
      await loadProducts();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "삭제 실패");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-xl">상품 관리</CardTitle>
            <Button type="button" variant="success" onClick={handleCreateModalOpen}>
              신규 상품 등록
            </Button>
          </div>

          <div className="mt-3 flex w-full gap-2 md:w-[420px]">
            <Input
              placeholder="상품명 또는 규격을 입력하세요"
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
        </CardHeader>

        <CardContent className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>품목</TableHead>
                <TableHead>규격</TableHead>
                <TableHead>등록일시</TableHead>
                <TableHead className="text-center">삭제</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-slate-500"
                  >
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : items.length ? (
                items.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium text-slate-900">
                      {item.name}
                    </TableCell>
                    <TableCell>{item.unit || "-"}</TableCell>
                    <TableCell>
                      {new Date(item.createdAt).toLocaleString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDelete(item._id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-slate-500"
                  >
                    등록된 상품이 없습니다.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span>총 {total}개의 상품이 등록되어 있습니다.</span>
            <div className="flex items-center gap-2">
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
          </div>
        </CardContent>
      </Card>

      <ProductUpsertDialog
        open={isCreateModalOpen}
        onOpenChange={setCreateModalOpen}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}
