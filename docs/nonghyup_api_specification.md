# 농협 온라인 전자거래 플랫폼 — API 명세서

> 실제 시뮬레이션 실행 로그(`2026-06-07 10:00 KST`) 기반으로 작성된 실측 데이터 기준 명세입니다.

---

## 1. 세션 & 만료 관리 체계

### 1.1 토큰 구조 및 역할

| 토큰 | 저장 위치 | 발급 시점 | 만료 정책 | 갱신 방법 |
|:---|:---|:---|:---|:---|
| **X-CSRF-Token** | `sessionStorage` | 페이지 최초 접속 시 | 서버 판단 (`CSRF_TOKEN_EXPIRED`) | `ONBIECM830001R01` 재호출 |
| **X-KEY (Passphrase)** | `sessionStorage` | CSRF 토큰과 동시 발급 | CSRF와 동일 수명 | CSRF 재발급 시 함께 갱신 |
| **X-JWT-Token** | `sessionStorage` | 로그인 인증 성공 시 | 발급 후 **600초(10분)** | `ONBIECM830001R05` (refreshJwt) |
| **세션 쿠키** | 브라우저 Cookie Jar | CSRF 발급 응답의 `Set-Cookie` | 서버 세션 타임아웃 | API 호출 시 자동 갱신 |

### 1.2 JWT 토큰 실측 분석

실제 수신된 JWT 토큰을 디코딩한 결과입니다.

**토큰 원문:**
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhdXRoQ25tIjoiMiIsImV4cCI6MTc4MDc5NDgwMTAzNiwidXVpZCI6IjhlZjFiN2M4ZDAyNDRhZDY5M2VkOWIyNjUwNDVjOTQxIiwiaWF0IjoxNzgwNzk0MjAxMDM2LCJ1c3JJZE5vIjoiZG1zZ2hla2R6aCJ9.GyJvjLE4-eU81nvFpBiMc-8x4zCGGrKZQMHw8iwERB8
```

**Header:**
```json
{
  "typ": "JWT",
  "alg": "HS256"
}
```

**Payload:**
```json
{
  "authCnm": "2",
  "exp": 1780794801036,
  "uuid": "8ef1b7c8d0244ad693ed9b265045c941",
  "iat": 1780794201036,
  "usrIdNo": "dmsghekdzh"
}
```

| 필드 | 값 | 설명 |
|:---|:---|:---|
| `authCnm` | `"2"` | 권한구분 (2 = 구매자/중도매인) |
| `iat` | `1780794201036` | 발급 시각: **2026-06-07 10:03:21 KST** |
| `exp` | `1780794801036` | 만료 시각: **2026-06-07 10:13:21 KST** |
| `uuid` | `8ef1b7c8...c941` | 세션 고유 식별자 |
| `usrIdNo` | `dmsghekdzh` | 사용자 아이디 |
| **유효 기간** | **600,000ms** | **= 정확히 10분** |

### 1.3 세션 만료 흐름도

```mermaid
flowchart TD
    A["API 호출"] --> B{"서버 응답 검사"}
    B -->|정상 prcStsc=0| C["touchOk() → 만료시각 갱신<br/>(현재시각 + 600초)"]
    B -->|CSRF_TOKEN_EXPIRED| D["CSRFToken() 재발급"]
    D -->|성공| E["원래 API 자동 재시도 (1회)"]
    D -->|실패| F["'토큰 재발급 실패' 팝업 → 로그아웃"]
    B -->|JWT_TOKEN_EXPIRED| G["refreshJwt()<br/>ONBIECM830001R05"]
    G -->|성공: 새 JWT 수신| H["Storage에 새 JWT 저장<br/>→ 원래 API 자동 재시도"]
    G -->|실패| I["'세션이 종료되었습니다' 팝업 → 로그아웃"]
    B -->|SESSION_EXPIRED| J["즉시 로그아웃 처리"]
    C --> K["화면 타이머 MM:SS 갱신"]
    K --> L{"잔여시간 ≤ 0?"}
    L -->|Yes| M["onExpire() 콜백 → 로그아웃"]
    L -->|No| N["1초 후 다시 체크"]
```

### 1.4 CSRF ↔ JWT 관계 정리

```
┌─────────────────────────────────────────────────────────┐
│                    브라우저 세션                           │
│                                                         │
│  ┌──────────────────┐    ┌──────────────────┐           │
│  │  X-CSRF-Token    │    │  X-JWT-Token     │           │
│  │  (사이트 보호)    │    │  (사용자 인증)    │           │
│  │                  │    │                  │           │
│  │  • 로그인 전 발급  │    │  • 로그인 후 발급  │           │
│  │  • 출처 검증      │    │  • 권한/신원 검증  │           │
│  └────────┬─────────┘    └────────┬─────────┘           │
│           │                       │                     │
│           └───────────┬───────────┘                     │
│                       │                                 │
│              API 요청 헤더에 동시 전송                     │
│              → 서버에서 두 값 모두 유효해야 처리             │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 전체 API 흐름도

```mermaid
sequenceDiagram
    autonumber
    actor Client as Node.js Client
    participant BXM as BXM Server<br/>(newgp.nonghyup.com)

    rect rgb(40, 40, 60)
    Note over Client,BXM: 준비 단계 — CSRF/세션 초기화
    Client->>BXM: POST /naieSvc/xframe<br/>ONBIECM830001R01 (평문)
    BXM-->>Client: csrfToken + passphrase(X-KEY)<br/>+ Set-Cookie(세션쿠키)
    Note over Client: PBKDF2로 X-KEY 복호화 → passKey 도출<br/>passKey로 config KEY/IV 복호화<br/>→ API 대칭키 세팅 완료
    end

    rect rgb(40, 60, 40)
    Note over Client,BXM: 1단계 — RSA 공개키 요청
    Client->>BXM: POST (AES 암호화)<br/>ONBIECM830001R07
    BXM-->>Client: keyId + publicKeyPem + nonce
    end

    rect rgb(60, 40, 40)
    Note over Client,BXM: 2단계 — 로그인 인증
    Note over Client: SHA256(PW) → Base64 해싱<br/>userId:hashedPw::nonce → RSA-OAEP 암호화
    Client->>BXM: POST (AES 암호화)<br/>ONBIEMN4003R0R01<br/>body: {pwizeKeyVal, pwizeKeyCntn}
    BXM-->>Client: 사용자 정보 + 사업장 정보<br/>Header: X-JWT-Token
    end

    rect rgb(40, 50, 60)
    Note over Client,BXM: 추가 단계 — 경매낙찰내역 조회
    Client->>BXM: POST (AES 암호화)<br/>ONBIEBY5005R0R01<br/>Header: X-JWT-Token 포함<br/>body: {seldt:"20260605", ...}
    BXM-->>Client: 낙찰 내역 리스트 + 합계
    end
```

---

## 3. API별 상세 명세

### 3.0 공통 사항

> [!IMPORTANT]
> 모든 API는 단일 엔드포인트 `POST https://newgp.nonghyup.com/naieSvc/xframe` 으로 전송되며, 요청 바디의 `header.tgrmSvcId` 값으로 서비스를 분기합니다.

**공통 요청 헤더:**
```http
Content-Type: application/json
X-CSRF-Token: {CSRF 토큰값}
X-JWT-Token: {JWT 토큰값}       ← 로그인 완료 후 API에만 포함
NHDATA1: {32byte 암호화 플래그}   ← AES 암호화 활성 여부 제어
Cookie: {세션쿠키}
```

**공통 요청 바디 구조:**
```json
{
  "header": {
    "trCrtDt": "YYYYMMDD",        // 전송생성일자
    "trTmsHr": "HHMMSSxxx",       // 전송시간 (밀리초 포함)
    "scrnNo": "화면ID",            // 호출 화면 식별자
    "tgrmSvcId": "서비스ID",       // 전문 서비스 ID (라우팅 키)
    "naConnChanVal": "04"          // 접속 채널 (04 = 웹)
  },
  "body": { ... }
}
```

**공통 응답 헤더 구조:**
```json
{
  "header": {
    "prcStsc": "0",               // 처리상태 ("0" = 정상)
    "prcrztMsgCntn": "메시지",     // 처리결과 메시지
    "prcRztRspC": "응답코드"       // 에러 시 상세 코드
  },
  "body": { ... }
}
```

**암호화 처리:**
- `NHDATA1` 플래그가 암호화 활성(`true`)을 나타내면, 요청 바디는 **AES-256-CBC**로 암호화된 Base64 문자열로 전송됩니다.
- 응답 바디 역시 동일한 키/IV로 AES 암호화된 텍스트로 수신되며, 클라이언트에서 복호화 후 JSON으로 파싱합니다.

---

### 3.1 CSRF 토큰 및 세션 키 발급 (`ONBIECM830001R01`)

> [!NOTE]
> 유일하게 **평문(JSON)으로 송수신**되는 API입니다. CSRF 토큰 미소지 상태에서 호출하므로 `X-CSRF-Token` 헤더가 불필요합니다.

**요청:**
```json
{
  "header": {
    "trCrtDt": "20260607",
    "trTmsHr": "1003210036",
    "scrnNo": "login",
    "tgrmSvcId": "ONBIECM830001R01",
    "naConnChanVal": "04"
  },
  "body": {}
}
```

**응답:**
```json
{
  "header": { "prcStsc": "0" },
  "body": {
    "csrfToken": "usWYdPOgLr...",
    "passphrase": "VZo6IP35zG..."
  }
}
```

| 응답 필드 | 타입 | 설명 |
|:---|:---|:---|
| `csrfToken` | String | CSRF 보호 토큰 (이후 모든 API의 `X-CSRF-Token` 헤더에 사용) |
| `passphrase` | String | AES-PBKDF2 암호화된 임시 키 (CSRF 토큰을 passphrase로 복호화하여 API 대칭키 도출에 활용) |

**후속 처리 (클라이언트):**
```
passKey = PBKDF2_Decrypt(passphrase, csrfToken)
KEYVal  = OpenSSL_AES_Decrypt(config.KEY, passKey)  → "3F35233E322B24123526133920392632"
IVVal   = OpenSSL_AES_Decrypt(config.IV, passKey)   → "2F27213B3F391828"
```

---

### 3.2 RSA 공개키 및 Nonce 발급 (`ONBIECM830001R07`)

**요청:**
```json
{
  "header": {
    "scrnNo": "login",
    "tgrmSvcId": "ONBIECM830001R07",
    "naConnChanVal": "04"
  },
  "body": {}
}
```

**응답 (실측):**
```json
{
  "header": { "prcStsc": "0" },
  "body": {
    "keyId": "9bd85c8d-cf83-4221-bd69-b539eed84fe1",
    "publicKeyPem": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhki...",
    "nonce": "7e5040bd9024428ab4d61597a130e7df"
  }
}
```

| 응답 필드 | 타입 | 설명 |
|:---|:---|:---|
| `keyId` | String (UUID) | RSA 키쌍 식별자 (로그인 요청 시 `pwizeKeyVal`로 전송) |
| `publicKeyPem` | String (PEM) | RSA-2048 공개키 (SPKI 형식) |
| `nonce` | String (Hex) | 일회성 난수값 (리플레이 공격 방지, 32바이트 hex) |

---

### 3.3 로그인 인증 (`ONBIEMN4003R0R01`)

**요청 (운영 환경):**
```json
{
  "header": {
    "scrnNo": "login",
    "tgrmSvcId": "ONBIEMN4003R0R01",
    "naConnChanVal": "04"
  },
  "body": {
    "pwizeKeyVal": "9bd85c8d-cf83-4221-bd69-b539eed84fe1",
    "pwizeKeyCntn": "[RSA-OAEP 암호화된 Base64 페이로드]"
  }
}
```

> `pwizeKeyCntn`의 암호화 전 평문 구성: `{userId}:{SHA256Base64(password)}:{naTrplC}:{nonce}`

**응답 (실측):**
```json
{
  "header": { "prcStsc": "0" },
  "body": {
    "usrIdNo": "dmsghekdzh",
    "wmUsrnm": "부산공판장309번",
    "wmEltTrTrmnDsc": "2",
    "naBzplc": "8808990001104",
    "naBzplnm": "부산공판장",
    "rotsYn": null,
    "trmnAmnno": 280,
    "wmTrmnAmnno": 309,
    "amnDsc": null,
    "enoCusamrNo": null,
    "amnClntnm": null,
    "apvYn": "1",
    "inqYn": "0",
    "vldDds": 90,
    "rginWmcDsc": "04",
    "mpno": null,
    "pscrpDsc": "2",
    "attcRqrNo": null,
    "empEno": null,
    "chrrIpadr": null,
    "chrrIpadr2": null,
    "chrrIpadr3": null,
    "chrrIpadr4": null,
    "xAplYn": "0",
    "xuseClasUyn": "1",
    "ieXuseClasUgApvYn": "1",
    "fwXuseClasUgApvYn": "1",
    "pwChgDds": 0,
    "naCusno": 1124896415,
    "naTrplC": "2920010613398",
    "naTrplCCnt": 1,
    "empDsc": null,
    "tokenExpiPrdVal": "600"
  }
}
```

**응답 헤더:**
```http
X-JWT-Token: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

| 응답 필드 | 타입 | 실측값 | 설명 |
|:---|:---|:---|:---|
| `usrIdNo` | String | `"dmsghekdzh"` | 사용자 아이디 |
| `wmUsrnm` | String | `"부산공판장309번"` | 사용자 표시명 |
| `wmEltTrTrmnDsc` | String | `"2"` | 권한구분 (1=출하자, 2=구매자, 3=매참인, 4=출하처, 5=경매사, 6=산지주재원, 7=직원, 8=공판지원부, 9=관리자) |
| `naBzplc` | String | `"8808990001104"` | 경제통합사업장코드 |
| `naBzplnm` | String | `"부산공판장"` | 사업장명 |
| `trmnAmnno` | Number | `280` | 거래인관리번호 |
| `wmTrmnAmnno` | Number | `309` | 공판거래인관리번호 |
| `apvYn` | String | `"1"` | 승인 여부 (1=승인) |
| `inqYn` | String | `"0"` | 조회전용 여부 |
| `vldDds` | Number | `90` | 유효일수 |
| `rginWmcDsc` | String | `"04"` | 소속 공판장 구분코드 |
| `mpno` | String\|null | `null` | 휴대폰번호 (MFA 시 SMS 발송 대상) |
| `pscrpDsc` | String | `"2"` | 가입구분 |
| `xAplYn` | String | `"0"` | 전자거래 적용 여부 |
| `xuseClasUyn` | String | `"1"` | 품목분류 사용 여부 |
| `ieXuseClasUgApvYn` | String | `"1"` | 전자거래 품목분류 업그레이드 승인여부 |
| `fwXuseClasUgApvYn` | String | `"1"` | 선물 품목분류 업그레이드 승인여부 |
| `pwChgDds` | Number | `0` | 비밀번호 마지막 변경 경과일수 (>90일이면 변경 강제) |
| `naCusno` | Number | `1124896415` | 농협 고객번호 |
| `naTrplC` | String | `"2920010613398"` | 거래처코드 |
| `naTrplCCnt` | Number | `1` | 등록된 거래처 수 (>1이면 거래처 선택 팝업) |
| `tokenExpiPrdVal` | String | `"600"` | JWT 토큰 유효시간 (초) |

---

### 3.4 경매낙찰내역 조회 (`ONBIEBY5005R0R01`)

> [!IMPORTANT]
> 이 API는 **로그인 완료 후** `X-JWT-Token` 헤더를 필수로 포함해야 합니다.

**요청:**
```json
{
  "header": {
    "scrnNo": "IEBY5005R0",
    "tgrmSvcId": "ONBIEBY5005R0R01",
    "naConnChanVal": "04"
  },
  "body": {
    "seldt": "20260605",
    "naBzplc": "8808990001104",
    "trmnAmnno": 280,
    "wmTrmnAmnno": 309,
    "naLatc": "",
    "sogIdnm": "",
    "gbn": "1",
    "pageNo": 1,
    "inqCn": "20"
  }
}
```

| 요청 필드 | 타입 | 실측값 | 설명 |
|:---|:---|:---|:---|
| `seldt` | String | `"20260605"` | 경매일자 (`YYYYMMDD`) |
| `naBzplc` | String | `"8808990001104"` | 사업장코드 (로그인 응답에서 획득) |
| `trmnAmnno` | Number | `280` | 거래인관리번호 |
| `wmTrmnAmnno` | Number | `309` | 공판거래인관리번호 |
| `naLatc` | String | `""` | 품목코드 (빈 문자열 = 전체) |
| `sogIdnm` | String | `""` | 출하자명 (빈 문자열 = 전체) |
| `gbn` | String | `"1"` | 거래구분 (`"1"`: 공판장, `"2"`: 전자거래) |
| `pageNo` | Number | `1` | 페이지 번호 |
| `inqCn` | String | `"20"` | 페이지당 조회건수 |

**응답 (실측):**
```json
{
  "header": { "prcStsc": "0" },
  "body": {
    "cCnt": 2,
    "resultList": [
      {
        "oslpNo": 1710,
        "aucNo": 280,
        "wmcLatcnm": "포기찹",
        "wmSogmnm": "210",
        "wmWt": 2,
        "grdWmBaseInfCnm": "상",
        "budlCn": 0,
        "szeWmBaseInfCnm": "없음",
        "trqt": 5,
        "actoUpr": 6200,
        "wmUwupr": 0,
        "selAm": 31000,
        "etcRmkCntn": null,
        "naLatc": "003003005015"
      },
      {
        "oslpNo": 1710,
        "aucNo": 10,
        "wmcLatcnm": "포기찹",
        "wmSogmnm": "205",
        "wmWt": 2,
        "grdWmBaseInfCnm": "상",
        "budlCn": 0,
        "szeWmBaseInfCnm": "없음",
        "trqt": 10,
        "actoUpr": 7900,
        "wmUwupr": 0,
        "selAm": 79000,
        "etcRmkCntn": null,
        "naLatc": "003003005015"
      },
      {
        "oslpNo": 0,
        "aucNo": 0,
        "wmcLatcnm": "합계",
        "wmSogmnm": "",
        "wmWt": null,
        "grdWmBaseInfCnm": null,
        "budlCn": null,
        "szeWmBaseInfCnm": null,
        "trqt": 15,
        "actoUpr": null,
        "wmUwupr": null,
        "selAm": 110000,
        "etcRmkCntn": null,
        "naLatc": null
      }
    ]
  }
}
```

| 응답 필드 | 타입 | 설명 |
|:---|:---|:---|
| `cCnt` | Number | 조회된 총 데이터 건수 (합계 행 제외) |
| `resultList[]` | Array | 낙찰 내역 배열 (마지막 항목은 합계 행) |

**resultList 항목 상세:**

| 필드 | 타입 | 실측값 예시 | 설명 |
|:---|:---|:---|:---|
| `oslpNo` | Number | `1710` | 출하전표번호 |
| `aucNo` | Number | `280` | 경매번호 |
| `wmcLatcnm` | String | `"포기찹"` | 품목명 |
| `wmSogmnm` | String | `"210"` | 출하자번호/명 |
| `wmWt` | Number | `2` | 중량 (Kg) |
| `grdWmBaseInfCnm` | String | `"상"` | 등급 |
| `budlCn` | Number | `0` | 묶음수 |
| `szeWmBaseInfCnm` | String | `"없음"` | 크기 구분 |
| `trqt` | Number | `5` | 거래수량 (개) |
| `actoUpr` | Number | `6200` | 낙찰 단가 (원) |
| `wmUwupr` | Number | `0` | 공판 단위가격 (원) |
| `selAm` | Number | `31000` | 낙찰 금액 (원) = `trqt × actoUpr` |
| `etcRmkCntn` | String\|null | `null` | 비고/특이사항 |
| `naLatc` | String | `"003003005015"` | 공판품목코드 |

**합계 행 식별:**
- `wmcLatcnm === "합계"` 일 때 합계 행으로 판별합니다.
- 합계 행에서는 `trqt`(총 수량)과 `selAm`(총 금액)만 유효하며, 나머지 필드는 `null`입니다.

**실측 합계 데이터 정리:**

| 품목 | 출하자 | 등급 | 수량 | 낙찰 단가 | 낙찰 금액 |
|:---|:---|:---|---:|---:|---:|
| 포기찹 | 210 | 상 | 5개 | 6,200원 | 31,000원 |
| 포기찹 | 205 | 상 | 10개 | 7,900원 | 79,000원 |
| **합계** | | | **15개** | | **110,000원** |

---

## 4. 암호화 파이프라인 요약

```mermaid
flowchart LR
    subgraph "준비 단계"
        A["서버 발급<br/>csrfToken + passphrase"] --> B["PBKDF2 복호화<br/>passphrase → passKey"]
        B --> C["OpenSSL AES 복호화<br/>config.KEY → KEYVal<br/>config.IV → IVVal"]
    end

    subgraph "API 통신 암호화"
        C --> D["AES-256-CBC 암호화<br/>요청 바디 → Base64"]
        D --> E["fetch POST 전송"]
        E --> F["AES-256-CBC 복호화<br/>Base64 → JSON"]
    end

    subgraph "로그인 자격 증명"
        G["비밀번호"] --> H["SHA-256 → Base64 해싱"]
        H --> I["userId:hashedPw::nonce<br/>평문 조립"]
        I --> J["RSA-OAEP-SHA256<br/>공개키 암호화 → Base64"]
    end
```

**실측된 대칭키 정보:**
| 항목 | 실측값 |
|:---|:---|
| **AES KEY** (32 hex chars = 16 bytes) | `3F35233E322B24123526133920392632` |
| **AES IV** (16 hex chars = 8 bytes) | `2F27213B3F391828` |
| **알고리즘** | AES-256-CBC / PKCS7 Padding |

---

## 5. 에러 코드 및 처리 매트릭스

| 에러 코드/메시지 | 발생 시점 | 클라이언트 자동 처리 |
|:---|:---|:---|
| `CSRF_TOKEN_INVALID` | CSRF 토큰 위변조 감지 | 경고 팝업 → 즉시 로그아웃 |
| `CSRF_TOKEN_EXPIRED` | CSRF 토큰 만료 | 자동 재발급 → API 1회 재시도 |
| `JWT_TOKEN_EXPIRED` | JWT 세션 만료 | `refreshJwt()` 호출 → API 1회 재시도 |
| `SESSION_EXPIRED` | 서버 세션 완전 종료 | 경고 팝업 → 즉시 로그아웃 |
| `BIEE0002` | 비밀번호 관련 오류 | 비밀번호 찾기 화면으로 이동 |
| `BIEE0003` | 접근 권한 부족 | 403 페이지로 이동 |
| `BIEE0004` | 계정 차단/잠김 | 즉시 로그아웃 |
