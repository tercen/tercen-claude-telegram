export interface Config {
  telegramBotToken: string;
  allowedChatIds: Set<number>;
  claudeWorkingDir: string;
  notificationPort: number;
}

export function loadConfig(): Config {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  const chatIdsRaw = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
  if (!chatIdsRaw) {
    throw new Error("TELEGRAM_ALLOWED_CHAT_IDS environment variable is required");
  }

  const allowedChatIds = new Set(
    chatIdsRaw.split(",").map((id) => {
      const n = parseInt(id.trim(), 10);
      if (isNaN(n)) throw new Error(`Invalid chat ID: ${id}`);
      return n;
    })
  );

  const claudeWorkingDir = process.env.CLAUDE_WORKING_DIR || process.cwd();
  const notificationPort = parseInt(process.env.NOTIFICATION_PORT || "7777", 10);

  return { telegramBotToken: token, allowedChatIds, claudeWorkingDir, notificationPort };
}
