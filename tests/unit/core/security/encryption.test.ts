import { describe, it, expect, beforeEach } from 'vitest';
import {
  EncryptionService,
  PasswordHashingService,
  generateMasterKey,
} from '../../../../src/core/security/encryption.js';

describe('generateMasterKey()', () => {
  it('returns a 64-character hex string', () => {
    const key = generateMasterKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
  });

  it('produces a different key on each call', () => {
    const k1 = generateMasterKey();
    const k2 = generateMasterKey();
    expect(k1).not.toBe(k2);
  });
});

describe('EncryptionService', () => {
  const validKey = generateMasterKey();
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(validKey);
  });

  describe('constructor', () => {
    it('throws on empty key', () => {
      expect(() => new EncryptionService('')).toThrow();
    });

    it('throws when key length is wrong (e.g., 32 chars)', () => {
      expect(() => new EncryptionService('a'.repeat(32))).toThrow();
    });

    it('succeeds with a 64-character hex key', () => {
      expect(() => new EncryptionService(validKey)).not.toThrow();
    });
  });

  describe('encrypt()', () => {
    it('returns an EncryptedData object with all required fields', () => {
      const result = service.encrypt('hello world');
      expect(result).toHaveProperty('encrypted');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('authTag');
      expect(result).toHaveProperty('salt');
    });

    it('produces different ciphertext on each call (random IV + salt)', () => {
      const r1 = service.encrypt('same plaintext');
      const r2 = service.encrypt('same plaintext');
      expect(r1.encrypted).not.toBe(r2.encrypted);
      expect(r1.iv).not.toBe(r2.iv);
    });
  });

  describe('decrypt()', () => {
    it('decrypts back to the original plaintext', () => {
      const plaintext = 'super secret value';
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('throws when the authTag is tampered with', () => {
      const encrypted = service.encrypt('data');
      const tampered = {
        ...encrypted,
        authTag: Buffer.from('tampered-auth-tag-value!!').toString('base64'),
      };
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('encryptToJson() / decryptFromJson()', () => {
    it('round-trips plaintext through JSON serialization', () => {
      const plaintext = 'json round-trip test';
      const json = service.encryptToJson(plaintext);
      expect(service.decryptFromJson(json)).toBe(plaintext);
    });

    it('encryptToJson returns a valid JSON string', () => {
      const json = service.encryptToJson('test');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('decryptFromJson throws on invalid JSON', () => {
      expect(() => service.decryptFromJson('not valid json {{')).toThrow();
    });
  });
});

describe('PasswordHashingService', () => {
  let hashingService: PasswordHashingService;

  beforeEach(() => {
    hashingService = new PasswordHashingService();
  });

  describe('hashPassword()', () => {
    it('returns a bcrypt hash starting with $2b$', async () => {
      const hash = await hashingService.hashPassword('myPassword');
      expect(hash.startsWith('$2b$')).toBe(true);
    }, 10_000);

    it('throws on empty password', async () => {
      await expect(hashingService.hashPassword('')).rejects.toThrow();
    });
  });

  describe('verifyPassword()', () => {
    it('returns true for a matching password', async () => {
      const hash = await hashingService.hashPassword('correctPassword');
      expect(await hashingService.verifyPassword('correctPassword', hash)).toBe(true);
    }, 10_000);

    it('returns false for a wrong password', async () => {
      const hash = await hashingService.hashPassword('correctPassword');
      expect(await hashingService.verifyPassword('wrongPassword', hash)).toBe(false);
    }, 10_000);

    it('returns false when password is empty', async () => {
      const hash = await hashingService.hashPassword('somePassword');
      expect(await hashingService.verifyPassword('', hash)).toBe(false);
    }, 10_000);

    it('returns false when hash is empty', async () => {
      expect(await hashingService.verifyPassword('anyPassword', '')).toBe(false);
    });
  });

  describe('needsRehash()', () => {
    it('returns false for a hash generated with cost factor 12', async () => {
      const hash = await hashingService.hashPassword('password');
      expect(hashingService.needsRehash(hash)).toBe(false);
    }, 10_000);

    it('returns true for a hash generated with a lower cost factor', async () => {
      // bcrypt hash with cost factor 10 (lower than the required 12)
      const import_bcrypt = await import('bcrypt');
      const lowCostHash = await import_bcrypt.default.hash('password', 10);
      expect(hashingService.needsRehash(lowCostHash)).toBe(true);
    }, 10_000);
  });
});
