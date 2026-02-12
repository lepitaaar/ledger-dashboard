# Ledger Dashboard MVP 스택/아키텍처 결정 문서

작성일: 2026-02-12

## 1. 문서 목적
이 문서는 MVP 구현 시점에 실제 적용한 기술 스택과 아키텍처 선택 이유를 기록한다.
핵심 목표는 `빠른 개발`, `운영 안정성`, `KST 고정 정산 정확도`, `추후 확장 용이성`이다.

## 2. MVP 목표와 제약
- 거래 장부 조회/검색/필터/엑셀 다운로드
- 업체 기준 정산서 발행(거래 스냅샷 저장)
- 계산서 관리 화면에서 `거래일자 + 업체` 기준 행 편집/반품/엑셀 저장
- MongoDB Atlas 기반, 스키마 유연성 + 무결성 + 감사로그 확보
- 로그인/권한은 MVP 범위 제외(내부망/인프라 통제)
- 서버리스 제외, 상시 Node 런타임 운영

## 3. 사용 스택과 선정 이유
| 영역 | 선택 | 선정 이유 |
|---|---|---|
| 프레임워크 | Next.js App Router | UI + API를 단일 코드베이스에서 운영 가능. MVP에서 개발/배포 복잡도 최소화 |
| 언어 | TypeScript (strict) | 런타임 오류를 사전에 줄이고, 도메인 모델 변경 시 안전한 리팩터링 가능 |
| UI | Tailwind + shadcn 스타일 컴포넌트 | 빠른 화면 구성 + 일관된 스타일 시스템 확보 |
| 테이블 | TanStack Table | 거래조회 페이지의 컬럼/정렬/확장에 유연, 대량 목록 화면에 적합 |
| 폼/검증 | React Hook Form + Zod | 입력 폼 성능 + 선언적 검증. API DTO와 동일한 검증 규칙 유지 가능 |
| DB | MongoDB Atlas | 문서형 스키마로 초기 요구 변경 대응이 빠르고 운영형 매니지드 서비스 사용 가능 |
| ODM | Mongoose | 모델/인덱스/쿼리 관리와 도메인 모델링 속도 확보 |
| 서버 DTO 검증 | Zod | API 입력값 방어, 일관된 에러 응답 제공 |
| 엑셀 | xlsx | 서버에서 즉시 파일 생성/다운로드 구현이 단순하고 MVP 요구 충족 |
| 시간대 처리 | Luxon (`Asia/Seoul`) | 서버/클라이언트/집계 기준을 명시적으로 KST 고정 처리 |
| 배포 | Docker + Next standalone | 서버리스 없이 상시 런타임 운영. VM/EC2/Fly/Render/Railway 이식 용이 |

## 4. 아키텍처 개요

```mermaid
graph TD
    A[Dashboard UI (App Router)] --> B[Route Handlers (/api/*)]
    B --> C[Zod DTO Validation]
    C --> D[Service Layer]
    D --> E[Mongoose Models]
    E --> F[(MongoDB Atlas)]
    D --> G[AuditLog Write]
    B --> H[XLSX Export]
```

### 4.1 레이어 분리 이유
- `app/api/*`: HTTP 인터페이스/상태코드/파라미터 파싱 담당
- `lib/dto/*`: 입력 스키마 및 쿼리 검증 규칙 중앙화
- `server/services/*`: 거래 조회/정산 발행 같은 비즈니스 로직 집중
- `server/models/*`: 인덱스/스키마/소프트삭제 정책의 단일 소스

이 분리로 인해 API 형식 변경과 도메인 로직 변경을 독립적으로 다루기 쉽다.

## 5. 현재 폴더 구조

```text
src/
  app/
    api/
      vendors/route.ts
      products/route.ts
      transactions/route.ts
      transactions/export/route.ts
      settlements/route.ts
      settlements/manage/route.ts
      settlements/manage/return/route.ts
      settlements/export/route.ts
      settlements/[id]/route.ts
      audit/route.ts
    dashboard/
      transactions/page.tsx
      vendors/page.tsx
      products/page.tsx
      settlements/page.tsx
      settlements/manage/page.tsx
  components/
    screens/
    layout/
    ui/
  lib/
    db.ts
    kst.ts
    http.ts
    pagination.ts
    dto/
  server/
    models/
    services/
```

## 6. 데이터 모델 결정 이유

### 6.1 날짜 전략
- 전략: `A) dateKey = "YYYY-MM-DD" (KST 기준)`
- 이유:
  - 기간 조회/집계 쿼리가 단순해짐 (`$gte`, `$lte` 문자열 비교)
  - 정산 기준일/조회 필터가 UI 입력값과 1:1 대응
  - 시간대 변환 실수를 줄이고 운영/디버깅이 쉬움

### 6.2 무결성 규칙
- `amount`는 클라이언트 입력 무시, 서버에서 `unitPrice * qty` 재계산
- 거래 행에 `productUnit(규격)` 필드를 추가해 계산서 관리 화면과 일치
- `deletedAt` 소프트 삭제로 이력 보존
- 감사로그(`AuditLog`)에 create/update/delete/issue/return 기록

### 6.3 인덱스 이유
- `Transaction`: `dateKey`, `vendorId+dateKey`, `productName`, `deletedAt`
  - 기간/업체 필터와 키워드 검색 성능 대응
- `Settlement`: `vendorId+issueDateKey`, `rangeStartKey+rangeEndKey`
  - 업체별 발행 이력/기간 조회 대응

## 7. API 설계 원칙
- 기본 페이지네이션: `page`, `limit` (기본 50)
- 조회 쿼리: `startKey`, `endKey`, `vendorId`, `keyword`, `preset`
- 응답: `data + meta` 구조 통일
- 에러: `HTTP status + message` 일관 응답

## 8. 정산서 발행 방식(스냅샷) 이유
정산서는 발행 시점의 거래 상태를 보존해야 하므로, 원본 거래를 실시간 참조하지 않고 `itemsSnapshot[]`를 저장한다.

장점:
- 이후 거래 수정/삭제가 발생해도 발행 문서 내용이 불변
- 감사/회계 추적 시점 보존 가능

## 9. 계산서 관리 페이지 설계 이유
- 메인(`/dashboard/settlements`)은 업체 선택 집중 UI로 단순화
- 관리(`/dashboard/settlements/manage`)는 일자 단위 실무 편집 화면으로 분리
- 반품은 원본 수정 대신 음수 신규행 생성으로 감사 추적성과 회계 해석성을 유지

## 10. 운영 관점 결정 이유
- Next standalone + Docker로 단일 컨테이너 배포
- 서버리스 미사용 조건 준수
- `.env` 기반 Atlas URI 주입으로 환경 분리 단순화

## 11. 향후 확장 방향
- 인증/권한(RBAC) 추가 시 API 미들웨어 계층 확장
- 거래 조회 고도화: 서버 정렬/다중필터/CSV 병행 다운로드
- 정산서 PDF 출력 및 발행 번호 정책 도입
- 감사로그에 actor(사용자) 연동

## 12. 관련 파일
- DB 연결: `/Users/lockpick/Desktop/ledger-dashboard/src/lib/db.ts`
- KST 유틸: `/Users/lockpick/Desktop/ledger-dashboard/src/lib/kst.ts`
- 거래 서비스: `/Users/lockpick/Desktop/ledger-dashboard/src/server/services/transactions.ts`
- 정산 서비스: `/Users/lockpick/Desktop/ledger-dashboard/src/server/services/settlements.ts`
- 거래 화면: `/Users/lockpick/Desktop/ledger-dashboard/src/components/screens/transactions-screen.tsx`
- 계산서 메인 화면: `/Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlements-screen.tsx`
- 계산서 관리 화면: `/Users/lockpick/Desktop/ledger-dashboard/src/components/screens/settlement-manage-screen.tsx`
