import crypto from 'crypto';

// (A) PBKDF2 + AES Decryption
export function decryptAESPBK(cipherTextBase64: string, passphrase: string): string | null {
  if (!cipherTextBase64) return null;
  const buffer = Buffer.from(cipherTextBase64, 'base64');
  if (buffer.length <= 8) return '';

  const salt = buffer.subarray(0, 8);
  const ciphertext = buffer.subarray(8);

  // keySize = 12 words = 48 bytes (32 key + 16 iv)
  const derived = crypto.pbkdf2Sync(passphrase, salt, 10000, 48, 'sha256');
  const key = derived.subarray(0, 32);
  const iv = derived.subarray(32, 48);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// (B) CryptoJS 기본 방식 (OpenSSL EVP_BytesToKey MD5 KDF) 복호화
export function decryptOpenSSLAES(ciphertextBase64: string, passphrase: string): string {
  const ciphertextBuffer = Buffer.from(ciphertextBase64, 'base64');
  if (ciphertextBuffer.subarray(0, 8).toString('ascii') !== 'Salted__') {
    throw new Error('올바른 OpenSSL 암호문이 아닙니다.');
  }
  const salt = ciphertextBuffer.subarray(8, 16);
  const ciphertext = ciphertextBuffer.subarray(16);

  let keyAndIv = Buffer.alloc(0);
  let currentHash = Buffer.alloc(0);
  while (keyAndIv.length < 48) {
    currentHash = crypto.createHash('md5')
      .update(Buffer.concat([currentHash, Buffer.from(passphrase, 'utf8'), salt]))
      .digest();
    keyAndIv = Buffer.concat([keyAndIv, currentHash]);
  }
  const key = keyAndIv.subarray(0, 32);
  const iv = keyAndIv.subarray(32, 48);

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// (C) API 바디 대칭 암호화
export function apiEncrypt(plainText: string, key: string, iv: string): string {
  const keyBuf = Buffer.from(key, 'utf8');
  const ivBuf = Buffer.from(iv, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuf, ivBuf);
  let encrypted = cipher.update(plainText, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// (D) API 바디 대칭 복호화
export function apiDecrypt(cipherTextBase64: string, key: string, iv: string): string {
  const keyBuf = Buffer.from(key, 'utf8');
  const ivBuf = Buffer.from(iv, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuf, ivBuf);
  let decrypted = decipher.update(cipherTextBase64, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// (E) NHDATA1 암호화 활성화 플래그 생성기
export function generateEnc32ByteFlag(flag: boolean): string {
  const flagNum = flag === true ? 1 : 0;
  const totalLength = 32;
  const timestampLength = 3;
  const randomFlagPosLength = 22;
  const reverseFlagPosLength = 7;

  const now = Date.now();
  const timestamp3 = ('000' + (now % 1000)).slice(-timestampLength);

  const bodyLen = totalLength - timestampLength;
  let randomField = '';
  for (let i = 0; i < bodyLen; i++) {
    const randomByte = crypto.randomBytes(1)[0];
    randomField += ((randomByte & 1) ? '1' : '0');
  }

  const flags32byte = timestamp3 + randomField;
  const tsNum = parseInt(timestamp3, 10);
  const flagPosition = tsNum % randomFlagPosLength;
  const reverseFlagPosition = tsNum % reverseFlagPosLength;

  const chars = flags32byte.split('');
  chars[timestampLength + flagPosition] = String(flagNum);
  chars[timestampLength + randomFlagPosLength + reverseFlagPosition] = String(Math.abs(1 - flagNum));
  return chars.join('');
}

// (F) 비밀번호용 SHA256 Base64 해싱
export function hashSHA256Base64(text: string): string {
  return crypto.createHash('sha256').update(text).digest('base64');
}

// (G) RSA-OAEP 공개키 기반 암호화
export function encryptRSA(publicKeyPem: string, text: string): string {
  const buffer = Buffer.from(text, 'utf8');
  const encrypted = crypto.publicEncrypt({
    key: publicKeyPem,
    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
    oaepHash: 'sha256'
  }, buffer);
  return encrypted.toString('base64');
}
