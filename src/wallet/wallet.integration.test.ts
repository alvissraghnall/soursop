import { WalletManager, WalletInfo } from './wallet-manager';
import * as bip39 from 'bip39';
import bs58 from 'bs58';

describe('WalletManager Tests', () => {
  let walletManager: WalletManager;
  let testWallet: WalletInfo;
  
  const VALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const INVALID_MNEMONIC = 'invalid mnemonic phrase';
  
  beforeAll(async () => {
    walletManager = new WalletManager();
    testWallet = await walletManager.generateWallet();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default RPC', () => {
      const defaultManager = new WalletManager();
      expect(defaultManager).toBeInstanceOf(WalletManager);
    });

  });

  describe('Wallet Generation', () => {
    test('should generate a new wallet successfully', async () => {
      const wallet = await walletManager.generateWallet();
      
      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('mnemonic');
      expect(typeof wallet.publicKey).toBe('string');
      expect(typeof wallet.privateKey).toBe('string');
      expect(typeof wallet.mnemonic).toBe('string');
      expect(wallet.publicKey).toHaveLength(44);
      expect(bip39.validateMnemonic(wallet.mnemonic!)).toBe(true);
    });

    test('should generate unique wallets', async () => {
      const wallet1 = await walletManager.generateWallet();
      const wallet2 = await walletManager.generateWallet();
      
      expect(wallet1.publicKey).not.toBe(wallet2.publicKey);
      expect(wallet1.privateKey).not.toBe(wallet2.privateKey);
      expect(wallet1.mnemonic).not.toBe(wallet2.mnemonic);
    });

    test('should generate valid keypair from generated wallet', async () => {
      const wallet = await walletManager.generateWallet();
      const keypair = walletManager.getKeypair(wallet);
      
      expect(keypair).toBeInstanceOf(Keypair);
      expect(keypair.publicKey.toBase58()).toBe(wallet.publicKey);
    });
  });

  describe('Mnemonic Import', () => {
    test('should import wallet from valid mnemonic', async () => {
      const wallet = await walletManager.importFromMnemonic(VALID_MNEMONIC);
      
      expect(wallet).toHaveProperty('publicKey');
      expect(wallet).toHaveProperty('privateKey');
      expect(wallet).toHaveProperty('mnemonic');
      expect(wallet.mnemonic).toBe(VALID_MNEMONIC);
    });

    test('should reject invalid mnemonic', async () => {
      await expect(walletManager.importFromMnemonic(INVALID_MNEMONIC))
        .rejects.toThrow('Failed to import from mnemonic');
    });

    test('should generate consistent wallet from same mnemonic', async () => {
      const wallet1 = await walletManager.importFromMnemonic(VALID_MNEMONIC);
      const wallet2 = await walletManager.importFromMnemonic(VALID_MNEMONIC);
      
      expect(wallet1.publicKey).toBe(wallet2.publicKey);
      expect(wallet1.privateKey).toBe(wallet2.privateKey);
    });

    test('should reject empty mnemonic', async () => {
      await expect(walletManager.importFromMnemonic(''))
        .rejects.toThrow('Failed to import from mnemonic');
    });
  });

  describe('Private Key Import', () => {
    test('should import wallet from Base58 private key', async () => {
      const originalWallet = await walletManager.generateWallet();
      const importedWallet = await walletManager.importFromPrivateKey(originalWallet.privateKey);
      
      expect(importedWallet.publicKey).toBe(originalWallet.publicKey);
      expect(importedWallet.privateKey).toBe(originalWallet.privateKey);
      expect(importedWallet.mnemonic).toBeUndefined();
    });

    test('should import wallet from hex private key', async () => {
      const keypair = Keypair.generate();
      const hexKey = Buffer.from(keypair.secretKey).toString('hex');
      
      const importedWallet = await walletManager.importFromPrivateKey(hexKey);
      
      expect(importedWallet.publicKey).toBe(keypair.publicKey.toBase58());
    });

    test('should import wallet from array format private key', async () => {
      const keypair = Keypair.generate();
      const arrayKey = JSON.stringify(Array.from(keypair.secretKey));
      
      const importedWallet = await walletManager.importFromPrivateKey(arrayKey);
      
      expect(importedWallet.publicKey).toBe(keypair.publicKey.toBase58());
    });

    test('should reject invalid private key formats', async () => {
      await expect(walletManager.importFromPrivateKey('invalid-key'))
        .rejects.toThrow('Failed to import from private key');
    });

    test('should reject malformed array private key', async () => {
      await expect(walletManager.importFromPrivateKey('[1,2,3]'))
        .rejects.toThrow('Failed to import from private key');
    });
  });

  describe('Balance Operations', () => {
    test('should get balance for valid public key', async () => {
      const balance = await walletManager.getBalance(testWallet.publicKey);
      
      expect(typeof balance).toBe('number');
      expect(balance).toBeGreaterThanOrEqual(0);
    });

    test('should handle invalid public key in balance check', async () => {
      await expect(walletManager.getBalance('invalid-address'))
        .rejects.toThrow('Failed to get balance');
    });

    test('should return 0 balance for new wallet', async () => {
      const newWallet = await walletManager.generateWallet();
      const balance = await walletManager.getBalance(newWallet.publicKey);
      
      expect(balance).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    test('should validate valid Solana addresses', () => {
      expect(walletManager.isValidAddress(testWallet.publicKey)).toBe(true);
    });

    test('should reject invalid addresses', () => {
      expect(walletManager.isValidAddress('invalid')).toBe(false);
      expect(walletManager.isValidAddress('')).toBe(false);
      expect(walletManager.isValidAddress('123')).toBe(false);
    });

    test('should create keypair from wallet info', () => {
      const keypair = walletManager.getKeypair(testWallet);
      
      expect(keypair).toBeInstanceOf(Keypair);
      expect(keypair.publicKey.toBase58()).toBe(testWallet.publicKey);
    });

    test('should handle invalid private key in getKeypair', () => {
      const invalidWallet: WalletInfo = {
        publicKey: testWallet.publicKey,
        privateKey: 'invalid-key'
      };
      
      expect(() => walletManager.getKeypair(invalidWallet))
        .toThrow('Failed to create keypair');
    });
  });

  describe('Connection Management', () => {
    test('should update connection when setting new RPC endpoint', () => {
      const manager = new WalletManager();
      const testnetRpc = clusterApiUrl('testnet');
      
      manager.setRpcEndpoint(testnetRpc);
      expect(manager).toBeInstanceOf(WalletManager);
    });
  });
});


describe('Integration Between WalletManager and TelegramWalletHandler', () => {
  test('should maintain consistency between direct WalletManager and TelegramWalletHandler', async () => {
    const walletManager = new WalletManager(clusterApiUrl('devnet'));
    const handler = new TelegramWalletHandler(clusterApiUrl('devnet'));
    
    const directWallet = await walletManager.generateWallet();
    
    const userId = 9999;
    await handler.handleImportMnemonic(userId, directWallet.mnemonic!);
    const handlerWallet = handler.getUserWallet(userId);
    
    expect(handlerWallet!.publicKey).toBe(directWallet.publicKey);
    expect(handlerWallet!.privateKey).toBe(directWallet.privateKey);
  });

  test('should handle same operations with consistent results', async () => {
    const walletManager = new WalletManager(clusterApiUrl('devnet'));
    const handler = new TelegramWalletHandler(clusterApiUrl('devnet'));
    
    const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    
    const directWallet = await walletManager.importFromMnemonic(MNEMONIC);
    
    const userId = 8888;
    await handler.handleImportMnemonic(userId, MNEMONIC);
    const handlerWallet = handler.getUserWallet(userId);
    
    expect(handlerWallet!.publicKey).toBe(directWallet.publicKey);
    expect(handlerWallet!.privateKey).toBe(directWallet.privateKey);
    expect(handlerWallet!.mnemonic).toBe(directWallet.mnemonic);
  });
});
