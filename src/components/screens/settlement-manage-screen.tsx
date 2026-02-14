"use client";

import { DatePicker } from "@/components/ui/date-picker";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { DateTime } from "luxon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { buildQueryString, fetchJson } from "@/lib/client";
import {
  DATE_KEY_FORMAT,
  KST_ZONE,
  getTodayDateKey,
  parseDateKeyKst,
} from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";

type VendorOption = {
  _id: string;
  name: string;
};

type ProductOption = {
  _id: string;
  name: string;
  unit?: string;
  vendorId?: string | null;
  createdAt?: string;
};

type VendorListResponse = {
  data: VendorOption[];
};

type ProductListResponse = {
  data: ProductOption[];
};

type SettlementManageRowResponse = {
  _id: string;
  productName: string;
  productUnit: string;
  qty: number;
  unitPrice: number;
  amount: number;
  registeredTimeKST: string;
};

type SettlementManageResponse = {
  data: {
    vendor: {
      _id: string;
      name: string;
    };
    dateKey: string;
    rows: SettlementManageRowResponse[];
    totalAmount: number;
  };
};

type EditableRow = {
  localId: string;
  id?: string;
  selected: boolean;
  productName: string;
  productUnit: string;
  qty: string;
  unitPrice: string;
  registeredTimeKST: string;
};

type EditableField =
  | "selected"
  | "productName"
  | "productUnit"
  | "qty"
  | "unitPrice";

type PersistableRowPayload = {
  productName: string;
  productUnit?: string;
  qty: number;
  unitPrice: number;
};

type SavedRowSnapshot = {
  productName: string;
  productUnit: string;
  qty: number;
  unitPrice: number;
};

const MIN_BASE_ROWS = 15;
const PRINT_ROWS_PER_PAGE = 23;

type PrintItem = {
  productName: string;
  qty: number;
  unitPrice: number;
  amount: number;
  note: string;
};

type PrintSupplier = {
  businessNumber: string;
  companyName: string;
  ownerName: string;
  address: string;
  businessType: string;
  itemType: string;
};

type PrintConfigResponse = {
  data: PrintSupplier;
};

type AutoSaveState = "idle" | "saving" | "saved" | "error";

function createLocalId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createEmptyRow(): EditableRow {
  return {
    localId: createLocalId(),
    selected: false,
    productName: "",
    productUnit: "",
    qty: "",
    unitPrice: "",
    registeredTimeKST: "",
  };
}

function ensureBaseRows(rows: EditableRow[]): EditableRow[] {
  if (rows.length >= MIN_BASE_ROWS) {
    return rows;
  }

  const appended = [...rows];
  while (appended.length < MIN_BASE_ROWS) {
    appended.push(createEmptyRow());
  }
  return appended;
}

function mapApiRowToEditable(row: SettlementManageRowResponse): EditableRow {
  return {
    localId: row._id,
    id: row._id,
    selected: false,
    productName: row.productName,
    productUnit: row.productUnit ?? "",
    qty: String(row.qty),
    unitPrice: String(row.unitPrice),
    registeredTimeKST: row.registeredTimeKST,
  };
}

function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") {
    return Number.NaN;
  }
  return Number(normalized);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatPrintNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (Number.isInteger(value)) {
    return value.toLocaleString("ko-KR");
  }

  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function toPrintableItems(rows: EditableRow[]): PrintItem[] {
  return rows
  .map((row) => {
      const productName = row.productName.trim();
      const qty = parseNumber(row.qty);
      const unitPrice = parseNumber(row.unitPrice);

      if (!productName || !Number.isFinite(qty) || !Number.isFinite(unitPrice)) {
        return null;
      }

      return {
        productName,
        qty,
        unitPrice,
        amount: Number((qty * unitPrice).toFixed(2)),
        note: qty < 0 ? "반품" : "",
      };
    })
    .filter((item): item is PrintItem => item !== null);
}

function chunkPrintItems(items: PrintItem[], size: number): PrintItem[][] {
  if (items.length === 0) {
    return [[]];
  }

  const chunks: PrintItem[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function calcRowAmount(row: EditableRow): number {
  const qty = parseNumber(row.qty);
  const unitPrice = parseNumber(row.unitPrice);

  if (!Number.isFinite(qty) || !Number.isFinite(unitPrice)) {
    return 0;
  }

  return Number((qty * unitPrice).toFixed(2));
}

function toDateKeyValue(value: string): string {
  const parsed = DateTime.fromFormat(value, DATE_KEY_FORMAT, {
    zone: KST_ZONE,
  });
  if (!parsed.isValid) {
    return getTodayDateKey();
  }
  return parsed.toFormat(DATE_KEY_FORMAT);
}

function sortProductsByCreatedAtAsc(products: ProductOption[]): ProductOption[] {
  return [...products].sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return aTime - bTime;
  });
}

export function SettlementManageScreen(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialVendorId = searchParams.get("vendorId") ?? "";
  const initialDateKey = toDateKeyValue(
    searchParams.get("dateKey") ?? getTodayDateKey(),
  );

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const [selectedVendorId, setSelectedVendorId] = useState(initialVendorId);
  const [vendorInput, setVendorInput] = useState("");
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);

  const [dateKey, setDateKey] = useState(initialDateKey);
  const [rows, setRows] = useState<EditableRow[]>(() => ensureBaseRows([]));

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [processingRowId, setProcessingRowId] = useState<string | null>(null);
  const [activeProductRowId, setActiveProductRowId] = useState<string | null>(
    null,
  );
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [savedSnapshots, setSavedSnapshots] = useState<
    Record<string, SavedRowSnapshot>
  >({});
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [autoSaveRowKey, setAutoSaveRowKey] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const rowsRef = useRef<EditableRow[]>(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const updateRouteQuery = useCallback(
    (nextVendorId: string, nextDateKey: string) => {
      const query = buildQueryString({
        vendorId: nextVendorId || undefined,
        dateKey: nextDateKey,
      });
      router.replace(`/dashboard/settlements/manage?${query}`);
    },
    [router],
  );

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [vendorsResponse, productsResponse] = await Promise.all([
        fetchJson<VendorListResponse>("/api/vendors?page=1&limit=500"),
        fetchJson<ProductListResponse>("/api/products?page=1&limit=500"),
      ]);

      setVendors(vendorsResponse.data);
      setProducts(sortProductsByCreatedAtAsc(productsResponse.data));

      if (selectedVendorId) {
        const selected = vendorsResponse.data.find(
          (vendor) => vendor._id === selectedVendorId,
        );
        if (selected) {
          setVendorInput(selected.name);
        }
      }
    } catch (error) {
      alert(
        error instanceof Error ? error.message : "업체/상품 목록 조회 실패",
      );
    } finally {
      setLoadingMeta(false);
    }
  }, [selectedVendorId]);

  const loadRows = useCallback(async () => {
    if (!selectedVendorId) {
      setRows(ensureBaseRows([]));
      setSavedSnapshots({});
      setEditingRowId(null);
      return;
    }

    setLoadingRows(true);
    try {
      const query = buildQueryString({ vendorId: selectedVendorId, dateKey });
      const response = await fetchJson<SettlementManageResponse>(
        `/api/settlements/manage?${query}`,
      );

      const mappedRows = response.data.rows.map((row) =>
        mapApiRowToEditable(row),
      );
      setRows(ensureBaseRows(mappedRows));
      setEditingRowId(null);
      setSavedSnapshots(
        Object.fromEntries(
          response.data.rows.map((row) => [
            row._id,
            {
              productName: row.productName,
              productUnit: row.productUnit ?? "",
              qty: row.qty,
              unitPrice: row.unitPrice,
            },
          ]),
        ),
      );

      setVendorInput((prev) => prev || response.data.vendor.name);
    } catch (error) {
      alert(error instanceof Error ? error.message : "계산서 데이터 조회 실패");
      setRows(ensureBaseRows([]));
      setSavedSnapshots({});
    } finally {
      setLoadingRows(false);
    }
  }, [dateKey, selectedVendorId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor._id === selectedVendorId),
    [vendors, selectedVendorId],
  );

  const vendorSuggestions = useMemo(() => {
    const query = vendorInput.trim().toLowerCase();
    if (!query) {
      return vendors.slice(0, 12);
    }

    return vendors
      .filter((vendor) => vendor.name.toLowerCase().includes(query))
      .slice(0, 12);
  }, [vendorInput, vendors]);

  const productsByVendor = useMemo(() => {
    if (!selectedVendorId) {
      return products;
    }

    return products.filter(
      (product) => !product.vendorId || product.vendorId === selectedVendorId,
    );
  }, [products, selectedVendorId]);

  const totalAmount = useMemo(
    () => rows.reduce((acc, row) => acc + calcRowAmount(row), 0),
    [rows],
  );

  const updateRowField = (
    localId: string,
    field: EditableField,
    value: string | boolean,
  ): void => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.localId !== localId) {
          return row;
        }

        return {
          ...row,
          [field]: value,
        };
      }),
    );
  };

  const selectVendor = (vendor: VendorOption): void => {
    setSelectedVendorId(vendor._id);
    setVendorInput(vendor.name);
    setVendorDropdownOpen(false);
    updateRouteQuery(vendor._id, dateKey);
  };

  const applyVendorSearch = (): void => {
    const query = vendorInput.trim().toLowerCase();
    if (!query) {
      alert("업체명을 입력하세요.");
      return;
    }

    const matched =
      vendors.find((vendor) => vendor.name.toLowerCase() === query) ??
      vendors.find((vendor) => vendor.name.toLowerCase().includes(query));

    if (!matched) {
      alert("일치하는 업체가 없습니다.");
      return;
    }

    selectVendor(matched);
  };

  const applyDate = (nextDateKey: string): void => {
    const normalized = toDateKeyValue(nextDateKey);
    setDateKey(normalized);
    updateRouteQuery(selectedVendorId, normalized);
  };

  const moveDate = (days: number): void => {
    try {
      const next = parseDateKeyKst(dateKey)
        .plus({ days })
        .toFormat(DATE_KEY_FORMAT);
      applyDate(next);
    } catch {
      applyDate(getTodayDateKey());
    }
  };

  const buildPersistablePayload = (
    row: EditableRow,
  ): PersistableRowPayload | null => {
    const productName = row.productName.trim();
    const productUnit = row.productUnit.trim();
    const qty = parseNumber(row.qty);
    const unitPrice = parseNumber(row.unitPrice);

    if (!productName) {
      return null;
    }

    if (!Number.isFinite(qty)) {
      return null;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return null;
    }

    return {
      productName,
      productUnit: productUnit || undefined,
      qty,
      unitPrice,
    };
  };

  const isSameAsSavedSnapshot = (
    row: EditableRow,
    payload: PersistableRowPayload,
  ): boolean => {
    if (!row.id) {
      return false;
    }

    const snapshot = savedSnapshots[row.id];
    if (!snapshot) {
      return false;
    }

    return (
      snapshot.productName === payload.productName &&
      snapshot.productUnit === (payload.productUnit ?? "") &&
      snapshot.qty === payload.qty &&
      snapshot.unitPrice === payload.unitPrice
    );
  };

  const persistRow = async (
    row: EditableRow,
    payload: PersistableRowPayload,
  ): Promise<void> => {
    if (!selectedVendorId) {
      return;
    }

    setProcessingRowId(row.localId);
    setAutoSaveState("saving");
    setAutoSaveRowKey(row.id ?? row.localId);

    try {
      let savedId: string | undefined;

      if (row.id) {
        const response = await fetchJson<{ data: { _id: string } }>(
          "/api/settlements/manage",
          {
          method: "PATCH",
          body: JSON.stringify({
            id: row.id,
            productName: payload.productName,
            productUnit: payload.productUnit,
            qty: payload.qty,
            unitPrice: payload.unitPrice,
          }),
          },
        );
        savedId = response.data._id;
      } else {
        const response = await fetchJson<{ data: { _id: string } }>(
          "/api/settlements/manage",
          {
          method: "POST",
          body: JSON.stringify({
            vendorId: selectedVendorId,
            dateKey,
            productName: payload.productName,
            productUnit: payload.productUnit,
            qty: payload.qty,
            unitPrice: payload.unitPrice,
          }),
          },
        );
        savedId = response.data._id;
      }

      await loadRows();
      setAutoSaveState("saved");
      setAutoSaveRowKey(savedId ?? row.id ?? row.localId);
      setLastAutoSavedAt(
        DateTime.now().setZone(KST_ZONE).toFormat("HH:mm:ss"),
      );
    } catch (error) {
      setAutoSaveState("error");
      alert(error instanceof Error ? error.message : "행 저장 실패");
    } finally {
      setProcessingRowId(null);
    }
  };

  const autoSaveRow = async (row: EditableRow): Promise<void> => {
    if (!selectedVendorId || processingRowId === row.localId) {
      return;
    }

    const payload = buildPersistablePayload(row);
    if (!payload) {
      return;
    }

    if (isSameAsSavedSnapshot(row, payload)) {
      setEditingRowId((current) => (current === row.localId ? null : current));
      return;
    }

    await persistRow(row, payload);
    setEditingRowId((current) => (current === row.localId ? null : current));
  };

  const handleRowBlur = (localId: string): void => {
    window.setTimeout(() => {
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement?.dataset.rowid === localId) {
        return;
      }

      const targetRow = rowsRef.current.find(
        (item) => item.localId === localId,
      );
      if (!targetRow) {
        return;
      }

      void autoSaveRow(targetRow);
    }, 120);
  };

  const returnRow = async (row: EditableRow): Promise<void> => {
    if (!row.id) {
      alert("저장된 행만 반품 처리할 수 있습니다.");
      return;
    }

    setProcessingRowId(row.localId);
    try {
      await fetchJson<{ data: unknown }>("/api/settlements/manage/return", {
        method: "POST",
        body: JSON.stringify({ transactionId: row.id }),
      });
      await loadRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "반품 처리 실패");
    } finally {
      setProcessingRowId(null);
    }
  };

  const deleteRow = async (row: EditableRow): Promise<void> => {
    if (!row.id) {
      setRows((prev) =>
        ensureBaseRows(prev.filter((item) => item.localId !== row.localId)),
      );
      return;
    }

    setProcessingRowId(row.localId);
    try {
      await fetchJson<{ data: unknown }>("/api/settlements/manage", {
        method: "DELETE",
        body: JSON.stringify({ id: row.id }),
      });
      await loadRows();
    } catch (error) {
      alert(error instanceof Error ? error.message : "행 삭제 실패");
    } finally {
      setProcessingRowId(null);
    }
  };

  const addRow = (): void => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const exportExcel = (): void => {
    if (!selectedVendorId) {
      alert("먼저 업체를 선택하세요.");
      return;
    }

    const query = buildQueryString({ vendorId: selectedVendorId, dateKey });
    window.location.href = `/api/settlements/export?${query}`;
  };

  const printPage = async (): Promise<void> => {
    let supplier: PrintSupplier;

    try {
      const response = await fetchJson<PrintConfigResponse>(
        "/api/settlements/print-config",
      );
      supplier = response.data;
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "인쇄 설정 정보를 불러오지 못했습니다.",
      );
      return;
    }

    const printableItems = toPrintableItems(rows);
    const totalAmount = printableItems.reduce(
      (acc, item) => acc + item.amount,
      0,
    );
    const pages = chunkPrintItems(printableItems, PRINT_ROWS_PER_PAGE);

    const pagesHtml = pages
      .map((pageItems, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1;
        const emptyRows = Math.max(PRINT_ROWS_PER_PAGE - pageItems.length, 0);

        const itemRowsHtml = pageItems
          .map(
            (item) => `<tr>
          <td class="left">${escapeHtml(item.productName)}</td>
          <td class="right">${formatPrintNumber(item.qty)}</td>
          <td class="right">${formatPrintNumber(item.unitPrice)}</td>
          <td class="right">${formatPrintNumber(item.amount)}</td>
          <td>${escapeHtml(item.note)}</td>
        </tr>`,
          )
          .join("");

        const emptyRowsHtml = Array.from({ length: emptyRows })
          .map(
            () => `<tr>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        </tr>`,
          )
          .join("");

        const totalRowHtml = isLastPage
          ? `<tr class="total">
              <td>계</td>
              <td></td>
              <td></td>
              <td class="right">${formatPrintNumber(totalAmount)}</td>
              <td></td>
            </tr>`
          : "";

        return `<section class="sheet ${isLastPage ? "" : "page-break"}">
      <div class="title">일반계산서</div>
      <div class="meta">거래일자: ${escapeHtml(dateKey)} | ${pageIndex + 1} / ${pages.length}</div>

      <table class="supplier">
        <colgroup>
          <col style="width: 17%;" />
          <col style="width: 16%;" />
          <col style="width: 23%;" />
          <col style="width: 14%;" />
          <col style="width: 20%;" />
          <col style="width: 10%;" />
        </colgroup>
        <tbody>
          <tr>
            <th rowspan="5">공급자</th>
            <th>사업자번호</th>
            <td colspan="4" class="left">${escapeHtml(supplier.businessNumber)}</td>
          </tr>
          <tr>
            <th>상호</th>
            <td colspan="2" class="left">${escapeHtml(supplier.companyName)}</td>
            <th>성명</th>
            <td>${escapeHtml(supplier.ownerName)}</td>
            <td>(인)</td>
          </tr>
          <tr>
            <th>소재지</th>
            <td colspan="4" class="left">${escapeHtml(supplier.address)}</td>
          </tr>
          <tr>
            <th>업태</th>
            <td>${escapeHtml(supplier.businessType)}</td>
            <th>종목</th>
            <td colspan="2">${escapeHtml(supplier.itemType)}</td>
          </tr>
          <tr>
            <th>담당자</th>
            <td></td>
            <th>전화번호</th>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>

      <table class="items">
        <colgroup>
          <col style="width: 38%;" />
          <col style="width: 14%;" />
          <col style="width: 19%;" />
          <col style="width: 20%;" />
          <col style="width: 9%;" />
        </colgroup>
        <thead>
          <tr>
            <th>품명</th>
            <th>수량</th>
            <th>단가</th>
            <th>금액</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHtml}
          ${emptyRowsHtml}
          ${totalRowHtml}
        </tbody>
      </table>
    </section>`;
      })
      .join("");

    const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>거래명세서 인쇄</title>
    <style>
      @page {
        size: A5 portrait;
        margin: 8mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #111827;
        font-family: "Pretendard", "Pretendard Variable", "Malgun Gothic", sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .sheet {
        width: 132mm;
        margin: 0 auto 0 auto;
      }

      .title {
        margin: 4mm 0 5mm;
        text-align: center;
        font-size: 11mm;
        font-weight: 700;
      }

      .meta {
        margin-bottom: 1.8mm;
        text-align: right;
        font-size: 11px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th,
      td {
        border: 1px solid #111827;
        padding: 1.2mm 1.4mm;
        font-size: 10.5px;
        line-height: 1.2;
        text-align: center;
        vertical-align: middle;
      }

      .supplier {
        margin-bottom: 1.8mm;
      }

      .supplier th,
      .supplier td {
        height: 5.3mm;
        font-size: 10px;
      }

      .items td,
      .items th {
        height: 5.9mm;
      }

      .left {
        text-align: left;
      }

      .right {
        text-align: right;
      }

      .total td {
        font-weight: 700;
      }

      .page-break {
        page-break-after: always;
        break-after: page;
      }
    </style>
  </head>
  <body>
    ${pagesHtml}
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 200);
      };
      window.onafterprint = function() {
        window.close();
      };
    </script>
  </body>
</html>`;

    const popup = window.open("", "_blank", "width=800,height=1100");
    if (!popup) {
      alert("인쇄 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

  const getProductSuggestions = (row: EditableRow): ProductOption[] => {
    const sortedProducts = sortProductsByCreatedAtAsc(productsByVendor);
    const query = row.productName.trim().toLowerCase();

    if (!query) {
      return sortedProducts.slice(0, 8);
    }

    return sortedProducts
      .filter((product) => product.name.toLowerCase().includes(query))
      .slice(0, 8);
  };

  const applyProduct = (row: EditableRow, product: ProductOption): void => {
    setRows((prev) =>
      prev.map((item) => {
        if (item.localId !== row.localId) {
          return item;
        }

        return {
          ...item,
          productName: product.name,
          productUnit: product.unit ?? "",
        };
      }),
    );

    setActiveProductRowId(null);
    setEditingRowId((current) => current ?? row.localId);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="text-lg">계산서 상세 관리</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-md border border-slate-300 bg-slate-50 px-1 py-1">
                <span className="px-2 text-xs font-medium text-slate-500">
                  거래일자
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => moveDate(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DatePicker
                  className="w-40"
                  value={dateKey}
                  onChange={(val) => applyDate(val)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => moveDate(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => applyDate(getTodayDateKey())}
                >
                  오늘
                </Button>
              </div>

              <Button
                type="button"
                variant="success"
                className="whitespace-nowrap"
                onClick={exportExcel}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                엑셀 저장
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="whitespace-nowrap"
                onClick={() => void printPage()}
              >
                <Printer className="mr-1 h-4 w-4" />
                인쇄
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <span className="w-14 text-sm font-medium text-slate-600">
              상호
            </span>
            <div className="relative flex-1">
              <Input
                value={vendorInput}
                placeholder="업체명을 검색하세요"
                onFocus={() => setVendorDropdownOpen(true)}
                onChange={(event) => {
                  setVendorInput(event.target.value);
                  setVendorDropdownOpen(true);
                }}
                onBlur={() => {
                  window.setTimeout(() => setVendorDropdownOpen(false), 120);
                }}
              />
              {vendorDropdownOpen && vendorSuggestions.length ? (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                  {vendorSuggestions.map((vendor) => (
                    <button
                      key={vendor._id}
                      type="button"
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-0 hover:bg-blue-50"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectVendor(vendor)}
                    >
                      {vendor.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button
              type="button"
              variant="outline"
              className="whitespace-nowrap"
              onClick={applyVendorSearch}
            >
              <Search className="mr-1 h-4 w-4" />
              검색
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              선택 상호
              <div className="mt-1 text-base font-semibold text-slate-900">
                {selectedVendor?.name ?? "미선택"}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              거래일자
              <div className="mt-1 text-base font-semibold text-slate-900">
                {dateKey}
              </div>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              합계금액
              <div className="mt-1 text-base font-semibold text-primary">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="flex justify-end px-4 py-3">
            <div
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium ${
                autoSaveState === "saving"
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : autoSaveState === "saved"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : autoSaveState === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {autoSaveState === "saving" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : autoSaveState === "saved" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : autoSaveState === "error" ? (
                <AlertCircle className="h-3.5 w-3.5" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>
                {autoSaveState === "saving"
                  ? "자동 저장 중..."
                  : autoSaveState === "saved"
                    ? `마지막 저장 ${lastAutoSavedAt ?? "-"}`
                    : autoSaveState === "error"
                      ? "자동 저장 실패"
                      : "자동 저장 대기"}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="w-12 border border-slate-200 px-2 py-3 text-center">
                    <input type="checkbox" aria-label="전체 선택" />
                  </th>
                  <th className="border border-slate-200 px-3 py-3 text-left">
                    품목
                  </th>
                  <th className="w-36 border border-slate-200 px-3 py-3 text-left">
                    규격
                  </th>
                  <th className="w-28 border border-slate-200 px-3 py-3 text-right">
                    수량
                  </th>
                  <th className="w-36 border border-slate-200 px-3 py-3 text-right">
                    단가
                  </th>
                  <th className="w-40 border border-slate-200 bg-slate-100 px-3 py-3 text-right">
                    합계
                  </th>
                  <th className="w-40 border border-slate-200 px-3 py-3 text-center">
                    관리
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => {
                  const amount = calcRowAmount(row);
                  const suggestions = getProductSuggestions(row);
                  const rowBusy = processingRowId === row.localId;
                  const isEditingRow = editingRowId === row.localId;
                  const currentRowKey = row.id ?? row.localId;
                  const isAutoSavingRow =
                    autoSaveState === "saving" &&
                    autoSaveRowKey === currentRowKey;
                  const isAutoSavedRow =
                    autoSaveState === "saved" &&
                    autoSaveRowKey === currentRowKey;
                  const isAutoSaveFailedRow =
                    autoSaveState === "error" &&
                    autoSaveRowKey === currentRowKey;
                  const rowLocked =
                    Boolean(row.id) && editingRowId !== row.localId;
                  const inputClassName = `h-8 border-0 px-1 shadow-none focus-visible:ring-0 ${
                    rowLocked
                      ? "cursor-not-allowed bg-slate-100 text-slate-500"
                      : isEditingRow
                        ? "bg-blue-50/80"
                        : "bg-transparent"
                  }`;

                  return (
                    <tr
                      key={row.localId}
                      className={
                        isEditingRow ? "bg-blue-50/50" : "hover:bg-slate-50"
                      }
                    >
                      <td className="border border-slate-200 px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            updateRowField(
                              row.localId,
                              "selected",
                              event.target.checked,
                            )
                          }
                        />
                      </td>

                      <td className="relative border border-slate-200 px-2 py-1">
                        <Input
                          className={inputClassName}
                          data-rowid={row.localId}
                          value={row.productName}
                          readOnly={rowLocked || rowBusy}
                          onFocus={() => {
                            if (!rowLocked) {
                              setActiveProductRowId(row.localId);
                            }
                          }}
                          onBlur={() => {
                            window.setTimeout(
                              () =>
                                setActiveProductRowId((current) =>
                                  current === row.localId ? null : current,
                                ),
                              120,
                            );
                            handleRowBlur(row.localId);
                          }}
                          onChange={(event) =>
                            updateRowField(
                              row.localId,
                              "productName",
                              event.target.value,
                            )
                          }
                        />

                        {activeProductRowId === row.localId &&
                        suggestions.length ? (
                          <div className="absolute left-0 top-full z-20 mt-1 max-h-60 w-[320px] overflow-y-auto rounded-md border border-slate-200 bg-white shadow-xl">
                            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                              추천 품목
                            </div>
                            {suggestions.map((product) => (
                              <button
                                key={product._id}
                                type="button"
                                className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-700 last:border-0 hover:bg-blue-50"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => applyProduct(row, product)}
                              >
                                <span>{product.name}</span>
                                <span className="text-xs text-slate-400">
                                  {product.unit ?? "-"}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </td>

                      <td className="border border-slate-200 px-2 py-1">
                        <Input
                          className={`${inputClassName} text-slate-600`}
                          data-rowid={row.localId}
                          value={row.productUnit}
                          readOnly={rowLocked || rowBusy}
                          onBlur={() => handleRowBlur(row.localId)}
                          onChange={(event) =>
                            updateRowField(
                              row.localId,
                              "productUnit",
                              event.target.value,
                            )
                          }
                        />
                      </td>

                      <td className="border border-slate-200 px-2 py-1">
                        <Input
                          className={`${inputClassName} text-right`}
                          data-rowid={row.localId}
                          inputMode="decimal"
                          value={row.qty}
                          readOnly={rowLocked || rowBusy}
                          onBlur={() => handleRowBlur(row.localId)}
                          onChange={(event) =>
                            updateRowField(
                              row.localId,
                              "qty",
                              event.target.value,
                            )
                          }
                        />
                      </td>

                      <td className="border border-slate-200 px-2 py-1">
                        <Input
                          className={`${inputClassName} text-right`}
                          data-rowid={row.localId}
                          inputMode="decimal"
                          value={row.unitPrice}
                          readOnly={rowLocked || rowBusy}
                          onBlur={() => handleRowBlur(row.localId)}
                          onChange={(event) =>
                            updateRowField(
                              row.localId,
                              "unitPrice",
                              event.target.value,
                            )
                          }
                        />
                      </td>

                      <td
                        className={`border border-slate-200 bg-slate-50 px-3 py-1 text-right font-semibold ${
                          amount < 0 ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {Number.isFinite(amount) ? formatCurrency(amount) : ""}
                      </td>

                      <td className="border border-slate-200 px-2 py-1 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              title="수정"
                              className={`rounded p-1 transition-colors ${
                                isEditingRow
                                  ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                                  : "text-slate-400 hover:bg-blue-50 hover:text-blue-600"
                              } disabled:opacity-50`}
                              disabled={rowBusy}
                              onClick={() =>
                                setEditingRowId((current) =>
                                  current === row.localId ? null : row.localId,
                                )
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="반품"
                              className="rounded p-1 text-slate-400 hover:bg-orange-50 hover:text-orange-500 disabled:opacity-50"
                              disabled={!row.id || rowBusy}
                              onClick={() => void returnRow(row)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="삭제"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                              disabled={rowBusy}
                              onClick={() => void deleteRow(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="min-h-4 text-[11px] leading-4">
                            {isAutoSavingRow ? (
                              <span className="inline-flex items-center gap-1 text-blue-600">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                저장중...
                              </span>
                            ) : isAutoSavedRow ? (
                              <span className="text-emerald-600">
                                저장됨 {lastAutoSavedAt ?? ""}
                              </span>
                            ) : isAutoSaveFailedRow ? (
                              <span className="text-red-600">저장 실패</span>
                            ) : null}
                          </p>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">
              {loadingMeta || loadingRows
                ? "데이터를 불러오는 중..."
                : "품목 기본 15행이 제공됩니다. 연필 아이콘으로 수정 후, 포커스가 벗어나면 자동 저장됩니다."}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="mr-1 h-4 w-4" />행 추가
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
