import { Context } from "telegraf";
import { WalletManager } from "../wallet/wallet-manager";

export async function handleWalletsCommand(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return ctx.reply("❌ Could not identify user.");

  try {
    const walletManager = new WalletManager();
    const wallets = await walletManager.retrieveAndConstruct(userId);

    if (wallets.length === 0) {
      return ctx.reply(
        "👛 No wallets found. Generate one with /generate or import with /import.",
      );
    }

    const lines: string[] = [`👛 *Your Wallets (${wallets.length})*`, ""];
    for (const wallet of wallets) {
      if (!wallet.address) continue;
      const balance = await walletManager.getBalance(wallet.address);
      const sol = Number(balance) / 1e9;
      const label = wallet.default ? "⭐ Default" : "";
      lines.push(`\`${wallet.address}\` ${label}\n  └ ${sol.toFixed(4)} SOL`);
    }

    return ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
  } catch (error) {
    return ctx.reply("❌ Error fetching wallets.");
  }
}
