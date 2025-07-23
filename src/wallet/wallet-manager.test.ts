import { WalletManager, WalletInfo } from './wallet-manager';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import * as bip39 from 'bip39';

jest.mock('@solana/web3.js', () => {
  const actual = jest.requireActual('@solana/web3.js');
  return {
    ...actual,
    Connection: jest.fn().mockImplementation(() => ({
      getBalance: jest.fn().mockResolvedValue(2 * actual.LAMPORTS_PER_SOL),
    })),
  };
});

describe('WalletManager', () => {
  let walletManager: WalletManager;

  beforeEach(() => {
    walletManager = new WalletManager('https://api.devnet.solana.com');
  });

  describe('generateWallet', () => {
    it('should generate a wallet with valid keys and mnemonic', async () => {
      const wallet: WalletInfo = await walletManager.generateWallet();

      expect(wallet.publicKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
      expect(wallet.privateKey).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,88}$/);
      expect(wallet.mnemonic?.split(' ')).toHaveLength(12);
    });

    it('should throw on failure', async () => {
      jest.spyOn(bip39, 'generateMnemonic').mockImplementationOnce(() => {
        throw new Error('fail');
      });

      await expect(walletManager.generateWallet()).rejects.toThrow(
        'Failed to generate wallet'
      );
    });
  });

  describe('importFromMnemonic', () => {
    it('should import a wallet from a valid mnemonic', async () => {
      const mnemonic = bip39.generateMnemonic();
      const wallet = await walletManager.importFromMnemonic(mnemonic);

      expect(wallet.publicKey).toBeDefined();
      expect(wallet.privateKey).toBeDefined();
      expect(wallet.mnemonic).toEqual(mnemonic);
    });

    it('should throw an error for invalid mnemonic', async () => {
      await expect(
        walletManager.importFromMnemonic('invalid mnemonic phrase')
      ).rejects.toThrow('Failed to import from mnemonic: Error: Invalid mnemonic phrase');
    });
  });

  describe('importFromPrivateKey', () => {
    it('should import from Base58 private key', async () => {
      const generated = await walletManager.generateWallet();
      const imported = await walletManager.importFromPrivateKey(generated.privateKey);

      expect(imported.publicKey).toEqual(generated.publicKey);
    });

    it('should import from array format private key', async () => {
      const generated = await walletManager.generateWallet();
      const keypair = walletManager.getKeypair(generated);
      const arrayFormat = `[${Array.from(keypair.secretKey)}]`;

      const imported = await walletManager.importFromPrivateKey(arrayFormat);
      expect(imported.publicKey).toEqual(generated.publicKey);
    });

    it('should import from hex format private key', async () => {
      const generated = await walletManager.generateWallet();
      const keypair = walletManager.getKeypair(generated);
      const hex = Buffer.from(keypair.secretKey).toString('hex');

      const imported = await walletManager.importFromPrivateKey(hex);
      expect(imported.publicKey).toEqual(generated.publicKey);
    });

    it('should throw for malformed private key', async () => {
      await expect(walletManager.importFromPrivateKey('badKey')).rejects.toThrow(
        'Failed to import from private key'
      );
    });
  });

  describe('getBalance', () => {
    it('should return correct balance in SOL', async () => {
      const pubKey = (await walletManager.generateWallet()).publicKey;
      const balance = await walletManager.getBalance(pubKey);
      expect(balance).toBe(2);
    });

    it('should throw for invalid public key', async () => {
      await expect(walletManager.getBalance('invalid')).rejects.toThrow(
        'Failed to get balance'
      );
    });
  });

  describe('getKeypair', () => {
    it('should create a Keypair from WalletInfo', async () => {
      const wallet = await walletManager.generateWallet();
      const keypair = walletManager.getKeypair(wallet);

      expect(bs58.encode(keypair.secretKey)).toEqual(wallet.privateKey);
    });

    it('should throw for invalid private key', () => {
      const badWallet = { publicKey: '', privateKey: 'badkey' };
      expect(() => walletManager.getKeypair(badWallet)).toThrow(
        'Failed to create keypair'
      );
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid addresses', async () => {
      const wallet = await walletManager.generateWallet();
      expect(walletManager.isValidAddress(wallet.publicKey)).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(walletManager.isValidAddress('notanaddress')).toBe(false);
    });
  });

  describe('setRpcEndpoint', () => {
    it('should set a new RPC endpoint', () => {
      const spy = jest.spyOn(walletManager as any, 'connection', 'set');
      walletManager.setRpcEndpoint('https://new-rpc');
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
