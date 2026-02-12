# 계산서 인쇄 템플릿 (A5)

기준: 2026-02-12

## 1. 목적

계산서 관리 화면의 `인쇄` 버튼에서 현재 웹 화면을 그대로 출력하지 않고, 고정된 거래명세서 양식(A5)에 데이터를 채워 출력하기 위한 사양 문서.

## 2. 적용 화면

- 화면: `/dashboard/settlements/manage`
- 구현 파일: `/Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx`

## 3. 인쇄 방식

- `window.open`으로 인쇄 전용 팝업 창 생성
- 팝업에 인쇄용 HTML/CSS 템플릿 주입
- `window.print()` 호출
- 인쇄 종료 후 `window.onafterprint`에서 팝업 자동 닫기

참고:
- 브라우저 팝업 차단이 활성화되어 있으면 인쇄창이 열리지 않는다.

## 4. 페이지/용지 규격

- `@page { size: A5 portrait; margin: 8mm; }`
- 다중 페이지 자동 분할
- 페이지당 데이터 행 수: `23`
- 마지막 페이지에서만 `계(총합)` 행 출력

## 5. 공급자 필드 (.env)

공급자 정보는 코드 하드코딩이 아니라 서버 환경변수에서 읽는다.

조회 API:
- `GET /api/settlements/print-config`

환경변수:
- `SUPPLIER_BUSINESS_NUMBER`
- `SUPPLIER_COMPANY_NAME`
- `SUPPLIER_OWNER_NAME`
- `SUPPLIER_ADDRESS`
- `SUPPLIER_BUSINESS_TYPE`
- `SUPPLIER_ITEM_TYPE`

## 6. 데이터 매핑 규칙

출력 컬럼:
- 품명: `productName`
- 수량: `qty`
- 단가: `unitPrice`
- 금액: `amount` (`qty * unitPrice`)
- 비고: 반품 여부

반품 표기:
- `qty < 0`이면 비고에 `반품` 출력

제외 항목:
- 규격(`productUnit`)

## 7. 금액/숫자 포맷

- `ko-KR` 로케일 숫자 포맷 적용
- 정수는 소수점 없이 표시
- 소수점이 있는 경우 최대 2자리 표시

## 8. 보안/안정성 처리

- 텍스트 필드는 HTML escape 후 템플릿에 주입
- 인쇄 데이터는 계산서 관리 화면의 현재 행 상태 기준
- 유효하지 않은 행(품명 없음, 수량/단가 숫자 아님)은 인쇄 데이터에서 제외
- 공급자 민감정보는 코드 상수에 두지 않고 `.env`로 분리
