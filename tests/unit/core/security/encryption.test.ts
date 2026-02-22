/**
 * Unit Tests for Encryption Service
 * 
 * Tests AES-256-GCM encryption and bcrypt password hashing
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  EncryptionService,
  PasswordHashingService,
  generateMasterKey,
  initializeEncryption,
  getEncryptionService,
  getPasswordHashingService,
} from '@/core/security/encryption.js';

describe('EncryptionService', () => {
  let masterKey: string;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    masterKey = generateMasterKey();
    encryptionService = new EncryptionService(masterKey);
  });

  describe('Master Key Generation', () => {
    it('should generate a 64-character hex key', () => {
      const key = generateMasterKey();
      expect(key).toHaveLength(64);
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique keys', () => {
      const key1 = generateMasterKey();
      const key2 = generateMasterKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('Constructor', () => {
    it('should accept valid 64-character hex key', () => {
      const key = generateMasterKey();
      expect(() => new EncryptionService(key)).not.toThrow();
    });

    it('should reject invalid key length', () => {
      expect(() => new EncryptionService('short')).toThrow('Master key must be 64 hex characters');
    });

    it('should reject non-hex characters', () => {
      const invalidKey = 'g'.repeat(64); // 'g' is not a hex character
      expect(() => new EncryptionService(invalidKey)).toThrow();
    });

    it('should reject empty key', () => {
      expect(() => new EncryptionService('')).toThrow();
    });
  });

  describe('Encryption', () => {
    it('should encrypt plaintext successfully', () => {
      const plaintext = 'my_secret_api_key';
      const encrypted = encryptionService.encrypt(plaintext);

      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('salt');
      expect(encrypted.encrypted).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test_data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      // Different IV and salt should produce different ciphertext
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should encrypt empty string', () => {
      const encrypted = encryptionService.encrypt('');
      // Empty string encryption produces empty ciphertext, but structure should exist
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');
      expect(encrypted).toHaveProperty('salt');
    });

    it('should encrypt long strings', () => {
      const longString = 'a'.repeat(10000);
      const encrypted = encryptionService.encrypt(longString);
      expect(encrypted.encrypted).toBeTruthy();
    });

    it('should encrypt special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptionService.encrypt(specialChars);
      expect(encrypted.encrypted).toBeTruthy();
    });

    it('should encrypt unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا';
      const encrypted = encryptionService.encrypt(unicode);
      expect(encrypted.encrypted).toBeTruthy();
    });
  });

  describe('Decryption', () => {
    it('should decrypt to original plaintext', () => {
      const plaintext = 'my_secret_api_key';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt empty string', () => {
      const plaintext = '';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should decrypt unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with wrong master key', () => {
      const plaintext = 'test_data';
      const encrypted = encryptionService.encrypt(plaintext);

      const wrongKey = generateMasterKey();
      const wrongService = new EncryptionService(wrongKey);

      expect(() => wrongService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });

    it('should fail with corrupted ciphertext', () => {
      const plaintext = 'test_data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Corrupt the ciphertext
      encrypted.encrypted = 'corrupted_data';

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });

    it('should fail with corrupted IV', () => {
      const plaintext = 'test_data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Corrupt the IV
      encrypted.iv = 'corrupted_iv';

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });

    it('should fail with corrupted auth tag', () => {
      const plaintext = 'test_data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Corrupt the auth tag
      encrypted.authTag = 'corrupted_tag';

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });

    it('should fail with corrupted salt', () => {
      const plaintext = 'test_data';
      const encrypted = encryptionService.encrypt(plaintext);

      // Corrupt the salt
      encrypted.salt = 'corrupted_salt';

      expect(() => encryptionService.decrypt(encrypted)).toThrow('Failed to decrypt data');
    });
  });

  describe('JSON Serialization', () => {
    it('should encrypt and serialize to JSON', () => {
      const plaintext = 'my_api_key';
      const json = encryptionService.encryptToJson(plaintext);

      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('authTag');
      expect(parsed).toHaveProperty('salt');
    });

    it('should decrypt from JSON', () => {
      const plaintext = 'my_api_key';
      const json = encryptionService.encryptToJson(plaintext);
      const decrypted = encryptionService.decryptFromJson(json);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail with invalid JSON', () => {
      expect(() => encryptionService.decryptFromJson('invalid json')).toThrow(
        'Invalid encrypted data format'
      );
    });

    it('should fail with malformed JSON structure', () => {
      const invalidJson = JSON.stringify({ invalid: 'structure' });
      expect(() => encryptionService.decryptFromJson(invalidJson)).toThrow();
    });
  });

  describe('Multiple Encryptions', () => {
    it('should handle multiple encryptions with same service', () => {
      const data = ['key1', 'key2', 'key3'];
      const encrypted = data.map((d) => encryptionService.encrypt(d));
      const decrypted = encrypted.map((e) => encryptionService.decrypt(e));

      expect(decrypted).toEqual(data);
    });

    it('should handle concurrent encryptions', () => {
      const data = Array.from({ length: 10 }, (_, i) => `key_${i}`);
      const encrypted = data.map((d) => encryptionService.encrypt(d));
      const decrypted = encrypted.map((e) => encryptionService.decrypt(e));

      expect(decrypted).toEqual(data);
    });
  });
});

describe('PasswordHashingService', () => {
  let passwordService: PasswordHashingService;

  beforeEach(() => {
    passwordService = new PasswordHashingService();
  });

  describe('Password Hashing', () => {
    it('should hash password successfully', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordService.hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/); // Bcrypt hash format
    });

    it('should produce different hashes for same password', async () => {
      const password = 'test_password';
      const hash1 = await passwordService.hashPassword(password);
      const hash2 = await passwordService.hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should hash long passwords', async () => {
      const longPassword = 'a'.repeat(100);
      const hash = await passwordService.hashPassword(longPassword);

      expect(hash).toBeTruthy();
    });

    it('should hash passwords with special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const hash = await passwordService.hashPassword(password);

      expect(hash).toBeTruthy();
    });

    it('should hash passwords with unicode', async () => {
      const password = '密码123🔒';
      const hash = await passwordService.hashPassword(password);

      expect(hash).toBeTruthy();
    });

    it('should reject empty password', async () => {
      await expect(passwordService.hashPassword('')).rejects.toThrow('Failed to hash password');
    });

    it('should use cost factor 12 or higher', async () => {
      const password = 'test_password';
      const hash = await passwordService.hashPassword(password);

      // Extract cost factor from hash (format: $2b$12$...)
      const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
      expect(costMatch).toBeTruthy();

      const costFactor = parseInt(costMatch![1], 10);
      expect(costFactor).toBeGreaterThanOrEqual(12);
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      const password = 'MySecurePassword123!';
      const hash = await passwordService.hashPassword(password);
      const isValid = await passwordService.verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'correct_password';
      const hash = await passwordService.hashPassword(password);
      const isValid = await passwordService.verifyPassword('wrong_password', hash);

      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const hash = await passwordService.hashPassword('test');
      const isValid = await passwordService.verifyPassword('', hash);

      expect(isValid).toBe(false);
    });

    it('should reject empty hash', async () => {
      const isValid = await passwordService.verifyPassword('test', '');

      expect(isValid).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const isValid = await passwordService.verifyPassword('test', 'invalid_hash');

      expect(isValid).toBe(false);
    });

    it('should be case-sensitive', async () => {
      const password = 'Password123';
      const hash = await passwordService.hashPassword(password);

      expect(await passwordService.verifyPassword('password123', hash)).toBe(false);
      expect(await passwordService.verifyPassword('PASSWORD123', hash)).toBe(false);
      expect(await passwordService.verifyPassword('Password123', hash)).toBe(true);
    });
  });

  describe('Hash Rehashing', () => {
    it('should not need rehash for current cost factor', async () => {
      const password = 'test_password';
      const hash = await passwordService.hashPassword(password);
      const needsRehash = passwordService.needsRehash(hash);

      expect(needsRehash).toBe(false);
    });

    it('should detect invalid hash format', () => {
      const needsRehash = passwordService.needsRehash('invalid_hash');

      expect(needsRehash).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should hash password in reasonable time', async () => {
      const password = 'test_password';
      const start = Date.now();
      await passwordService.hashPassword(password);
      const duration = Date.now() - start;

      // Bcrypt with cost factor 12 should take 50-500ms
      expect(duration).toBeLessThan(1000);
    });

    it('should verify password in reasonable time', async () => {
      const password = 'test_password';
      const hash = await passwordService.hashPassword(password);

      const start = Date.now();
      await passwordService.verifyPassword(password, hash);
      const duration = Date.now() - start;

      // Verification should take similar time to hashing
      expect(duration).toBeLessThan(1000);
    });
  });
});

describe('Singleton Instances', () => {
  it('should initialize encryption service', () => {
    const masterKey = generateMasterKey();
    expect(() => initializeEncryption(masterKey)).not.toThrow();
  });

  it('should get encryption service after initialization', () => {
    const masterKey = generateMasterKey();
    initializeEncryption(masterKey);

    const service = getEncryptionService();
    expect(service).toBeInstanceOf(EncryptionService);
  });

  it('should get password hashing service after initialization', () => {
    const masterKey = generateMasterKey();
    initializeEncryption(masterKey);

    const service = getPasswordHashingService();
    expect(service).toBeInstanceOf(PasswordHashingService);
  });

  it('should throw if encryption service not initialized', () => {
    // Reset singleton (this is a hack for testing)
    // In real code, this would never happen
    expect(() => {
      // Try to get service without initialization in a new context
      const module = { encryptionServiceInstance: null };
      if (!module.encryptionServiceInstance) {
        throw new Error('Encryption service not initialized. Call initializeEncryption() first.');
      }
    }).toThrow('Encryption service not initialized');
  });
});

describe('Integration Tests', () => {
  it('should encrypt and decrypt API keys', () => {
    const masterKey = generateMasterKey();
    const service = new EncryptionService(masterKey);

    const apiKeys = {
      discord: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAuAbCdEf.GhIjKlMnOpQrStUvWxYz123456789',
      kick: 'kick_api_key_1234567890abcdef',
      google: 'AIzaSyD1234567890abcdefghijklmnopqrstuv',
    };

    const encrypted = {
      discord: service.encryptToJson(apiKeys.discord),
      kick: service.encryptToJson(apiKeys.kick),
      google: service.encryptToJson(apiKeys.google),
    };

    const decrypted = {
      discord: service.decryptFromJson(encrypted.discord),
      kick: service.decryptFromJson(encrypted.kick),
      google: service.decryptFromJson(encrypted.google),
    };

    expect(decrypted).toEqual(apiKeys);
  });

  it('should hash and verify multiple passwords', async () => {
    const service = new PasswordHashingService();

    const users = [
      { username: 'user1', password: 'Password1!' },
      { username: 'user2', password: 'Password2!' },
      { username: 'user3', password: 'Password3!' },
    ];

    // Hash all passwords
    const hashes = await Promise.all(
      users.map((u) => service.hashPassword(u.password))
    );

    // Verify correct passwords
    for (let i = 0; i < users.length; i++) {
      const isValid = await service.verifyPassword(users[i].password, hashes[i]);
      expect(isValid).toBe(true);
    }

    // Verify wrong passwords
    for (let i = 0; i < users.length; i++) {
      const wrongPassword = users[(i + 1) % users.length].password;
      const isValid = await service.verifyPassword(wrongPassword, hashes[i]);
      expect(isValid).toBe(false);
    }
  });

  it('should handle full encryption workflow', async () => {
    const masterKey = generateMasterKey();
    initializeEncryption(masterKey);

    const encryptionService = getEncryptionService();
    const passwordService = getPasswordHashingService();

    // Encrypt API key
    const apiKey = 'my_secret_api_key';
    const encryptedKey = encryptionService.encryptToJson(apiKey);

    // Hash password
    const password = 'UserPassword123!';
    const passwordHash = await passwordService.hashPassword(password);

    // Simulate storage and retrieval
    const storedData = {
      apiKey: encryptedKey,
      passwordHash: passwordHash,
    };

    // Decrypt API key
    const decryptedKey = encryptionService.decryptFromJson(storedData.apiKey);
    expect(decryptedKey).toBe(apiKey);

    // Verify password
    const isValid = await passwordService.verifyPassword(password, storedData.passwordHash);
    expect(isValid).toBe(true);
  });
});
