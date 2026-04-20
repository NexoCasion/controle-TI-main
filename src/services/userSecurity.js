const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'enc:v1';

function getUserDataSecret() {
  const secret = String(process.env.USER_DATA_SECRET || process.env.SESSION_SECRET || '').trim();

  if (!secret) {
    throw new Error('SESSION_SECRET ou USER_DATA_SECRET deve estar configurado para proteger os usuarios.');
  }

  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function normalizeLookupValue(value) {
  return String(value || '').trim().toLowerCase();
}

function hashLookupValue(value) {
  return crypto.createHash('sha256').update(normalizeLookupValue(value), 'utf8').digest('hex');
}

function isEncryptedValue(value) {
  return String(value || '').startsWith(`${ENCRYPTION_PREFIX}:`);
}

function encryptUserField(value) {
  const plainText = String(value ?? '').trim();
  if (!plainText) return '';
  if (isEncryptedValue(plainText)) return plainText;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getUserDataSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTION_PREFIX}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptUserField(value) {
  const storedValue = String(value ?? '');
  if (!storedValue) return '';
  if (!isEncryptedValue(storedValue)) return storedValue;

  const [, , ivHex, authTagHex, encryptedHex] = storedValue.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getUserDataSecret(),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = {
  decryptUserField,
  encryptUserField,
  hashLookupValue,
  isEncryptedValue,
  normalizeLookupValue,
};
