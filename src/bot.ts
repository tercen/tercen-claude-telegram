import { Bot, type Context } from "grammy";
import type { Config } from "./config.js";
import type { ClaudeBridge } from "./claude.js";

export function createBot(config: Config, claude: ClaudeBridge): Bot {
  const bot = new Bot(config.telegramBotToken);

  // Auth middleware — reject messages from non-allowed chats
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId === undefined || !config.allowedChatIds.has(chatId)) {
      console.log(`Rejected message from unauthorized chat: ${chatId}`);
      return; // silently ignore
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    await ctx.reply(
      "Hello! I'm your Claude Code bridge.\n\n" +
        "Send me any message and I'll forward it to Claude.\n\n" +
        "Commands:\n" +
        "/new — Start a fresh Claude session\n" +
        "/stop — Cancel the current operation",
    );
  });

  // /new command — fresh session
  bot.command("new", async (ctx) => {
    const chatId = ctx.chat!.id;
    claude.newSession(chatId);
    await ctx.reply("🆕 New session started. Send a message to begin.");
  });

  // /stop command — cancel current operation
  bot.command("stop", async (ctx) => {
    const chatId = ctx.chat!.id;
    claude.stopSession(chatId);
    await ctx.reply("⏹ Stopping current operation...");
  });

  // Text message handler — forward to Claude
  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat!.id;
    const text = ctx.message.text;

    // Skip empty messages
    if (!text.trim()) return;

    const send = async (cid: number, msg: string) => {
      await bot.api.sendMessage(cid, msg);
    };

    const typing = async (cid: number) => {
      await bot.api.sendChatAction(cid, "typing");
    };

    await claude.sendMessage(chatId, text, send, typing);
  });

  return bot;
}

/**
 * Create a send function bound to the bot API for use by the notification server.
 */
export function createSendFn(bot: Bot): (chatId: number, text: string) => Promise<void> {
  return async (chatId: number, text: string) => {
    await bot.api.sendMessage(chatId, text);
  };
}
