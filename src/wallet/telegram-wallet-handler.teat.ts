import { TelegramWalletHandler } from './telegram-wallet-handler';
import { WalletManager } from './wallet-manager';
import { Keypair, Connection } from '@solana/web3.js';

// Mock the entire WalletManager module
jest.mock('./wallet-manager', () => {
  return {
    WalletManager: jest.fn().mockImplementation(() => ({
      generateWallet: jest.fn(),
      importFromMnemonic: jest.fn(),
      importFromPrivateKey: jest.fn(),
      getBalance: jest.fn(),
      getKeypair: jest.fn(),
    })),
  };
});

describe('TelegramWalletHandler', () => {
  let handler: TelegramWalletHandler;
  const testUserId = 12345;
  const mockRpcUrl = 'https://test-rpc-url.com';
  const mockPublicKey = 'mockPublicKey123';
  const mockPrivateKey = 'mockPrivateKey123';
  const mockMnemonic = 'mock mnemonic phrase with twelve words';
  const mockBalance = 1.2345;
  let mockWalletManager: jest.Mocked<WalletManager>;

  beforeEach(() => {
    handler = new TelegramWalletHandler(mockRpcUrl);
    
    mockWalletManager = (WalletManager as jest.Mock).mock.results[0].value;
    
    mockWalletManager.generateWallet.mockResolvedValue({
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
      mnemonic: mockMnemonic,
    });

    mockWalletManager.importFromMnemonic.mockResolvedValue({
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
      mnemonic: mockMnemonic,
    });

    mockWalletManager.importFromPrivateKey.mockResolvedValue({
      publicKey: mockPublicKey,
      privateKey: mockPrivateKey,
      mnemonic: mockMnemonic,
    });

    mockWalletManager.getBalance.mockResolvedValue(mockBalance);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create a new instance with default RPC URL when none provided', () => {
      const defaultHandler = new TelegramWalletHandler();
      expect(defaultHandler).toBeInstanceOf(TelegramWalletHandler);
      expect(WalletManager).toHaveBeenCalledWith(undefined);
    });

    it('should create a new instance with custom RPC URL', () => {
      expect(handler).toBeInstanceOf(TelegramWalletHandler);
      expect(WalletManager).toHaveBeenCalledWith(mockRpcUrl);
    });
  });

  describe('handleGenerateWallet', () => {
    it('should generate a new wallet and store it for the user', async () => {
      const result = await handler.handleGenerateWallet(testUserId);

      expect(mockWalletManager.generateWallet).toHaveBeenCalled();
      expect(result).toContain('🎉 New wallet generated!');
      expect(result).toContain(mockPublicKey);
      expect(result).toContain(mockPrivateKey);
      expect(result).toContain(mockMnemonic);
    });

    it('should return error message when wallet generation fails', async () => {
      const errorMessage = 'Failed to generate keypair';
      mockWalletManager.generateWallet.mockRejectedValue(new Error(errorMessage));

      const result = await handler.handleGenerateWallet(testUserId);

      expect(result).toContain('❌ Failed to generate wallet');
      expect(result).toContain(errorMessage);
    });
  });

  describe('handleImportMnemonic', () => {
    it('should import wallet from mnemonic and store it for the user', async () => {
      const result = await handler.handleImportMnemonic(testUserId, mockMnemonic);

      expect(mockWalletManager.importFromMnemonic).toHaveBeenCalledWith(mockMnemonic);
      expect(mockWalletManager.getBalance).toHaveBeenCalledWith(mockPublicKey);
      expect(result).toContain('✅ Wallet imported successfully!');
      expect(result).toContain(mockPublicKey);
      expect(result).toContain(mockBalance.toFixed(4));
    });

    it('should return error message when mnemonic import fails', async () => {
      const errorMessage = 'Invalid mnemonic phrase';
      mockWalletManager.importFromMnemonic.mockRejectedValue(new Error(errorMessage));

      const result = await handler.handleImportMnemonic(testUserId, 'invalid mnemonic');

      expect(result).toContain('❌ Failed to import wallet');
      expect(result).toContain(errorMessage);
    });
  });

  describe('handleImportPrivateKey', () => {
    it('should import wallet from private key and store it for the user', async () => {
      const result = await handler.handleImportPrivateKey(testUserId, mockPrivateKey);

      expect(mockWalletManager.importFromPrivateKey).toHaveBeenCalledWith(mockPrivateKey);
      expect(mockWalletManager.getBalance).toHaveBeenCalledWith(mockPublicKey);
      expect(result).toContain('✅ Wallet imported successfully!');
      expect(result).toContain(mockPublicKey);
      expect(result).toContain(mockBalance.toFixed(4));
    });

    it('should return error message when private key import fails', async () => {
      const errorMessage = 'Invalid private key';
      mockWalletManager.importFromPrivateKey.mockRejectedValue(new Error(errorMessage));

      const result = await handler.handleImportPrivateKey(testUserId, 'invalid private key');

      expect(result).toContain('❌ Failed to import wallet');
      expect(result).toContain(errorMessage);
    });
  });

  describe('handleWalletInfo', () => {
    it('should return wallet info when wallet exists', async () => {
      // First generate a wallet for the user
      await handler.handleGenerateWallet(testUserId);

      const result = await handler.handleWalletInfo(testUserId);

      expect(mockWalletManager.getBalance).toHaveBeenCalledWith(mockPublicKey);
      expect(result).toContain('💼 Your Wallet Info:');
      expect(result).toContain(mockPublicKey);
      expect(result).toContain(mockBalance.toFixed(4));
      expect(result).toContain(mockPrivateKey);
    });

    it('should return error message when no wallet exists for user', async () => {
      const result = await handler.handleWalletInfo(testUserId);

      expect(result).toBe('❌ No wallet found. Please generate or import a wallet first.');
    });

    it('should return error message when balance check fails', async () => {
      // First generate a wallet for the user
      await handler.handleGenerateWallet(testUserId);

      const errorMessage = 'RPC connection failed';
      mockWalletManager.getBalance.mockRejectedValue(new Error(errorMessage));

      const result = await handler.handleWalletInfo(testUserId);

      expect(result).toContain('❌ Failed to get wallet info');
      expect(result).toContain(errorMessage);
    });
  });

  describe('getUserWallet', () => {
    it('should return undefined when no wallet exists for user', () => {
      const wallet = handler.getUserWallet(testUserId);
      expect(wallet).toBeUndefined();
    });

    it('should return wallet info when wallet exists', async () => {
      await handler.handleGenerateWallet(testUserId);
      const wallet = handler.getUserWallet(testUserId);

      expect(wallet).toBeDefined();
      expect(wallet?.publicKey).toBe(mockPublicKey);
      expect(wallet?.privateKey).toBe(mockPrivateKey);
      expect(wallet?.mnemonic).toBe(mockMnemonic);
    });
  });

  describe('getUserKeypair', () => {
    it('should return undefined when no wallet exists for user', () => {
      const keypair = handler.getUserKeypair(testUserId);
      expect(keypair).toBeUndefined();
    });

    it('should return keypair when wallet exists', async () => {
      const mockKeypair = {} as Keypair;
      mockWalletManager.getKeypair.mockReturnValue(mockKeypair);

      await handler.handleGenerateWallet(testUserId);
      const keypair = handler.getUserKeypair(testUserId);

      expect(keypair).toBe(mockKeypair);
      expect(mockWalletManager.getKeypair).toHaveBeenCalledWith({
        publicKey: mockPublicKey,
        privateKey: mockPrivateKey,
        mnemonic: mockMnemonic,
      });
    });
  });
});
