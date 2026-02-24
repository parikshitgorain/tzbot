/**
 * Encryption Utilities
 *
 * Provides AES-256 encryption for sensitive data at rest and bcrypt password hashing.
 *
 * Requirements:
 * - 12.6: Encrypt sensitive configuration values (API keys, tokens)
 * - 15.1: Encrypt all API keys and tokens at rest using AES-256
 * - 15.5: Hash passwords using bcrypt with cost factor 12+
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { logger, logError } from '../logger/logger.js';
/**
 * AES-256-GCM encryption configuration
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const SALT_LENGTH = 32; // 256 bits for key derivation
const KEY_LENGTH = 32; // 256 bits for AES-256
/**
 * Bcrypt configuration
 */
const BCRYPT_COST_FACTOR = 12; // Minimum cost factor as per requirement 15.5
/**
 * Encryption service for sensitive data
 */
export class EncryptionService {
    masterKey;
    /**
     * Initialize encryption service with a master key
     *
     * @param masterKeyHex - Master encryption key in hex format (64 characters for 256 bits)
     * @throws Error if master key is invalid
     */
    constructor(masterKeyHex) {
        if (!masterKeyHex || masterKeyHex.length !== 64) {
            throw new Error('Master key must be 64 hex characters (256 bits)');
        }
        try {
            this.masterKey = Buffer.from(masterKeyHex, 'hex');
            if (this.masterKey.length !== KEY_LENGTH) {
                throw new Error('Invalid master key length');
            }
        }
        catch (error) {
            logError('Failed to initialize encryption service', error);
            throw new Error('Invalid master key format');
        }
    }
    /**
     * Derive encryption key from master key and salt using PBKDF2
     *
     * @param salt - Salt for key derivation
     * @returns Derived encryption key
     */
    deriveKey(salt) {
        return crypto.pbkdf2Sync(this.masterKey, salt, 100000, KEY_LENGTH, 'sha256');
    }
    /**
     * Encrypt sensitive data using AES-256-GCM
     *
     * Validates: Requirements 12.6, 15.1
     *
     * @param plaintext - Data to encrypt
     * @returns Encrypted data with IV, auth tag, and salt
     */
    encrypt(plaintext) {
        try {
            // Generate random salt for key derivation
            const salt = crypto.randomBytes(SALT_LENGTH);
            // Derive encryption key from master key and salt
            const key = this.deriveKey(salt);
            // Generate random IV
            const iv = crypto.randomBytes(IV_LENGTH);
            // Create cipher
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
            // Encrypt data
            let encrypted = cipher.update(plaintext, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            // Get authentication tag
            const authTag = cipher.getAuthTag();
            logger.debug('Data encrypted successfully');
            return {
                encrypted,
                iv: iv.toString('base64'),
                authTag: authTag.toString('base64'),
                salt: salt.toString('base64'),
            };
        }
        catch (error) {
            logError('Encryption failed', error);
            throw new Error('Failed to encrypt data');
        }
    }
    /**
     * Decrypt data encrypted with AES-256-GCM
     *
     * @param encryptedData - Encrypted data structure
     * @returns Decrypted plaintext
     * @throws Error if decryption fails or authentication fails
     */
    decrypt(encryptedData) {
        try {
            // Parse encrypted data components
            const salt = Buffer.from(encryptedData.salt, 'base64');
            const iv = Buffer.from(encryptedData.iv, 'base64');
            const authTag = Buffer.from(encryptedData.authTag, 'base64');
            // Derive encryption key from master key and salt
            const key = this.deriveKey(salt);
            // Create decipher
            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);
            // Decrypt data
            let decrypted = decipher.update(encryptedData.encrypted, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            logger.debug('Data decrypted successfully');
            return decrypted;
        }
        catch (error) {
            logError('Decryption failed', error);
            throw new Error('Failed to decrypt data - data may be corrupted or tampered with');
        }
    }
    /**
     * Encrypt and serialize to JSON string
     *
     * @param plaintext - Data to encrypt
     * @returns JSON string of encrypted data
     */
    encryptToJson(plaintext) {
        const encrypted = this.encrypt(plaintext);
        return JSON.stringify(encrypted);
    }
    /**
     * Decrypt from JSON string
     *
     * @param json - JSON string of encrypted data
     * @returns Decrypted plaintext
     */
    decryptFromJson(json) {
        try {
            const encryptedData = JSON.parse(json);
            return this.decrypt(encryptedData);
        }
        catch (error) {
            logError('Failed to parse encrypted JSON', error);
            throw new Error('Invalid encrypted data format');
        }
    }
}
/**
 * Password hashing service using bcrypt
 */
export class PasswordHashingService {
    /**
     * Hash a password using bcrypt with cost factor 12+
     *
     * Validates: Requirement 15.5
     *
     * @param password - Plain text password to hash
     * @returns Hashed password
     */
    async hashPassword(password) {
        try {
            if (!password || password.length === 0) {
                throw new Error('Password cannot be empty');
            }
            const hash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);
            logger.debug('Password hashed successfully');
            return hash;
        }
        catch (error) {
            logError('Password hashing failed', error);
            throw new Error('Failed to hash password');
        }
    }
    /**
     * Verify a password against a bcrypt hash
     *
     * @param password - Plain text password to verify
     * @param hash - Bcrypt hash to compare against
     * @returns True if password matches hash
     */
    async verifyPassword(password, hash) {
        try {
            if (!password || !hash) {
                return false;
            }
            const isValid = await bcrypt.compare(password, hash);
            logger.debug(`Password verification: ${isValid ? 'success' : 'failed'}`);
            return isValid;
        }
        catch (error) {
            logError('Password verification failed', error);
            return false;
        }
    }
    /**
     * Check if a hash needs to be rehashed (cost factor changed)
     *
     * @param hash - Bcrypt hash to check
     * @returns True if hash should be regenerated
     */
    needsRehash(hash) {
        try {
            const rounds = bcrypt.getRounds(hash);
            return rounds < BCRYPT_COST_FACTOR;
        }
        catch (error) {
            logError('Failed to check hash rounds', error);
            return true; // Assume rehash needed if we can't determine
        }
    }
}
/**
 * Generate a cryptographically secure master key
 *
 * @returns 256-bit master key in hex format
 */
export function generateMasterKey() {
    const key = crypto.randomBytes(KEY_LENGTH);
    return key.toString('hex');
}
/**
 * Singleton instances for convenience
 * Note: These should be initialized with proper master key from environment
 */
let encryptionServiceInstance = null;
let passwordHashingServiceInstance = null;
/**
 * Initialize encryption service with master key from environment
 *
 * @param masterKeyHex - Master encryption key in hex format
 */
export function initializeEncryption(masterKeyHex) {
    encryptionServiceInstance = new EncryptionService(masterKeyHex);
    passwordHashingServiceInstance = new PasswordHashingService();
    logger.info('Encryption services initialized');
}
/**
 * Get encryption service instance
 *
 * @returns Encryption service instance
 * @throws Error if not initialized
 */
export function getEncryptionService() {
    if (!encryptionServiceInstance) {
        throw new Error('Encryption service not initialized. Call initializeEncryption() first.');
    }
    return encryptionServiceInstance;
}
/**
 * Get password hashing service instance
 *
 * @returns Password hashing service instance
 * @throws Error if not initialized
 */
export function getPasswordHashingService() {
    if (!passwordHashingServiceInstance) {
        throw new Error('Password hashing service not initialized. Call initializeEncryption() first.');
    }
    return passwordHashingServiceInstance;
}
//# sourceMappingURL=encryption.js.map