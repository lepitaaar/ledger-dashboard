# Troubleshooting

## 1) `tsc: command not found`

원인:

- 의존성 미설치

해결:

```bash
cd /Users/lockpick/Desktop/ledger-dashboard
npm install
npm run typecheck
```

## 2) MongoDB 연결 실패 (`MONGODB_URI environment variable is required`)

원인:

- `.env` 미설정 또는 변수명 오타

해결:

- `.env`에 `MONGODB_URI=...` 설정
- 서버 재시작

## 3) Atlas 인증 실패 (`bad auth`)

원인:

- 계정/비밀번호 불일치
- Atlas 사용자 권한 부족

해결:

- Atlas Database Access에서 사용자/비밀번호 재확인
- 대상 DB에 readWrite 이상 권한 부여

## 4) Atlas 네트워크 오류 (`ENOTFOUND`, timeout)

원인:

- 실행 환경 네트워크 제한
- Atlas IP Allowlist 미등록

해결:

- 배포 서버 egress 허용
- Atlas Network Access에 서버 공인 IP 등록
- 사내망/프록시 환경이면 DNS/방화벽 정책 확인

## 5) `400 기간 필터가 올바르지 않습니다.`

원인:

- `startKey > endKey`
- 날짜 형식이 `YYYY-MM-DD`가 아님

해결:

- 쿼리 파라미터를 `YYYY-MM-DD`로 정규화
- 시작일/종료일 역전 여부 확인

## 6) 정산서 발행 실패 (`선택한 기간에 발행할 거래가 없습니다.`)

원인:

- 해당 업체 + 기간 조건에서 거래 없음
- 거래가 소프트 삭제됨

해결:

- 업체/기간 재확인
- 거래조회에서 동일 조건으로 먼저 데이터 확인

## 7) 엑셀 다운로드가 안 됨

원인:

- 브라우저 팝업/다운로드 정책
- API 응답 에러

해결:

- 네트워크 탭에서 `/api/transactions/export` 상태코드 확인
- 4xx/5xx면 응답 `message` 확인 후 필터 수정

## 8) KST 기준 불일치 의심

점검:

- `.env`에 `TZ=Asia/Seoul` 존재 여부
- API 입력 날짜가 `dateKey`로 전달되는지
- 화면에서 ISO 시간 직접 비교 대신 `dateKey` 기준으로 집계하는지 확인

## 9) Next.js 빌드 오류 (Static Generation & Dynamic Usage)

`npm run build` 시 발생하는 정적 생성 및 동적 서버 사용 오류.

### 증상 1: `useSearchParams() should be wrapped in a suspense boundary`

```
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/dashboard/settlements/manage"
Error occurred prerendering page "/dashboard/settlements/manage"
```

**원인**

- `page.tsx`가 `useSearchParams`를 사용하는 클라이언트 컴포넌트를 렌더링하는데, 빌드 타임(Static Generation)에는 URL 파라미터를 알 수 없음.
- Next.js는 이를 정적 페이지로 간주하려다 쿼리 파라미터 접근 코드를 만나면 중단됨.

**해결**

- 해당 컴포넌트를 `<Suspense>`로 감싸서, 클라이언트 사이드에서 비동기로 렌더링됨을 명시해야 함.
- 예시:
  ```tsx
  export default function Page() {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <SettlementManageScreen />
      </Suspense>
    );
  }
  ```

### 증상 2: `Dynamic server usage: Route ... couldn't be rendered statically`

```
Error: Dynamic server usage: Route /api/transactions/export couldn't be rendered statically because it used `nextUrl.searchParams`.
```

**원인**

- API 라우트에서 `request.nextUrl.searchParams` 등을 사용하면 동적(Dynamic)으로 동작해야 함.
- 하지만 Next.js가 이를 정적 API로 최적화하려고 시도하다가, 동적 요소(쿼리 파라미터 등)를 만나 실패함.
- `output: 'export'` 모드를 사용하거나, 정적 생성 페이지와 혼합될 때 주로 발생.

**해결**

- 해당 API 라우트 파일 상단에 동적 렌더링 강제 옵션 추가.
  ```typescript
  export const dynamic = "force-dynamic";
  ```
