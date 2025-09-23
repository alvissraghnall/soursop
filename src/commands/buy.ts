import { Scenes, Telegraf } from "telegraf";
import {
  getBuyQuote,
  getQuote,
  getTokenInfo,
  getTokenMetadata,
} from "../swap/jupiter";
import { WalletInfo, WalletManager } from "../wallet/wallet-manager";
import {
  getJupiterQuote,
  executeSwap,
  getSwapInstructions,
} from "../swap/jupiter";
import { Message, CallbackQuery } from "telegraf/typings/core/types/typegram";

const { enter, leave } = Scenes.Stage;

export interface BuyState extends Scenes.WizardSessionData {
  tokenAddress?: string;
  amount?: number;
  tokenMetadata?: { name: string; symbol: string; decimals: number };
}

export type BuyContext = Scenes.WizardContext<BuyState>;

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

      // Explicitly type the state
      const state = ctx.wizard.state as BuyState;
      state.tokenAddress = tokenAddress;
      state.tokenMetadata = {
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

    // Explicitly type the state
    const state = ctx.wizard.state as BuyState;
    const { tokenMetadata } = state;
    if (!tokenMetadata) {
      return ctx.reply("❌ Token information not found. Please start over.");
    }

    // const amountRaw = BigInt(Math.floor(amount * 10 ** tokenMetadata.decimals));
    state.amount = amount;

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
        `🛒 You are about to buy *${amount} ${tokenMetadata.symbol}*.\nEstimated fee: 0.002 SOL.`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Confirm", callback_data: "buy_confirm" },
                { text: "❌ Cancel", callback_data: "buy_cancel" },
              ],
            ],
          },
        },
      );

      return ctx.wizard.next();
    } catch (error) {
      console.error("Error checking balance:", error);
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

        if (!userId) {
          return ctx.reply("No associated user wallet found!");
        }

        let walletManager = new WalletManager();
        let defaultWallet =
          await walletManager.retrieveAndConstructDefault(userId);

        if (callbackData === "buy_cancel") {
          await ctx.reply("❎ Buy cancelled.");
          return ctx.scene.leave();
        }

        if (callbackData === "buy_confirm") {
          const state = ctx.wizard.state as BuyState;
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
            const quote = await getBuyQuote(tokenAddress, amount);
            const swapInstructions = await getSwapInstructions(
              quote.rawQuote,
              defaultWallet.address,
            );
            const txSig = await executeSwap(defaultWallet, swapInstructions);

            await ctx.reply(`✅ Swap completed!\n🔗 Transaction: ${txSig}`);
          } catch (err) {
            console.error("Swap error:", err);
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

export { buyWizard };
