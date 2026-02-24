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
/**
 * Encrypted data structure
 */
export interface EncryptedData {
    encrypted: string;
    iv: string;
    authTag: string;
    salt: string;
}
/**
 * Encryption service for sensitive data
 */
export declare class EncryptionService {
    private masterKey;
    /**
     * Initialize encryption service with a master key
     *
     * @param masterKeyHex - Master encryption key in hex format (64 characters for 256 bits)
     * @throws Error if master key is invalid
     */
    constructor(masterKeyHex: string);
    /**
     * Derive encryption key from master key and salt using PBKDF2
     *
     * @param salt - Salt for key derivation
     * @returns Derived encryption key
     */
    private deriveKey;
    /**
     * Encrypt sensitive data using AES-256-GCM
     *
     * Validates: Requirements 12.6, 15.1
     *
     * @param plaintext - Data to encrypt
     * @returns Encrypted data with IV, auth tag, and salt
     */
    encrypt(plaintext: string): EncryptedData;
    /**
     * Decrypt data encrypted with AES-256-GCM
     *
     * @param encryptedData - Encrypted data structure
     * @returns Decrypted plaintext
     * @throws Error if decryption fails or authentication fails
     */
    decrypt(encryptedData: EncryptedData): string;
    /**
     * Encrypt and serialize to JSON string
     *
     * @param plaintext - Data to encrypt
     * @returns JSON string of encrypted data
     */
    encryptToJson(plaintext: string): string;
    /**
     * Decrypt from JSON string
     *
     * @param json - JSON string of encrypted data
     * @returns Decrypted plaintext
     */
    decryptFromJson(json: string): string;
}
/**
 * Password hashing service using bcrypt
 */
export declare class PasswordHashingService {
    /**
     * Hash a password using bcrypt with cost factor 12+
     *
     * Validates: Requirement 15.5
     *
     * @param password - Plain text password to hash
     * @returns Hashed password
     */
    hashPassword(password: string): Promise<string>;
    /**
     * Verify a password against a bcrypt hash
     *
     * @param password - Plain text password to verify
     * @param hash - Bcrypt hash to compare against
     * @returns True if password matches hash
     */
    verifyPassword(password: string, hash: string): Promise<boolean>;
    /**
     * Check if a hash needs to be rehashed (cost factor changed)
     *
     * @param hash - Bcrypt hash to check
     * @returns True if hash should be regenerated
     */
    needsRehash(hash: string): boolean;
}
/**
 * Generate a cryptographically secure master key
 *
 * @returns 256-bit master key in hex format
 */
export declare function generateMasterKey(): string;
/**
 * Initialize encryption service with master key from environment
 *
 * @param masterKeyHex - Master encryption key in hex format
 */
export declare function initializeEncryption(masterKeyHex: string): void;
/**
 * Get encryption service instance
 *
 * @returns Encryption service instance
 * @throws Error if not initialized
 */
export declare function getEncryptionService(): EncryptionService;
/**
 * Get password hashing service instance
 *
 * @returns Password hashing service instance
 * @throws Error if not initialized
 */
export declare function getPasswordHashingService(): PasswordHashingService;
//# sourceMappingURL=encryption.d.ts.map