import { Context } from "telegraf";
import { WalletManager } from "../wallet/wallet-manager";
import { WalletModel } from "../wallet/model";
import { UserSettingsModel } from "../wallet/user-settings";

export async function handleSettingsCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return ctx.reply("❌ Could not identify user.");

  try {
    let settings = await UserSettingsModel.findOne({ userId }).exec();

    if (!settings) {
      settings = await UserSettingsModel.create({ userId });
    }

    const walletManager = new WalletManager();
    const wallets = await walletManager.retrieveAndConstruct(userId);
    const walletButtons = wallets
      .filter((w) => w.address)
      .map((w) => {
        const label = w.default
          ? `⭐ ${w.address!.slice(0, 8)}...${w.address!.slice(-4)} (current)`
          : `${w.address!.slice(0, 8)}...${w.address!.slice(-4)}`;
        return [{ text: label, callback_data: `set_default:${w.address}` }];
      });

    return ctx.reply(
      `⚙️ *Settings*\n\nSlippage: \`${settings.slippageBps} bps (${settings.slippageBps / 100}%)\`\n\nSelect default wallet or adjust slippage:`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            ...walletButtons,
            [
              { text: "◀️ -100 bps", callback_data: "slippage:sub:100" },
              { text: "Slippage", callback_data: "noop" },
              { text: "+100 bps ▶️", callback_data: "slippage:add:100" },
            ],
            [{ text: "Reset to 300 bps", callback_data: "slippage:reset" }],
          ],
        },
      },
    );
  } catch (error) {
    return ctx.reply("❌ Error loading settings.");
  }
}

export async function handleSettingsCallback(ctx: Context) {
  if (!("callback_query" in ctx.update)) return;

  const cb = ctx.update.callback_query;
  if (!("data" in cb)) return;

  await ctx.answerCbQuery();

  const userId = cb.from.id;
  const data = cb.data;

  try {
    if (data === "noop") return;

    let settings = await UserSettingsModel.findOne({ userId }).exec();
    if (!settings) {
      settings = await UserSettingsModel.create({ userId });
    }

    if (data.startsWith("set_default:")) {
      const address = data.slice("set_default:".length);
      const walletManager = new WalletManager();
      const wallets = await walletManager.retrieveAndConstruct(userId);
      const wallet = wallets.find((w) => w.address === address);
      if (!wallet) {
        return ctx.reply("❌ Wallet not found.");
      }
      const dbWallet = await walletManager.retrieve(userId);
      const target = dbWallet.find((w) => w.address === address);
      if (target) {
        await WalletModel.setDefaultWallet(userId, target._id);
        await ctx.reply(`✅ Default wallet set to \`${address}\``, {
          parse_mode: "Markdown",
        });
      }
    } else if (data.startsWith("slippage:")) {
      const parts = data.split(":");
      const action = parts[1];

      if (action === "reset") {
        settings.slippageBps = 300;
      } else if (action === "add" || action === "sub") {
        const delta = parseInt(parts[2], 10);
        if (action === "add") {
          settings.slippageBps = Math.min(settings.slippageBps + delta, 5000);
        } else {
          settings.slippageBps = Math.max(settings.slippageBps - delta, 0);
        }
      }

      await settings.save();
      await ctx.reply(
        `✅ Slippage set to \`${settings.slippageBps} bps (${settings.slippageBps / 100}%)\``,
        { parse_mode: "Markdown" },
      );
    }
  } catch (error) {
    await ctx.reply("❌ Error updating settings.");
  }
}
