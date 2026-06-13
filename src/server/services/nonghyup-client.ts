import { DateTime } from 'luxon';
import {
  decryptAESPBK,
  decryptOpenSSLAES,
  apiEncrypt,
  apiDecrypt,
  generateEnc32ByteFlag,
  hashSHA256Base64,
  encryptRSA
} from './nonghyup-crypto';

const BXM_URL = 'https://newgp.nonghyup.com/naieSvc/xframe';
const REQUEST_TIMEOUT_MS = Number(process.env.NONGHYUP_REQUEST_TIMEOUT_MS || 15_000);
const MAX_REQUEST_ATTEMPTS = 2;

// 운영 환경 정보 고정 정의
const PROD_CONFIG = {
  KEY: 'U2FsdGVkX1+lz9MJHEFrHY24q4gvJnmR+uDnn9r1KcCfEXUrT0xM6xsKU74vcXsLur0Y7CjPpHWVuLJ/D2oxnw==',
  IV: 'U2FsdGVkX18SD/GOLIAsbaguUOXGc/Ns1toYcoRHyocOE7iWSDBMIKB6qYN/EyrT'
};

interface NonghyupSession {
  cookieJar: string;
  xCsrfToken: string;
  KEYVal: string;
  IVVal: string;
  jwtToken: string;
  naBzplc: string;
  trmnAmnno: number;
  wmTrmnAmnno: number;
}

let activeSession: NonghyupSession | null = null;

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_REQUEST_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (!isRetryableStatus(response.status) || attempt === MAX_REQUEST_ATTEMPTS) {
        return response;
      }

      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === MAX_REQUEST_ATTEMPTS) throw error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
  }

  throw lastError instanceof Error ? lastError : new Error('농협 API 요청에 실패했습니다.');
}

// KST 날짜/시간 구하기 헬퍼 함수
function getTodayKst(): string {
  return DateTime.now().setZone('Asia/Seoul').toFormat('yyyyLLdd');
}

function getTimeKst(): string {
  return DateTime.now().setZone('Asia/Seoul').toFormat('HHmmssSSS');
}

// 쿠키 업데이트 헬퍼 함수
function parseAndFormatCookies(headers: Headers, currentCookies: string): string {
  const setCookies = headers.getSetCookie ? headers.getSetCookie() : (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : []);
  if (!setCookies || setCookies.length === 0) return currentCookies;

  const jar: Record<string, string> = {};
  if (currentCookies) {
    currentCookies.split('; ').forEach(cookie => {
      const parts = cookie.split('=');
      if (parts[0]) jar[parts[0]] = parts.slice(1).join('=');
    });
  }
  setCookies.forEach(item => {
    const cookie = item.split(';')[0];
    const parts = cookie.split('=');
    if (parts[0]) jar[parts[0]] = parts.slice(1).join('=');
  });
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

// 세션 초기화 및 로그인 실행
async function runLogin(): Promise<NonghyupSession> {
  const userId = process.env.NONGHYUP_USER_ID;
  const password = process.env.NONGHYUP_PASSWORD;

  if (!userId || !password) {
    throw new Error('농협 연동을 위한 NONGHYUP_USER_ID 및 NONGHYUP_PASSWORD 환경변수가 설정되지 않았습니다.');
  }

  let cookieJar = '';

  // [준비단계] CSRF 및 임시 키(X-KEY) 요청 (ONBIECM830001R01)
  const initPayload = {
    header: {
      trCrtDt: getTodayKst(),
      trTmsHr: getTimeKst(),
      scrnNo: 'login',
      tgrmSvcId: 'ONBIECM830001R01',
      naConnChanVal: '04'
    },
    body: {}
  };

  const initResponse = await fetchWithRetry(BXM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(initPayload)
  });

  if (!initResponse.ok) {
    throw new Error(`임시 키 통신 실패 (HTTP ${initResponse.status})`);
  }

  cookieJar = parseAndFormatCookies(initResponse.headers, cookieJar);
  const initResult = await initResponse.json();

  if (initResult.header?.prcStsc !== '0') {
    throw new Error(`임시 키 취득 실패: ${initResult.header?.prcrztMsgCntn || '알 수 없는 오류'}`);
  }

  const xCsrfToken = initResult.body.csrfToken;
  const xKey = initResult.body.passphrase;

  // 복호화하여 실제 API 대칭 키 도출
  const passKey = decryptAESPBK(xKey, xCsrfToken);
  if (!passKey) {
    throw new Error('API Passphrase 복호화 실패');
  }

  const KEYVal = decryptOpenSSLAES(PROD_CONFIG.KEY, passKey);
  const IVVal = decryptOpenSSLAES(PROD_CONFIG.IV, passKey);

  const nhdata1 = generateEnc32ByteFlag(true);

  // [1단계] RSA 공개키 및 Nonce 요청 (ONBIECM830001R07)
  const rsaPayload = {
    header: {
      trCrtDt: getTodayKst(),
      trTmsHr: getTimeKst(),
      scrnNo: 'login',
      tgrmSvcId: 'ONBIECM830001R07',
      naConnChanVal: '04'
    },
    body: {}
  };

  const rsaEncryptedBody = apiEncrypt(JSON.stringify(rsaPayload), KEYVal, IVVal);

  const rsaResponse = await fetchWithRetry(BXM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': xCsrfToken,
      'NHDATA1': nhdata1,
      'Cookie': cookieJar
    },
    body: rsaEncryptedBody
  });

  if (!rsaResponse.ok) {
    throw new Error(`RSA 키 요청 통신 실패 (HTTP ${rsaResponse.status})`);
  }

  cookieJar = parseAndFormatCookies(rsaResponse.headers, cookieJar);
  const rsaEncryptedText = await rsaResponse.text();
  const rsaDecryptedText = apiDecrypt(rsaEncryptedText, KEYVal, IVVal);
  const rsaResult = JSON.parse(rsaDecryptedText);

  if (rsaResult.header?.prcStsc !== '0') {
    throw new Error(`RSA 공개키 수신 에러: ${rsaResult.header?.prcrztMsgCntn || '알 수 없는 오류'}`);
  }

  const { keyId, publicKeyPem, nonce } = rsaResult.body;

  // [2단계] 패스워드 해싱 및 RSA 암호화 페이로드 생성
  const hashedPw = hashSHA256Base64(password);
  const rawPayload = `${userId}:${hashedPw}::${nonce}`;
  const encBase64 = encryptRSA(publicKeyPem, rawPayload);

  // [3단계] 로그인 요청 전송 (ONBIEMN4003R0R01)
  const loginPayload = {
    header: {
      trCrtDt: getTodayKst(),
      trTmsHr: getTimeKst(),
      scrnNo: 'login',
      tgrmSvcId: 'ONBIEMN4003R0R01',
      naConnChanVal: '04'
    },
    body: {
      pwizeKeyVal: keyId,
      pwizeKeyCntn: encBase64
    }
  };

  const loginEncryptedBody = apiEncrypt(JSON.stringify(loginPayload), KEYVal, IVVal);

  const loginResponse = await fetchWithRetry(BXM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': xCsrfToken,
      'NHDATA1': nhdata1,
      'Cookie': cookieJar
    },
    body: loginEncryptedBody
  });

  if (!loginResponse.ok) {
    throw new Error(`로그인 통신 실패 (HTTP ${loginResponse.status})`);
  }

  cookieJar = parseAndFormatCookies(loginResponse.headers, cookieJar);
  const loginEncryptedText = await loginResponse.text();
  const loginDecryptedText = apiDecrypt(loginEncryptedText, KEYVal, IVVal);
  const loginResult = JSON.parse(loginDecryptedText);

  if (loginResult.header?.prcStsc !== '0') {
    const errorMsg = loginResult.header?.prcrztMsgCntn || '로그인 인증 실패';
    const errorCode = loginResult.header?.prcRztRspC || '';
    const error = new Error(`로그인 실패: ${errorMsg}`);
    (error as { code?: string }).code = errorCode;
    throw error;
  }

  const resultBody = loginResult.body;
  const jwtToken = loginResponse.headers.get('x-jwt-token') || loginResponse.headers.get('X-JWT-Token') || '';

  const newSession: NonghyupSession = {
    cookieJar,
    xCsrfToken,
    KEYVal,
    IVVal,
    jwtToken,
    naBzplc: resultBody.naBzplc,
    trmnAmnno: resultBody.trmnAmnno,
    wmTrmnAmnno: resultBody.wmTrmnAmnno
  };

  activeSession = newSession;
  return newSession;
}

export interface AuctionPurchaseItem {
  oslpNo: number;
  aucNo: number;
  wmcLatcnm: string;
  wmSogmnm: string;
  wmWt: number;
  grdWmBaseInfCnm: string;
  budlCn: number;
  szeWmBaseInfCnm: string;
  trqt: number;
  actoUpr: number;
  wmUwupr: number;
  selAm: number;
  etcRmkCntn: string | null;
  naLatc: string;
  naBzplc: string;
  gbn: string;
}

export interface AuctionQueryResponse {
  cCnt: number;
  resultList: AuctionPurchaseItem[];
}

// 경매내역 조회 API 전송 핵심 메서드
async function executeAuctionQuery(session: NonghyupSession, ymd: string, pageNo: number, inqCn: string): Promise<AuctionQueryResponse> {
  const nhdata1 = generateEnc32ByteFlag(true);

  const auctionPayload = {
    header: {
      trCrtDt: getTodayKst(),
      trTmsHr: getTimeKst(),
      scrnNo: 'IEBY5005R0',
      tgrmSvcId: 'ONBIEBY5005R0R01',
      naConnChanVal: '04'
    },
    body: {
      seldt: ymd,
      naBzplc: session.naBzplc,
      trmnAmnno: session.trmnAmnno,
      wmTrmnAmnno: session.wmTrmnAmnno,
      naLatc: '',
      sogIdnm: '',
      gbn: '1',
      pageNo,
      inqCn
    }
  };

  const encryptedBody = apiEncrypt(JSON.stringify(auctionPayload), session.KEYVal, session.IVVal);

  const response = await fetchWithRetry(BXM_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': session.xCsrfToken,
      'X-JWT-Token': session.jwtToken,
      'NHDATA1': nhdata1,
      'Cookie': session.cookieJar
    },
    body: encryptedBody
  });

  if (!response.ok) {
    throw new Error(`경매조회 통신 실패 (HTTP ${response.status})`);
  }

  // 세션 쿠키 업데이트
  session.cookieJar = parseAndFormatCookies(response.headers, session.cookieJar);

  const encryptedText = await response.text();
  const decryptedText = apiDecrypt(encryptedText, session.KEYVal, session.IVVal);
  const result = JSON.parse(decryptedText);

  if (result.header?.prcStsc !== '0') {
    const errorMsg = result.header?.prcrztMsgCntn || '경매내역 조회 실패';
    const errorCode = result.header?.prcRztRspC || '';
    const error = new Error(errorMsg);
    (error as { code?: string }).code = errorCode;
    throw error;
  }

  const rawList = (result.body.resultList as unknown[] || []);
  const list: AuctionPurchaseItem[] = rawList.map((item) => {
    const p = item as Record<string, unknown>;
    return {
      oslpNo: Number(p.oslpNo),
      aucNo: Number(p.aucNo),
      wmcLatcnm: String(p.wmcLatcnm),
      wmSogmnm: String(p.wmSogmnm),
      wmWt: Number(p.wmWt),
      grdWmBaseInfCnm: String(p.grdWmBaseInfCnm),
      budlCn: Number(p.budlCn),
      szeWmBaseInfCnm: String(p.szeWmBaseInfCnm),
      trqt: Number(p.trqt),
      actoUpr: Number(p.actoUpr),
      wmUwupr: Number(p.wmUwupr),
      selAm: Number(p.selAm),
      etcRmkCntn: p.etcRmkCntn ? String(p.etcRmkCntn) : null,
      naLatc: String(p.naLatc),
      naBzplc: session.naBzplc,
      gbn: '1'
    };
  });

  return {
    cCnt: Number(result.body.cCnt || 0),
    resultList: list
  };
}

/**
 * 농협 경매 낙찰 내역을 조회합니다.
 * @param dateKey 'YYYY-MM-DD' 형식의 조회 날짜
 * @param pageNo 조회할 페이지 (기본 1)
 * @param inqCn 페이지당 데이터 수 (기본 '20')
 */
export async function fetchNonghyupAuctions(dateKey: string, pageNo = 1, inqCn = '20'): Promise<AuctionQueryResponse> {
  const ymd = dateKey.replace(/-/g, ''); // 'YYYY-MM-DD' -> 'YYYYMMDD'

  if (!activeSession) {
    activeSession = await runLogin();
  }

  try {
    return await executeAuctionQuery(activeSession, ymd, pageNo, inqCn);
  } catch (error) {
    const errCode = (error as { code?: string }).code;
    // 보안 정책 및 영구 중단 에러 코드는 재로그인 없이 즉시 실패
    if (errCode && ['BIEE0002', 'BIEE0003', 'BIEE0004'].includes(errCode)) {
      throw error;
    }

    // 만료 혹은 토큰 오류 시, 세션을 초기화하고 1회 재로그인 및 재시도
    console.warn(`[NonghyupClient] API 호출 오류(${errCode || (error as Error).message}). 세션 재설정 및 로그인 재시도합니다.`);
    activeSession = null;

    // 다시 로그인 후 시도
    const newSession = await runLogin();
    return await executeAuctionQuery(newSession, ymd, pageNo, inqCn);
  }
}
