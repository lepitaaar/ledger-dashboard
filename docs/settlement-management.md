# 계산서 페이지 운영 가이드

기준: 2026-02-12

## 1. 화면 구조

### 1) 계산서 메인
경로: `/dashboard/settlements`

기능:
- 업체명 검색
- 업체 카드 선택
- `발행 대상업체 선택` 버튼 클릭 시 관리 화면으로 이동
- 발행일자 입력 없음

### 2) 계산서 관리
경로: `/dashboard/settlements/manage?vendorId=<id>&dateKey=YYYY-MM-DD`

기능:
- 상호 검색(input + 추천 드롭다운)
- 거래일자 빠른 이동: `<`, `>`, `오늘`
- 엑셀 저장: 품목/규격/수량/단가/합계
- 품목 입력 드롭다운: 상품관리 데이터 추천 + 선택 시 품목/규격 자동 입력
- 기본 15행 빈칸 제공, `행 추가`로 1행씩 증가
- 관리 아이콘:
  - 첫번째: 수정 모드 토글(재클릭 시 해제)
  - 두번째: 반품(음수 신규행 생성)
  - 세번째: 삭제

## 2. 행 편집/저장 규칙

- 저장 방식은 `자동 저장`이다.
- 연필(수정) 아이콘으로 행 편집 모드에 진입한다.
- 편집 중 포커스가 행 밖으로 나가면(`blur`) 유효한 입력이면 자동 저장된다.
- 기존 저장 행은 기본 잠금 상태이며, 수정 모드 진입 시 편집 가능하다.
- 신규 행도 입력 후 포커스 아웃 시 자동 `POST` 저장된다.

## 3. 인쇄(A5 거래명세서)

- 인쇄 버튼은 현재 화면 자체를 출력하지 않고, 별도 인쇄용 팝업 템플릿을 생성해 출력한다.
- 출력 규격: `A5 portrait`
- 출력 컬럼: `품명`, `수량`, `단가`, `금액`, `비고`
- `규격` 컬럼은 인쇄에서 제외한다.
- 공급자 정보(상호/대표자/전화번호)는 인쇄 양식에서 제외한다.
- 음수(반품) 행은 비고 컬럼에 `반품`을 자동 표기한다.
- 다중 페이지 지원:
  - 페이지당 품목 행 수를 고정해서 자동 분할한다.
  - 데이터가 많으면 다음 페이지로 넘겨 인쇄한다.
  - 마지막 페이지에만 총합(`계`)을 출력한다.

상세 CSS/페이지 분할 규칙은 `/Users/lockpick/Desktop/ledger-dashboard/docs/settlement-print-a5.md` 참조.

## 4. 데이터 처리 규칙

- 기준 데이터 소스: `Transaction`
- 조회 기준: `vendorId + dateKey`
- `amount`는 서버 재계산(`unitPrice * qty`)
- 반품은 원본 거래를 수정하지 않고 음수 행을 신규 생성
- `deletedAt` 소프트 삭제 적용
- 감사로그에 `create/update/delete/return` 기록

## 5. 관련 API

- `GET /api/settlements/manage`
- `POST /api/settlements/manage`
- `PATCH /api/settlements/manage`
- `DELETE /api/settlements/manage`
- `POST /api/settlements/manage/return`
- `GET /api/settlements/export`

상세 요청/응답 스키마는 `/Users/lockpick/Desktop/ledger-dashboard/docs/api-reference.md` 참조.

## 6. 스키마 변경 사항

`Transaction` 필드 추가:
- `productUnit?: string` (규격)

영향 범위:
- 거래 CRUD DTO/API
- 거래 검색(키워드에 규격 포함)
- 계산서 관리 화면/엑셀
- 정산 스냅샷(`Settlement.itemsSnapshot`)에 `productUnit` 포함
