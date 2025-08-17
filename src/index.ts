import { Telegraf } from "telegraf";
import { connectDB } from "./db";
import { getRequiredEnv } from "./util/env-helper";
import { WalletManager } from "./wallet/wallet-manager";
import {
  handleGenerateCommand,
  handleImportCommand,
  handleImportWalletTextMessage,
  sendHelpMessage,
  sendWelcomeMessage,
} from "./commands/wallet";
import { connectKafka } from "./kafka";
import { startBackgroundFetcher } from "./util/price-fetcher";

const bot = new Telegraf(getRequiredEnv("BOT_TOKEN"));

const userStates = new Map();

connectDB();

bot.start(sendWelcomeMessage);

bot.help(sendHelpMessage);

bot.command("generate", handleGenerateCommand);

bot.command("import", (ctx) => {
  handleImportCommand(ctx, userStates);

  bot.on("text", async (ctx, next) =>
    handleImportWalletTextMessage(ctx, next, userStates),
  );
});

async function start() {
  await connectKafka();
  startBackgroundFetcher();
  bot.launch();
  console.log("All services running");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

start().catch(console.error);
