"use client";

import { Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchJson } from "@/lib/client";
import { getTodayDateKey } from "@/lib/kst";

type VendorOption = {
  _id: string;
  name: string;
  representativeName?: string;
  phone?: string;
};

type VendorListResponse = {
  data: VendorOption[];
};

export function SettlementsScreen(): JSX.Element {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadVendors = async (): Promise<void> => {
      setLoading(true);
      try {
        const response = await fetchJson<VendorListResponse>(
          "/api/vendors?page=1&limit=500",
        );
        setVendors(response.data);
      } catch (error) {
        alert(error instanceof Error ? error.message : "업체 목록 조회 실패");
      } finally {
        setLoading(false);
      }
    };

    void loadVendors();
  }, []);

  const filteredVendors = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    if (!query) {
      return vendors;
    }

    return vendors.filter((vendor) =>
      vendor.name.toLowerCase().includes(query),
    );
  }, [keyword, vendors]);

  const moveToManage = (vendorId: string): void => {
    const dateKey = getTodayDateKey();
    router.push(
      `/dashboard/settlements/manage?vendorId=${vendorId}&dateKey=${dateKey}`,
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">계산서 메인</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="업체명을 검색하세요"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full whitespace-nowrap md:w-auto"
              onClick={() => setKeyword(keyword.trim())}
            >
              검색
            </Button>
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              발행 대상 업체 선택
            </h2>

            {loading ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                업체 목록을 불러오는 중...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {filteredVendors.map((vendor) => (
                  <div
                    key={vendor._id}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-primary hover:bg-blue-50/50"
                    onClick={() => moveToManage(vendor._id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-full bg-blue-100 p-2 text-primary">
                        <Store className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {vendor.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {vendor.representativeName ?? "-"} |{" "}
                          {vendor.phone ?? "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {!filteredVendors.length ? (
                  <div className="col-span-full rounded-md border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                    검색 결과가 없습니다.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
