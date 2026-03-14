const crypto = require('crypto');

/**
 * Generate a deterministic, unique, enterprise-policy-compliant credential
 * for seed/demo accounts. Each account key produces a different credential.
 *
 * Policy: min 12 chars, uppercase + lowercase + digit + special character.
 *
 * This is used ONLY for seeding demo/test data. Production accounts must
 * set their own passwords through the registration or password-change flow.
 *
 * @param {string} accountKey - Unique key identifying the account (e.g. 'lo1', 'admin')
 * @returns {string} A compliant credential string
 */
function generateSeedCredential(accountKey) {
  // Derive a deterministic hash from the account key + a fixed domain separator
  const domain = 'republic-finance-los-seed-v1';
  const hash = crypto.createHmac('sha256', domain).update(accountKey).digest('hex');

  // Build parts from the hash to ensure policy compliance
  const upper = String.fromCharCode(65 + (parseInt(hash.slice(0, 2), 16) % 26)); // A-Z
  const lower = String.fromCharCode(97 + (parseInt(hash.slice(2, 4), 16) % 26)); // a-z
  const digit = String(parseInt(hash.slice(4, 6), 16) % 10);                      // 0-9
  const specials = '!@#$%&*';
  const special = specials[parseInt(hash.slice(6, 8), 16) % specials.length];

  // Use a portion of the hex hash for the remaining characters, mixed case
  const body = hash.slice(8, 16).split('').map((ch, i) => {
    return i % 2 === 0 ? ch.toUpperCase() : ch;
  }).join('');

  // Assemble: guaranteed upper + lower + digit + special + 8-char body = 12+ chars
  return `${upper}${lower}${digit}${special}${body}`;
}

/**
 * Get all seed account credentials as a map of accountKey -> credential.
 * Useful for displaying in frontend demo login or documentation.
 *
 * @returns {Object} Map of account keys to their generated credentials
 */
function getAllSeedCredentials() {
  const keys = [
    'lo1', 'lo2', 'lo3', 'lo4', 'lo5', 'lo6', 'lo7', 'lo8', 'lo9', 'lo10',
    'uw1', 'uw2', 'uw3',
    'bm1', 'bm2', 'bm3', 'bm4', 'bm5',
    'compliance', 'admin', 'exec',
    'b1', 'b2', 'b3', 'b4', 'b5',
  ];
  const credentials = {};
  for (const key of keys) {
    credentials[key] = generateSeedCredential(key);
  }
  return credentials;
}

module.exports = { generateSeedCredential, getAllSeedCredentials };
