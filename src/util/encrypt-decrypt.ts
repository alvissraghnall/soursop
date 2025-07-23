import crypto from 'crypto';
import { getRequiredEnv } from './env-helper';

const algorithm = 'aes-256-gcm';
const password = getRequiredEnv("PASSWORD");

const SALT_LEN = 16;
const IV_LEN = 12;
const AUTH_TAG_LEN = 16;
const KEY_LEN = 32;

export function encrypt(plaintext: string, password: string): Promise<Buffer> {
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, (err, key) => {
      if (err) return reject(err);

      const cipher = crypto.createCipheriv(algorithm, key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final()
      ]);
      const authTag = cipher.getAuthTag();

      const payload = Buffer.concat([salt, iv, authTag, ciphertext]);
      resolve(payload);
    });
  });
}

export function decrypt(encryptedBuffer: Buffer, password: string): Promise<string> {
  const salt = encryptedBuffer.subarray(0, SALT_LEN);
  const iv = encryptedBuffer.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const authTag = encryptedBuffer.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + AUTH_TAG_LEN);
  const ciphertext = encryptedBuffer.subarray(SALT_LEN + IV_LEN + AUTH_TAG_LEN);

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LEN, (err, key) => {
      if (err) return reject(err);

      try {
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        const decrypted = Buffer.concat([
          decipher.update(ciphertext),
          decipher.final()
        ]);
        resolve(decrypted.toString());
      } catch (e) {
        reject(e);
      }
    });
  });
}

