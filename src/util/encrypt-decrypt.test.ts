import crypto from 'crypto';

import { encrypt, decrypt } from './encrypt-decrypt';

describe('Encryption/Decryption Module', () => {
  const testPassword = 'test-password-123';
  const testPlaintext = 'Hello, World!'; 

  const SALT_LEN = 16;
  const IV_LEN = 12;
  const AUTH_TAG_LEN = 16;
  const KEY_LEN = 32;

  describe('encrypt function', () => {
    it('should encrypt plaintext and return a Buffer', async () => {
      const result = await encrypt(testPlaintext, testPassword);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(SALT_LEN + IV_LEN + AUTH_TAG_LEN);
    });

    it('should produce different outputs for the same input (due to random salt/iv)', async () => {
      const result1 = await encrypt(testPlaintext, testPassword);
      const result2 = await encrypt(testPlaintext, testPassword);
      
      expect(result1).not.toEqual(result2);
      expect(result1.length).toBe(result2.length);
    });

    it('should handle empty string', async () => {
      const result = await encrypt('', testPassword);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(SALT_LEN + IV_LEN + AUTH_TAG_LEN);
    });

    it('should handle unicode characters', async () => {
      const unicodeText = 'Hello 世界 مرحبا';
      const result = await encrypt(unicodeText, testPassword);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(SALT_LEN + IV_LEN + AUTH_TAG_LEN);
    });

    it('should handle long strings', async () => {
      const longText = 'A'.repeat(10000);
      const result = await encrypt(longText, testPassword);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThanOrEqual(SALT_LEN + IV_LEN + AUTH_TAG_LEN + longText.length);
    });

    it('should work with different passwords', async () => {
      const password1 = 'password1';
      const password2 = 'password2';
      
      const result1 = await encrypt(testPlaintext, password1);
      const result2 = await encrypt(testPlaintext, password2);
      
      expect(result1).not.toEqual(result2);
    });

    it('should reject with scrypt errors', async () => {
      const originalScrypt = crypto.scrypt;
      const mockError = new Error('Scrypt error');
      
      crypto.scrypt = jest.fn().mockImplementation((password, salt, keylen, callback) => {
        callback(mockError);
      });

      await expect(encrypt(testPlaintext, testPassword)).rejects.toThrow('Scrypt error');
      
      crypto.scrypt = originalScrypt;
    });
  });

  describe('decrypt function', () => {
    it('should decrypt encrypted data correctly', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should handle empty string encryption/decryption', async () => {
      const encrypted = await encrypt('', testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', async () => {
      const unicodeText = 'Hello 世界 مرحبا';
      const encrypted = await encrypt(unicodeText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(unicodeText);
    });

    it('should handle long strings', async () => {
      const longText = 'A'.repeat(10000);
      const encrypted = await encrypt(longText, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      expect(decrypted).toBe(longText);
    });

    it('should fail with wrong password', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      
      await expect(decrypt(encrypted, 'wrong-password')).rejects.toThrow();
    });

    it('should fail with corrupted salt', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      // Corrupt the salt (first 16 bytes)
      encrypted[0] = encrypted[0] ^ 0xFF;
      
      await expect(decrypt(encrypted, testPassword)).rejects.toThrow();
    });

    it('should fail with corrupted IV', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      // Corrupt the IV (bytes 16-27)
      encrypted[16] = encrypted[16] ^ 0xFF;
      
      await expect(decrypt(encrypted, testPassword)).rejects.toThrow();
    });

    it('should fail with corrupted auth tag', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      // Corrupt the auth tag (bytes 28-43)
      encrypted[28] = encrypted[28] ^ 0xFF;
      
      await expect(decrypt(encrypted, testPassword)).rejects.toThrow();
    });

    it('should fail with corrupted ciphertext', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      // Corrupt the ciphertext (last part)
      const lastIndex = encrypted.length - 1;
      encrypted[lastIndex] = encrypted[lastIndex] ^ 0xFF;
      
      await expect(decrypt(encrypted, testPassword)).rejects.toThrow();
    });

    it('should fail with truncated buffer', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      const truncated = encrypted.subarray(0, SALT_LEN + IV_LEN);
      
      await expect(decrypt(truncated, testPassword)).rejects.toThrow();
    });

    it('should fail with buffer too small for headers', async () => {
      const tooSmall = Buffer.alloc(10);
      
      await expect(decrypt(tooSmall, testPassword)).rejects.toThrow();
    });

    it('should reject with scrypt errors', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      
      const originalScrypt = crypto.scrypt;
      const mockError = new Error('Scrypt error');
      
      crypto.scrypt = jest.fn().mockImplementation((password, salt, keylen, callback) => {
        callback(mockError);
      });

      await expect(decrypt(encrypted, testPassword)).rejects.toThrow('Scrypt error');
      
      crypto.scrypt = originalScrypt;
    });
  });

  describe('Buffer structure validation', () => {
    it('should have correct buffer structure after encryption', async () => {
      const encrypted = await encrypt(testPlaintext, testPassword);
      
      expect(encrypted.length).toBeGreaterThanOrEqual(SALT_LEN + IV_LEN + AUTH_TAG_LEN);
      
      const salt = encrypted.subarray(0, SALT_LEN);
      const iv = encrypted.subarray(SALT_LEN, SALT_LEN + IV_LEN);
      const authTag = encrypted.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + AUTH_TAG_LEN);
      const ciphertext = encrypted.subarray(SALT_LEN + IV_LEN + AUTH_TAG_LEN);
      
      expect(salt.length).toBe(SALT_LEN);
      expect(iv.length).toBe(IV_LEN);
      expect(authTag.length).toBe(AUTH_TAG_LEN);
      expect(ciphertext.length).toBeGreaterThan(0);
    });
  });

  describe('Round-trip tests', () => {
    const testCases = [
      'Simple text',
      '',
      'Unicode test with é 世界',
      'A'.repeat(1000),
      'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
      'Newlines\nand\ttabs',
      JSON.stringify({ nested: { object: 'test', array: [1, 2, 3] } })
    ];

    testCases.forEach((testCase, index) => {
      it(`should successfully encrypt and decrypt test case ${index + 1}`, async () => {
        const encrypted = await encrypt(testCase, testPassword);
        const decrypted = await decrypt(encrypted, testPassword);
        
        expect(decrypted).toBe(testCase);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle very short passwords', async () => {
      const shortPassword = 'a';
      const encrypted = await encrypt(testPlaintext, shortPassword);
      const decrypted = await decrypt(encrypted, shortPassword);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const encrypted = await encrypt(testPlaintext, longPassword);
      const decrypted = await decrypt(encrypted, longPassword);
      
      expect(decrypted).toBe(testPlaintext);
    });

    it('should handle password with special characters', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = await encrypt(testPlaintext, specialPassword);
      const decrypted = await decrypt(encrypted, specialPassword);
      
      expect(decrypted).toBe(testPlaintext);
    });
  });

  describe('Performance tests', () => {
    it('should complete encryption/decryption within reasonable time', async () => {
      const start = Date.now();
      
      const encrypted = await encrypt(testPlaintext, testPassword);
      const decrypted = await decrypt(encrypted, testPassword);
      
      const duration = Date.now() - start;
      
      expect(decrypted).toBe(testPlaintext);
      expect(duration).toBeLessThan(1000);
    });
  });
});
