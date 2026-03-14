const crypto = require('crypto');

/**
 * Enterprise-grade field-level encryption using AES-256-GCM.
 * Provides authenticated encryption with associated data (AEAD) for PII fields
 * such as SSN, date of birth, account numbers, and routing numbers.
 *
 * Key management: The encryption key is derived from an environment variable
 * using PBKDF2 with a static salt. In production, use a dedicated KMS (e.g., AWS KMS,
 * HashiCorp Vault) for key storage and rotation.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit authentication tag
const SALT = 'republic-finance-los-kdf-salt-v1'; // Static salt for key derivation
const KEY_ITERATIONS = 100000; // PBKDF2 iterations

let _derivedKey = null;

/**
 * Derive a 256-bit encryption key from the configured secret using PBKDF2.
 * Caches the derived key for performance.
 */
function getDerivedKey() {
  if (_derivedKey) return _derivedKey;
  const secret = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-encryption-key-change-in-production';
  _derivedKey = crypto.pbkdf2Sync(secret, SALT, KEY_ITERATIONS, 32, 'sha512');
  return _derivedKey;
}

/**
 * Encrypt a plaintext value using AES-256-GCM.
 * Returns a base64-encoded string in the format: iv:authTag:ciphertext
 *
 * @param {string} plaintext - The value to encrypt
 * @returns {string} Encrypted value (base64-encoded iv:authTag:ciphertext)
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return plaintext;
  const text = String(plaintext);

  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  // Format: base64(iv):base64(authTag):base64(ciphertext)
  return `enc:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted value.
 *
 * @param {string} encryptedValue - The encrypted string (enc:iv:authTag:ciphertext)
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedValue) {
  if (!encryptedValue || !String(encryptedValue).startsWith('enc:')) return encryptedValue;

  const parts = String(encryptedValue).split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted value format');
  }

  const [, ivB64, authTagB64, ciphertext] = parts;
  const key = getDerivedKey();
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Check if a value is already encrypted.
 *
 * @param {string} value - The value to check
 * @returns {boolean} True if the value appears to be encrypted
 */
function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith('enc:');
}

/**
 * Hash a value using SHA-256 for non-reversible storage (e.g., SSN hash for lookup).
 *
 * @param {string} value - The value to hash
 * @param {string} [pepper] - Optional pepper for additional security
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashValue(value, pepper = '') {
  if (!value) return null;
  const secret = process.env.HASH_PEPPER || 'republic-finance-hash-pepper-v1';
  return crypto.createHmac('sha256', secret + pepper).update(String(value)).digest('hex');
}

/**
 * Mask sensitive data for display/logging purposes.
 * Shows only the last N characters, replacing the rest with asterisks.
 *
 * @param {string} value - The value to mask
 * @param {number} [visibleChars=4] - Number of trailing characters to show
 * @param {string} [maskChar='*'] - Character to use for masking
 * @returns {string} Masked value
 */
function maskSensitive(value, visibleChars = 4, maskChar = '*') {
  if (!value) return value;
  const str = String(value);
  if (str.length <= visibleChars) return maskChar.repeat(str.length);
  return maskChar.repeat(str.length - visibleChars) + str.slice(-visibleChars);
}

/**
 * Mask an email address for display (e.g., j***@example.com).
 *
 * @param {string} email - The email to mask
 * @returns {string} Masked email
 */
function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local.slice(-1)}@${domain}`;
}

/**
 * Encrypt multiple fields on an object in place.
 *
 * @param {Object} obj - The object to encrypt fields on
 * @param {string[]} fields - Array of field names to encrypt
 * @returns {Object} The object with encrypted fields
 */
function encryptFields(obj, fields) {
  if (!obj) return obj;
  for (const field of fields) {
    if (obj[field] !== null && obj[field] !== undefined && !isEncrypted(obj[field])) {
      obj[field] = encrypt(String(obj[field]));
    }
  }
  return obj;
}

/**
 * Decrypt multiple fields on an object in place.
 *
 * @param {Object} obj - The object to decrypt fields on
 * @param {string[]} fields - Array of field names to decrypt
 * @returns {Object} The object with decrypted fields
 */
function decryptFields(obj, fields) {
  if (!obj) return obj;
  for (const field of fields) {
    if (obj[field] && isEncrypted(obj[field])) {
      try {
        obj[field] = decrypt(obj[field]);
      } catch (err) {
        // If decryption fails, leave the value as-is (may be plaintext from before encryption was enabled)
        console.error(`Failed to decrypt field ${field}:`, err.message);
      }
    }
  }
  return obj;
}

/**
 * Mask multiple fields on an object for safe API response.
 *
 * @param {Object} obj - The object to mask fields on
 * @param {Object} fieldConfig - Map of field names to visible character count
 * @returns {Object} New object with masked fields
 */
function maskFields(obj, fieldConfig) {
  if (!obj) return obj;
  const masked = { ...obj };
  for (const [field, visibleChars] of Object.entries(fieldConfig)) {
    if (masked[field]) {
      // Decrypt first if encrypted, then mask
      let value = masked[field];
      if (isEncrypted(value)) {
        try {
          value = decrypt(value);
        } catch (err) {
          // Leave as-is if decryption fails
        }
      }
      masked[field] = maskSensitive(value, visibleChars);
    }
  }
  return masked;
}

/**
 * Generate a cryptographically secure random token.
 *
 * @param {number} [bytes=32] - Number of random bytes
 * @returns {string} Hex-encoded random token
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Generate a unique request ID for tracing.
 *
 * @returns {string} UUID-format request ID
 */
function generateRequestId() {
  return crypto.randomUUID();
}

// Clear cached key (for testing or key rotation)
function clearKeyCache() {
  _derivedKey = null;
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  hashValue,
  maskSensitive,
  encryptFields,
  decryptFields,
  maskFields,
  generateSecureToken,
  generateRequestId,
  clearKeyCache,
};
