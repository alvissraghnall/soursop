import { WalletManager, WalletInfo } from './wallet-manager';
import { TelegramWalletHandler } from './telegram-wallet-handler';
import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import * as bip39 from 'bip39';
import bs58 from 'bs58';

describe('WalletManager Tests', () => {
  let walletManager: WalletManager;
  let testWallet: WalletInfo;
  
  const VALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const DEVNET_RPC = clusterApiUrl('devnet');
  const INVALID_MNEMONIC = 'invalid mnemonic phrase';
  
  beforeAll(async () => {
    walletManager = new WalletManager(DEVNET_RPC);
    testWallet = await walletManager.generateWallet();
  });

  describe('Constructor and Configuration', () => {
    test('should initialize with default mainnet-beta RPC', () => {
      const defaultManager = new WalletManager();
      expect(defaultManager).toBeInstanceOf(WalletManager);
    });

    test('should initialize with custom RPC URL', () => {
      const customManager = new WalletManager(DEVNET_RPC);
      expect(customManager).toBeInstanceOf(WalletManager);
    });

    test('should set RPC endpoint', () => {
      const manager = new WalletManager();
      expect(() => manager.setRpcEndpoint(DEVNET_RPC)).not.toThrow();
    });

    test('should handle invalid RPC URL gracefully', () => {
      expect(() => new WalletManager('invalid-url')).toThrow();
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

describe('TelegramWalletHandler Tests', () => {
  let handler: TelegramWalletHandler;
  const TEST_USER_ID = 12345;
  const TEST_USER_ID_2 = 67890;
  const VALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  
  beforeAll(() => {
    handler = new TelegramWalletHandler(clusterApiUrl('devnet'));
  });

  describe('Constructor', () => {
    test('should initialize with default RPC', () => {
      const defaultHandler = new TelegramWalletHandler();
      expect(defaultHandler).toBeInstanceOf(TelegramWalletHandler);
    });

    test('should initialize with custom RPC', () => {
      const customHandler = new TelegramWalletHandler(clusterApiUrl('testnet'));
      expect(customHandler).toBeInstanceOf(TelegramWalletHandler);
    });
  });

  describe('Wallet Generation', () => {

    test('should store wallet in user map', async () => {
      await handler.handleGenerateWallet(TEST_USER_ID_2);
      const wallet = handler.getUserWallet(TEST_USER_ID_2);
      
      expect(wallet).toBeDefined();
      expect(wallet!.publicKey).toBeDefined();
      expect(wallet!.privateKey).toBeDefined();
      expect(wallet!.mnemonic).toBeDefined();
    });

    test('should generate unique wallets for different users', async () => {
      const user1Id = 111;
      const user2Id = 222;
      
      await handler.handleGenerateWallet(user1Id);
      await handler.handleGenerateWallet(user2Id);
      
      const wallet1 = handler.getUserWallet(user1Id);
      const wallet2 = handler.getUserWallet(user2Id);
      
      expect(wallet1).toBeDefined();
      expect(wallet2).toBeDefined();
      expect(wallet1!.publicKey).not.toBe(wallet2!.publicKey);
    });
  });

  describe('Mnemonic Import', () => {
    test('should import wallet from valid mnemonic', async () => {
      const response = await handler.handleImportMnemonic(TEST_USER_ID, VALID_MNEMONIC);
      
      expect(response).toContain('✅ Wallet imported successfully!');
      expect(response).toContain('Address:');
      expect(response).toContain('Balance:');
      expect(response).toContain('SOL');
    });

    test('should store imported wallet', async () => {
      const userId = 333;
      await handler.handleImportMnemonic(userId, VALID_MNEMONIC);
      const wallet = handler.getUserWallet(userId);
      
      expect(wallet).toBeDefined();
      expect(wallet!.mnemonic).toBe(VALID_MNEMONIC);
    });

    test('should handle invalid mnemonic gracefully', async () => {
      const response = await handler.handleImportMnemonic(TEST_USER_ID, 'invalid mnemonic');
      
      expect(response).toContain('❌ Failed to import wallet:');
    });

    test('should overwrite existing wallet', async () => {
      const userId = 444;
      await handler.handleGenerateWallet(userId);
      const originalWallet = handler.getUserWallet(userId);
      
      await handler.handleImportMnemonic(userId, VALID_MNEMONIC);
      const newWallet = handler.getUserWallet(userId);
      
      expect(newWallet!.publicKey).not.toBe(originalWallet!.publicKey);
      expect(newWallet!.mnemonic).toBe(VALID_MNEMONIC);
    });
  });

  describe('Private Key Import', () => {
    test('should import wallet from private key', async () => {
      await handler.handleGenerateWallet(999);
      const tempWallet = handler.getUserWallet(999);
      
      const response = await handler.handleImportPrivateKey(TEST_USER_ID, tempWallet!.privateKey);
      
      expect(response).toContain('✅ Wallet imported successfully!');
      expect(response).toContain('Address:');
      expect(response).toContain('Balance:');
    });

    test('should handle invalid private key', async () => {
      const response = await handler.handleImportPrivateKey(TEST_USER_ID, 'invalid-key');
      
      expect(response).toContain('❌ Failed to import wallet:');
    });
  });

  describe('Wallet Info', () => {
    test('should return wallet info for existing user', async () => {
      const userId = 555;
      await handler.handleGenerateWallet(userId);
      
      const response = await handler.handleWalletInfo(userId);
      
      expect(response).toContain('💼 Your Wallet Info:');
      expect(response).toContain('Address:');
      expect(response).toContain('Balance:');
      expect(response).toContain('Private Key:');
    });

    test('should handle user without wallet', async () => {
      const response = await handler.handleWalletInfo(999999);
      
      expect(response).toBe('❌ No wallet found. Please generate or import a wallet first.');
    });

    test('should format balance correctly', async () => {
      const userId = 666;
      await handler.handleGenerateWallet(userId);
      
      const response = await handler.handleWalletInfo(userId);
      
      expect(response).toMatch(/Balance: \d+\.\d{4} SOL/);
    });
  });

  describe('User Management', () => {
    test('should return undefined for non-existent user wallet', () => {
      const wallet = handler.getUserWallet(999999);
      expect(wallet).toBeUndefined();
    });

    test('should return undefined for non-existent user keypair', () => {
      const keypair = handler.getUserKeypair(999999);
      expect(keypair).toBeUndefined();
    });

    test('should return valid keypair for existing user', async () => {
      const userId = 777;
      await handler.handleGenerateWallet(userId);
      
      const keypair = handler.getUserKeypair(userId);
      const wallet = handler.getUserWallet(userId);
      
      expect(keypair).toBeDefined();
      expect(keypair!.publicKey.toBase58()).toBe(wallet!.publicKey);
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors gracefully', async () => {
      const faultyHandler = new TelegramWalletHandler('http://invalid-rpc-url');
      const response = await faultyHandler.handleWalletInfo(TEST_USER_ID);
      
      expect(typeof response).toBe('string');
    });

    test('should maintain user isolation', async () => {
      const user1 = 1001;
      const user2 = 1002;
      
      await handler.handleGenerateWallet(user1);
      await handler.handleGenerateWallet(user2);
      
      const wallet1 = handler.getUserWallet(user1);
      const wallet2 = handler.getUserWallet(user2);
      
      expect(wallet1!.publicKey).not.toBe(wallet2!.publicKey);
      expect(wallet1!.privateKey).not.toBe(wallet2!.privateKey);
    });
  });

  describe('Message Formatting', () => {
    test('should format generation response correctly', async () => {
      const response = await handler.handleGenerateWallet(1111);
      
      expect(response).toContain('🎉');
      expect(response).toContain('📍');
      expect(response).toContain('🔑');
      expect(response).toContain('📝');
      expect(response).toContain('⚠️');
      expect(response).toContain('`');
    });

    test('should format import response correctly', async () => {
      const response = await handler.handleImportMnemonic(2222, VALID_MNEMONIC);
      
      expect(response).toContain('✅');
      expect(response).toContain('📍');
      expect(response).toContain('💰');
      expect(response).toContain('`');
    });

    test('should format info response correctly', async () => {
      const userId = 3333;
      await handler.handleGenerateWallet(userId);
      const response = await handler.handleWalletInfo(userId);
      
      expect(response).toContain('💼');
      expect(response).toContain('📍');
      expect(response).toContain('💰');
      expect(response).toContain('🔑');
      expect(response).toContain('`');
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
