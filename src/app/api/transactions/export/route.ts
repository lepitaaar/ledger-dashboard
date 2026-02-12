import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { connectMongo } from "@/lib/db";
import { transactionExportQuerySchema } from "@/lib/dto/transaction";
import {
  getDateRangeByPreset,
  getTodayDateKey,
  normalizeDateRange,
} from "@/lib/kst";
import { formatCurrency } from "@/lib/utils";
import { handleApiError, HttpError } from "@/lib/http";
import { listTransactionsForExport } from "@/server/services/transactions";

export const runtime = "nodejs";

function resolveRange(input: {
  startKey?: string;
  endKey?: string;
  preset?: "today" | "1w" | "1m" | "3m";
}):
  | {
      startKey: string;
      endKey: string;
    }
  | undefined {
  const fromPreset =
    input.preset && !input.startKey && !input.endKey
      ? getDateRangeByPreset(input.preset)
      : undefined;

  try {
    return normalizeDateRange(
      input.startKey ?? fromPreset?.startKey,
      input.endKey ?? fromPreset?.endKey,
    );
  } catch {
    throw new HttpError(400, "기간 필터가 올바르지 않습니다.");
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    await connectMongo();

    const query = transactionExportQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const range = resolveRange({
      startKey: query.startKey,
      endKey: query.endKey,
      preset: query.preset,
    });

    const rows = await listTransactionsForExport({
      vendorId: query.vendorId,
      productName: query.productName,
      keyword: query.keyword,
      includeDeleted: query.includeDeleted,
      startKey: range?.startKey,
      endKey: range?.endKey,
    });

    const header = [
      "날짜",
      "업체명",
      "상품명",
      "단가",
      "수량",
      "매출액",
      "등록시간",
    ];
    const body = rows.map((row) => [
      row.dateKey,
      row.vendorName,
      row.productName,
      row.unitPrice,
      row.qty,
      row.amount,
      row.registeredTimeKST,
    ]);

    const totalAmount = rows.reduce((acc, row) => acc + row.amount, 0);

    const sheet = XLSX.utils.aoa_to_sheet([
      header,
      ...body,
      [],
      ["총 합계", "", "", "", "", totalAmount, ""],
    ]);

    sheet["!cols"] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 26 },
      { wch: 14 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "거래내역");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const dateSuffix = range
      ? `${range.startKey}_${range.endKey}`
      : getTodayDateKey();
    const fileName = `transactions_${dateSuffix}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Total-Amount": encodeURIComponent(formatCurrency(totalAmount)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
