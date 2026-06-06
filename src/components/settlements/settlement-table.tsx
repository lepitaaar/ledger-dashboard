'use client'

import * as React from "react";
import { Loader2, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { SettlementRowEditor } from "./settlement-row-editor";
import {
  type EditableRow,
  type EditableField,
  type ProductOption,
  type RowValidationErrors,
  type AutoSaveState,
} from "./use-settlement-manage";
import { formatCurrency } from "@/lib/utils";

interface SettlementTableProps {
  rows: EditableRow[];
  productsByVendor: ProductOption[];
  totalAmount: number;
  loadingMeta: boolean;
  loadingRows: boolean;
  processingRowId: string | null;
  editingRowId: string | null;
  setEditingRowId: React.Dispatch<React.SetStateAction<string | null>>;
  rowValidationErrors: Record<string, RowValidationErrors>;
  autoSaveState: AutoSaveState;
  autoSaveRowKey: string | null;
  lastAutoSavedAt: string | null;
  allSelected: boolean;
  toggleSelectAll: (checked: boolean) => void;
  onFieldChange: (localId: string, field: EditableField, value: string | boolean) => void;
  onRowBlur: (localId: string) => void;
  onSelectProduct: (row: EditableRow, product: ProductOption) => void;
  onReturnRow: (row: EditableRow) => void;
  onDeleteRow: (row: EditableRow) => void;
  onAddRow: () => void;
  onCancelEdit: (row: EditableRow) => void;
  onSaveRow: (row: EditableRow) => Promise<void>;
  savedTotalAmount: number;
}

export function SettlementTable({
  rows,
  productsByVendor,
  totalAmount,
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
  onFieldChange,
  onRowBlur,
  onSelectProduct,
  onReturnRow,
  onDeleteRow,
  onAddRow,
  onCancelEdit,
  onSaveRow,
  savedTotalAmount,
}: SettlementTableProps) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex justify-end px-4 py-3">
          <Badge
            variant={
              autoSaveState === "saving"
                ? "secondary"
                : autoSaveState === "saved"
                  ? "default"
                  : autoSaveState === "error"
                    ? "destructive"
                    : "outline"
            }
            className="gap-2 px-3 py-1.5"
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
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-collapse text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="w-12 border border-slate-200 px-2 py-3 text-center">
                  <div className="flex justify-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                      aria-label="전체 선택"
                    />
                  </div>
                </th>
                <th className="border border-slate-200 px-3 py-3 text-left">
                  품목
                </th>
                <th className="w-32 border border-slate-200 px-3 py-3 text-left">
                  규격
                </th>
                <th className="w-24 border border-slate-200 px-3 py-3 text-right">
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
                const rowBusy = processingRowId === row.localId;
                const isEditingRow = editingRowId === row.localId;
                const currentRowKey = row.id ?? row.localId;
                const isAutoSavingRow =
                  autoSaveState === "saving" && autoSaveRowKey === currentRowKey;
                const isAutoSaveFailedRow =
                  autoSaveState === "error" && autoSaveRowKey === currentRowKey;
                const rowLocked = Boolean(row.id) && editingRowId !== row.localId;
                const validationErrors = rowValidationErrors[row.localId] ?? {};

                return (
                  <SettlementRowEditor
                    key={row.localId}
                    row={row}
                    productsByVendor={productsByVendor}
                    rowBusy={rowBusy}
                    isEditingRow={isEditingRow}
                    isAutoSavingRow={isAutoSavingRow}
                    isAutoSaveFailedRow={isAutoSaveFailedRow}
                    rowLocked={rowLocked}
                    validationErrors={validationErrors}
                    onFieldChange={onFieldChange}
                    onRowBlur={onRowBlur}
                    onSelectProduct={onSelectProduct}
                    onReturnRow={onReturnRow}
                    onDeleteRow={onDeleteRow}
                    setEditingRowId={setEditingRowId}
                    onCancelEdit={onCancelEdit}
                    onSaveRow={onSaveRow}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold text-slate-700">
                <td className="border border-slate-200 px-3 py-3" />
                <td className="border border-slate-200 px-3 py-3 text-left">
                  총계
                </td>
                <td className="border border-slate-200 px-3 py-3" />
                <td className="border border-slate-200 px-3 py-3" />
                <td className="border border-slate-200 px-3 py-3" />
                <td className="border border-slate-200 px-3 py-3 text-right text-base text-primary">
                  <div className="flex flex-col items-end gap-1">
                    {savedTotalAmount !== totalAmount && (
                      <span className="text-[11px] text-slate-500 font-normal">
                        저장된 합계: {formatCurrency(savedTotalAmount)}
                      </span>
                    )}
                    <span className={savedTotalAmount !== totalAmount ? "text-blue-600 font-bold" : "text-primary font-bold"}>
                      {savedTotalAmount !== totalAmount ? "예상 합계: " : ""}
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>
                </td>
                <td className="border border-slate-200 px-3 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            {loadingMeta || loadingRows
              ? "데이터를 불러오는 중..."
              : "품목 기본 15행이 제공됩니다. 연필 아이콘으로 수정 후, 포커스가 벗어나면 자동 저장됩니다."}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddRow}
            title="새로운 빈 입력 행을 추가합니다"
            aria-label="행 추가"
          >
            <Plus className="mr-1 h-4 w-4" />행 추가
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
