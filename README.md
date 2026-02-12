# Ledger Dashboard MVP

내부 운영용 `장부/거래/정산` 관리자 웹 애플리케이션입니다.  
`Next.js(App Router) + TypeScript + MongoDB Atlas` 기반으로, 계산서 관리/거래조회/거래처 관리 기능을 중심으로 구성되어 있습니다.

## 프로젝트 설명

이 프로젝트는 다음 업무를 빠르게 처리하기 위한 MVP입니다.

- 거래(장부) 데이터 조회/검색/필터링
- 계산서 관리 화면에서 거래 행 편집/반품/삭제/엑셀/인쇄
- 거래처별 매출/입금/미수금 관리
- 정산서 발행(스냅샷 저장)
- 감사로그 기반 변경 이력 추적

## 핵심 기능

1. 거래 조회 (`/dashboard/transactions`)
- 기간 프리셋(당일/1주일/1개월/3개월)
- 업체명/상품명/검색어 필터
- 오늘 매출 총계
- 엑셀 다운로드

2. 계산서 관리 (`/dashboard/settlements`, `/dashboard/settlements/manage`)
- 업체 선택 후 거래일자 기준 행 조회
- 자동 저장(행 단위), 반품(음수 행 생성), 삭제
- A5 거래명세서 인쇄(다중 페이지 분할)
- 반품 행 비고 자동 표기

3. 거래처 관리 (`/dashboard/vendors`)
- 거래처 목록/상태 관리
- 상세 페이지에서 입금 기록 추가
- 월간/누적 지표 및 미수금 확인

4. 상품 관리 (`/dashboard/products`)
- 상품/규격 관리
- 계산서 관리의 품목 추천 소스로 사용

## 기술 스택

| 구분 | 사용 기술 |
|---|---|
| Frontend / Fullstack | Next.js 14 (App Router), React 18, TypeScript (strict) |
| UI | Tailwind CSS, shadcn 스타일 컴포넌트 |
| Table | TanStack Table |
| Form / Validation | React Hook Form, Zod |
| Date/Timezone | Luxon (`Asia/Seoul` 고정) |
| Database | MongoDB Atlas |
| ODM | Mongoose |
| Export | xlsx |
| Test | Vitest |

## 아키텍처

```mermaid
graph TD
    A[Dashboard Screens] --> B[Next.js Route Handlers (/api)]
    B --> C[Zod DTO Validation]
    C --> D[Service Layer]
    D --> E[Mongoose Models]
    E --> F[(MongoDB Atlas)]
    D --> G[Audit Log]
    B --> H[Excel Export]
    B --> I[A5 Print Config (.env)]
```

레이어 역할:
- `app/api/*`: HTTP 인터페이스, 상태코드, 파라미터 처리
- `lib/dto/*`: 입력/쿼리 검증 스키마
- `server/services/*`: 도메인 로직(조회/집계/정산/반품)
- `server/models/*`: 스키마/인덱스/소프트삭제 정책

## 데이터/시간 규칙

- 날짜 기준은 KST 문자열 키(`dateKey = YYYY-MM-DD`)를 사용합니다.
- 서버 실행 타임존은 `TZ=Asia/Seoul`을 사용합니다.
- `amount`는 클라이언트 입력을 신뢰하지 않고 서버에서 재계산합니다.
- 소프트 삭제(`deletedAt`)를 기본 적용합니다.
- 계산서 인쇄용 공급자 정보는 `.env`에서 로드합니다.

## 폴더 구조

```text
src/
  app/
    api/
      vendors/
      products/
      transactions/
      settlements/
      audit/
    dashboard/
      transactions/
      vendors/
      products/
      settlements/
  components/
    layout/
    screens/
    ui/
  lib/
    db.ts
    kst.ts
    dto/
    http.ts
  server/
    models/
    services/
```

## 시작 방법

### 1) 로컬 실행

```bash
cp .env.example .env
npm install
npm run dev
```

접속:
- `http://localhost:3000/dashboard/transactions`

### 2) 필수 환경변수

- `MONGODB_URI`
- `TZ=Asia/Seoul`

### 3) 인쇄 템플릿 공급자 환경변수

- `SUPPLIER_BUSINESS_NUMBER`
- `SUPPLIER_COMPANY_NAME`
- `SUPPLIER_OWNER_NAME`
- `SUPPLIER_ADDRESS`
- `SUPPLIER_BUSINESS_TYPE`
- `SUPPLIER_ITEM_TYPE`

## 배포

권장 배포:
- Docker + VM(EC2/사내 VM 등)

실행:
```bash
docker compose up --build -d
```

상세 배포 전략은 `docs/deployment.md`를 참고하세요.

## 품질 점검

```bash
npm run lint
npm run typecheck
npm run test
```

## 문서

- 문서 인덱스: `docs/README.md`
- 스택/아키텍처: `docs/mvp-stack-architecture.md`
- ERD: `docs/erd.md`
- API: `docs/api-reference.md`
- 계산서 관리: `docs/settlement-management.md`
- 계산서 A5 인쇄: `docs/settlement-print-a5.md`
- 배포 방식: `docs/deployment.md`
- 운영 런북: `docs/operations-runbook.md`
- 트러블슈팅: `docs/troubleshooting.md`
