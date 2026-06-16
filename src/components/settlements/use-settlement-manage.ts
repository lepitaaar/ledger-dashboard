import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import { toast } from "sonner";
import { buildQueryString, fetchJson } from "@/lib/client";
import {
  DATE_KEY_FORMAT,
  KST_ZONE,
  getTodayDateKey,
  parseDateKeyKst,
} from "@/lib/kst";
import {
  buildSettlementPrintHtml,
  type SettlementPrintItem,
  type SettlementPrintSupplier,
} from "@/lib/settlement-print";

export type VendorOption = {
  _id: string;
  name: string;
};

export type ProductOption = {
  _id: string;
  name: string;
  unit?: string;
  vendorId?: string | null;
  createdAt?: string;
};

export type SettlementManageRowResponse = {
  _id: string;
  productName: string;
  productUnit: string;
  qty: number;
  unitPrice: number;
  amount: number;
  registeredTimeKST: string;
};

export type SettlementManageResponse = {
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

export type EditableRow = {
  localId: string;
  id?: string;
  selected: boolean;
  productName: string;
  productUnit: string;
  qty: string;
  unitPrice: string;
  registeredTimeKST: string;
};

export type EditableField =
  | "selected"
  | "productName"
  | "productUnit"
  | "qty"
  | "unitPrice";

export type EditableValueField = Exclude<EditableField, "selected">;

export type PersistableRowPayload = {
  productName: string;
  productUnit?: string;
  qty: number;
  unitPrice: number;
};

export type SavedRowSnapshot = {
  productName: string;
  productUnit: string;
  qty: number;
  unitPrice: number;
};

export type RowValidationErrors = Partial<Record<EditableValueField, string>>;

export type AutoSaveState = "idle" | "saving" | "saved" | "error";

type LocalDraftRow = {
  localId: string;
  id?: string;
  vendorId: string;
  dateKey: string;
  productName: string;
  productUnit: string;
  qty: string;
  unitPrice: string;
  savedAt: string;
  lastError?: string;
};

export type PrintConfigResponse = {
  data: SettlementPrintSupplier;
};

export type VendorListResponse = {
  data: VendorOption[];
};

export type ProductListResponse = {
  data: ProductOption[];
};

const MIN_BASE_ROWS = 15;
const LOCAL_DRAFT_STORAGE_PREFIX = "ledger:settlement-local-drafts:v1";

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

function getLocalDraftStorageKey(vendorId: string, dateKey: string): string {
  return `${LOCAL_DRAFT_STORAGE_PREFIX}:${vendorId}:${dateKey}`;
}

function readLocalDraftRows(vendorId: string, dateKey: string): LocalDraftRow[] {
  if (typeof window === "undefined" || !vendorId) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(
      getLocalDraftStorageKey(vendorId, dateKey),
    );
    if (!raw) return [];

    const parsed = JSON.parse(raw) as LocalDraftRow[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (draft) =>
        draft.vendorId === vendorId &&
        draft.dateKey === dateKey &&
        typeof draft.localId === "string" &&
        typeof draft.productName === "string" &&
        typeof draft.qty === "string" &&
        typeof draft.unitPrice === "string",
    );
  } catch {
    return [];
  }
}

function writeLocalDraftRows(
  vendorId: string,
  dateKey: string,
  drafts: LocalDraftRow[],
): void {
  if (typeof window === "undefined" || !vendorId) {
    return;
  }

  const key = getLocalDraftStorageKey(vendorId, dateKey);
  try {
    if (drafts.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(drafts));
  } catch {
    toast.error("로컬 임시저장 공간이 부족해 저장 실패 행을 백업하지 못했습니다.");
  }
}

function upsertLocalDraftRow(
  vendorId: string,
  dateKey: string,
  row: EditableRow,
  errorMessage?: string,
): void {
  const drafts = readLocalDraftRows(vendorId, dateKey);
  const draft: LocalDraftRow = {
    localId: row.localId,
    id: row.id,
    vendorId,
    dateKey,
    productName: row.productName,
    productUnit: row.productUnit,
    qty: row.qty,
    unitPrice: row.unitPrice,
    savedAt: new Date().toISOString(),
    lastError: errorMessage,
  };

  const key = row.id ?? row.localId;
  const next = drafts.filter((item) => (item.id ?? item.localId) !== key);
  next.push(draft);
  writeLocalDraftRows(vendorId, dateKey, next);
}

function removeLocalDraftRow(
  vendorId: string,
  dateKey: string,
  rowIdOrLocalId: string,
): void {
  const drafts = readLocalDraftRows(vendorId, dateKey);
  writeLocalDraftRows(
    vendorId,
    dateKey,
    drafts.filter(
      (draft) =>
        draft.localId !== rowIdOrLocalId && draft.id !== rowIdOrLocalId,
    ),
  );
}

function mapLocalDraftToEditable(draft: LocalDraftRow): EditableRow {
  return {
    localId: draft.localId,
    id: draft.id,
    selected: false,
    productName: draft.productName,
    productUnit: draft.productUnit,
    qty: draft.qty,
    unitPrice: draft.unitPrice,
    registeredTimeKST: draft.id ? "" : "로컬 임시저장",
  };
}

function mergeLocalDraftRows(
  serverRows: EditableRow[],
  drafts: LocalDraftRow[],
): EditableRow[] {
  if (drafts.length === 0) {
    return serverRows;
  }

  const rowsById = new Map(serverRows.map((row) => [row.id, row]));
  const merged = serverRows.map((row) => {
    const draft = drafts.find((item) => item.id && item.id === row.id);
    return draft
      ? {
          ...mapLocalDraftToEditable(draft),
          registeredTimeKST: row.registeredTimeKST,
        }
      : row;
  });

  for (const draft of drafts) {
    if (!draft.id || !rowsById.has(draft.id)) {
      merged.push(mapLocalDraftToEditable(draft));
    }
  }

  return merged;
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

export function parseNumber(value: string): number {
  const normalized = value.replace(/,/g, "").trim();
  if (normalized === "") {
    return Number.NaN;
  }
  return Number(normalized);
}

export function calcRowAmount(row: EditableRow): number {
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

export function useSettlementManage() {
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

  const [dateKey, setDateKey] = useState(initialDateKey);
  const [rows, setRows] = useState<EditableRow[]>(() => ensureBaseRows([]));

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [processingRowId, setProcessingRowId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [savedSnapshots, setSavedSnapshots] = useState<
    Record<string, SavedRowSnapshot>
  >({});
  const [rowValidationErrors, setRowValidationErrors] = useState<
    Record<string, RowValidationErrors>
  >({});
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState>("idle");
  const [autoSaveRowKey, setAutoSaveRowKey] = useState<string | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  
  // Custom dialog state for warn on navigate / bulk actions
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const rowsRef = useRef<EditableRow[]>(rows);
  const syncingLocalDraftsRef = useRef(false);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const hasUnsavedChanges = useMemo(() => {
    return rows.some((row) => {
      const isEmpty =
        row.productName.trim() === "" &&
        row.productUnit.trim() === "" &&
        row.qty.trim() === "" &&
        row.unitPrice.trim() === "";
      if (!row.id && isEmpty) {
        return false;
      }
      
      if (rowValidationErrors[row.localId] && Object.keys(rowValidationErrors[row.localId]).length > 0) {
        return true;
      }
      
      if (autoSaveState === "error" && autoSaveRowKey === (row.id ?? row.localId)) {
        return true;
      }
      
      if (!row.id) {
        return true;
      }
      
      const snapshot = savedSnapshots[row.id];
      if (!snapshot) return false;
      return (
        row.productName !== snapshot.productName ||
        row.productUnit !== snapshot.productUnit ||
        row.qty !== String(snapshot.qty) ||
        row.unitPrice !== String(snapshot.unitPrice)
      );
    });
  }, [rows, savedSnapshots, rowValidationErrors, autoSaveState, autoSaveRowKey]);

  const savedTotalAmount = useMemo(() => {
    return Object.values(savedSnapshots).reduce(
      (acc, snap) => acc + snap.qty * snap.unitPrice,
      0
    );
  }, [savedSnapshots]);

  const allSelected = useMemo(() => {
    const savedRows = rows.filter((row) => row.id);
    return savedRows.length > 0 && savedRows.every((row) => row.selected);
  }, [rows]);

  const toggleSelectAll = (checked: boolean): void => {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        selected: row.id ? checked : false,
      })),
    );
  };

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
      toast.error(
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
      setRowValidationErrors({});
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
      const localDrafts = readLocalDraftRows(selectedVendorId, dateKey);
      setRows(ensureBaseRows(mergeLocalDraftRows(mappedRows, localDrafts)));
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
      setRowValidationErrors({});
      if (localDrafts.length > 0) {
        setAutoSaveState("error");
        setAutoSaveRowKey(localDrafts[0].id ?? localDrafts[0].localId);
        toast.info(
          `로컬 임시저장 ${localDrafts.length}건을 복구했습니다. 서버 동기화를 다시 시도합니다.`,
        );
      }

      setVendorInput((prev) => prev || response.data.vendor.name);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "계산서 데이터 조회 실패");
      setRows(ensureBaseRows([]));
      setSavedSnapshots({});
      setRowValidationErrors({});
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
    const currentRow = rowsRef.current.find((row) => row.localId === localId);
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

    if (selectedVendorId && field !== "selected" && currentRow) {
      const drafts = readLocalDraftRows(selectedVendorId, dateKey);
      const hasDraft = drafts.some(
        (draft) => draft.localId === localId || draft.id === currentRow.id,
      );
      if (hasDraft) {
        upsertLocalDraftRow(selectedVendorId, dateKey, {
          ...currentRow,
          [field]: value as string,
        });
      }
    }

    if (autoSaveRowKey === localId && autoSaveState === "error") {
      setAutoSaveState("idle");
    }

    if (field !== "selected") {
      setRowValidationErrors((prev) => {
        const rowErrors = prev[localId];
        if (!rowErrors || !rowErrors[field]) {
          return prev;
        }

        const nextRowErrors = { ...rowErrors };
        delete nextRowErrors[field];

        if (Object.keys(nextRowErrors).length === 0) {
          const rest = { ...prev };
          delete rest[localId];
          return rest;
        }

        return {
          ...prev,
          [localId]: nextRowErrors,
        };
      });
    }
  };

  const selectVendor = (vendor: VendorOption): void => {
    const proceed = () => {
      setSelectedVendorId(vendor._id);
      setVendorInput(vendor.name);
      updateRouteQuery(vendor._id, dateKey);
    };

    if (hasUnsavedChanges) {
      setConfirmState({
        isOpen: true,
        title: "변경사항이 저장되지 않았습니다",
        description: "현재 페이지에 저장되지 않은 변경사항이나 저장 실패한 행이 있습니다. 다른 업체로 이동하면 변경사항이 소실됩니다. 이동하시겠습니까?",
        onConfirm: () => {
          setConfirmState(null);
          proceed();
        },
        onCancel: () => setConfirmState(null),
      });
    } else {
      proceed();
    }
  };

  const applyDate = (nextDateKey: string): void => {
    const normalized = toDateKeyValue(nextDateKey);
    const proceed = () => {
      setDateKey(normalized);
      updateRouteQuery(selectedVendorId, normalized);
    };

    if (hasUnsavedChanges) {
      setConfirmState({
        isOpen: true,
        title: "변경사항이 저장되지 않았습니다",
        description: "현재 페이지에 저장되지 않은 변경사항이나 저장 실패한 행이 있습니다. 다른 날짜로 이동하면 변경사항이 소실됩니다. 이동하시겠습니까?",
        onConfirm: () => {
          setConfirmState(null);
          proceed();
        },
        onCancel: () => setConfirmState(null),
      });
    } else {
      proceed();
    }
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

  const buildPersistablePayload = useCallback((
    row: EditableRow,
  ): { payload: PersistableRowPayload | null; errors: RowValidationErrors } => {
    const productName = row.productName.trim();
    const productUnit = row.productUnit.trim();
    const qty = parseNumber(row.qty);
    const unitPrice = parseNumber(row.unitPrice);
    const errors: RowValidationErrors = {};

    if (!productName) {
      errors.productName = "품목은 필수입니다.";
    } else if (productName.length > 200) {
      errors.productName = "품목은 200자 이하로 입력하세요.";
    }

    if (productUnit.length > 50) {
      errors.productUnit = "규격은 50자 이하로 입력하세요.";
    }

    if (!Number.isFinite(qty)) {
      errors.qty = "수량은 숫자여야 합니다.";
    }

    if (!Number.isFinite(unitPrice)) {
      errors.unitPrice = "단가는 숫자여야 합니다.";
    } else if (unitPrice < 0) {
      errors.unitPrice = "단가는 0 이상이어야 합니다.";
    }

    if (Object.keys(errors).length > 0) {
      return {
        payload: null,
        errors,
      };
    }

    return {
      payload: {
        productName,
        productUnit: productUnit || undefined,
        qty,
        unitPrice,
      },
      errors: {},
    };
  }, []);

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
      let updatedRowData: SettlementManageRowResponse;

      if (row.id) {
        const response = await fetchJson<{ data: SettlementManageRowResponse }>(
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
        updatedRowData = response.data;
      } else {
        const response = await fetchJson<{ data: SettlementManageRowResponse }>(
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
        updatedRowData = response.data;
      }

      const savedRow = mapApiRowToEditable(updatedRowData);

      setRows((prev) =>
        prev.map((item) => {
          if (item.localId === row.localId) {
            return {
              ...savedRow,
              selected: item.selected
            };
          }
          return item;
        })
      );

      setSavedSnapshots((prev) => ({
        ...prev,
        [savedRow.id!]: {
          productName: savedRow.productName,
          productUnit: savedRow.productUnit,
          qty: parseNumber(savedRow.qty),
          unitPrice: parseNumber(savedRow.unitPrice),
        }
      }));
      removeLocalDraftRow(selectedVendorId, dateKey, row.id ?? row.localId);
      removeLocalDraftRow(selectedVendorId, dateKey, savedRow.id!);

      setAutoSaveState("saved");
      setAutoSaveRowKey(savedRow.id!);
      setLastAutoSavedAt(
        DateTime.now().setZone(KST_ZONE).toFormat("HH:mm:ss"),
      );
    } catch (error) {
      setAutoSaveState("error");
      setAutoSaveRowKey(row.id ?? row.localId);
      const errorMsg = error instanceof Error ? error.message : "서버 오류";
      upsertLocalDraftRow(selectedVendorId, dateKey, row, errorMsg);
      const rowName = row.productName ? `"${row.productName}" ` : "신규 행 ";
      toast.error(`${rowName}저장 실패: ${errorMsg}. 로컬에 임시저장했으며, 나중에 다시 동기화합니다.`);
    } finally {
      setProcessingRowId(null);
    }
  };

  const autoSaveRow = async (row: EditableRow): Promise<void> => {
    if (!selectedVendorId || processingRowId === row.localId) {
      return;
    }

    const isEmptyRow =
      row.productName.trim() === "" &&
      row.productUnit.trim() === "" &&
      row.qty.trim() === "" &&
      row.unitPrice.trim() === "";

    if (!row.id && isEmptyRow) {
      setRowValidationErrors((prev) => {
        if (!prev[row.localId]) return prev;
        const next = { ...prev };
        delete next[row.localId];
        return next;
      });
      return;
    }

    const { payload, errors } = buildPersistablePayload(row);
    if (!payload) {
      setRowValidationErrors((prev) => ({
        ...prev,
        [row.localId]: errors,
      }));
      setAutoSaveState("error");
      setAutoSaveRowKey(row.id ?? row.localId);
      return;
    }

    setRowValidationErrors((prev) => {
      if (!prev[row.localId]) {
        return prev;
      }

      const rest = { ...prev };
      delete rest[row.localId];
      return rest;
    });

    if (isSameAsSavedSnapshot(row, payload)) {
      setEditingRowId((current) => (current === row.localId ? null : current));
      return;
    }

    await persistRow(row, payload);
    setEditingRowId((current) => (current === row.localId ? null : current));
  };

  const syncLocalDraftsFromStorage = useCallback(async (
    showSuccessToast = false,
  ): Promise<void> => {
    if (!selectedVendorId || syncingLocalDraftsRef.current) {
      return;
    }

    const drafts = readLocalDraftRows(selectedVendorId, dateKey);
    if (drafts.length === 0) {
      return;
    }

    syncingLocalDraftsRef.current = true;
    try {
      let syncedCount = 0;
      for (const draft of drafts) {
        const draftRow = mapLocalDraftToEditable(draft);
        const { payload } = buildPersistablePayload(draftRow);
        if (!payload) {
          continue;
        }

        try {
          let updatedRowData: SettlementManageRowResponse;
          if (draft.id) {
            const response = await fetchJson<{ data: SettlementManageRowResponse }>(
              "/api/settlements/manage",
              {
                method: "PATCH",
                body: JSON.stringify({
                  id: draft.id,
                  productName: payload.productName,
                  productUnit: payload.productUnit,
                  qty: payload.qty,
                  unitPrice: payload.unitPrice,
                }),
              },
            );
            updatedRowData = response.data;
          } else {
            const response = await fetchJson<{ data: SettlementManageRowResponse }>(
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
            updatedRowData = response.data;
          }

          const savedRow = mapApiRowToEditable(updatedRowData);
          removeLocalDraftRow(selectedVendorId, dateKey, draft.id ?? draft.localId);
          removeLocalDraftRow(selectedVendorId, dateKey, savedRow.id!);
          syncedCount += 1;

          setRows((prev) => {
            let didReplace = false;
            const next = prev.map((item) => {
              if (
                item.localId === draft.localId ||
                item.id === draft.id ||
                item.id === savedRow.id
              ) {
                didReplace = true;
                return {
                  ...savedRow,
                  selected: item.selected,
                };
              }
              return item;
            });

            return ensureBaseRows(didReplace ? next : [...next, savedRow]);
          });
          setSavedSnapshots((prev) => ({
            ...prev,
            [savedRow.id!]: {
              productName: savedRow.productName,
              productUnit: savedRow.productUnit,
              qty: parseNumber(savedRow.qty),
              unitPrice: parseNumber(savedRow.unitPrice),
            },
          }));
        } catch (error) {
          upsertLocalDraftRow(
            selectedVendorId,
            dateKey,
            draftRow,
            error instanceof Error ? error.message : "서버 오류",
          );
        }
      }

      const remainingDrafts = readLocalDraftRows(selectedVendorId, dateKey);
      if (remainingDrafts.length === 0 && syncedCount > 0) {
        setAutoSaveState("saved");
        setAutoSaveRowKey(null);
        setLastAutoSavedAt(
          DateTime.now().setZone(KST_ZONE).toFormat("HH:mm:ss"),
        );
        if (showSuccessToast) {
          toast.success(`로컬 임시저장 ${syncedCount}건을 DB에 동기화했습니다.`);
        }
      } else if (remainingDrafts.length > 0) {
        setAutoSaveState("error");
        setAutoSaveRowKey(remainingDrafts[0].id ?? remainingDrafts[0].localId);
      }
    } finally {
      syncingLocalDraftsRef.current = false;
    }
  }, [buildPersistablePayload, dateKey, selectedVendorId]);

  useEffect(() => {
    if (!selectedVendorId || loadingRows) {
      return;
    }

    const timer = window.setTimeout(() => {
      void syncLocalDraftsFromStorage(true);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [loadingRows, selectedVendorId, syncLocalDraftsFromStorage]);

  useEffect(() => {
    const handleOnline = (): void => {
      void syncLocalDraftsFromStorage(true);
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncLocalDraftsFromStorage]);

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
      toast.error("저장된 행만 반품 처리할 수 있습니다.");
      return;
    }

    if (parseNumber(row.qty) <= 0) {
      toast.error("음수 수량인 반품 거래는 다시 반품할 수 없습니다.");
      return;
    }

    setProcessingRowId(row.localId);
    try {
      const response = await fetchJson<{ data: { _id: string } }>("/api/settlements/manage/return", {
        method: "POST",
        body: JSON.stringify({ transactionId: row.id }),
      });

      const returnQty = -parseNumber(row.qty);
      const returnRowObj: EditableRow = {
        localId: response.data._id,
        id: response.data._id,
        selected: false,
        productName: row.productName,
        productUnit: row.productUnit,
        qty: String(returnQty),
        unitPrice: row.unitPrice,
        registeredTimeKST: DateTime.now().setZone(KST_ZONE).toFormat("HH:mm:ss"),
      };

      setRows((prev) => {
        const nextRows: EditableRow[] = [];
        prev.forEach((item) => {
          nextRows.push(item);
          if (item.id === row.id) {
            nextRows.push(returnRowObj);
          }
        });
        return ensureBaseRows(nextRows);
      });

      setSavedSnapshots((prev) => ({
        ...prev,
        [returnRowObj.id!]: {
          productName: returnRowObj.productName,
          productUnit: returnRowObj.productUnit,
          qty: returnQty,
          unitPrice: parseNumber(returnRowObj.unitPrice),
        }
      }));

      toast.success("반품 처리되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "반품 처리 실패");
    } finally {
      setProcessingRowId(null);
    }
  };

  const deleteRow = async (row: EditableRow): Promise<void> => {
    if (!row.id) {
      if (selectedVendorId) {
        removeLocalDraftRow(selectedVendorId, dateKey, row.localId);
      }
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

      setRows((prev) =>
        ensureBaseRows(prev.filter((item) => item.localId !== row.localId))
      );
      setSavedSnapshots((prev) => {
        const next = { ...prev };
        delete next[row.id!];
        return next;
      });
      removeLocalDraftRow(selectedVendorId, dateKey, row.id);
      toast.success("품목이 삭제되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "행 삭제 실패");
    } finally {
      setProcessingRowId(null);
    }
  };

  const cancelRowEdit = (row: EditableRow): void => {
    if (selectedVendorId) {
      removeLocalDraftRow(selectedVendorId, dateKey, row.id ?? row.localId);
    }

    if (row.id) {
      const snapshot = savedSnapshots[row.id];
      if (snapshot) {
        setRows((prev) =>
          prev.map((item) => {
            if (item.localId !== row.localId) {
              return item;
            }
            return {
              ...item,
              productName: snapshot.productName,
              productUnit: snapshot.productUnit,
              qty: String(snapshot.qty),
              unitPrice: String(snapshot.unitPrice),
            };
          })
        );
      }
    } else {
      setRows((prev) =>
        prev.map((item) => {
          if (item.localId !== row.localId) {
            return item;
          }
          return {
            ...item,
            productName: "",
            productUnit: "",
            qty: "",
            unitPrice: "",
          };
        })
      );
    }
    setEditingRowId(null);
    setRowValidationErrors((prev) => {
      const next = { ...prev };
      delete next[row.localId];
      return next;
    });
  };

  const triggerBulkDelete = (): void => {
    const selectedRows = rows.filter((row) => row.selected && row.id);
    if (selectedRows.length === 0) {
      toast.error("선택된 저장된 행이 없습니다.");
      return;
    }

    const count = selectedRows.length;
    const amount = selectedRows.reduce((acc, r) => acc + calcRowAmount(r), 0);

    const formatCurrencyLocal = (val: number) => {
      return new Intl.NumberFormat("ko-KR").format(val);
    };

    setConfirmState({
      isOpen: true,
      title: "선택 항목 일괄 삭제",
      description: `선택한 ${count}건의 항목을 정말로 삭제하시겠습니까? (삭제 합계 금액: ${formatCurrencyLocal(amount)}원)`,
      onConfirm: () => {
        setConfirmState(null);
        void executeBulkDelete(selectedRows);
      },
      onCancel: () => setConfirmState(null),
    });
  };

  const executeBulkDelete = async (selectedRows: EditableRow[]): Promise<void> => {
    setBulkProcessing(true);
    const transactionIds = selectedRows.map((r) => r.id!);

    try {
      const response = await fetchJson<{
        data: { processedIds: string[] };
      }>("/api/settlements/manage/bulk", {
        method: "POST",
        body: JSON.stringify({
          action: "delete",
          transactionIds,
        }),
      });

      const deletedIdsSet = new Set(response.data.processedIds);

      setRows((prev) =>
        ensureBaseRows(
          prev.filter((item) => !item.id || !deletedIdsSet.has(item.id))
        )
      );

      setSavedSnapshots((prev) => {
        const next = { ...prev };
        response.data.processedIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });

      toast.success(`성공적으로 ${response.data.processedIds.length}건이 삭제되었습니다.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "일괄 삭제 처리에 실패했습니다."
      );
    } finally {
      setBulkProcessing(false);
    }
  };

  const triggerBulkReturn = (): void => {
    const selectedRows = rows.filter((row) => row.selected && row.id);
    if (selectedRows.length === 0) {
      toast.error("선택된 저장된 행이 없습니다.");
      return;
    }

    const hasInvalid = selectedRows.some((r) => parseNumber(r.qty) <= 0);
    if (hasInvalid) {
      toast.error("반품은 수량이 양수인 거래(양수 행)만 가능합니다.");
      return;
    }

    const count = selectedRows.length;
    const amount = selectedRows.reduce((acc, r) => acc + calcRowAmount(r), 0);

    const formatCurrencyLocal = (val: number) => {
      return new Intl.NumberFormat("ko-KR").format(val);
    };

    setConfirmState({
      isOpen: true,
      title: "선택 항목 일괄 반품",
      description: `선택한 ${count}건의 항목을 반품 처리하시겠습니까? (반품 합계 금액: ${formatCurrencyLocal(amount)}원)`,
      onConfirm: () => {
        setConfirmState(null);
        void executeBulkReturn(selectedRows);
      },
      onCancel: () => setConfirmState(null),
    });
  };

  const executeBulkReturn = async (selectedRows: EditableRow[]): Promise<void> => {
    setBulkProcessing(true);
    const transactionIds = selectedRows.map((r) => r.id!);

    try {
      const response = await fetchJson<{
        data: { processedIds: string[]; createdIds: string[] };
      }>("/api/settlements/manage/bulk", {
        method: "POST",
        body: JSON.stringify({
          action: "return",
          transactionIds,
        }),
      });

      const { processedIds, createdIds } = response.data;
      const processedIdsSet = new Set(processedIds);

      const createdIdsMap: Record<string, string> = {};
      processedIds.forEach((pid, idx) => {
        createdIdsMap[pid] = createdIds[idx];
      });

      const nowTimeKey = DateTime.now().setZone(KST_ZONE).toFormat("HH:mm:ss");

      setRows((prev) => {
        const nextRows: EditableRow[] = [];
        prev.forEach((item) => {
          nextRows.push(item);
          if (item.id && processedIdsSet.has(item.id)) {
            const createdId = createdIdsMap[item.id];
            if (createdId) {
              const returnQty = -parseNumber(item.qty);
              nextRows.push({
                localId: createdId,
                id: createdId,
                selected: false,
                productName: item.productName,
                productUnit: item.productUnit,
                qty: String(returnQty),
                unitPrice: item.unitPrice,
                registeredTimeKST: nowTimeKey,
              });
            }
          }
        });
        return ensureBaseRows(nextRows);
      });

      setSavedSnapshots((prev) => {
        const next = { ...prev };
        selectedRows.forEach((item, idx) => {
          const createdId = createdIds[idx];
          const returnQty = -parseNumber(item.qty);
          next[createdId] = {
            productName: item.productName,
            productUnit: item.productUnit,
            qty: returnQty,
            unitPrice: parseNumber(item.unitPrice),
          };
        });
        return next;
      });

      setRows((prev) =>
        prev.map((item) =>
          item.id && processedIdsSet.has(item.id)
            ? { ...item, selected: false }
            : item
        )
      );

      toast.success(`성공적으로 ${createdIds.length}건이 반품 처리되었습니다.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "일괄 반품 처리에 실패했습니다."
      );
    } finally {
      setBulkProcessing(false);
    }
  };

  const addRow = (): void => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const exportExcel = (): void => {
    if (!selectedVendorId) {
      toast.error("먼저 업체를 선택하세요.");
      return;
    }

    const query = buildQueryString({ vendorId: selectedVendorId, dateKey });
    window.location.href = `/api/settlements/export?${query}`;
  };

  const printPage = async (): Promise<void> => {
    const vendorName = selectedVendor?.name ?? vendorInput.trim();
    if (!selectedVendorId || !vendorName) {
      toast.error("먼저 출력할 상호를 선택하세요.");
      return;
    }

    const popup = window.open("", "_blank", "width=800,height=1100");
    if (!popup) {
      toast.error("인쇄 팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.");
      return;
    }

    popup.document.open();
    popup.document.write(
      '<!doctype html><html lang="ko"><head><meta charset="utf-8" /></head><body>인쇄 양식을 준비하는 중...</body></html>',
    );
    popup.document.close();

    let supplier: SettlementPrintSupplier;

    try {
      const response = await fetchJson<PrintConfigResponse>(
        "/api/settlements/print-config",
      );
      supplier = response.data;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "인쇄 설정 정보를 불러오지 못했습니다.",
      );
      popup.close();
      return;
    }

    const printableItems = rows
      .map((row): SettlementPrintItem | null => {
        const productName = row.productName.trim();
        const qty = parseNumber(row.qty);
        const unitPrice = parseNumber(row.unitPrice);

        if (
          !productName ||
          !Number.isFinite(qty) ||
          !Number.isFinite(unitPrice)
        ) {
          return null;
        }

        return {
          dateKey,
          productName,
          productUnit: row.productUnit.trim(),
          qty,
          unitPrice,
          amount: Number((qty * unitPrice).toFixed(2)),
        };
      })
      .filter((item): item is SettlementPrintItem => item !== null);

    const html = buildSettlementPrintHtml({
      dateKey,
      vendorName,
      supplier,
      items: printableItems,
    });

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
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
    setRowValidationErrors((prev) => {
      const rowErrors = prev[row.localId];
      if (!rowErrors || (!rowErrors.productName && !rowErrors.productUnit)) {
        return prev;
      }

      const nextRowErrors = { ...rowErrors };
      delete nextRowErrors.productName;
      delete nextRowErrors.productUnit;

      if (Object.keys(nextRowErrors).length === 0) {
        const rest = { ...prev };
        delete rest[row.localId];
        return rest;
      }

      return {
        ...prev,
        [row.localId]: nextRowErrors,
      };
    });

    setEditingRowId((current) => current ?? row.localId);
  };

  return {
    vendors,
    products,
    selectedVendorId,
    selectedVendor,
    dateKey,
    rows,
    loadingMeta,
    loadingRows,
    processingRowId,
    editingRowId,
    setEditingRowId,
    rowValidationErrors,
    autoSaveState,
    autoSaveRowKey,
    lastAutoSavedAt,
    allSelected,
    toggleSelectAll,
    selectVendor,
    applyDate,
    moveDate,
    updateRowField,
    handleRowBlur,
    returnRow,
    deleteRow,
    addRow,
    exportExcel,
    printPage,
    applyProduct,
    productsByVendor,
    totalAmount,
    cancelRowEdit,
    savedTotalAmount,
    confirmState,
    setConfirmState,
    bulkProcessing,
    triggerBulkDelete,
    triggerBulkReturn,
    saveRow: autoSaveRow,
  };
}
