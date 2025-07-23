import { 
  Connection, 
  Keypair, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  clusterApiUrl 
} from '@solana/web3.js';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import bs58 from 'bs58';
import { WalletModel } from './model';
import { encrypt } from '../util/encrypt-decrypt';
import { PASSWORD } from '../util/constants';
import { Types } from 'mongoose';

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
  mnemonic?: string;
  balance?: number;
}

export class WalletManager {
  private _connection: Connection;

  constructor(rpcUrl?: string) {
    this._connection = new Connection(
      rpcUrl || clusterApiUrl('mainnet-beta'),
      'confirmed'
    );
  }

  async generateWallet(): Promise<WalletInfo> {
    try {
      const mnemonic = bip39.generateMnemonic();
      
      const keypair = this.keypairFromMnemonic(mnemonic);
      
      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
        mnemonic: mnemonic
      };

      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to generate wallet: ${error}`);
    }
  }

  async importFromMnemonic(mnemonic: string): Promise<WalletInfo> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error('Invalid mnemonic phrase');
      }

      const keypair = this.keypairFromMnemonic(mnemonic);

      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey),
        mnemonic: mnemonic
      };

      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to import from mnemonic: ${error}`);
    }
  }

  async importFromPrivateKey(privateKey: string): Promise<WalletInfo> {
    try {
      let keypair: Keypair;

      if (privateKey.startsWith('[') && privateKey.endsWith(']')) {
        // Array format: [1,2,3,...]
        const keyArray = JSON.parse(privateKey);
        keypair = Keypair.fromSecretKey(new Uint8Array(keyArray));
      } else if (privateKey.length === 128) {
        // Hex format
        const keyBytes = Buffer.from(privateKey, 'hex');
        keypair = Keypair.fromSecretKey(keyBytes);
      } else {
        // Base58 format
        const keyBytes = bs58.decode(privateKey);
        keypair = Keypair.fromSecretKey(keyBytes);
      }

      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey.toBase58(),
        privateKey: bs58.encode(keypair.secretKey)
      };

      return walletInfo;
    } catch (error) {
      throw new Error(`Failed to import from private key: ${error}`);
    }
  }

  async getBalance(publicKey: string): Promise<number> {
    try {
      const pubKey = new PublicKey(publicKey);
      const balance = await this._connection.getBalance(pubKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      throw new Error(`Failed to get balance: ${error}`);
    }
  }

  getKeypair(walletInfo: WalletInfo): Keypair {
    try {
      const secretKey = bs58.decode(walletInfo.privateKey);
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      throw new Error(`Failed to create keypair: ${error}`);
    }
  }

  isValidAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  private keypairFromMnemonic(mnemonic: string): Keypair {
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString('hex')).key;
    return Keypair.fromSeed(derivedSeed);
  }

  setRpcEndpoint(rpcUrl: string): void {
    this._connection = new Connection(rpcUrl, 'confirmed');
  }

  async store (wallet: WalletInfo, userId: number): Promise<Types.ObjectId> {
    const secretKey = (await encrypt(wallet.privateKey, PASSWORD)).toString('base64');
    const encryptedMnemonic = wallet.mnemonic && (await encrypt(wallet.mnemonic, PASSWORD)).toString('base64');
    
    const newWallet = await WalletModel.createAndSave({
      userId, address: wallet.publicKey,
      encryptedPrivateKey: secretKey,
      encryptedMnemonic
    });

    return newWallet._id;

  }

  async retrieve (userId: number) {
    return WalletModel.findByUserId(userId);
  }

  get connection() {
    return this.connection;
  }

  set connection(value: Connection) {
    this.connection = value;
  }
}
