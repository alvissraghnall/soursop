import { WalletManager, WalletInfo } from './wallet-manager';
import * as bip39 from 'bip39';

describe('WalletManager Integration Tests', () => {
  let walletManager: WalletManager;
  let testWallet: WalletInfo;

  const VALID_MNEMONIC = 'pill tomorrow foster begin walnut borrow virtual kick shift mutual shoe scatter';
  const VALID_MNEMONIC_PUBLIC_KEY = '5F86TNSTre3CYwZd1wELsGQGhqG2HkN3d8zxhbyBSnzm';

  beforeAll(async () => {

    walletManager = new WalletManager();

    testWallet = await walletManager.generateWallet();
  });

  describe('Wallet Generation', () => {
    test('should generate a new wallet successfully with valid properties', async () => {
      const wallet = await walletManager.generateWallet();

      expect(wallet).toHaveProperty('publicKey');
      expect(wallet.publicKey).toBeInstanceOf(CryptoKey);
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet.privateKey).toBeInstanceOf(CryptoKey);
      expect(wallet).toHaveProperty('mnemonic');
      expect(typeof wallet.mnemonic).toBe('string');

      expect(bip39.validateMnemonic(wallet.mnemonic!)).toBe(true);

      const [, publicKeyBs58] = await walletManager.exportKeyPair(wallet);
      expect(walletManager.isValidAddress(publicKeyBs58)).toBe(true);
    });

    test('should generate unique wallets on each call', async () => {
      const wallet1 = await walletManager.generateWallet();
      const wallet2 = await walletManager.generateWallet();

      const [, pubKey1] = await walletManager.exportKeyPair(wallet1);
      const [, pubKey2] = await walletManager.exportKeyPair(wallet2);

      expect(pubKey1).not.toBe(pubKey2);
      expect(wallet1.mnemonic).not.toBe(wallet2.mnemonic);
    });
  });

  describe('Mnemonic Import', () => {
    test('should import a wallet correctly from a valid mnemonic', async () => {
      const wallet = await walletManager.importFromMnemonic(VALID_MNEMONIC);
      const [, publicKeyBs58] = await walletManager.exportKeyPair(wallet);

      expect(wallet.mnemonic).toBe(VALID_MNEMONIC);
      expect(publicKeyBs58).toBe(VALID_MNEMONIC_PUBLIC_KEY);
    });

    test('should generate consistent wallets from the same mnemonic', async () => {
      const wallet1 = await walletManager.importFromMnemonic(VALID_MNEMONIC);
      const wallet2 = await walletManager.importFromMnemonic(VALID_MNEMONIC);

      const [, pubKey1] = await walletManager.exportKeyPair(wallet1);
      const [, pubKey2] = await walletManager.exportKeyPair(wallet2);

      expect(pubKey1).toBe(pubKey2);
    });

    test('should reject an invalid mnemonic phrase', async () => {
      await expect(walletManager.importFromMnemonic('invalid mnemonic phrase')).rejects.toThrow('Failed to import from mnemonic');
    });

    test('should reject an empty mnemonic', async () => {
      await expect(walletManager.importFromMnemonic('')).rejects.toThrow('Failed to import from mnemonic');
    });
  });

  describe('Private Key Import', () => {
    test('should import wallet from a Base58 private key', async () => {
      const originalWallet = await walletManager.generateWallet();
      const [privKeyBs58, pubKeyBs58] = await walletManager.exportKeyPair(originalWallet);

      const importedWallet = await walletManager.importFromPrivateKey(privKeyBs58);
      const [, importedPubKey] = await walletManager.exportKeyPair(importedWallet);

      expect(importedPubKey).toBe(pubKeyBs58);
      expect(importedWallet.mnemonic).toBeUndefined();
    });

    test('should import wallet from a hex private key', async () => {
      const originalWallet = await walletManager.generateWallet();
      const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', originalWallet.privateKey);

      const hexKey = Buffer.from(privateKeyPkcs8).subarray(16).toString('hex');

      const importedWallet = await walletManager.importFromPrivateKey(hexKey);
      const [, importedPubKey] = await walletManager.exportKeyPair(importedWallet);
      const [, originalPubKey] = await walletManager.exportKeyPair(originalWallet);

      expect(importedPubKey).toBe(originalPubKey);
    });

    test('should import wallet from an array format private key', async () => {
      const originalWallet = await walletManager.generateWallet();
      const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', originalWallet.privateKey);

      const arrayKey = JSON.stringify(Array.from(new Uint8Array(privateKeyPkcs8)));

      const importedWallet = await walletManager.importFromPrivateKey(arrayKey);
      const [, importedPubKey] = await walletManager.exportKeyPair(importedWallet);
      const [, originalPubKey] = await walletManager.exportKeyPair(originalWallet);

      expect(importedPubKey).toBe(originalPubKey);
    });

    test('should reject an invalid private key format', async () => {
      await expect(walletManager.importFromPrivateKey('this-is-not-a-valid-key')).rejects.toThrow('Failed to import from private key');
    });

    test('should reject a malformed (too short) array private key', async () => {
      await expect(walletManager.importFromPrivateKey('[1,2,3]')).rejects.toThrow('Key is too short');
    });
  });

  describe('Balance Operations', () => {
    test('should get balance for a valid public key', async () => {
      const [, pubKeyBs58] = await walletManager.exportKeyPair(testWallet);
      const balance = await walletManager.getBalance(pubKeyBs58);

      expect(typeof balance).toBe('bigint');
      expect(balance).toBeGreaterThanOrEqual(0n);
    });

    test('should return 0 balance for a new wallet', async () => {
      const newWallet = await walletManager.generateWallet();
      const [, pubKeyBs58] = await walletManager.exportKeyPair(newWallet);
      const balance = await walletManager.getBalance(pubKeyBs58);

      expect(balance).toBe(0n);
    });

    test('should throw an error when checking balance for an invalid address', async () => {
      await expect(walletManager.getBalance('invalid-solana-address')).rejects.toThrow('Failed to get balance');
    });
  });

  describe('Address Validation', () => {
    test('should correctly validate a valid Solana address', async () => {
      const [, pubKeyBs58] = await walletManager.exportKeyPair(testWallet);
      expect(walletManager.isValidAddress(pubKeyBs58)).toBe(true);
    });

    test('should reject an invalid Solana address', () => {
      expect(walletManager.isValidAddress('invalid-address')).toBe(false);
      expect(walletManager.isValidAddress('12345')).toBe(false);
      expect(walletManager.isValidAddress('')).toBe(false);
    });
  });
});
