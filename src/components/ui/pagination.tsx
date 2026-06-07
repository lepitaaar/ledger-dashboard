import * as React from "react"
import { Button } from "@/components/ui/button"

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  total?: number
  pageSize?: number
}

export function Pagination({ page, totalPages, onPageChange, total, pageSize }: PaginationProps) {
  const start = total && pageSize ? (page - 1) * pageSize + 1 : null
  const end = total && pageSize ? Math.min(page * pageSize, total) : null

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium text-slate-600">
        {start !== null && end !== null && total !== undefined
          ? `전체 ${total.toLocaleString("ko-KR")}건 중 ${start.toLocaleString("ko-KR")}-${end.toLocaleString("ko-KR")}`
          : "목록 페이지"}
      </span>
      <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        이전
      </Button>
      <span className="min-w-20 text-center text-base font-bold text-slate-800">
        {page} / {totalPages || 1} 페이지
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        다음
      </Button>
      </div>
    </div>
  )
}
