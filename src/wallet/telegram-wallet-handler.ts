
import { 
  Connection, 
  Keypair, 
} from '@solana/web3.js';
import { WalletInfo, WalletManager } from './wallet-manager';

export class TelegramWalletHandler {
  private walletManager: WalletManager;
  private userWallets: Map<number, WalletInfo> = new Map();

  constructor(rpcUrl?: string) {
    this.walletManager = new WalletManager(rpcUrl);
  }

  async handleGenerateWallet(userId: number): Promise<string> {
    try {
      const wallet = await this.walletManager.generateWallet();
      this.userWallets.set(userId, wallet);

      return `🎉 New wallet generated!
      
📍 Address: \`${wallet.publicKey}\`
🔑 Private Key: \`${wallet.privateKey}\`
📝 Mnemonic: \`${wallet.mnemonic}\`

⚠️ IMPORTANT: Save your private key and mnemonic phrase securely. Never share them with anyone!`;
    } catch (error) {
      return `❌ Failed to generate wallet: ${error}`;
    }
  }

  async handleImportMnemonic(userId: number, mnemonic: string): Promise<string> {
    try {
      const wallet = await this.walletManager.importFromMnemonic(mnemonic);
      this.userWallets.set(userId, wallet);

      const balance = await this.walletManager.getBalance(wallet.publicKey);
      
      return `✅ Wallet imported successfully!
      
📍 Address: \`${wallet.publicKey}\`
💰 Balance: ${balance.toFixed(4)} SOL`;
    } catch (error) {
      return `❌ Failed to import wallet: ${error}`;
    }
  }

  async handleImportPrivateKey(userId: number, privateKey: string): Promise<string> {
    try {
      const wallet = await this.walletManager.importFromPrivateKey(privateKey);
      this.userWallets.set(userId, wallet);

      const balance = await this.walletManager.getBalance(wallet.publicKey);

      return `✅ Wallet imported successfully!
      
📍 Address: \`${wallet.publicKey}\`
💰 Balance: ${balance.toFixed(4)} SOL`;
    } catch (error) {
      return `❌ Failed to import wallet: ${error}`;
    }
  }

  async handleWalletInfo(userId: number): Promise<string> {
    try {
      const wallet = this.userWallets.get(userId);
      if (!wallet) {
        return "❌ No wallet found. Please generate or import a wallet first.";
      }

      const balance = await this.walletManager.getBalance(wallet.publicKey);

      return `💼 Your Wallet Info:
      
📍 Address: \`${wallet.publicKey}\`
💰 Balance: ${balance.toFixed(4)} SOL
🔑 Private Key: \`${wallet.privateKey}\``;
    } catch (error) {
      return `❌ Failed to get wallet info: ${error}`;
    }
  }

  getUserWallet(userId: number): WalletInfo | undefined {
    return this.userWallets.get(userId);
  }

  getUserKeypair(userId: number): Keypair | undefined {
    const wallet = this.userWallets.get(userId);
    if (!wallet) return undefined;
    
    return this.walletManager.getKeypair(wallet);
  }
}
