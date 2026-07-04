import { Context } from "telegraf";

export function sendHelpMessage(ctx: Context) {
  return ctx.reply(
    "📖 Solana Trading Bot Commands:\n\n" +
      "🆕 /generate - Generate a new Solana wallet\n" +
      "🔑 /import - Import wallet using private key or mnemonic\n" +
      "💰 /balance - Check balance of your wallets\n" +
      "🟢 /buy - Buy any arbitrary token\n" +
      "🔴 /sell - Sell tokens you hold\n" +
      "👛 /wallets - View all your stored wallets\n" +
      "⚙️ /settings - Bot settings\n" +
      "❓ /help - Show this help message",
  );
}
