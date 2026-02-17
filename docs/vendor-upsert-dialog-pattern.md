# 거래처 Upsert 공통 모달 패턴 가이드

기준: 2026-02-17  
상태: 적용 완료

## 1. 개요

거래처 등록(create)과 수정(edit)을 별도 모달로 관리하던 구조를
`VendorUpsertDialog` 단일 공통 컴포넌트로 통합했다.

핵심 목표:
1. 모달 껍데기(UI/열림-닫힘/타이틀) 중복 제거
2. 생성/수정 모드 전환을 `mode` 파라미터로 일원화
3. 화면 컴포넌트는 상태 오케스트레이션에만 집중

## 2. 현재 구현 방식

1. 공통 모달 컨테이너
- 파일: `src/components/vendors/vendor-upsert-dialog.tsx`
- 책임:
  - `Dialog` 렌더링
  - `mode(create|edit)`에 따른 타이틀/초기값 분기
  - 공통 취소 동작(`onOpenChange(false)`) 제공

2. 폼 컴포넌트 재사용
- 파일: `src/components/vendors/vendor-create-form.tsx`
- 책임:
  - `mode`에 따라 `POST /api/vendors`(등록) 또는 `PATCH /api/vendors`(수정) 실행
  - 수정 모드에서 `initialValues` 대비 변경 필드만 전송
  - Zod + react-hook-form 기반 검증/오류 처리

3. 화면 상태 오케스트레이션
- 파일: `src/components/screens/vendors-screen.tsx`
- 책임:
  - URL 기반 생성 모달 상태(`?modal=create`)
  - 목록 행 기반 수정 대상 상태(`editingVendor`)
  - 공통 모달에 `open/mode/initialValues/onSuccess` 전달

## 3. 기술 스택 선택 이유

1. Next.js App Router + Client Component
- URL 쿼리 동기화(`modal=create`)와 클라이언트 인터랙션을 함께 처리하기 적합
- 목록/모달 상태를 단일 화면에서 빠르게 조합 가능

2. Radix Dialog(`@radix-ui/react-dialog`)
- 접근성(포커스 트랩, ESC, 오버레이 클릭) 기본 동작이 안정적
- 공통 모달 컨테이너로 감싸기 쉬워 재사용성이 높음

3. react-hook-form + zod
- 폼 상태 관리와 유효성 검증을 선언적으로 유지
- create/edit 모드에서 동일 스키마 재사용이 가능해 규칙 일관성 확보

4. fetchJson 래퍼
- API 오류 메시지 처리 규칙을 일관화
- 폼/화면 레이어에서 공통 실패 처리 패턴 유지

## 4. 실무 패턴 관점

현재 구조는 다음 조합 패턴을 따른다:
1. Container + Reusable Form
- `VendorUpsertDialog`(컨테이너) + `VendorCreateForm`(폼) 분리
- 화면에서는 조합만 수행하고 구현 디테일 의존을 낮춤

2. Mode-driven Upsert
- create/edit 분기를 라우팅이 아닌 `mode`로 통합
- 동일한 UX와 검증 규칙을 유지하면서 API 동작만 변경

3. Thin Screen
- 화면은 `open/mode/initialValues`만 관리
- 모달/폼 내부 구현 변경이 있어도 화면 영향 최소화

## 5. 트레이드오프 및 후속 개선

1. 트레이드오프
- 단일 폼에서 create/edit를 함께 다루므로 분기 코드가 늘어남
- URL 기반 생성 상태와 로컬 수정 상태를 함께 관리해야 함

2. 개선 후보
- `useVendorUpsertModal` 커스텀 훅으로 상태 전환 로직 분리
- 서버 스키마 기반 타입 공유로 PATCH payload 타입 안정성 강화
- 공통 모달 레이어(예: `EntityUpsertDialog`)로 타 도메인 확장

## 6. 변경 파일

1. `src/components/vendors/vendor-upsert-dialog.tsx`
2. `src/components/vendors/vendor-create-form.tsx`
3. `src/components/screens/vendors-screen.tsx`
