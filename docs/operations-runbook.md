# Operations Runbook

기준: 2026-02-12

## 1. 환경 변수
필수:
- `MONGODB_URI`
- `TZ=Asia/Seoul`

권장:
- `NODE_ENV`
- `PORT`
- `SUPPLIER_BUSINESS_NUMBER`
- `SUPPLIER_COMPANY_NAME`
- `SUPPLIER_OWNER_NAME`
- `SUPPLIER_ADDRESS`
- `SUPPLIER_BUSINESS_TYPE`
- `SUPPLIER_ITEM_TYPE`

샘플: `.env.example`

## 2. 로컬 실행
```bash
cd /Users/lockpick/Desktop/ledger-dashboard
cp .env.example .env
# .env에 MONGODB_URI 입력
npm install
npm run dev
```

접속:
- `http://localhost:3000/dashboard/transactions`

## 3. 프로덕션 실행(노드)
```bash
cd /Users/lockpick/Desktop/ledger-dashboard
npm install
npm run build
npm run start
```

## 4. Docker 실행
```bash
cd /Users/lockpick/Desktop/ledger-dashboard
docker compose up --build
```

## 5. 배포 전 체크리스트
- `.env`에 Atlas URI 반영 완료
- `TZ=Asia/Seoul` 유지
- MongoDB Atlas 네트워크 허용 IP/방화벽 확인
- `npm run build` 성공
- API 기본 점검:
  - `GET /api/vendors`
  - `GET /api/transactions`
  - `GET /api/settlements`

## 6. 운영 점검 루틴
일일:
- 거래조회 화면에서 오늘 매출 합계 확인
- 정산서 발행/상세 조회 동작 확인
- 감사로그 최신 이벤트 확인 (`/api/audit`)

주간:
- Atlas 인덱스/쿼리 성능 점검
- 소프트 삭제 누적량 확인 및 아카이빙 정책 검토

## 7. 데이터 무결성 점검
- 거래 생성/수정 시 `amount = unitPrice * qty` 유지 여부 샘플 검증
- 정산서 `totalAmount`가 `itemsSnapshot.amount` 합계와 일치하는지 검증
- `dateKey` 형식이 `YYYY-MM-DD`인지 검증

## 8. 백업/복구(Atlas 권장)
- Atlas 자동 백업(스냅샷) 활성화
- 복구 리허설은 운영 외 프로젝트에서 정기 수행
- 복구 후 API 스모크 테스트 실시

## 9. 보안 메모
- 현재 MVP는 앱 레벨 인증/인가 미포함
- 운영 시 인프라 레벨 접근통제(VPN/IP allowlist) 필수
- Atlas 계정/비밀번호는 문서나 코드 저장소에 평문으로 보관 금지
