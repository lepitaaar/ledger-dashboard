"use client";

import { useSettlementManage } from "@/components/settlements/use-settlement-manage";
import { SettlementToolbar } from "@/components/settlements/settlement-toolbar";
import { SettlementTable } from "@/components/settlements/settlement-table";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, RotateCcw } from "lucide-react";
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

export function SettlementManageScreen(): JSX.Element {
  const settlement = useSettlementManage();

  const selectedRows = settlement.rows.filter((row) => row.selected && row.id);
  const selectedCount = selectedRows.length;
  const selectedAmount = selectedRows.reduce((acc, row) => {
    const qty = parseFloat(row.qty.replace(/,/g, "")) || 0;
    const price = parseFloat(row.unitPrice.replace(/,/g, "")) || 0;
    return acc + qty * price;
  }, 0);

  return (
    <div className="space-y-6 relative pb-16">
      <SettlementToolbar
        vendors={settlement.vendors}
        selectedVendorId={settlement.selectedVendorId}
        dateKey={settlement.dateKey}
        onSelectVendor={settlement.selectVendor}
        onDateChange={settlement.applyDate}
        onMoveDate={settlement.moveDate}
        onExportExcel={settlement.exportExcel}
        onPrintPage={settlement.printPage}
      />

      <SettlementTable
        rows={settlement.rows}
        productsByVendor={settlement.productsByVendor}
        totalAmount={settlement.totalAmount}
        loadingMeta={settlement.loadingMeta}
        loadingRows={settlement.loadingRows}
        processingRowId={settlement.processingRowId}
        editingRowId={settlement.editingRowId}
        setEditingRowId={settlement.setEditingRowId}
        rowValidationErrors={settlement.rowValidationErrors}
        autoSaveState={settlement.autoSaveState}
        autoSaveRowKey={settlement.autoSaveRowKey}
        lastAutoSavedAt={settlement.lastAutoSavedAt}
        allSelected={settlement.allSelected}
        toggleSelectAll={settlement.toggleSelectAll}
        onFieldChange={settlement.updateRowField}
        onRowBlur={settlement.handleRowBlur}
        onSelectProduct={settlement.applyProduct}
        onReturnRow={settlement.returnRow}
        onDeleteRow={settlement.deleteRow}
        onAddRow={settlement.addRow}
        onCancelEdit={settlement.cancelRowEdit}
        onSaveRow={settlement.saveRow}
        savedTotalAmount={settlement.savedTotalAmount}
      />

      {/* Floating Bulk Action Bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-6 rounded-full border border-slate-800 bg-slate-900/95 px-6 py-3.5 text-white shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white font-bold">
              {selectedCount}
            </span>
            <span>건 선택됨</span>
            <span className="text-slate-400">|</span>
            <span>선택 합계:</span>
            <span className="text-blue-400 font-semibold">
              {new Intl.NumberFormat("ko-KR").format(selectedAmount)}원
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={settlement.bulkProcessing}
              onClick={settlement.triggerBulkReturn}
              className="h-8 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              {settlement.bulkProcessing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
              )}
              선택 반품
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={settlement.bulkProcessing}
              onClick={settlement.triggerBulkDelete}
              className="h-8 bg-red-600 text-white hover:bg-red-700"
            >
              {settlement.bulkProcessing ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="mr-1 h-3.5 w-3.5" />
              )}
              선택 삭제
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Alert Dialog */}
      {settlement.confirmState && (
        <AlertDialog
          open={settlement.confirmState.isOpen}
          onOpenChange={(open) => {
            if (!open) {
              settlement.confirmState?.onCancel();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{settlement.confirmState.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {settlement.confirmState.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={settlement.confirmState.onCancel}>
                취소
              </AlertDialogCancel>
              <AlertDialogAction onClick={settlement.confirmState.onConfirm}>
                확인
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
