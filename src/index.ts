import { loadConfig } from "./config.js";
import { ClaudeBridge } from "./claude.js";
import { createBot, createSendFn } from "./bot.js";
import { createNotificationServer } from "./notifications.js";

async function main() {
  const config = loadConfig();

  console.log("Starting Claude-Telegram bridge...");
  console.log(`  Working directory: ${config.claudeWorkingDir}`);
  console.log(`  Notification port: ${config.notificationPort}`);
  console.log(`  Allowed chats: ${Array.from(config.allowedChatIds).join(", ")}`);

  // Initialize Claude bridge
  const claude = new ClaudeBridge(config);

  // Initialize Telegram bot
  const bot = createBot(config, claude);
  const send = createSendFn(bot);

  // Start notification server
  const notifications = createNotificationServer(config.allowedChatIds, send);
  notifications.start(config.notificationPort);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    bot.stop();
    await notifications.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start Telegram bot (long polling)
  console.log("Bot is running. Send a message in Telegram to start chatting with Claude.");
  bot.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
