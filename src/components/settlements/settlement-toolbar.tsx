'use client'

import * as React from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { getTodayDateKey } from "@/lib/kst";
import { type VendorOption } from "./use-settlement-manage";

interface SettlementToolbarProps {
  vendors: VendorOption[];
  selectedVendorId: string;
  dateKey: string;
  onSelectVendor: (vendor: VendorOption) => void;
  onDateChange: (dateKey: string) => void;
  onMoveDate: (days: number) => void;
  onExportExcel: () => void;
  onPrintPage: () => void;
}

export function SettlementToolbar({
  vendors,
  selectedVendorId,
  dateKey,
  onSelectVendor,
  onDateChange,
  onMoveDate,
  onExportExcel,
  onPrintPage,
}: SettlementToolbarProps) {
  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <CardTitle className="text-lg">계산서 상세 관리</CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-2 xl:flex-1">
            <div className="flex items-center rounded-md border border-slate-300 bg-slate-50 px-1 py-1">
              <span className="px-2 text-xs font-medium text-slate-500">
                거래일자
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onMoveDate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-1 text-sm font-semibold text-slate-700">
                {dateKey}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onMoveDate(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onDateChange(getTodayDateKey())}
              >
                오늘
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="success"
                className="whitespace-nowrap"
                onClick={onExportExcel}
              >
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                엑셀 저장
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="whitespace-nowrap"
                onClick={onPrintPage}
              >
                <Printer className="mr-1 h-4 w-4" />
                인쇄
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <span className="w-14 text-sm font-medium text-slate-600">
            상호
          </span>
          <div className="flex-1">
            <Combobox
              options={vendors}
              value={selectedVendorId}
              onSelect={onSelectVendor}
              placeholder="업체 검색..."
              displayKey="name"
              valueKey="_id"
            />
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
