import { describe, expect, it } from "vitest";

import {
  buildSettlementPrintHtml,
  formatKoreanAmount,
} from "@/lib/settlement-print";

describe("formatKoreanAmount", () => {
  it("formats won amounts with Korean number units", () => {
    expect(formatKoreanAmount(0)).toBe("영");
    expect(formatKoreanAmount(55000)).toBe("오만오천");
    expect(formatKoreanAmount(105000)).toBe("십만오천");
    expect(formatKoreanAmount(123456789)).toBe(
      "일억이천삼백사십오만육천칠백팔십구",
    );
  });

  it("supports returned transactions with a negative total", () => {
    expect(formatKoreanAmount(-44000)).toBe("마이너스 사만사천");
  });
});

describe("buildSettlementPrintHtml", () => {
  it("maps the selected vendor, date, item columns, and total amount", () => {
    const html = buildSettlementPrintHtml({
      dateKey: "2026-06-06",
      vendorName: "테스트 상호",
      supplier: {
        businessNumber: "123-45-67890",
        companyName: "공급자 상호",
        ownerName: "대표자",
        phone: "010-0000-0000",
        address: "부산광역시",
        accountText: "계좌번호 : 테스트은행 123-456",
      },
      items: [
        {
          dateKey: "2026-06-06",
          productName: "대파",
          productUnit: "10kg",
          qty: 5,
          unitPrice: 11000,
          amount: 55000,
        },
      ],
    });

    expect(html).toContain("2026년 6월 6일");
    expect(html).toContain("테스트 상호");
    expect(html).toContain("오만오천");
    expect(html.match(/55,000/g)?.length).toBe(2);
    expect(html).toContain("6/6");
    expect(html).toContain("대파");
    expect(html).toContain("10kg");
    expect(html).toContain("width: 138mm");
    expect(html).toContain("size: 148mm 210mm");
    expect(html).toContain("margin: 5mm");
    expect(html).toContain("height: 200mm");
    expect(html).toContain("width: auto");
    expect(html).not.toContain("width: 148mm");
    expect(html).not.toContain("min-height: 202mm");
    expect(html).toContain("window.print()");
    expect(html).not.toContain("window.close()");
    expect(html).not.toContain("window.onafterprint");
  });
});
