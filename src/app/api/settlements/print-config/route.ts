import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({
      data: {
        businessNumber: process.env.SUPPLIER_BUSINESS_NUMBER ?? "",
        companyName: process.env.SUPPLIER_COMPANY_NAME ?? "",
        ownerName: process.env.SUPPLIER_OWNER_NAME ?? "",
        phone: process.env.SUPPLIER_PHONE ?? "",
        address: process.env.SUPPLIER_ADDRESS ?? "",
        accountText: process.env.SUPPLIER_ACCOUNT_TEXT ?? "",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
