import { Telegraf, Scenes, session, SessionStore } from "telegraf";
import { buyWizard, BuyContext, BuyState } from "./commands/buy";
import { sellWizard, SellContext, SellState } from "./commands/sell";
import {
  handleBalanceCommand,
  handleGenerateCommand,
  handleImportCommand,
  handleImportWalletTextMessage,
  handleSettingsCommand,
  handleSettingsCallback,
  handleWalletsCommand,
  sendHelpMessage,
  sendWelcomeMessage,
} from "./commands";
import { connectDB } from "./db";
import { getRequiredEnv } from "./util/env-helper";
import { setupKafka } from "./kafka";
import { startBackgroundFetcher } from "./services/price-fetcher";
import { redis, connectRedis } from "./redis";
import { Redis } from "@telegraf/session/redis";
import { WizardSession } from "telegraf/scenes";
import { logger } from "./util/logger";

type BotContext = BuyContext & SellContext;

const bot = new Telegraf<BotContext>(getRequiredEnv("BOT_TOKEN"));
const stage = new Scenes.Stage<BotContext>([buyWizard, sellWizard]);

const knownCommands = new Set<string>();
const userStates = new Map();

const store: SessionStore<WizardSession<BuyState & SellState>> = Redis({
  client: redis,
});

bot.use(session({ store }));

connectDB();

bot.use(stage.middleware());

bot.start(sendWelcomeMessage);
knownCommands.add("/start");

bot.help(sendHelpMessage);
knownCommands.add("/help");

bot.command("generate", handleGenerateCommand);
knownCommands.add("/generate");

bot.command("import", (ctx) => {
  handleImportCommand(ctx, userStates);
});
knownCommands.add("/import");

bot.command("buy", (ctx) => ctx.scene.enter("BUY_WIZARD"));
knownCommands.add("/buy");

bot.command("sell", (ctx) => ctx.scene.enter("SELL_WIZARD"));
knownCommands.add("/sell");

bot.command("balance", handleBalanceCommand);
knownCommands.add("/balance");

bot.command("wallets", handleWalletsCommand);
knownCommands.add("/wallets");

bot.command("settings", handleSettingsCommand);
knownCommands.add("/settings");

bot.action(/set_default:.+/, handleSettingsCallback);
bot.action(/slippage:.+/, handleSettingsCallback);
bot.action("noop", handleSettingsCallback);

bot.on("text", async (ctx, next) => {
  const messageText = ctx.message.text;
  const userId = ctx.from?.id;

  if (messageText.startsWith("/")) {
    const command = messageText.split(" ")[0];
    if (!knownCommands.has(command)) {
      return ctx.reply(
        "❓ Unknown command. Type /help to see the available commands.",
      );
    }
  }

  if (userStates.has(userId)) {
    return handleImportWalletTextMessage(ctx, next, userStates);
  }

  return ctx.reply("🤖 I didn’t understand that. Type /help to get started.");
});

async function start() {
  await connectRedis();
  await setupKafka();
  startBackgroundFetcher();
  bot.launch().then(() => logger.info("Bot UP!"));
  logger.info("All services running");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

start().catch((err) => logger.error(err, "Failed to start bot"));
