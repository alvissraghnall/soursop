import { Context } from 'telegraf';
import { WalletManager } from '../wallet/wallet-manager';
import { UserStates } from '../util/constants';



export function sendWelcomeMessage(ctx: Context) {
  return ctx.reply(`
🚀 Welcome to SourSop — The No-Fee SOL Trading Bot!

Trade Solana (SOL) seamlessly, instantly, and 100% fee-free.
No middlemen. No hidden charges. Just pure trading, swapping and more at lightning speed.

🔐 Secure | ⚡ Fast | 💸 Zero Fees

Type /help to begin trading or explore available commands.
  `);
}

export function sendHelpMessage(ctx: Context) {
  return ctx.reply(
    '📖 Solana Wallet Manager Commands:\n\n' +
    '🆕 /generate - Generate a new Solana wallet\n' +
    '🔑 /import - Import wallet using private key or mnemonic\n' +
    '💰 /balance - Check balance of your wallets\n' +
    '👛 /wallets - View all your stored wallets\n' +
    '⚙️ /settings - Bot settings\n' +
    '❓ /help - Show this help message'
  );
}

export async function handleGenerateCommand(ctx: Context) {
  try {
    const walletManager = new WalletManager();
    const wallet = await walletManager.generateWallet();

    const walletId = ctx.from?.id && await walletManager.store(wallet, ctx.from?.id);

    await ctx.reply(
      '✅ New wallet generated successfully!\n\n' +
      `🏦 Address: \`${wallet.publicKey}\`\n` +
      `🔐 Private Key: \`${wallet.privateKey}\`\n\n` +
      '⚠️ IMPORTANT: Save your mnemonic phrase securely!',
      { parse_mode: 'Markdown' }
    );

    const mnemonicMsg = await ctx.reply(
      `🔐 Your recovery phrase:\n\`${wallet.mnemonic}\`\n\n` +
      '⚠️ This message will be deleted in 60 seconds for security.',
      { parse_mode: 'Markdown' }
    );

    setTimeout(() => {
      ctx.deleteMessage(mnemonicMsg.message_id).catch(() => {});
    }, 60000);

  } catch (error) {
    const err = error as Error;
    await ctx.reply(`❌ Error generating wallet: ${err.message}`);
  }
}

export async function handleImportCommand (ctx: Context, userStates: Map<number, UserStates>) {
  
  await ctx.reply(
    '📥 Please send your wallet secret (mnemonic or private key):\n\n' +
    '⚠️ Make sure you\'re in a private chat!\n\n' +
    '*Mnemonic Example:* `solid prout ... await `\n' +
    '*Private Key Formats:*\n' +
    '• Base58: `5Kb8kLf9zg...`\n' +
    '• Hex: `abcdef123456...`\n' +
    '• Array: `[1,2,3,...]`',
    { parse_mode: 'Markdown' }
  );

  userStates.set(ctx.from?.id ?? -1, UserStates.AWAITING_IMPORT);

}

export async function handleImportWalletTextMessage(ctx: any, next: () => Promise<void>, userStates: Map<number, UserStates>) {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);
 
  console.log(ctx.from);

  if (userState === UserStates.AWAITING_IMPORT) {
    const input = ctx.message.text.trim();
    const walletManager = new WalletManager();

    try {
      let wallet;
      if (/^(\w+\s){11,23}\w+$/.test(input)) {
        wallet = await walletManager.importFromMnemonic(input);
      } else {
        wallet = await walletManager.importFromPrivateKey(input);
      }

      const walletId = await walletManager.store(wallet, userId);

      console.log(walletId);

      await ctx.deleteMessage(ctx.message.message_id);

      await ctx.reply(
        '✅ Wallet imported successfully!\n\n' +
        `🏦 Address: \`${wallet.publicKey}\`\n` +
        `💾 Wallet ID: ${walletId}\n\n` +
        '🔒 Your secret has been encrypted and stored securely.',
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      const err = error as Error;
      await ctx.reply(`❌ Error importing wallet: ${err.message}`);
    } finally {
      userStates.delete(userId);
    }

    return;
  }

  return next();
}
