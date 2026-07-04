import { Scenes } from "telegraf";
import {
  getSellQuote,
  getSwapInstructions,
  executeSwap,
  getTokenInfo,
  getTokenMetadata,
} from "../swap/jupiter";
import { WalletManager } from "../wallet/wallet-manager";
import { Message } from "telegraf/typings/core/types/typegram";
import { logger } from "../util/logger";

export interface SellState extends Scenes.WizardSessionData {
  tokenAddress?: string;
  amount?: number;
  tokenMetadata?: { name: string; symbol: string; decimals: number };
}

export type SellContext = Scenes.WizardContext<SellState>;

const sellWizard = new Scenes.WizardScene<SellContext>(
  "SELL_WIZARD",
  async (ctx) => {
    await ctx.reply("🪙 Please send the token address you want to **sell**.");
    return ctx.wizard.next();
  },
  async (ctx) => {
    const message = ctx.message as Message.TextMessage;
    const input = message?.text?.trim();

    if (!input) {
      return ctx.reply("❌ Please provide a valid token address.");
    }

    try {
      const tokenInfo = await getTokenInfo(input);
      if (!tokenInfo.isInitialized) {
        return ctx.reply("❌ Invalid token address. Please try again.");
      }

      const metadata = await getTokenMetadata(input);

      if (!metadata) {
        return ctx.reply("❌ No token found for address provided.");
      }

      const state = ctx.wizard.state as SellState;
      state.tokenAddress = input;
      state.tokenMetadata = {
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: tokenInfo.decimals,
      };

      await ctx.reply(
        `✅ Token found: ${metadata.name} (${metadata.symbol})\nNow enter amount to sell (e.g. 100):`,
      );
      return ctx.wizard.next();
    } catch (error) {
      logger.error(error, "Error fetching token info");
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

    const state = ctx.wizard.state as SellState;
    const { tokenMetadata } = state;
    if (!tokenMetadata) {
      return ctx.reply("❌ Token information not found. Please start over.");
    }

    state.amount = amount;

    const userId = ctx.message?.from.id;
    if (!userId) return ctx.reply("❌ No associated user wallet found!");

    let walletManager = new WalletManager();
    let defaultWallet = await walletManager.retrieveAndConstructDefault(userId);

    if (!defaultWallet || !defaultWallet.address) {
      await ctx.reply(
        "❌ No wallet found! Please generate or import a wallet first using /generate or /import.",
      );
      return ctx.scene.leave();
    }

    try {
      const solBalance = await walletManager.getBalance(defaultWallet.address);
      const estimatedFee = BigInt(0.002 * 1e9);

      if (solBalance < estimatedFee) {
        await ctx.reply("❌ Insufficient SOL for network fees.");
        return ctx.scene.leave();
      }

      await ctx.reply(
        `🛒 You are about to sell *${amount} ${tokenMetadata.symbol}*.\nEstimated fee: 0.002 SOL.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Confirm", callback_data: "sell_confirm" },
                { text: "❌ Cancel", callback_data: "sell_cancel" },
              ],
            ],
          },
        },
      );

      return ctx.wizard.next();
    } catch (error) {
      logger.error(error, "Error checking balance");
      return ctx.reply("❌ Error checking wallet balance. Please try again.");
    }
  },
  async (ctx) => {
    if ("callback_query" in ctx.update) {
      const callbackQuery = ctx.update.callback_query;

      if (callbackQuery && "data" in callbackQuery) {
        const callbackData = callbackQuery.data;

        await ctx.answerCbQuery();

        const userId = ctx.update.callback_query.from.id;
        if (!userId) return ctx.reply("No associated user wallet found!");

        let walletManager = new WalletManager();
        let defaultWallet =
          await walletManager.retrieveAndConstructDefault(userId);

        if (!defaultWallet || !defaultWallet.address) {
          await ctx.reply(
            "❌ No wallet found! Please generate or import a wallet first.",
          );
          return ctx.scene.leave();
        }

        if (callbackData === "sell_cancel") {
          await ctx.reply("❎ Sell cancelled.");
          return ctx.scene.leave();
        }

        if (callbackData === "sell_confirm") {
          const state = ctx.wizard.state as SellState;
          const { tokenAddress, amount, tokenMetadata } = state;

          if (
            !tokenAddress ||
            !amount ||
            !tokenMetadata ||
            !defaultWallet.address
          ) {
            await ctx.reply(
              "❌ Missing transaction information. Please start over.",
            );
            return ctx.scene.leave();
          }

          try {
            const quote = await getSellQuote(tokenAddress, amount);
            const swapInstructions = await getSwapInstructions(
              quote.rawQuote,
              defaultWallet.address,
            );
            const txSig = await executeSwap(defaultWallet, swapInstructions);

            await ctx.reply(`✅ Swap completed!\n🔗 Transaction: ${txSig}`);
          } catch (err) {
            logger.error(err, "Swap error");
            await ctx.reply(
              `⚠️ Error during swap: ${err instanceof Error ? err.message : "Unknown error"}`,
            );
          }

          return ctx.scene.leave();
        }
      } else {
        await ctx.reply("❌ Unexpected callback query type.");
      }
    } else {
      await ctx.reply("❌ Please use the buttons to confirm or cancel.");
    }
  },
);

export { sellWizard };
