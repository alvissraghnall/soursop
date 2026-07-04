import * as bip39 from "bip39";
import { derivePath } from "ed25519-hd-key";
import bs58 from "bs58";
import { WalletModel } from "./model";
import { decrypt, encrypt } from "../util/encrypt-decrypt";
import { PASSWORD } from "../util/constants";
import { Types } from "mongoose";
import { Client, createClient } from "../client";
import {
  address,
  assertIsAddress,
  createKeyPairFromPrivateKeyBytes,
  generateKeyPair,
  lamports,
} from "@solana/kit";
import { GenerateError } from "../errors/generate.error";
import { GetBalanceError } from "../errors/get-balance.error";
import { ExportKeyError } from "../errors/export-key.error";
import { logger } from "../util/logger";

export interface WalletInfo {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  mnemonic?: string;
  balance?: number;
  default?: boolean;
  address?: string;
}

export class WalletManager {
  private client: Promise<Client>;

  constructor() {
    this.client = createClient();
  }

  async generateWallet(): Promise<WalletInfo> {
    try {
      const mnemonic = bip39.generateMnemonic();

      return this.keypairFromMnemonic(mnemonic).then(
        ({ privateKey, publicKey }) => {
          return new Promise((resolve, reject) => {
            const walletInfo: WalletInfo = {
              publicKey,
              privateKey,
              mnemonic,
            };
            resolve(walletInfo);
          });
        },
      );
    } catch (error) {
      throw new GenerateError(`Failed to generate wallet: ${error}`);
    }
  }

  async importFromMnemonic(mnemonic: string): Promise<WalletInfo> {
    try {
      if (!bip39.validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic phrase");
      }

      const { privateKey, publicKey } =
        await this.keypairFromMnemonic(mnemonic);

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

      if (privateKey.startsWith("[") && privateKey.endsWith("]")) {
        // Array format: [1,2,3,...]
        let keyArray = JSON.parse(privateKey);
        keyArray = this.processKey(keyArray);
        keypair = await createKeyPairFromPrivateKeyBytes(
          new Uint8Array(keyArray),
          true,
        );
      } else if (privateKey.length === 64) {
        // Hex format
        const keyBytes = Buffer.from(privateKey, "hex");
        keypair = await createKeyPairFromPrivateKeyBytes(
          new Uint8Array(keyBytes),
          true,
        );
      } else {
        // Base58 format
        const keyBytes = bs58.decode(privateKey);
        keypair = await createKeyPairFromPrivateKeyBytes(
          new Uint8Array(keyBytes),
          true,
        );
      }

      const walletInfo: WalletInfo = {
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
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
      .then((client) => {
        if (this.isValidAddress(publicKey)) {
          const pubKey = address(publicKey);
          return client.rpc.getBalance(pubKey).send();
        } else {
          throw new GetBalanceError("Invalid address provided", {
            cause: "INVALID_ADDRESS",
          });
        }
      })
      .then(({ value }) => {
        return value.valueOf() / 1_000_000_000n;
      })
      .catch((err) => {
        const error = err as Error;
        logger.error(error, "Failed to get balance");
        throw new GetBalanceError("Failed to get balance", { cause: error });
      });
  }

  async exportKeyPair(wallet: WalletInfo): Promise<[string, string]> {
    try {
      const exportedPublicKey = await crypto.subtle.exportKey(
        "spki",
        wallet.publicKey,
      );
      const exportedPrivateKey = await crypto.subtle.exportKey(
        "pkcs8",
        wallet.privateKey,
      );

      const publicKeyBs58 = bs58.encode(
        new Uint8Array(exportedPublicKey.slice(12)),
      );
      const privateKeyBs58 = bs58.encode(
        new Uint8Array(exportedPrivateKey.slice(16)),
      );

      logger.debug(
        { publicKey: publicKeyBs58, privateKey: privateKeyBs58 },
        "Exported keypair",
      );

      return [privateKeyBs58, publicKeyBs58];
    } catch (err) {
      const error = err as Error;
      logger.error(error, "Error exporting keys");
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
    const derivedSeed = derivePath(
      "m/44'/501'/0'/0'",
      seed.toString("hex"),
    ).key;
    return createKeyPairFromPrivateKeyBytes(derivedSeed, true);
  }

  async store(
    wallet: WalletInfo,
    userId: number,
  ): Promise<ReturnType<(typeof WalletModel)["createAndSave"]>> {
    const [privateKey, publicKey] = await this.exportKeyPair(wallet);
    const secretKey = (await encrypt(privateKey, PASSWORD)).toString("base64");
    const encryptedMnemonic =
      wallet.mnemonic &&
      (await encrypt(wallet.mnemonic, PASSWORD)).toString("base64");

    const newWallet = await WalletModel.createAndSave({
      userId,
      address: publicKey,
      encryptedPrivateKey: secretKey,
      encryptedMnemonic,
    });

    if (!newWallet) throw new Error("Wallet store failed!");

    return newWallet;
  }

  async retrieve(userId: number) {
    return WalletModel.find({ userId }).sort({ default: -1 }).limit(100).exec(); // -1 for descending (default first)
  }

  async reconstructWalletInfo(
    walletFromDb:
      | Awaited<ReturnType<WalletManager["retrieve"]>>[number]
      | Awaited<ReturnType<(typeof WalletModel)["findOne"]>>,
  ): Promise<WalletInfo> {
    const privKeyB58 = (
      await decrypt(
        Buffer.from(walletFromDb.encryptedPrivateKey, "base64"),
        PASSWORD,
      )
    ).toString();

    const walletAsCryptoKeys = await this.importFromPrivateKey(privKeyB58);

    let mnemonic: string | undefined = undefined;
    if (walletFromDb.encryptedMnemonic) {
      mnemonic = (
        await decrypt(
          Buffer.from(walletFromDb.encryptedMnemonic, "base64"),
          PASSWORD,
        )
      ).toString();
    }

    const walletInfo: WalletInfo = {
      mnemonic,
      address: walletFromDb.address,
      default: walletFromDb.default || false,
      ...walletAsCryptoKeys,
    };

    return walletInfo;
  }

  async retrieveAndConstruct(userId: number): Promise<WalletInfo[]> {
    const walletsFromDb = await this.retrieve(userId);

    const reconstructedWallets = await Promise.all(
      walletsFromDb.map((wallet) => this.reconstructWalletInfo(wallet)),
    );

    return reconstructedWallets;
  }

  async retrieveAndConstructDefault(
    userId: number,
  ): Promise<WalletInfo | null> {
    const walletFromDb = await WalletModel.findOne({
      userId,
      default: true,
    }).exec();

    if (!walletFromDb) return null;

    return this.reconstructWalletInfo(walletFromDb);
  }

  async importEd25519PrivateKey(rawPrivateKey: number[]): Promise<CryptoKey> {
    if (rawPrivateKey.length !== 32) {
      throw new Error("Ed25519 private key must be 32 bytes.");
    }

    // PKCS#8 prefix for Ed25519 private key
    const pkcs8Prefix = new Uint8Array([
      0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70,
      0x04, 0x22, 0x04, 0x20,
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
      ["sign"],
    );

    return privateKey;
  }

  async importEd25519PublicKey(rawPublicKey: number[]): Promise<CryptoKey> {
    if (rawPublicKey.length !== 32) {
      throw new Error("Ed25519 public key must be 32 bytes.");
    }

    //spki prefix for Ed25519
    const spkiPrefix = new Uint8Array([
      0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
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
      ["verify"],
    );

    return publicKey;
  }
}
