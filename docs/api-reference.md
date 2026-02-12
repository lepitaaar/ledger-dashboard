# API Reference

기준: 2026-02-12, Node runtime, KST(Asia/Seoul) 고정

## 공통 규칙
- Base URL: `/api`
- 응답 기본 형태: `data`, `meta`(목록)
- 에러 형태: `{ "message": "..." }`
- 페이지네이션 기본값: `page=1`, `limit=50`
- 날짜 키 형식: `YYYY-MM-DD` (`dateKey`)
- 소프트 삭제: 기본 조회에서 `deletedAt != null` 제외

## 1) Vendors

### GET `/api/vendors`
쿼리:
- `page`, `limit`
- `keyword` (업체명/대표자명/전화번호)
- `includeDeleted` (`true|false`)

응답 메타:
- `activeCount` (거래중 업체 수)

### POST `/api/vendors`
요청:
```json
{
  "name": "글로벌유통",
  "representativeName": "홍길동",
  "phone": "010-0000-0000"
}
```

참고:
- 호환 alias 입력도 허용: `vendorName`, `companyName`, `contact`, `tel`, `representative`

### PATCH `/api/vendors`
요청 예시:
```json
{
  "id": "66f0b1...",
  "isActive": false
}
```

### DELETE `/api/vendors`
요청:
```json
{
  "id": "66f0b1..."
}
```

### GET `/api/vendors/:id`
설명:
- 거래처 상세 지표 + 매출/입금 통합 이력

### POST `/api/vendors/:id/payments`
요청:
```json
{
  "dateKey": "2026-02-12",
  "amount": 1000000
}
```

## 2) Products

### GET `/api/products`
쿼리:
- `page`, `limit`
- `keyword` (상품명/규격)
- `includeDeleted`

### POST `/api/products`
요청:
```json
{
  "name": "대파",
  "unit": "Kg"
}
```

### PATCH `/api/products`
요청:
```json
{
  "id": "66f0b2...",
  "name": "양파",
  "unit": "Box"
}
```

### DELETE `/api/products`
요청:
```json
{
  "id": "66f0b2..."
}
```

## 3) Transactions

### GET `/api/transactions`
쿼리:
- `page`, `limit`
- `vendorId`
- `productName` (상품명 정확 일치)
- `keyword` (상품명/규격/업체명)
- `startKey`, `endKey`
- `preset` (`today|1w|1m|3m`)
- `includeDeleted`

응답 메타 추가 필드:
- `todayTotalAmount`: KST 오늘 매출 합계
- `appliedRange`: 실제 적용된 기간

### POST `/api/transactions`
요청:
```json
{
  "dateKey": "2026-02-12",
  "vendorId": "66f0b1...",
  "productName": "대파",
  "productUnit": "Kg",
  "unitPrice": 45000,
  "qty": 12,
  "registeredTimeKST": "14:22:45"
}
```

참고:
- `amount`는 서버에서 항상 재계산/저장 (`unitPrice * qty`)

### PATCH `/api/transactions`
요청 예시:
```json
{
  "id": "66f0b3...",
  "productUnit": "Box",
  "unitPrice": 46000,
  "qty": 10
}
```

### DELETE `/api/transactions`
요청:
```json
{
  "id": "66f0b3..."
}
```

### GET `/api/transactions/export`
쿼리:
- `vendorId`, `productName`, `keyword`
- `startKey`, `endKey`, `preset`
- `includeDeleted`

응답:
- xlsx 파일 (`transactions_<range>.xlsx`)

## 4) Settlements (스냅샷 발행)

### GET `/api/settlements`
쿼리:
- `page`, `limit`
- `vendorId`
- `issueStartKey`, `issueEndKey`

### POST `/api/settlements`
설명:
- 선택 기간 거래를 스냅샷(`itemsSnapshot`)으로 고정 저장

요청:
```json
{
  "issueDateKey": "2026-02-12",
  "vendorId": "66f0b1...",
  "rangeStartKey": "2026-02-01",
  "rangeEndKey": "2026-02-12"
}
```

### GET `/api/settlements/:id`
설명:
- 발행된 정산서 상세 + 스냅샷 조회

## 5) Settlement 관리 화면 전용 API

### GET `/api/settlements/manage`
쿼리:
- `vendorId` (필수)
- `dateKey` (필수)

설명:
- 선택 업체 + 거래일자 기준으로 저장된 거래행 조회

### POST `/api/settlements/manage`
요청:
```json
{
  "vendorId": "66f0b1...",
  "dateKey": "2026-02-12",
  "productName": "대파",
  "productUnit": "Kg",
  "qty": 12,
  "unitPrice": 45000
}
```

### PATCH `/api/settlements/manage`
요청:
```json
{
  "id": "66f0b3...",
  "productName": "대파",
  "productUnit": "Kg",
  "qty": 10,
  "unitPrice": 46000
}
```

### DELETE `/api/settlements/manage`
요청:
```json
{
  "id": "66f0b3..."
}
```

### POST `/api/settlements/manage/return`
요청:
```json
{
  "transactionId": "66f0b3..."
}
```

설명:
- 원본 거래를 기준으로 `qty` 음수 행을 신규 생성(반품)

### GET `/api/settlements/export`
쿼리:
- `vendorId` (필수)
- `dateKey` (필수)

설명:
- 계산서 관리 테이블 기준 엑셀 다운로드
- 컬럼: `품목`, `규격`, `수량`, `단가`, `합계`

## 6) Audit

### GET `/api/audit`
쿼리:
- `page`, `limit`
- `entityType` (`vendor|product|transaction|settlement|payment`)
- `action` (`create|update|delete|issue|return` 포함)

## HTTP Status 가이드
- `200`: 조회/수정/삭제 성공
- `201`: 생성/발행 성공
- `400`: 검증 실패/기간 오류
- `404`: 대상 없음
- `409`: 중복(업체명 등)
- `500`: 서버 오류
