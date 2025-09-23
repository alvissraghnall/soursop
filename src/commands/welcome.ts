import { type Context } from "telegraf";

export function sendWelcomeMessage(ctx: Context) {
  return ctx.reply(`
🚀 Welcome to SourSop — The No-Fee SOL Trading Bot!

Trade Solana (SOL) seamlessly, instantly, and 100% fee-free.
No middlemen. No hidden charges. Just pure trading, swapping and more at lightning speed.

🔐 Secure | ⚡ Fast | 💸 Zero Fees

Type /help to begin trading or explore available commands.
  `);
}
