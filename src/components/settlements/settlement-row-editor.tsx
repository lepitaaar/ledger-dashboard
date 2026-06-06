'use client'

import * as React from "react";
import { Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  type EditableRow,
  type EditableField,
  type ProductOption,
  type RowValidationErrors,
  calcRowAmount,
  parseNumber,
} from "./use-settlement-manage";
import { formatCurrency } from "@/lib/utils";

interface SettlementRowEditorProps {
  row: EditableRow;
  productsByVendor: ProductOption[];
  rowBusy: boolean;
  isEditingRow: boolean;
  isAutoSavingRow: boolean;
  isAutoSaveFailedRow: boolean;
  rowLocked: boolean;
  validationErrors: RowValidationErrors;
  onFieldChange: (localId: string, field: EditableField, value: string | boolean) => void;
  onRowBlur: (localId: string) => void;
  onSelectProduct: (row: EditableRow, product: ProductOption) => void;
  onReturnRow: (row: EditableRow) => void;
  onDeleteRow: (row: EditableRow) => void;
  setEditingRowId: React.Dispatch<React.SetStateAction<string | null>>;
  onCancelEdit: (row: EditableRow) => void;
  onSaveRow: (row: EditableRow) => Promise<void>;
}

export function SettlementRowEditor({
  row,
  productsByVendor,
  rowBusy,
  isEditingRow,
  isAutoSavingRow,
  isAutoSaveFailedRow,
  rowLocked,
  validationErrors,
  onFieldChange,
  onRowBlur,
  onSelectProduct,
  onReturnRow,
  onDeleteRow,
  setEditingRowId,
  onCancelEdit,
  onSaveRow,
}: SettlementRowEditorProps) {
  const amount = calcRowAmount(row);
  const invalidCellClassName = "bg-red-50/20 shadow-[inset_0_0_0_1px_#f87171]";
  const invalidInputClassName = "border border-red-500 bg-red-50 focus-visible:ring-1 focus-visible:ring-red-200";
  const inputClassName = `h-8 border-0 px-1 shadow-none focus-visible:ring-0 ${
    rowLocked
      ? "cursor-not-allowed bg-slate-100 text-slate-500"
      : isEditingRow
        ? "bg-blue-50/80"
        : "bg-transparent"
  }`;

  return (
    <tr className={isEditingRow ? "bg-blue-50/50" : "hover:bg-slate-50"}>
      <td className="border border-slate-200 px-2 py-2 text-center">
        <div className="flex justify-center">
          <Checkbox
            checked={row.selected}
            onCheckedChange={(checked) =>
              onFieldChange(row.localId, "selected", Boolean(checked))
            }
            disabled={!row.id}
            aria-label="선택"
          />
        </div>
      </td>

      <td
        className={`border border-slate-200 px-2 py-1 ${
          validationErrors.productName ? invalidCellClassName : ""
        }`}
      >
        <Combobox
          options={productsByVendor}
          value={row.productName}
          onSelect={(product) => {
            onSelectProduct(row, product);
          }}
          placeholder="품목 선택..."
          displayKey="name"
          valueKey="name"
          disabled={rowLocked || rowBusy}
          allowCustomValue
          className="h-8 border-0 shadow-none bg-transparent hover:bg-blue-50/50"
        />
      </td>

      <td
        className={`border border-slate-200 px-2 py-1 ${
          validationErrors.productUnit ? invalidCellClassName : ""
        }`}
      >
        <Input
          className={`${inputClassName} text-slate-600 ${
            validationErrors.productUnit ? invalidInputClassName : ""
          }`}
          data-rowid={row.localId}
          value={row.productUnit}
          title={validationErrors.productUnit}
          readOnly={rowLocked || rowBusy}
          onBlur={() => onRowBlur(row.localId)}
          onChange={(event) =>
            onFieldChange(row.localId, "productUnit", event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelEdit(row);
            }
          }}
        />
      </td>

      <td
        className={`border border-slate-200 px-2 py-1 ${
          validationErrors.qty ? invalidCellClassName : ""
        }`}
      >
        <Input
          className={`${inputClassName} text-right font-medium text-slate-900 ${
            validationErrors.qty ? invalidInputClassName : ""
          }`}
          data-rowid={row.localId}
          inputMode="decimal"
          value={row.qty}
          title={validationErrors.qty}
          readOnly={rowLocked || rowBusy}
          onBlur={() => onRowBlur(row.localId)}
          onChange={(event) =>
            onFieldChange(row.localId, "qty", event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelEdit(row);
            }
          }}
        />
      </td>

      <td
        className={`border border-slate-200 px-2 py-1 ${
          validationErrors.unitPrice ? invalidCellClassName : ""
        }`}
      >
        <Input
          className={`${inputClassName} text-right font-medium text-slate-900 ${
            validationErrors.unitPrice ? invalidInputClassName : ""
          }`}
          data-rowid={row.localId}
          inputMode="decimal"
          value={row.unitPrice}
          title={validationErrors.unitPrice}
          readOnly={rowLocked || rowBusy}
          onBlur={() => onRowBlur(row.localId)}
          onChange={(event) =>
            onFieldChange(row.localId, "unitPrice", event.target.value)
          }
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancelEdit(row);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              void onSaveRow(row);
            }
          }}
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
        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center justify-center gap-1">
            <Button
              type="button"
              variant={isEditingRow ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              disabled={rowBusy}
              onClick={() =>
                setEditingRowId((current) =>
                  current === row.localId ? null : row.localId
                )
              }
              title={isEditingRow ? "수정 완료하고 행을 저장합니다" : "이 행을 수정합니다"}
              aria-label={isEditingRow ? "수정 완료" : "수정"}
            >
              <Pencil className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={rowBusy || !row.id || parseNumber(row.qty) <= 0}
              onClick={() => onReturnRow(row)}
              title={parseNumber(row.qty) <= 0 ? "양수 수량인 거래만 반품할 수 있습니다" : "이 행을 반품 처리합니다"}
              aria-label="반품"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={rowBusy}
              onClick={() => onDeleteRow(row)}
              title="이 행을 삭제합니다"
              aria-label="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <p className="min-h-4 text-[11px] leading-4 font-medium">
            {rowBusy || isAutoSavingRow ? (
              <span className="inline-flex items-center gap-1 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                저장 중
              </span>
            ) : isAutoSaveFailedRow ? (
              <span className="text-red-600">저장 실패</span>
            ) : isEditingRow ? (
              <span className="text-amber-600">변경됨</span>
            ) : row.id ? (
              <span className="text-emerald-600">저장 완료</span>
            ) : null}
          </p>
        </div>
      </td>
    </tr>
  );
}
