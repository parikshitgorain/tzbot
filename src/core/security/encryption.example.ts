/**
 * Encryption Service Usage Examples
 * 
 * This file demonstrates how to use the encryption utilities for:
 * - AES-256-GCM encryption for API keys and tokens
 * - Bcrypt password hashing
 */

import {
  EncryptionService,
  PasswordHashingService,
  generateMasterKey,
  initializeEncryption,
  getEncryptionService,
  getPasswordHashingService,
} from './encryption.js';

/**
 * Example 1: Generate a master key (do this once, store in environment)
 */
function example1_GenerateMasterKey() {
  console.log('=== Example 1: Generate Master Key ===');
  
  const masterKey = generateMasterKey();
  console.log('Generated master key (store this in .env as ENCRYPTION_MASTER_KEY):');
  console.log(masterKey);
  console.log('Length:', masterKey.length, 'characters (64 hex = 256 bits)');
  console.log();
}

/**
 * Example 2: Initialize encryption service
 */
function example2_InitializeService() {
  console.log('=== Example 2: Initialize Encryption Service ===');
  
  // In production, load from environment variable
  const masterKey = process.env.ENCRYPTION_MASTER_KEY || generateMasterKey();
  
  // Initialize singleton instances
  initializeEncryption(masterKey);
  
  console.log('Encryption service initialized');
  console.log();
}

/**
 * Example 3: Encrypt and decrypt API keys
 */
async function example3_EncryptApiKeys() {
  console.log('=== Example 3: Encrypt API Keys ===');
  
  const masterKey = generateMasterKey();
  const encryptionService = new EncryptionService(masterKey);
  
  // Encrypt sensitive API keys
  const discordToken = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAuAbCdEf.GhIjKlMnOpQrStUvWxYz123456789';
  const kickApiKey = 'kick_api_key_1234567890abcdef';
  const googleApiKey = 'AIzaSyD1234567890abcdefghijklmnopqrstuv';
  
  console.log('Original Discord token:', discordToken);
  
  // Encrypt
  const encryptedDiscord = encryptionService.encrypt(discordToken);
  console.log('Encrypted Discord token:', JSON.stringify(encryptedDiscord, null, 2));
  
  // Decrypt
  const decryptedDiscord = encryptionService.decrypt(encryptedDiscord);
  console.log('Decrypted Discord token:', decryptedDiscord);
  console.log('Match:', discordToken === decryptedDiscord);
  console.log();
  
  // Encrypt multiple keys
  encryptionService.encrypt(kickApiKey);
  encryptionService.encrypt(googleApiKey);
  
  console.log('All keys encrypted successfully');
  console.log();
}

/**
 * Example 4: Store encrypted data in database
 */
async function example4_DatabaseStorage() {
  console.log('=== Example 4: Database Storage ===');
  
  const masterKey = generateMasterKey();
  const encryptionService = new EncryptionService(masterKey);
  
  const apiKey = 'super_secret_api_key_12345';
  
  // Encrypt and serialize to JSON for database storage
  const encryptedJson = encryptionService.encryptToJson(apiKey);
  console.log('Encrypted JSON for database:', encryptedJson);
  
  // Simulate database storage
  const storedInDatabase = encryptedJson;
  
  // Retrieve and decrypt from database
  const decryptedApiKey = encryptionService.decryptFromJson(storedInDatabase);
  console.log('Decrypted from database:', decryptedApiKey);
  console.log('Match:', apiKey === decryptedApiKey);
  console.log();
}

/**
 * Example 5: Password hashing with bcrypt
 */
async function example5_PasswordHashing() {
  console.log('=== Example 5: Password Hashing ===');
  
  const passwordService = new PasswordHashingService();
  
  const password = 'MySecurePassword123!';
  console.log('Original password:', password);
  
  // Hash password
  const hash = await passwordService.hashPassword(password);
  console.log('Bcrypt hash:', hash);
  console.log('Hash length:', hash.length);
  
  // Verify correct password
  const isValid = await passwordService.verifyPassword(password, hash);
  console.log('Correct password verification:', isValid);
  
  // Verify incorrect password
  const isInvalid = await passwordService.verifyPassword('WrongPassword', hash);
  console.log('Incorrect password verification:', isInvalid);
  
  // Check if rehash needed
  const needsRehash = passwordService.needsRehash(hash);
  console.log('Needs rehash:', needsRehash);
  console.log();
}

/**
 * Example 6: Using singleton instances
 */
async function example6_SingletonUsage() {
  console.log('=== Example 6: Singleton Usage ===');
  
  // Initialize once at application startup
  const masterKey = generateMasterKey();
  initializeEncryption(masterKey);
  
  // Use throughout application
  const encryptionService = getEncryptionService();
  const passwordService = getPasswordHashingService();
  
  // Encrypt API key
  const apiKey = 'my_api_key_12345';
  const encrypted = encryptionService.encrypt(apiKey);
  console.log('Encrypted API key:', encrypted.encrypted.substring(0, 20) + '...');
  
  // Hash password
  const password = 'UserPassword123!';
  const hash = await passwordService.hashPassword(password);
  console.log('Password hash:', hash.substring(0, 20) + '...');
  
  console.log('Singleton instances work correctly');
  console.log();
}

/**
 * Example 7: Secure configuration storage
 */
async function example7_SecureConfiguration() {
  console.log('=== Example 7: Secure Configuration Storage ===');
  
  const masterKey = generateMasterKey();
  const encryptionService = new EncryptionService(masterKey);
  
  // Configuration with sensitive data
  const config = {
    discordToken: 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAuAbCdEf.GhIjKlMnOpQrStUvWxYz123456789',
    kickApiKey: 'kick_api_key_1234567890abcdef',
    googleSafeBrowsingKey: 'AIzaSyD1234567890abcdefghijklmnopqrstuv',
    webhookSecret: 'webhook_secret_abcdef123456',
  };
  
  // Encrypt each sensitive field
  const encryptedConfig = {
    discordToken: encryptionService.encryptToJson(config.discordToken),
    kickApiKey: encryptionService.encryptToJson(config.kickApiKey),
    googleSafeBrowsingKey: encryptionService.encryptToJson(config.googleSafeBrowsingKey),
    webhookSecret: encryptionService.encryptToJson(config.webhookSecret),
  };
  
  console.log('Encrypted configuration (ready for database storage):');
  console.log(JSON.stringify(encryptedConfig, null, 2));
  console.log();
  
  // Decrypt when needed
  const decryptedDiscordToken = encryptionService.decryptFromJson(
    encryptedConfig.discordToken
  );
  console.log('Decrypted Discord token:', decryptedDiscordToken);
  console.log('Match:', config.discordToken === decryptedDiscordToken);
  console.log();
}

/**
 * Example 8: Error handling
 */
async function example8_ErrorHandling() {
  console.log('=== Example 8: Error Handling ===');
  
  const masterKey = generateMasterKey();
  const encryptionService = new EncryptionService(masterKey);
  
  try {
    // Try to decrypt with wrong master key
    const encrypted = encryptionService.encrypt('test data');
    
    const wrongMasterKey = generateMasterKey();
    const wrongService = new EncryptionService(wrongMasterKey);
    
    wrongService.decrypt(encrypted);
  } catch (error) {
    console.log('Expected error caught:', (error as Error).message);
  }
  
  try {
    // Try to decrypt corrupted data
    const corruptedData = {
      encrypted: 'corrupted',
      iv: 'corrupted',
      authTag: 'corrupted',
      salt: 'corrupted',
    };
    
    encryptionService.decrypt(corruptedData);
  } catch (error) {
    console.log('Expected error caught:', (error as Error).message);
  }
  
  const passwordService = new PasswordHashingService();
  
  try {
    // Try to hash empty password
    await passwordService.hashPassword('');
  } catch (error) {
    console.log('Expected error caught:', (error as Error).message);
  }
  
  console.log('Error handling works correctly');
  console.log();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  console.log('ENCRYPTION SERVICE EXAMPLES\n');
  
  example1_GenerateMasterKey();
  example2_InitializeService();
  await example3_EncryptApiKeys();
  await example4_DatabaseStorage();
  await example5_PasswordHashing();
  await example6_SingletonUsage();
  await example7_SecureConfiguration();
  await example8_ErrorHandling();
  
  console.log('All examples completed successfully!');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}

export {
  example1_GenerateMasterKey,
  example2_InitializeService,
  example3_EncryptApiKeys,
  example4_DatabaseStorage,
  example5_PasswordHashing,
  example6_SingletonUsage,
  example7_SecureConfiguration,
  example8_ErrorHandling,
};
