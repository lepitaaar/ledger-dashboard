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
        address: process.env.SUPPLIER_ADDRESS ?? "",
        businessType: process.env.SUPPLIER_BUSINESS_TYPE ?? "",
        itemType: process.env.SUPPLIER_ITEM_TYPE ?? "",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
