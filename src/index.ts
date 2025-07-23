import { Telegraf } from 'telegraf';
import { connectDB } from './db';
import { getRequiredEnv } from './util/env-helper';
import { WalletManager } from './wallet/wallet-manager';
import { handleGenerateCommand, handleImportCommand, sendHelpMessage, sendWelcomeMessage } from './commands/wallet';

const bot = new Telegraf(getRequiredEnv("BOT_TOKEN"));

const userStates = new Map();

connectDB();

bot.start(sendWelcomeMessage);

bot.help(sendHelpMessage);

bot.command('generate', handleGenerateCommand);

bot.command('import', (ctx) => handleImportCommand(ctx, userStates));

bot.on('text', async (ctx, next) => {
  const userId = ctx.from.id;
  const userState = userStates.get(userId);

  console.log(ctx.from);

  if (userState === 'awaiting_import') {
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
      let err = error as Error;
      await ctx.reply(`❌ Error importing wallet: ${err.message}`);
    } finally {
      userStates.delete(userId);
    }
    return;
  }

  return next();
});

bot.launch();

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
