import { describe, it, expect } from 'vitest';
import {
  apiEncrypt,
  apiDecrypt,
  generateEnc32ByteFlag,
  hashSHA256Base64
} from '../src/server/services/nonghyup-crypto';

describe('Nonghyup Cryptography Services', () => {
  const testKey = '3F35233E322B24123526133920392632'; // 32 chars = 16 bytes/32 hex chars
  const testIv = '2F27213B3F391828'; // 16 chars

  it('should encrypt and decrypt a JSON payload correctly', () => {
    const originalPayload = {
      header: { tgrmSvcId: 'TEST_SVC' },
      body: { hello: 'world', number: 12345 }
    };

    const plainText = JSON.stringify(originalPayload);
    const encrypted = apiEncrypt(plainText, testKey, testIv);

    expect(encrypted).toBeTypeOf('string');
    expect(encrypted).not.toEqual(plainText);

    const decrypted = apiDecrypt(encrypted, testKey, testIv);
    const parsed = JSON.parse(decrypted);

    expect(parsed).toEqual(originalPayload);
  });

  it('should hash a password to SHA256 base64', () => {
    const rawPw = 'my_secure_password';
    const hashed = hashSHA256Base64(rawPw);

    expect(hashed).toBeTypeOf('string');
    expect(hashed.length).toBeGreaterThan(10);
    // sha256 base64 hash length is usually 44 characters
    expect(hashed).toEqual('LJqNAvwXrnfpJtOP6Dw1KdZjjR1jY3lQPwxkAOBjRF8=');
  });

  it('should generate NHDATA1 32byte flag with timestamps', () => {
    const flagTrue = generateEnc32ByteFlag(true);
    const flagFalse = generateEnc32ByteFlag(false);

    expect(flagTrue).toHaveLength(32);
    expect(flagFalse).toHaveLength(32);

    // Check characters are only '0', '1', and numbers
    expect(flagTrue).toMatch(/^[0-9]+$/);
  });
});
