# SSR 최우선 2개 페이지 전환 계획

작성일: 2026-02-14

## 1) 배경과 목표
- 대상: `/dashboard/transactions`, `/dashboard/vendors/[id]`
- 목표: 초기 진입 시점에 서버에서 데이터를 주입해 첫 화면 공백을 줄이고, 이후 상호작용은 기존 CSR 흐름을 유지
- 범위: 초기 SSR(하이브리드) 전환 + 구현 가이드 문서화
- 제외: 검색/필터/페이지네이션의 완전한 URL 서버 주도 전환

## 2) 최우선 대상 페이지 선정 근거
1. `/dashboard/transactions`
- 루트(`/`)와 대시보드(`/dashboard`) 리다이렉트 종착점으로 진입 빈도가 높다.
- 현재 `useEffect` 기반 최초 조회라 첫 페인트 시 데이터 공백이 생긴다.
- 거래 조회 API는 lookup/facet/합계 집계를 수행해 서버 선조회 이점이 크다.

2. `/dashboard/vendors/[id]`
- 상세 지표와 이력 계산 로직이 무겁고 현재는 클라이언트 최초 요청 이후에만 표시된다.
- 동적 라우트 특성상 서버에서 초기 데이터를 직접 주입하면 체감 개선 폭이 크다.

## 3) 현재 구조(CSR 중심)와 병목
- 두 페이지 모두 클라이언트 스크린 내부에서 `useEffect`로 API 호출을 시작한다.
- 초기 진입 시 데이터 렌더 이전 대기 구간이 발생한다.
- 서버는 API 라우트에서 계산 로직을 수행하고 있지만 페이지가 이를 초기 HTML에 활용하지 못한다.

## 4) 목표 구조(초기 SSR + 이후 CSR)
- 페이지 컴포넌트를 서버 비동기 컴포넌트로 전환한다.
- 서버에서 초기 데이터 조회 후 `initialData`/`initialMeta`/`initialError`를 클라이언트 스크린 props로 전달한다.
- 스크린은 초기 상태를 props로 시작하고, 최초 `useEffect` 1회는 스킵해 중복 호출을 방지한다.
- 이후 검색/필터/페이지 이동/저장은 기존 CSR fetch 로직을 그대로 유지한다.
- 캐시 정책은 실시간 우선으로 두 페이지 모두 `dynamic = "force-dynamic"`을 사용한다.

## 5) 페이지별 구현 상세

### A. Transactions (`/dashboard/transactions`)
- 페이지 파일에서 `connectMongo()` 수행 후 초기 데이터 조회:
  - 거래처 옵션: `listVendorOptions(500)`
  - 상품 옵션: `listProductOptions(500)`
  - 거래 목록: `listTransactions({ startKey: today, endKey: today }, { page: 1, limit: 50 })`
- 실패 시 서버 렌더 중단 대신 `initialError`를 스크린으로 전달한다.
- 스크린 컴포넌트 변경:
  - `TransactionsScreenProps` 추가
  - 초기 `useState`를 props 기반으로 초기화
  - `loadMeta`, `loadTransactions` 최초 effect 1회 스킵

### B. Vendor Detail (`/dashboard/vendors/[id]`)
- 상세 조회 로직을 `getVendorDetailView()` 서비스로 분리
- API route는 파라미터 검증 후 서비스 호출만 수행하도록 단순화
- 페이지 파일에서 `connectMongo()` + `getVendorDetailView({ page: 1, limit: 20 })` 수행 후 props 주입
- 스크린 컴포넌트 변경:
  - `VendorDetailScreenProps` 추가
  - 초기 상태를 `initialData`/`initialMeta`/`initialError`로 시작
  - 최초 상세 조회 effect 1회 스킵

## 6) 타입/인터페이스 변경점
- 외부 API 계약 변경 없음:
  - `/api/transactions`
  - `/api/vendors/[id]`
- 내부 인터페이스 추가:
  - `TransactionsScreenProps`
  - `VendorDetailScreenProps`
  - `listVendorOptions`, `listProductOptions`, `getVendorDetailView` 서비스 함수

## 7) 테스트 및 수용 기준

### 정적 검증
- `npm run lint`
- `npm run typecheck`
- `npm run test`

### 빌드 검증
- `npm run build`
- 빌드 출력에서 `/dashboard/transactions`가 동적(`ƒ`)으로 표시되는지 확인

### 기능 검증
- `/dashboard/transactions` 최초 진입 시 목록/필터 옵션이 즉시 표시되는지 확인
- `/dashboard/transactions` 최초 마운트 직후 동일 조건 중복 API 호출이 없는지 확인
- `/dashboard/vendors/[id]` 최초 진입 시 지표/이력이 즉시 표시되는지 확인
- `/dashboard/vendors/[id]`에서 입금 저장 후 재조회가 정상 동작하는지 확인
- 기존 검색/필터/페이지네이션/엑셀 동작 회귀가 없는지 확인

## 8) 롤아웃 순서와 리스크
1. 상세 조회 서비스 분리 (`vendor-detail`)
2. transactions 초기 SSR 주입
3. vendor detail 초기 SSR 주입
4. 회귀 테스트 및 빌드 확인

리스크:
- 초기 주입 데이터와 클라이언트 상태 불일치 시 hydration 경고 가능
- 첫 fetch 스킵 조건이 부정확하면 중복 호출 또는 데이터 공백이 발생할 수 있음

완화:
- 스킵 조건은 "초기 데이터 존재 여부" 기준으로 고정
- 에러는 throw 대신 `initialError` 전달로 UI 복구 경로 유지

## 9) 후속 과제(차순위 페이지)
- `/dashboard/vendors`
- `/dashboard/settlements/manage`

권장 후속 방향:
- 동일한 하이브리드 SSR 패턴을 적용하되, 편집/자동저장 화면은 초기 데이터 주입만 SSR로 제한
