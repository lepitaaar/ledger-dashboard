# 거래처 등록 모달 전환 가이드 (URL 동기화)

기준: 2026-02-14  
상태: 적용 완료

## 1. 개요

`신규 거래처 등록`을 전용 페이지(`/dashboard/vendors/new`)에서 처리하던 구조를
`거래처 관리` 화면(`/dashboard/vendors`) 내부 모달 구조로 전환했다.

모달 상태는 URL 쿼리(`?modal=create`)와 동기화되어
새로고침/뒤로가기/딥링크 접근에서 동일 동작을 보장한다.

## 2. 적용 결과

1. 등록 진입 URL 표준화
- 공식 등록 진입 URL: `/dashboard/vendors?modal=create`

2. 목록 화면 모달 통합
- 등록 버튼 클릭 시 URL에 `modal=create`를 추가하고 모달을 연다.
- 모달은 URL 상태를 기준으로 열린다.

3. 닫기 동작 URL 동기화
- 닫기 버튼/ESC/배경 클릭 시 `modal` 쿼리를 제거한다.

4. 등록 성공 처리
- `POST /api/vendors` 성공 시 모달 닫기
- 목록 필터를 초기화(`page=1`, `keyword=''`)하고 `loadVendors()` 재호출

5. 등록 실패 처리
- API 오류 메시지를 모달 폼 하단에 표시
- 모달은 열린 상태 유지

6. 기존 경로 호환
- `/dashboard/vendors/new` 접근 시 `/dashboard/vendors?modal=create`로 리다이렉트

## 3. 변경 파일

1. `src/components/ui/dialog.tsx` (신규)
- `@radix-ui/react-dialog` 기반 공통 Dialog 컴포넌트 추가
- 제공 컴포넌트: `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter`

2. `src/components/vendors/vendor-create-form.tsx` (신규)
- 거래처 등록 폼을 재사용 가능한 컴포넌트로 분리
- 기존 입력 규칙 유지
  - 업체명 필수
  - 대표자명/전화번호 선택
- 인터페이스
  - `onSuccess: () => void | Promise<void>`
  - `onCancel?: () => void`
  - `submitting?: boolean`

3. `src/components/screens/vendors-screen.tsx` (수정)
- `useSearchParams`로 `modal=create` 여부를 읽어 모달 상태 제어
- `setCreateModalOpen()`으로 쿼리 추가/삭제 처리
- 등록 성공 시 모달 닫기 + 목록 재조회 구현

4. `src/app/dashboard/vendors/new/page.tsx` (수정)
- 단독 화면 렌더링 제거
- `redirect('/dashboard/vendors?modal=create')` 적용

5. `src/components/screens/vendor-create-screen.tsx` (삭제)
- 모달 전환 후 미사용 파일 제거

6. `package.json`, `package-lock.json` (수정)
- `@radix-ui/react-dialog` 의존성 추가

## 4. 동작 시나리오

1. 버튼 오픈
- `/dashboard/vendors`에서 `신규 거래처 등록` 클릭
- URL: `/dashboard/vendors?modal=create`
- 결과: 등록 모달 오픈

2. 딥링크 오픈
- 브라우저 주소창에서 `/dashboard/vendors?modal=create` 직접 접근
- 결과: 초기 렌더에서 모달 오픈

3. 닫기
- ESC/배경 클릭/닫기 버튼/취소 버튼
- URL에서 `modal` 제거
- 결과: `/dashboard/vendors` 상태 복귀

4. 등록 성공
- `POST /api/vendors` 성공
- 모달 닫힘 + 목록 재조회

5. 등록 실패
- 409 또는 유효성 에러
- 오류 메시지 표시 + 모달 유지

## 5. 검증 결과

로컬 검증(2026-02-14):
- `npm run typecheck` 통과
- `npm run lint` 통과
- `npm test` 통과 (2 files, 4 tests)

## 6. 비고

- 백엔드 API/DTO(`/api/vendors`) 변경 없음
- 공개 URL 인터페이스는 `?modal=create` 기반으로 확장됨
