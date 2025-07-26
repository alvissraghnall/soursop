import { WalletManager, WalletInfo } from './wallet-manager';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { WalletModel } from './model';
import { encrypt } from '../util/encrypt-decrypt';
import { PASSWORD } from '../util/constants';
import { Types } from 'mongoose';
import { isAddress } from '@solana/kit';
import { Client, createClient } from '../client';

jest.mock('../client', () => ({
  createClient: jest.fn().mockReturnValue({
    rpc: {
      getBalance: jest.fn().mockReturnThis(),
      send: jest.fn(),
    },
  }),
}));
jest.mock('./model');
jest.mock('../util/encrypt-decrypt');
jest.mock('../util/constants', () => ({
  PASSWORD: 'test_password',
}));

jest.mock('@solana/kit', () => {
  const actual = jest.requireActual('@solana/kit');
  return {
    ...actual,
    lamports: jest.fn().mockReturnValue(700n),
  };
});

describe('WalletManager', () => {
  let walletManager: WalletManager;
  let client: Client;

  beforeEach(async () => {
    walletManager = new WalletManager();
    client = await createClient();
    jest.clearAllMocks();
  });

  describe('generateWallet', () => {
    it('should generate a wallet with valid keys and mnemonic', async () => {
      const wallet: WalletInfo = await walletManager.generateWallet();

      const publicKeyBuffer = new Uint8Array((await crypto.subtle.exportKey('spki', wallet.publicKey)).slice(12));
      const publicKeyB58 = bs58.encode(publicKeyBuffer);

      expect(walletManager.isValidAddress(publicKeyB58)).toBe(true);
      expect(isAddress(publicKeyB58)).toBe(true);
      expect(wallet.mnemonic?.split(' ')).toHaveLength(12);
      expect(wallet.privateKey).toBeDefined();
    });

    it('should throw on failure', async () => {
      jest.spyOn(bip39, 'generateMnemonic').mockImplementationOnce(() => {
        throw new Error('fail');
      });

      await expect(walletManager.generateWallet()).rejects.toThrow('Failed to generate wallet');
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
      await expect(walletManager.importFromMnemonic('invalid mnemonic phrase')).rejects.toThrow('Failed to import from mnemonic: Error: Invalid mnemonic phrase');
    });
  });

  describe('importFromPrivateKey', () => {
    const compareWallets = async (imported: WalletInfo, generated: WalletInfo) => {
        const [importedPriv, importedPub] = await walletManager.exportKeyPair(imported);
        const [generatedPriv, generatedPub] = await walletManager.exportKeyPair(generated);
        expect(importedPub).toEqual(generatedPub);
        expect(importedPriv).toEqual(generatedPriv);
    };
    
    it('should import from Base58 private key', async () => {
      const generated = await walletManager.generateWallet();
      const [priv] = await walletManager.exportKeyPair(generated);
      const imported = await walletManager.importFromPrivateKey(priv);
      await compareWallets(imported, generated);
    });

    it('should import from array format private key', async () => {
      const generated = await walletManager.generateWallet();
      const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', generated.privateKey);
      const arrayFormat = JSON.stringify(Array.from(new Uint8Array(privateKeyPkcs8)));

      const imported = await walletManager.importFromPrivateKey(arrayFormat);
      await compareWallets(imported, generated);
    });

    it('should import from hex format private key', async () => {
      const generated = await walletManager.generateWallet();
      const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', generated.privateKey);
      const hex = Buffer.from(privateKeyPkcs8).slice(16).toString('hex');
      
      const imported = await walletManager.importFromPrivateKey(hex);
      await compareWallets(imported, generated);
    });

    it('should throw for malformed private key', async () => {
      await expect(walletManager.importFromPrivateKey('badKey')).rejects.toThrow('Failed to import from private key');
    });
  });

  describe('getBalance', () => {
    it('should return correct balance in SOL', async () => {
      const pubKey = (await walletManager.generateWallet()).publicKey;
      const publicKeyBuffer = new Uint8Array((await crypto.subtle.exportKey('spki', pubKey)).slice(12));
      const publicKeyB58 = bs58.encode(publicKeyBuffer);

      const sendMock = jest.fn().mockResolvedValueOnce({ value: 100_000_000_000_000n });
      const getBalanceMock = jest.fn().mockReturnValue({ send: sendMock });
      client.rpc.getBalance = getBalanceMock;

      const balance = await walletManager.getBalance(publicKeyB58);
      expect(getBalanceMock).toHaveBeenCalledTimes(1);
      expect(getBalanceMock).toHaveBeenCalledWith(publicKeyB58);
      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(balance).toEqual(100_000n);
    });

    it('should throw for invalid public key', async () => {
      await expect(walletManager.getBalance('invalid')).rejects.toThrow('Failed to get balance');
    });
  });

  describe('isValidAddress', () => {
    it('should return true for valid addresses', async () => {
      const wallet = await walletManager.generateWallet();
      const [, publicKeyB58] = await walletManager.exportKeyPair(wallet);
      expect(walletManager.isValidAddress(publicKeyB58)).toBe(true);
    });

    it('should return false for invalid addresses', () => {
      expect(walletManager.isValidAddress('notanaddress')).toBe(false);
    });
  });

  describe('exportKeyPair', () => {
    it('should export a valid base58 key pair', async () => {
        const wallet = await walletManager.generateWallet();
        const [privateKeyBs58, publicKeyBs58] = await walletManager.exportKeyPair(wallet);

        expect(typeof privateKeyBs58).toBe('string');
        expect(typeof publicKeyBs58).toBe('string');
        expect(bs58.decode(publicKeyBs58).length).toBe(32);
        expect(bs58.decode(privateKeyBs58).length).toBe(32);
    });

    it('should throw on failure', async () => {
        const wallet = await walletManager.generateWallet();
        jest.spyOn(crypto.subtle, 'exportKey').mockRejectedValueOnce(new Error('crypto failed'));
        await expect(walletManager.exportKeyPair(wallet)).rejects.toThrow('Failed to export keypair: crypto failed');
    });
  });
  
  describe('store', () => {
    it('should encrypt and store the wallet details', async () => {
      const wallet = await walletManager.generateWallet();
      const userId = 123;
      const mockId = new Types.ObjectId();
      const encryptedPrivKey = 'encrypted_private_key';
      const encryptedMnemonic = 'encrypted_mnemonic';

      (encrypt as jest.Mock)
        .mockResolvedValueOnce(Buffer.from(encryptedPrivKey))
        .mockResolvedValueOnce(Buffer.from(encryptedMnemonic));
      (WalletModel.createAndSave as jest.Mock).mockResolvedValue({ _id: mockId });
      
      const [, publicKeyBs58] = await walletManager.exportKeyPair(wallet);
      const result = await walletManager.store(wallet, userId);

      expect(encrypt).toHaveBeenCalledTimes(2);
      expect(WalletModel.createAndSave).toHaveBeenCalledWith({
        userId,
        address: publicKeyBs58,
        encryptedPrivateKey: Buffer.from(encryptedPrivKey).toString('base64'),
        encryptedMnemonic: Buffer.from(encryptedMnemonic).toString('base64'),
      });
      expect(result).toBe(mockId);
    });
  });

  describe('retrieve', () => {
    it('should retrieve a wallet by user ID', async () => {
      const userId = 456;
      const mockWalletData = { userId, address: 'some_address' };
      (WalletModel.findByUserId as jest.Mock).mockResolvedValue(mockWalletData);

      const result = await walletManager.retrieve(userId);

      expect(WalletModel.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toEqual(mockWalletData);
    });
  });

  describe('importEd25519PrivateKey', () => {
    it('should import a valid 32-byte raw private key', async () => {
      const rawPrivateKey = Array.from(new Uint8Array(32).fill(1)); // 32 bytes
      const cryptoKey = await walletManager.importEd25519PrivateKey(rawPrivateKey);
      
      expect(cryptoKey.type).toBe('private');
      expect(cryptoKey.algorithm.name).toBe('Ed25519');
    });

    it('should throw an error if the key is not 32 bytes', async () => {
      const shortKey = [1, 2, 3];
      await expect(walletManager.importEd25519PrivateKey(shortKey)).rejects.toThrow('Ed25519 private key must be 32 bytes.');
    });
  });
  
  describe('importEd25519PublicKey', () => {
    it('should import a valid 32-byte raw public key', async () => {
      const rawPublicKey = Array.from(new Uint8Array(32).fill(2));
      const cryptoKey = await walletManager.importEd25519PublicKey(rawPublicKey);
      
      expect(cryptoKey.type).toBe('public');
      expect(cryptoKey.algorithm.name).toBe('Ed25519');
    });

    it('should throw an error if the key is not 32 bytes', async () => {
      const longKey = Array.from(new Uint8Array(40));
      await expect(walletManager.importEd25519PublicKey(longKey)).rejects.toThrow('Ed25519 public key must be 32 bytes.');
    });
  });
});
