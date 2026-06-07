export type SettlementPrintItem = {
  dateKey: string;
  productName: string;
  productUnit: string;
  qty: number;
  unitPrice: number;
  amount: number;
};

export type SettlementPrintSupplier = {
  businessNumber: string;
  companyName: string;
  ownerName: string;
  phone: string;
  address: string;
  accountText: string;
};

type SettlementPrintInput = {
  dateKey: string;
  vendorName: string;
  supplier: SettlementPrintSupplier;
  items: SettlementPrintItem[];
};

const PRINT_ROWS_PER_PAGE = 18;
const SMALL_UNITS = ["", "십", "백", "천"];
const LARGE_UNITS = ["", "만", "억", "조", "경"];
const KOREAN_DIGITS = [
  "",
  "일",
  "이",
  "삼",
  "사",
  "오",
  "육",
  "칠",
  "팔",
  "구",
];

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatDateLabel(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return dateKey;
  }

  return `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일`;
}

function formatItemDate(dateKey: string): string {
  const match = /^\d{4}-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return dateKey;
  }

  return `${Number(match[1])}/${Number(match[2])}`;
}

function fourDigitGroupToKorean(value: number): string {
  let result = "";

  for (let position = 3; position >= 0; position -= 1) {
    const divisor = 10 ** position;
    const digit = Math.floor(value / divisor) % 10;
    if (digit === 0) {
      continue;
    }

    const digitText = digit === 1 && position > 0 ? "" : KOREAN_DIGITS[digit];
    result += `${digitText}${SMALL_UNITS[position]}`;
  }

  return result;
}

export function formatKoreanAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.round(value);
  if (rounded === 0) {
    return "영";
  }

  const sign = rounded < 0 ? "마이너스 " : "";
  let remaining = Math.abs(rounded);
  const groups: string[] = [];
  let groupIndex = 0;

  while (remaining > 0 && groupIndex < LARGE_UNITS.length) {
    const groupValue = remaining % 10000;

    if (groupValue > 0) {
      groups.unshift(
        `${fourDigitGroupToKorean(groupValue)}${LARGE_UNITS[groupIndex]}`,
      );
    }

    remaining = Math.floor(remaining / 10000);
    groupIndex += 1;
  }

  return `${sign}${groups.join("")}`;
}

function chunkItems(items: SettlementPrintItem[]): SettlementPrintItem[][] {
  if (items.length === 0) {
    return [[]];
  }

  const chunks: SettlementPrintItem[][] = [];
  for (let index = 0; index < items.length; index += PRINT_ROWS_PER_PAGE) {
    chunks.push(items.slice(index, index + PRINT_ROWS_PER_PAGE));
  }
  return chunks;
}

export function buildSettlementPrintHtml(input: SettlementPrintInput): string {
  const totalAmount = Number(
    input.items.reduce((sum, item) => sum + item.amount, 0).toFixed(2),
  );
  const totalAmountText = formatNumber(totalAmount);
  const koreanAmountText = formatKoreanAmount(totalAmount);
  const pages = chunkItems(input.items);

  const pagesHtml = pages
    .map((pageItems, pageIndex) => {
      const emptyRows = Math.max(PRINT_ROWS_PER_PAGE - pageItems.length, 0);
      const isLastPage = pageIndex === pages.length - 1;

      const itemRowsHtml = pageItems
        .map(
          (item) => `<tr>
            <td>${escapeHtml(formatItemDate(item.dateKey))}</td>
            <td class="item-name">${escapeHtml(item.productName)}</td>
            <td>${escapeHtml(item.productUnit)}</td>
            <td class="number">${formatNumber(item.qty)}</td>
            <td class="number">${formatNumber(item.unitPrice)}</td>
            <td class="number">${formatNumber(item.amount)}</td>
          </tr>`,
        )
        .join("");

      const emptyRowsHtml = Array.from({ length: emptyRows })
        .map(
          () => `<tr>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
          </tr>`,
        )
        .join("");

      return `<section class="sheet ${isLastPage ? "" : "page-break"}">
        <h1>거 래 명 세 서</h1>

        <table class="date-table">
          <tbody>
            <tr>
              <th>날짜 :</th>
              <td>${escapeHtml(formatDateLabel(input.dateKey))}</td>
              <td class="page-number">${pageIndex + 1} / ${pages.length}</td>
            </tr>
          </tbody>
        </table>

        <div class="party-grid">
          <table class="recipient-table">
            <tbody>
              <tr>
                <th>상호명</th>
                <td class="vendor-name">${escapeHtml(input.vendorName)}</td>
              </tr>
            </tbody>
          </table>

          <table class="supplier-table">
            <tbody>
              <tr>
                <th class="supplier-title" rowspan="4">공<br />급<br />자</th>
                <th>사업자등록번호</th>
                <td colspan="3" class="supplier-strong">${escapeHtml(input.supplier.businessNumber)}</td>
              </tr>
              <tr>
                <th>상호</th>
                <td>${escapeHtml(input.supplier.companyName)}</td>
                <th>대표자</th>
                <td>${escapeHtml(input.supplier.ownerName)}</td>
              </tr>
              <tr>
                <th>전화번호</th>
                <td colspan="3">${escapeHtml(input.supplier.phone)}</td>
              </tr>
              <tr>
                <th>주소</th>
                <td colspan="3">${escapeHtml(input.supplier.address)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <table class="amount-table">
          <tbody>
            <tr>
              <th>합계금액 :</th>
              <td class="korean-amount">${escapeHtml(koreanAmountText)}</td>
              <td class="won-label">원정</td>
              <td class="amount-number">${totalAmountText}</td>
            </tr>
          </tbody>
        </table>

        <table class="items-table">
          <colgroup>
            <col style="width: 9%;" />
            <col style="width: 41%;" />
            <col style="width: 8.5%;" />
            <col style="width: 8.5%;" />
            <col style="width: 12%;" />
            <col style="width: 21%;" />
          </colgroup>
          <thead>
            <tr>
              <th>날짜</th>
              <th>품&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;명</th>
              <th>단위</th>
              <th>수량</th>
              <th>단&nbsp;&nbsp;&nbsp;&nbsp;가</th>
              <th>금&nbsp;&nbsp;&nbsp;&nbsp;액</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
            ${emptyRowsHtml}
          </tbody>
        </table>


        <div class="account-line">${escapeHtml(input.supplier.accountText)}</div>
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <title>거래명세서 인쇄</title>
    <style>
      @page {
        size: 148mm 210mm;
        margin: 5mm;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        color: #000;
        background: #fff;
        font-family: "Malgun Gothic", "Apple SD Gothic Neo", sans-serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .sheet {
        width: 138mm;
        height: 200mm;
        margin: 0 auto;
        overflow: hidden;
        break-inside: avoid;
        page-break-inside: avoid;
      }

      h1 {
        height: 15mm;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 0.35mm solid #000;
        border-bottom: 0;
        font-family: "Batang", "AppleMyungjo", serif;
        font-size: 20pt;
        font-weight: 700;
        text-decoration-line: underline;
        text-decoration-style: double;
        text-underline-offset: 2mm;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th,
      td {
        border: 0.35mm solid #000;
        padding: 0.6mm 0.8mm;
        text-align: center;
        vertical-align: middle;
        font-size: 8.2pt;
        line-height: 1.1;
      }

      th {
        font-weight: 700;
      }

      .date-table th {
        width: 12%;
        height: 7mm;
        border-right: 0;
      }

      .date-table td {
        text-align: left;
        padding-left: 5mm;
        font-weight: 700;
      }

      .date-table td:not(.page-number) {
        border-left: 0;
        border-right: 0;
      }

      .date-table .page-number {
        width: 12%;
        border-left: 0;
        padding-right: 1.5mm;
        text-align: right;
        font-size: 7pt;
        font-weight: 400;
      }

      .party-grid {
        display: grid;
        grid-template-columns: 38% 62%;
        margin-top: -0.35mm;
      }

      .party-grid table {
        height: 31mm;
      }

      .recipient-table {
        border-right: 0;
      }

      .recipient-table th {
        width: 32%;
        font-size: 11pt;
        text-decoration: underline;
        text-underline-offset: 1mm;
      }

      .vendor-name {
        padding: 1mm;
        font-size: 10pt;
        font-weight: 700;
        word-break: keep-all;
        overflow-wrap: anywhere;
      }

      .supplier-table {
        margin-left: -0.35mm;
        width: calc(100% + 0.35mm);
      }

      .supplier-table .supplier-title {
        width: 9%;
        background: #dbeef3;
        font-size: 10pt;
        line-height: 1.55;
      }

      .supplier-table th:not(.supplier-title) {
        width: 25%;
      }

      .supplier-table td {
        font-weight: 700;
        word-break: keep-all;
        overflow-wrap: anywhere;
      }

      .supplier-strong {
        font-size: 10.5pt;
      }

      .amount-table th,
      .amount-table td {
        height: 7mm;
        font-weight: 700;
      }

      .amount-table {
        margin-top: -0.35mm;
      }

      .amount-table th {
        width: 25%;
        font-size: 10pt;
      }

      .korean-amount {
        width: 34%;
        text-align: right;
        font-size: 10pt;
      }

      .won-label {
        width: 9%;
        text-align: left;
        font-size: 10pt;
      }

      .amount-number {
        width: 32%;
        font-size: 10pt;
      }

      .items-table thead th {
        height: 7mm;
        background: #dbeef3;
        font-size: 9pt;
      }

      .items-table {
        margin-top: -0.35mm;
      }

      .items-table tbody td {
        height: 5.95mm;
        font-size: 12pt;
      }

      .items-table .item-name {
        padding-left: 1.5mm;
        text-align: left;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .amount-table td:not(.amount-number) {
        border: 0;
        border-left: 0;
        border-right: 0;
      }

      .number {
        text-align: right;
        padding-right: 1.2mm;
      }

      .account-line {
        min-height: 9mm;
        display: flex;
        align-items: center;
        border: 0.35mm solid #000;
        border-top: 0;
        padding: 1mm 4mm;
        font-size: 9pt;
        font-weight: 700;
      }

      .page-break {
        page-break-after: always;
        break-after: page;
      }

      @media print {
        html,
        body {
          width: auto;
          height: auto;
        }

        .sheet {
          break-inside: avoid-page;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    ${pagesHtml}
    <script>
      window.onload = function() {
        setTimeout(function() {
          window.print();
        }, 200);
      };
    </script>
  </body>
</html>`;
}
