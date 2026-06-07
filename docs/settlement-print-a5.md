# 거래명세서 인쇄 템플릿 (A5)

기준: 2026-06-06

## 1. 목적

계산서 관리 화면의 `인쇄` 버튼에서 `거래명세서_양식-2.xlsx`를 기준으로 재구성한 A5 거래명세서를 출력하기 위한 사양 문서.

## 2. 적용 화면

- 화면: `/dashboard/settlements/manage`
- 구현 파일: `/Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx`

## 3. 인쇄 방식

- `window.open`으로 인쇄 전용 팝업 창 생성
- 팝업에 인쇄용 HTML/CSS 템플릿 주입
- `window.print()` 호출
- 인쇄 완료 또는 취소 후에도 팝업을 유지하며 사용자가 직접 닫는다.
- 팝업은 클릭 즉시 열고 공급자 설정을 불러온 뒤 최종 양식으로 교체한다.

참고:
- 브라우저 팝업 차단이 활성화되어 있으면 인쇄창이 열리지 않는다.

## 4. 페이지/용지 규격

- `@page { size: 148mm 210mm; margin: 5mm; }`
- 인쇄 본문 크기: `138mm x 200mm`
- 인쇄 모드의 `body` 폭은 고정하지 않아 A5 인쇄 가능 영역을 넘지 않게 한다.
- 브라우저/프린터의 mm 변환 반올림을 고려해 A5 인쇄 가능 영역보다 여유를 둔다.
- 다중 페이지 자동 분할
- 페이지당 데이터 행 수: `18`
- 각 페이지에 상단 합계와 하단 합계/총계를 반복 출력
- 제목 하단선과 상단 날짜/쪽번호 행의 상단선 및 내부 세로선을 표시하지 않아 하나의 병합된 영역처럼 출력
- 날짜 행과 상호명/공급자 행의 경계는 날짜 행 하단선만 사용하고, 두 영역을 음수 여백으로 겹치지 않는다.
- 상호명/공급자 행과 합계금액 행의 경계는 상호명/공급자 행 하단선만 사용하고, 두 영역을 음수 여백으로 겹치지 않는다.

## 5. 공급자 필드 (.env)

공급자 정보는 코드 하드코딩이 아니라 서버 환경변수에서 읽는다.

조회 API:
- `GET /api/settlements/print-config`

환경변수:
- `SUPPLIER_BUSINESS_NUMBER`
- `SUPPLIER_COMPANY_NAME`
- `SUPPLIER_OWNER_NAME`
- `SUPPLIER_PHONE`
- `SUPPLIER_ADDRESS`
- `SUPPLIER_ACCOUNT_TEXT`

## 6. 데이터 매핑 규칙

상단:
- 날짜: 계산서 관리 화면의 `dateKey`
- 상호명: 화면에서 선택한 거래처명
- 한글 합계금액: 전체 품목 금액 합계를 한글 숫자로 변환
- 숫자 합계금액: 전체 품목 금액 합계에 `ko-KR` 숫자 포맷 적용

출력 컬럼:
- 날짜: `dateKey`를 `M/D` 형식으로 표시
- 품명: `productName`
- 단위: `productUnit`
- 수량: `qty`
- 단가: `unitPrice`
- 금액: `amount` (`qty * unitPrice`)

하단:
- `합계금액`: 출력 품목 `amount` 전체 합계
- `총계금액`: 출력 품목 `amount` 전체 합계
- 계좌 안내: `SUPPLIER_ACCOUNT_TEXT`

## 7. 금액/숫자 포맷

- `ko-KR` 로케일 숫자 포맷 적용
- 정수는 소수점 없이 표시
- 소수점이 있는 경우 최대 2자리 표시
- 한글 금액은 원 단위 정수로 반올림해 `만`, `억`, `조`, `경` 단위로 표시
- 음수 총액은 `마이너스` 접두어를 표시

## 8. 보안/안정성 처리

- 텍스트 필드는 HTML escape 후 템플릿에 주입
- 인쇄 데이터는 계산서 관리 화면의 현재 행 상태 기준
- 유효하지 않은 행(품명 없음, 수량/단가 숫자 아님)은 인쇄 데이터에서 제외
- 공급자 민감정보는 코드 상수에 두지 않고 `.env`로 분리

## 9. 구현 파일

- HTML/CSS 및 한글 금액 변환: `src/lib/settlement-print.ts`
- 화면 데이터 매핑과 팝업 제어: `src/components/screens/settlement-manage-screen.tsx`
- 공급자 설정 API: `src/app/api/settlements/print-config/route.ts`
