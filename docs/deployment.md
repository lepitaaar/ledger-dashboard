# 배포 방식 가이드

기준: 2026-02-12

## 1. 배포 원칙

- 서버리스(예: Vercel Functions)는 사용하지 않는다.
- Next.js 앱을 상시 Node 런타임으로 운영한다.
- 시간대는 반드시 `TZ=Asia/Seoul`로 고정한다.
- MongoDB Atlas 연결은 `MONGODB_URI` 환경변수로 주입한다.

## 2. 권장 방식 (Option A): Docker + VM

가장 단순하고 재현성이 높은 운영 방식이다.

### 대상 환경
- EC2, GCP VM, Azure VM, 사내 VM

### 장점
- 로컬/스테이징/운영 실행 방식 일치
- 이미지 단위 롤백 용이
- Next standalone 빌드로 컨테이너 크기 최소화

### 절차
1. 서버에 코드 배포
2. `.env` 설정 (`MONGODB_URI`, `TZ=Asia/Seoul` 등)
3. 컨테이너 실행

```bash
cd /Users/lockpick/Desktop/ledger-dashboard
docker compose up --build -d
```

### 포트/헬스체크
- 컨테이너 포트: `3000`
- 점검 URL:
  - `GET /api/vendors`
  - `GET /api/transactions`
  - `GET /dashboard/transactions`

## 3. 대안 방식 (Option B): Node 직접 실행 + PM2

도커를 쓰지 않는 환경에서 사용.

### 장점
- 구성 단순
- 리소스 오버헤드 최소

### 절차
```bash
cd /Users/lockpick/Desktop/ledger-dashboard
npm ci
npm run build
pm2 start npm --name ledger-dashboard -- start
pm2 save
pm2 startup
```

### 권장 설정
- 리버스 프록시(Nginx/Caddy) 앞단 구성
- 로그 로테이션(`pm2-logrotate`) 적용

## 4. 대안 방식 (Option C): 관리형 컨테이너 플랫폼

예: Railway, Render, Fly.io

### 장점
- 인프라 운영 부담 감소
- 자동 배포 파이프라인 구성 용이

### 주의
- 서버리스 모드가 아닌 "Container / Web Service" 런타임으로 배포
- 환경변수에 `TZ=Asia/Seoul`, `MONGODB_URI` 반드시 설정
- 슬립/콜드스타트 정책 여부 확인(상시 구동 필요)

## 5. 리버스 프록시 권장 (Nginx 예시)

```nginx
server {
  listen 80;
  server_name your-domain.example;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

운영에서는 HTTPS(TLS) 설정을 반드시 추가한다.

## 6. 환경변수 체크리스트

필수:
- `MONGODB_URI`
- `TZ=Asia/Seoul`

권장:
- `NODE_ENV=production`
- `PORT=3000`

## 7. 배포 후 점검 절차

1. API 스모크 테스트
- `GET /api/vendors`
- `GET /api/transactions`
- `GET /api/settlements`

2. 기능 점검
- 계산서 관리 화면 조회/자동저장
- A5 인쇄 팝업/페이지 분할
- 엑셀 다운로드

3. 데이터 점검
- `amount = unitPrice * qty` 일치
- 반품(`qty < 0`) 데이터 정상 저장

## 8. 롤백 전략

### Docker
- 이전 이미지 태그로 재배포
- 예: `docker compose down && docker compose up -d` (이전 태그 기준)

### PM2
- 이전 빌드 아티팩트(혹은 이전 커밋)로 `npm run build` 후 재시작

## 9. 보안/운영 메모

- 앱 레벨 인증/인가가 없는 MVP이므로 인프라 접근 통제가 필수
- Atlas IP Allowlist를 최소 범위로 제한
- Atlas 계정 정보/URI를 문서/코드 저장소에 평문 저장 금지
