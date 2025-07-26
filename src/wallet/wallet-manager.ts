import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';
import { WalletModel } from './model';
import { encrypt } from '../util/encrypt-decrypt';
import { PASSWORD } from '../util/constants';
import { Types } from 'mongoose';
import { Client, createClient } from '../client';
import { address, assertIsAddress, createKeyPairFromPrivateKeyBytes, generateKeyPair, lamports } from '@solana/kit';
import { GenerateError } from '../errors/generate.error';
import { GetBalanceError } from '../errors/get-balance.error';
import { ExportKeyError } from '../errors/export-key.error';

export interface WalletInfo {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  mnemonic?: string;
  balance?: number;
}

export class WalletManager {
  private client: Promise<Client>;

  constructor() {
    this.client  = createClient();
  }

  async generateWallet(): Promise<WalletInfo> {
    try {

      const mnemonic = bip39.generateMnemonic();
      
      return this.keypairFromMnemonic(mnemonic).then(({ privateKey, publicKey }) => {
        return new Promise((resolve, reject) => {
          const walletInfo: WalletInfo = {
            publicKey,
            privateKey,
            mnemonic
          };
          resolve(walletInfo);
        })
      });
      
    } catch (error) {
      throw new GenerateError(`Failed to generate wallet: ${error}`);
    }
  }

  async importFromMnemonic(mnemonic: string): Promise<WalletInfo> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      const { privateKey, publicKey } = await this.keypairFromMnemonic(mnemonic);

      const walletInfo: WalletInfo = {
        publicKey,
        privateKey,
        mnemonic,
      };

      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to import from mnemonic: ${error}`);
    }
  }

  async importFromPrivateKey(privateKey: string): Promise<WalletInfo> {
    try {
      let keypair: CryptoKeyPair;

      if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
        // Array format: [1,2,3,...]
        let keyArray = JSON.parse(privateKey);
        keyArray = this.processKey(keyArray);
        keypair = await createKeyPairFromPrivateKeyBytes(new Uint8Array(keyArray), true);
      } else if (privateKey.length === 64) {
        // Hex format
        const keyBytes = Buffer.from(privateKey, 'hex');
        keypair = await createKeyPairFromPrivateKeyBytes(new Uint8Array(keyBytes), true);
      } else {
        // Base58 format
        const keyBytes = bs58.decode(privateKey);
        keypair = await createKeyPairFromPrivateKeyBytes(new Uint8Array(keyBytes), true);
      }

      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey
      };

      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to import from private key: ${error}`);
    }
  }

  private processKey(buffer: number[]) {

    if (buffer.length === 32) {
      return buffer;
    } else if (buffer.length > 32) {
      // Likely a PKCS#8 encoded key; strip the prefix, keep the last 32 bytes
      return buffer.slice(-32);
    } else {
      throw new Error("Key is too short. Expected at least 32 bytes.");
    }
  }


  async getBalance(publicKey: string): Promise<bigint> {
    return Promise.resolve(this.client)
      .then(client => {
        if (this.isValidAddress(publicKey)) {
          
          const pubKey = address(publicKey);
          console.log(pubKey);
          return client.rpc.getBalance(pubKey).send();
        } else {
          throw new GetBalanceError('Invalid address provided', { cause: 'INVALID_ADDRESS' });
        }
      })
      .then(({ value }) => {
        console.log(value);
        return value.valueOf() / 1_000_000_000n;
      })
      .catch(err => {
        const error = err as Error;
        console.error(error.message);
        throw new GetBalanceError('Failed to get balance', { cause: error });
      });
  }


  async exportKeyPair(wallet: WalletInfo): Promise<[string, string]> {

    try {
      const exportedPublicKey = await crypto.subtle.exportKey("spki", wallet.publicKey);
      const exportedPrivateKey = await crypto.subtle.exportKey("pkcs8", wallet.privateKey);

      const publicKeyBs58 = bs58.encode(new Uint8Array(exportedPublicKey.slice(12)));
      const privateKeyBs58 = bs58.encode(new Uint8Array(exportedPrivateKey.slice(16)));

      console.log(" Public Key (bs58):", publicKeyBs58);
      console.log(" Private Key (bs58):", privateKeyBs58);

      return [privateKeyBs58, publicKeyBs58];
    } catch (err) {
      const error = err as Error;
      console.error("Error exporting keys:", err);
      throw new ExportKeyError("Failed to export keypair: " + error.message);
    }
  }

  isValidAddress(address: string): boolean {
    try {
      assertIsAddress(address);
      return true;
    } catch {
      return false;
    }
  }

  private keypairFromMnemonic(mnemonic: string): Promise<CryptoKeyPair> {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    return createKeyPairFromPrivateKeyBytes(derivedSeed, true);
  }

  async store (wallet: WalletInfo, userId: number): Promise<Types.ObjectId> {
    const [privateKey, publicKey] = await this.exportKeyPair(wallet);
    const secretKey = (await encrypt(privateKey, PASSWORD)).toString('base64');
    const encryptedMnemonic = wallet.mnemonic && (await encrypt(wallet.mnemonic, PASSWORD)).toString('base64');

    
    console.log(publicKey, address(publicKey));
    
    const newWallet = await WalletModel.createAndSave({
      userId, address: publicKey,
      encryptedPrivateKey: secretKey,
      encryptedMnemonic
    });

    return newWallet._id;

  }

  async retrieve (userId: number) {
    return WalletModel.findByUserId(userId);
  }

  async importEd25519PrivateKey(rawPrivateKey: number[]): Promise<CryptoKey> {
    if (rawPrivateKey.length !== 32) {
      throw new Error("Ed25519 private key must be 32 bytes.");
    }

    // PKCS#8 prefix for Ed25519 private key
    const pkcs8Prefix = new Uint8Array([
      0x30, 0x2e,
      0x02, 0x01, 0x00,
      0x30, 0x05,
      0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22,
      0x04, 0x20
    ]);

    const pkcs8Key = new Uint8Array(pkcs8Prefix.length + rawPrivateKey.length);
    pkcs8Key.set(pkcs8Prefix);
    pkcs8Key.set(rawPrivateKey, pkcs8Prefix.length);

    const algorithm = { name: "Ed25519" };

    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      pkcs8Key.buffer,
      algorithm,
      true,
      ["sign"]
    );

    return privateKey;
  }

  async importEd25519PublicKey (rawPublicKey: number[]): Promise<CryptoKey> {
    if(rawPublicKey.length !== 32) {
      throw new Error("Ed25519 public key must be 32 bytes.");
    }
    
    //spki prefix for Ed25519
    const spkiPrefix = new Uint8Array([
      0x30, 0x2a,
      0x30, 0x05,
      0x06, 0x03, 0x2b, 0x65, 0x70,
      0x03, 0x21, 0x00
    ]);

    const spkiKey = new Uint8Array(spkiPrefix.length + rawPublicKey.length);
    spkiKey.set(spkiPrefix);
    spkiKey.set(rawPublicKey, spkiPrefix.length);
    
    const algorithm = { name: "Ed25519" };

    const publicKey = await crypto.subtle.importKey(
      "spki",
      spkiKey.buffer,
      algorithm,
      true,
      ["verify"]
    );

    return publicKey;
  }

}
