# Security Module

This module provides encryption and password hashing utilities for protecting sensitive data.

## Features

### AES-256-GCM Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits
- **Authentication**: Built-in authentication tag prevents tampering
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Use Cases**: API keys, tokens, webhook secrets, OAuth credentials

### Bcrypt Password Hashing
- **Algorithm**: bcrypt
- **Cost Factor**: 12 (configurable, minimum 12 per requirements)
- **Use Cases**: User passwords, sensitive credentials

## Requirements Validation

This module validates the following requirements:

- **Requirement 12.6**: Encrypt sensitive configuration values (API keys, tokens)
- **Requirement 15.1**: Encrypt all API keys and tokens at rest using AES-256
- **Requirement 15.5**: Hash passwords using bcrypt with cost factor 12+

## Setup

### 1. Generate Master Key

Generate a cryptographically secure master key (do this once):

```typescript
import { generateMasterKey } from './encryption.js';

const masterKey = generateMasterKey();
console.log('ENCRYPTION_MASTER_KEY=' + masterKey);
```

### 2. Store Master Key Securely

Add the master key to your `.env` file:

```bash
ENCRYPTION_MASTER_KEY=your_64_character_hex_key_here
```

**IMPORTANT**: 
- Never commit the master key to version control
- Store it securely (environment variable, secrets manager, etc.)
- Losing the master key means losing access to all encrypted data
- Rotate the master key periodically (requires re-encrypting all data)

### 3. Initialize at Application Startup

```typescript
import { initializeEncryption } from './core/security/encryption.js';

// Load master key from environment
const masterKey = process.env.ENCRYPTION_MASTER_KEY;
if (!masterKey) {
  throw new Error('ENCRYPTION_MASTER_KEY not set');
}

// Initialize encryption services
initializeEncryption(masterKey);
```

## Usage

### Encrypting API Keys

```typescript
import { getEncryptionService } from './core/security/encryption.js';

const encryptionService = getEncryptionService();

// Encrypt
const apiKey = 'my_secret_api_key';
const encrypted = encryptionService.encrypt(apiKey);

// Store in database as JSON
const jsonForDb = encryptionService.encryptToJson(apiKey);
await db.query('INSERT INTO config (key, value) VALUES ($1, $2)', 
  ['api_key', jsonForDb]);

// Retrieve and decrypt
const result = await db.query('SELECT value FROM config WHERE key = $1', 
  ['api_key']);
const decrypted = encryptionService.decryptFromJson(result.rows[0].value);
```

### Hashing Passwords

```typescript
import { getPasswordHashingService } from './core/security/encryption.js';

const passwordService = getPasswordHashingService();

// Hash password
const password = 'user_password_123';
const hash = await passwordService.hashPassword(password);

// Store hash in database
await db.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)',
  ['john', hash]);

// Verify password during login
const user = await db.query('SELECT password_hash FROM users WHERE username = $1',
  ['john']);
const isValid = await passwordService.verifyPassword(password, user.rows[0].password_hash);

if (isValid) {
  // Login successful
}
```

### Checking if Hash Needs Rehashing

```typescript
const passwordService = getPasswordHashingService();

// Check if hash was created with old cost factor
if (passwordService.needsRehash(storedHash)) {
  // Rehash with current cost factor
  const newHash = await passwordService.hashPassword(password);
  await db.query('UPDATE users SET password_hash = $1 WHERE id = $2',
    [newHash, userId]);
}
```

## Security Best Practices

### Master Key Management

1. **Generation**: Use `generateMasterKey()` to create a cryptographically secure key
2. **Storage**: Store in environment variables or secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
3. **Access Control**: Limit access to master key to authorized personnel only
4. **Rotation**: Rotate master key periodically (requires re-encrypting all data)
5. **Backup**: Securely backup master key in case of emergency

### Encryption Best Practices

1. **Never Log Plaintext**: Never log sensitive data before encryption
2. **Encrypt at Rest**: Encrypt all sensitive data before storing in database
3. **Decrypt on Demand**: Only decrypt when needed, don't keep plaintext in memory
4. **Use HTTPS**: Always use HTTPS for data in transit
5. **Audit Access**: Log all encryption/decryption operations

### Password Hashing Best Practices

1. **Never Store Plaintext**: Always hash passwords, never store plaintext
2. **Use Bcrypt**: Don't use MD5, SHA1, or other fast hashing algorithms
3. **Cost Factor**: Use minimum cost factor of 12 (current default)
4. **Rehash on Login**: Check if hash needs rehashing and update if needed
5. **Rate Limiting**: Implement rate limiting on login attempts

## Architecture

### Encryption Flow

```
Plaintext → PBKDF2 Key Derivation → AES-256-GCM Encryption → Encrypted Data
                ↓                           ↓
         Random Salt                  Random IV + Auth Tag
```

### Decryption Flow

```
Encrypted Data → PBKDF2 Key Derivation → AES-256-GCM Decryption → Plaintext
                        ↓                        ↓
                  Stored Salt            Verify Auth Tag
```

### Password Hashing Flow

```
Password → Bcrypt (cost factor 12) → Hash
                ↓
         Random Salt (built-in)
```

## Data Structures

### EncryptedData

```typescript
interface EncryptedData {
  encrypted: string;  // Base64 encoded ciphertext
  iv: string;         // Base64 encoded initialization vector
  authTag: string;    // Base64 encoded authentication tag
  salt: string;       // Base64 encoded salt for key derivation
}
```

## Error Handling

All encryption operations include comprehensive error handling:

- **Invalid Master Key**: Throws error if master key is not 64 hex characters
- **Decryption Failure**: Throws error if data is corrupted or tampered with
- **Empty Password**: Throws error if attempting to hash empty password
- **Invalid Format**: Throws error if encrypted JSON is malformed

## Performance Considerations

### Encryption Performance

- **AES-256-GCM**: Very fast (~100MB/s on modern CPUs)
- **PBKDF2**: Intentionally slow (100,000 iterations) for security
- **Overall**: ~1-2ms per encryption/decryption operation

### Password Hashing Performance

- **Bcrypt**: Intentionally slow (~100-200ms per hash)
- **Cost Factor 12**: ~150ms on modern CPUs
- **Verification**: Same time as hashing (~150ms)

### Recommendations

1. **Cache Decrypted Values**: Don't decrypt on every request
2. **Async Operations**: Use async password hashing to avoid blocking
3. **Connection Pooling**: Reuse encryption service instances
4. **Batch Operations**: Encrypt/decrypt multiple values together when possible

## Testing

See `encryption.example.ts` for comprehensive usage examples.

Run unit tests:
```bash
npm test tests/unit/core/security/encryption.test.ts
```

## Migration Guide

### Encrypting Existing Data

If you have existing unencrypted data in your database:

```typescript
import { getEncryptionService } from './core/security/encryption.js';

async function migrateExistingData() {
  const encryptionService = getEncryptionService();
  
  // Get all unencrypted API keys
  const result = await db.query('SELECT id, api_key FROM config WHERE encrypted = false');
  
  for (const row of result.rows) {
    // Encrypt
    const encrypted = encryptionService.encryptToJson(row.api_key);
    
    // Update database
    await db.query('UPDATE config SET api_key = $1, encrypted = true WHERE id = $2',
      [encrypted, row.id]);
  }
  
  console.log(`Migrated ${result.rows.length} records`);
}
```

### Rotating Master Key

If you need to rotate the master key:

```typescript
async function rotateMasterKey(oldKey: string, newKey: string) {
  const oldService = new EncryptionService(oldKey);
  const newService = new EncryptionService(newKey);
  
  // Get all encrypted data
  const result = await db.query('SELECT id, encrypted_value FROM config');
  
  for (const row of result.rows) {
    // Decrypt with old key
    const plaintext = oldService.decryptFromJson(row.encrypted_value);
    
    // Re-encrypt with new key
    const reencrypted = newService.encryptToJson(plaintext);
    
    // Update database
    await db.query('UPDATE config SET encrypted_value = $1 WHERE id = $2',
      [reencrypted, row.id]);
  }
  
  console.log(`Rotated ${result.rows.length} records`);
}
```

## Troubleshooting

### "Master key must be 64 hex characters"

The master key must be exactly 64 hexadecimal characters (256 bits). Generate a new one:

```typescript
import { generateMasterKey } from './encryption.js';
console.log(generateMasterKey());
```

### "Failed to decrypt data - data may be corrupted or tampered with"

This error occurs when:
1. Using wrong master key
2. Data was corrupted in storage
3. Data was tampered with (authentication tag mismatch)

Verify you're using the correct master key and the data hasn't been modified.

### "Encryption service not initialized"

Call `initializeEncryption()` at application startup before using singleton instances.

## References

- [AES-GCM Specification](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [PBKDF2 Specification](https://tools.ietf.org/html/rfc2898)
- [Bcrypt Specification](https://en.wikipedia.org/wiki/Bcrypt)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
