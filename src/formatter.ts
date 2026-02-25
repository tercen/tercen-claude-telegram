const TELEGRAM_MAX_LENGTH = 4096;

// Characters that must be escaped in MarkdownV2 outside of code blocks
const MD_V2_SPECIAL = /([_*\[\]()~`>#+\-=|{}.!\\])/g;

export function escapeMarkdownV2(text: string): string {
  return text.replace(MD_V2_SPECIAL, "\\$1");
}

/**
 * Split a long message into chunks that fit within Telegram's 4096 char limit.
 * Tries to split at paragraph boundaries, then line boundaries.
 */
export function splitMessage(text: string, maxLen = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    let splitAt = -1;

    // Try to split at a double newline (paragraph break) within limit
    const paraBreak = remaining.lastIndexOf("\n\n", maxLen);
    if (paraBreak > maxLen * 0.3) {
      splitAt = paraBreak + 2;
    }

    // Try single newline
    if (splitAt === -1) {
      const lineBreak = remaining.lastIndexOf("\n", maxLen);
      if (lineBreak > maxLen * 0.3) {
        splitAt = lineBreak + 1;
      }
    }

    // Try space
    if (splitAt === -1) {
      const space = remaining.lastIndexOf(" ", maxLen);
      if (space > maxLen * 0.3) {
        splitAt = space + 1;
      }
    }

    // Hard split as last resort
    if (splitAt === -1) {
      splitAt = maxLen;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

/**
 * Truncate text to a maximum length with a truncation marker.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const marker = "\n... (truncated)";
  return text.slice(0, maxLen - marker.length) + marker;
}

/**
 * Format a tool use event as a compact status line for Telegram.
 */
export function formatToolUse(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case "Read":
      return `📖 Reading ${input.file_path}`;
    case "Write":
      return `📝 Writing ${input.file_path}`;
    case "Edit":
      return `✏️ Editing ${input.file_path}`;
    case "Bash":
      return `💻 Running: ${truncate(String(input.command || ""), 100)}`;
    case "Glob":
      return `🔍 Searching files: ${input.pattern}`;
    case "Grep":
      return `🔎 Searching content: ${input.pattern}`;
    case "WebSearch":
      return `🌐 Searching web: ${input.query}`;
    case "WebFetch":
      return `🌐 Fetching: ${input.url}`;
    case "Task":
      return `🤖 Launching agent: ${input.description}`;
    default:
      return `🔧 Using tool: ${toolName}`;
  }
}
