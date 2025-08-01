import { Scenes, Telegraf } from 'telegraf';
import { getTokenInfo } from '../swap/jupiter';
import { findMetadataPda } from '@metaplex-foundation/mpl-token-metadata';
const { enter, leave } = Scenes.Stage;

interface BuySession extends Scenes.WizardSessionData {
  tokenAddress?: string;
  amount?: bigint;
  tokenInfo?: { name: string; symbol: string; decimals: number };
}



const buyWizard = new Scenes.WizardScene<Scenes.WizardContext & { session: BuySession }>(
  'BUY_WIZARD',
  async (ctx) => {
    await ctx.reply('🪙 Please send the token address you want to **buy**.');
    return ctx.wizard.next();
  },
  async (ctx) => {
    const input = ctx.message?.text?.trim();
    const tokenAddress = input;

    const tokenInfo = await getTokenInfo(tokenAddress);
    findMetadataPda
    if (!tokenInfo.isInitialized) {
      return ctx.reply('❌ Invalid token address. Please try again.');
    }

    ctx.session.tokenAddress = tokenAddress;
    ctx.session.tokenInfo = tokenInfo;

    await ctx.reply(`✅ Token found: ${tokenInfo} (${tokenInfo.name})\nNow enter amount to buy (e.g. 1.5):`);
    return ctx.wizard.next();
  },
  async (ctx) => {
    const input = ctx.message?.text?.trim();
    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Invalid amount. Enter a numeric value greater than 0.');
    }

    const { tokenInfo } = ctx.session;
    const amountRaw = BigInt(amount * 10 ** tokenInfo.decimals);
    ctx.session.amount = amountRaw;

    const wallet = getUserWallet(ctx.from.id);
    const solBalance = await walletManager.getBalance(wallet.publicKey.toBase58());

    const estimatedFee = BigInt(0.002 * 1e9); // Adjust fee estimate

    if (solBalance < estimatedFee) {
      await ctx.reply('❌ Insufficient SOL for network fees.');
      return ctx.scene.leave();
    }

    await ctx.reply(
      `🛒 You are about to buy *${amount} ${tokenInfo.symbol}*.\nEstimated fee: 0.002 SOL.\nType "yes" to confirm or "cancel" to abort.`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },
  async (ctx) => {
    const input = ctx.message?.text?.toLowerCase();
    if (input === 'cancel') {
      await ctx.reply('❎ Buy cancelled.');
      return ctx.scene.leave();
    }

    if (input !== 'yes') {
      return ctx.reply('Please type "yes" to confirm or "cancel" to abort.');
    }

    const wallet = getUserWallet(ctx.from.id);
    const { tokenAddress, amount } = ctx.session;

    try {
      const quote = await getQuote({ outputMint: tokenAddress, amount, direction: 'buy' });
      const swapInstructions = await quote.getSwapInstructions();

      const txSig = await executeSwap(wallet, swapInstructions);

      await ctx.reply(`✅ Swap completed!\n🔗 Transaction: ${txSig}`);
    } catch (err) {
      await ctx.reply(`⚠️ Error during swap: ${err.message}`);
    }

    return ctx.scene.leave();
  }
);
