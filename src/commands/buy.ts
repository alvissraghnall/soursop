import { Scenes, Telegraf } from "telegraf";
import { getTokenInfo, getTokenMetadata } from "../swap/jupiter";
import { WalletInfo, WalletManager } from "../wallet/wallet-manager";
import { getJupiterQuote, executeSwap } from "../swap/jupiter";
import { Message } from "telegraf/typings/core/types/typegram";

const { enter, leave } = Scenes.Stage;

interface BuySession extends Scenes.WizardSessionData {
  tokenAddress?: string;
  amount?: bigint;
  wallet: WalletInfo;
  tokenMetadata?: { name: string; symbol: string; decimals: number };
}

interface BuyWizardSession extends Scenes.WizardSession<BuySession> {
  tokenAddress?: string;
  amount?: bigint;
  wallet: WalletInfo;
  tokenMetadata?: { name: string; symbol: string; decimals: number };
}

type BuyContext = Scenes.WizardContext<BuySession> & {
  session: BuyWizardSession;
};

const buyWizard = new Scenes.WizardScene<BuyContext>(
  "BUY_WIZARD",
  async (ctx) => {
    await ctx.reply("🪙 Please send the token address you want to **buy**.");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const message = ctx.message as Message.TextMessage;
    const input = message?.text?.trim();

    if (!input) {
      return ctx.reply("❌ Please provide a valid token address.");
    }

    const tokenAddress = input;

    try {
      const tokenInfo = await getTokenInfo(tokenAddress);
      if (!tokenInfo.isInitialized) {
        return ctx.reply("❌ Invalid token address. Please try again.");
      }

      const metadata = await getTokenMetadata(tokenAddress);

      if (!metadata) {
        return ctx.reply("❌ No token found for address provided.");
      }

      ctx.session.tokenAddress = tokenAddress;
      ctx.session.tokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: tokenInfo.decimals,
      };

      await ctx.reply(
        `✅ Token found: ${metadata.name} (${metadata.symbol})\nNow enter amount to buy (e.g. 1.5):`,
      );
      return ctx.wizard.next();
    } catch (error) {
      console.error("Error fetching token info:", error);
      return ctx.reply(
        "❌ Error fetching token information. Please try again.",
      );
    }
  },
  async (ctx) => {
    const message = ctx.message as Message.TextMessage;
    const input = message?.text?.trim();

    if (!input) {
      return ctx.reply("❌ Please enter a valid amount.");
    }

    const amount = parseFloat(input);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply(
        "❌ Invalid amount. Enter a numeric value greater than 0.",
      );
    }

    const { tokenMetadata } = ctx.session;
    if (!tokenMetadata) {
      return ctx.reply("❌ Token information not found. Please start over.");
    }

    const amountRaw = BigInt(Math.floor(amount * 10 ** tokenMetadata.decimals));
    ctx.session.amount = amountRaw;

    const userId = ctx.message?.from.id;

    if (!userId)
      return ctx.reply(
        "No associated user wallet found! Please generate or import a wallet to continue.",
      );

    let walletManager = new WalletManager();
    let defaultWallet = await walletManager.retrieveAndConstructDefault(userId);

    try {
      const solBalance = await walletManager.getBalance(
        defaultWallet.address ?? "0",
      );

      const estimatedFee = BigInt(0.002 * 1e9);

      if (solBalance < estimatedFee) {
        await ctx.reply("❌ Insufficient SOL for network fees.");
        return ctx.scene.leave();
      }

      await ctx.reply(
        `🛒 You are about to buy *${amount} ${tokenMetadata.symbol}*.\nEstimated fee: 0.002 SOL.\nType "yes" to confirm or "cancel" to abort.`,
        { parse_mode: "Markdown" },
      );
      return ctx.wizard.next();
    } catch (error) {
      console.error("Error checking balance:", error);
      return ctx.reply("❌ Error checking wallet balance. Please try again.");
    }
  },
  async (ctx) => {
    const message = ctx.message as Message.TextMessage;
    const input = message?.text?.toLowerCase().trim();
    const userId = ctx.message?.from.id;

    if (!userId)
      return ctx.reply(
        "No associated user wallet found! Please generate or import a wallet to continue.",
      );

    let walletManager = new WalletManager();
    let defaultWallet = await walletManager.retrieveAndConstructDefault(userId);

    if (!input) {
      return ctx.reply('Please type "yes" to confirm or "cancel" to abort.');
    }

    if (input === "cancel") {
      await ctx.reply("❎ Buy cancelled.");
      return ctx.scene.leave();
    }

    if (input !== "yes") {
      return ctx.reply('Please type "yes" to confirm or "cancel" to abort.');
    }

    const { tokenAddress, amount, tokenMetadata } = ctx.session;

    if (!tokenAddress || !amount || !tokenMetadata) {
      await ctx.reply("❌ Missing transaction information. Please start over.");
      return ctx.scene.leave();
    }

    try {
      const quote = await getQuote({
        outputMint: tokenAddress,
        amount,
        direction: "buy",
      });

      const swapInstructions = await quote.getSwapInstructions();

      const txSig = await executeSwap(defaultWallet, swapInstructions);

      await ctx.reply(`✅ Swap completed!\n🔗 Transaction: ${txSig}`);
    } catch (err) {
      console.error("Swap error:", err);
      await ctx.reply(
        `⚠️ Error during swap: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    }

    return ctx.scene.leave();
  },
);

export { buyWizard };
