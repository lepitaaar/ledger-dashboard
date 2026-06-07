"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ArrowRight, AlertCircle, ShoppingBag, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox } from "@/components/ui/combobox";
import { fetchJson } from "@/lib/client";

type MappingRow = {
  _id: string;
  naBzplc: string;
  gbn: string;
  naLatc: string;
  productId: string;
  productName: string;
  productUnit: string;
};

type UnmappedSuggestion = {
  naBzplc: string;
  gbn: string;
  naLatc: string;
  wmcLatcnm: string;
  count: number;
};

type ProductOption = {
  _id: string;
  name: string;
  unit?: string;
};

export function ProductMappingsScreen(): JSX.Element {
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [unmappedSuggestions, setUnmappedSuggestions] = useState<UnmappedSuggestion[]>([]);

  const [loading, setLoading] = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Pagination for Mappings
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dialogs
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isQuickProductOpen, setIsQuickProductOpen] = useState(false);

  // Create Mapping Form state
  const [formNaBzplc, setFormNaBzplc] = useState("8808990001104"); // 부산공판장 기본값
  const [formGbn, setFormGbn] = useState("1"); // 공판장
  const [formNaLatc, setFormNaLatc] = useState("");
  const [formProductId, setFormProductId] = useState("");

  // Suggestion Match state
  const [selectedSuggestion, setSelectedSuggestion] = useState<UnmappedSuggestion | null>(null);

  // Quick Product Form state
  const [newProductName, setNewProductName] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("");

  const productOptions = useMemo(() => {
    return products.map(p => ({
      value: p._id,
      label: `${p.name}${p.unit ? ` (${p.unit})` : ""}`
    }));
  }, [products]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    try {
      // 1. 전체 상품 조회
      const prodRes = await fetchJson<{ data: ProductOption[] }>("/api/products?page=1&limit=500");
      setProducts(prodRes.data);

      // 2. 전체 기간의 활성 미매핑 품목 코드를 집계합니다.
      const mappingRes = await fetchJson<{ suggestions: UnmappedSuggestion[] }>(
        "/api/auctions/mappings?page=1&limit=1"
      );
      setUnmappedSuggestions(mappingRes.suggestions);
    } catch {
      toast.error("메타 정보 조회 실패");
    } finally {
      setMetaLoading(false);
    }
  }, []);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchJson<{ data: MappingRow[]; meta: { totalPages: number } }>(
        `/api/auctions/mappings?page=${page}&limit=10`
      );
      setMappings(res.data);
      setTotalPages(res.meta.totalPages);
    } catch (err) {
      toast.error((err as Error).message || "매핑 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  // 매핑 등록 실행
  const handleSubmitMapping = async (params: {
    naBzplc: string;
    gbn: string;
    naLatc: string;
    productId: string;
  }) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auctions/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "매핑 저장 실패");

      toast.success("매핑 정보가 저장되었습니다. 관련 재고 원장이 재계산됩니다.");
      setIsManualOpen(false);
      setSelectedSuggestion(null);
      void loadMeta();
      void loadMappings();
    } catch (err) {
      toast.error((err as Error).message || "매핑 저장 에러");
    } finally {
      setSubmitting(false);
    }
  };

  // 매핑 삭제 실행
  const handleDeleteMapping = async (id: string) => {
    if (!confirm("이 매핑을 해제하시겠습니까? 연결된 경매 데이터의 상품 연결이 풀리고 재고 원장이 다시 계산됩니다.")) {
      return;
    }

    try {
      const res = await fetch(`/api/auctions/mappings?id=${id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "매핑 삭제 실패");

      toast.success("매핑 정보가 성공적으로 해제되었습니다.");
      void loadMeta();
      void loadMappings();
    } catch (err) {
      toast.error((err as Error).message || "매핑 해제 에러");
    }
  };

  // 신규 상품 퀵 생성 실행
  const handleCreateProduct = async () => {
    if (!newProductName.trim()) {
      toast.warning("상품명을 입력하세요.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProductName.trim(),
          unit: newProductUnit.trim() || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "상품 생성 실패");

      toast.success(`신규 상품 "${newProductName}"이 등록되었습니다.`);

      const newProduct = data.data as ProductOption;

      // 목록 갱신
      setProducts(prev => [newProduct, ...prev]);

      // 매칭 수행
      if (selectedSuggestion) {
        await handleSubmitMapping({
          naBzplc: selectedSuggestion.naBzplc,
          gbn: selectedSuggestion.gbn,
          naLatc: selectedSuggestion.naLatc,
          productId: newProduct._id
        });
      } else {
        setFormProductId(newProduct._id);
      }

      setIsQuickProductOpen(false);
      setNewProductName("");
      setNewProductUnit("");
    } catch (err) {
      toast.error((err as Error).message || "상품 생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
        <div className="flex flex-col justify-between md:flex-row md:items-center">
          <div>
            <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">Product Match Manager</span>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">농협 품목 코드 매칭</h1>
            <p className="mt-1 text-teal-100">수집된 농협 공판장 품목 코드를 기존의 재고 관리용 상품 마스터와 연결합니다.</p>
          </div>
          <Button
            onClick={() => {
              setFormNaLatc("");
              setFormProductId("");
              setIsManualOpen(true);
            }}
            className="mt-4 md:mt-0 bg-white text-emerald-700 hover:bg-teal-50 font-bold shadow-md"
          >
            <Plus className="mr-1 h-4 w-4" />
            수동 매핑 추가
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Unmapped suggestions (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                  매칭 대기 중인 농협 품목 코드
                </CardTitle>
                <CardDescription>동기화는 되었으나 아직 연결할 상품을 정하지 못한 품목들입니다.</CardDescription>
              </div>
              <span className="text-xs bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-bold">
                {unmappedSuggestions.length}개 발견
              </span>
            </CardHeader>
            <CardContent className="p-5">
              {metaLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : unmappedSuggestions.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {unmappedSuggestions.map((sug) => (
                    <div
                      key={`${sug.naBzplc}_${sug.gbn}_${sug.naLatc}`}
                      className="flex flex-col justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/50 transition-all shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded border border-indigo-100">
                            낙찰 {sug.count}건 존재
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">{sug.naLatc}</span>
                        </div>
                        <h4 className="mt-2 text-base font-bold text-slate-800">{sug.wmcLatcnm}</h4>
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          사업장: {sug.naBzplc === "8808990001104" ? "부산공판장" : sug.naBzplc} ({sug.gbn === "1" ? "공판" : "전자"})
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/60 flex flex-col gap-2">
                        <Combobox
                          options={productOptions}
                          value=""
                          onSelect={(opt) => {
                            void handleSubmitMapping({
                              naBzplc: sug.naBzplc,
                              gbn: sug.gbn,
                              naLatc: sug.naLatc,
                              productId: opt.value
                            });
                          }}
                          placeholder="매칭할 상품 선택..."
                          displayKey="label"
                          valueKey="value"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSuggestion(sug);
                            setNewProductName(sug.wmcLatcnm); // 기본값 설정
                            setIsQuickProductOpen(true);
                          }}
                          className="h-8 text-xs font-semibold text-emerald-700 hover:text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                        >
                          <PlusCircle className="mr-1 h-3.5 w-3.5" />
                          새 상품 등록 후 매칭
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 italic">
                  모든 농협 품목 코드가 상품 마스터에 올바르게 매칭되어 있습니다!
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Current mappings (1 col) */}
        <div className="space-y-6">
          <Card className="border-border shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-800">등록된 매핑 목록</CardTitle>
              <CardDescription>현재 적용 중인 농협 품목 연동 이력입니다.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="p-4 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                ))
              ) : mappings.length > 0 ? (
                mappings.map((m) => (
                  <div key={m._id} className="p-4 hover:bg-slate-50 transition-colors text-xs flex justify-between items-center">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-slate-400">[{m.naLatc}]</span>
                        <ArrowRight className="h-3 w-3 text-slate-400" />
                        <span className="font-bold text-indigo-700">{m.productName}</span>
                        {m.productUnit && <span className="text-slate-500 text-[10px]">({m.productUnit})</span>}
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        사업장: {m.naBzplc === "8808990001104" ? "부산공판장" : m.naBzplc} | 구분: {m.gbn === "1" ? "공판" : "전자"}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDeleteMapping(m._id)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 italic">
                  등록된 품목 매핑이 없습니다.
                </div>
              )}
            </CardContent>
            {totalPages > 1 && (
              <div className="p-3 border-t border-slate-100 flex justify-center bg-slate-50/50">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Manual Mapping Dialog */}
      <Dialog open={isManualOpen} onOpenChange={setIsManualOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>수동 품목 매핑 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>경제통합사업장코드</Label>
              <Input value={formNaBzplc} onChange={(e) => setFormNaBzplc(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>거래구분</Label>
              <select
                value={formGbn}
                onChange={(e) => setFormGbn(e.target.value)}
                className="w-full rounded-md border border-slate-200 p-2 text-sm focus:border-indigo-500 focus:outline-none"
              >
                <option value="1">공판장 (부산공판장 등)</option>
                <option value="2">전자거래</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>농협 품목코드 (naLatc)</Label>
              <Input
                placeholder="예: 003003005015"
                value={formNaLatc}
                onChange={(e) => setFormNaLatc(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label>매칭할 대시보드 상품</Label>
              <Combobox
                options={productOptions}
                value={formProductId}
                onSelect={(opt) => setFormProductId(opt.value)}
                placeholder="상품을 검색해 보세요..."
                displayKey="label"
                valueKey="value"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualOpen(false)}>취소</Button>
            <Button
              disabled={submitting}
              onClick={() =>
                void handleSubmitMapping({
                  naBzplc: formNaBzplc,
                  gbn: formGbn,
                  naLatc: formNaLatc,
                  productId: formProductId
                })
              }
              className="bg-indigo-600 text-white hover:bg-indigo-700 font-bold"
            >
              매핑 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Product Create Dialog */}
      <Dialog open={isQuickProductOpen} onOpenChange={setIsQuickProductOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>새 상품 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>상품명</Label>
              <Input
                placeholder="예: 포기찹"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>규격 / 단위 (선택)</Label>
              <Input
                placeholder="예: 2kg, 1box 등"
                value={newProductUnit}
                onChange={(e) => setNewProductUnit(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickProductOpen(false)}>취소</Button>
            <Button
              disabled={submitting}
              onClick={() => void handleCreateProduct()}
              className="bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
            >
              등록 및 즉시 매칭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
