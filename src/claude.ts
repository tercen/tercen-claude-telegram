import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { Config } from "./config.js";
import { formatToolUse, splitMessage, truncate } from "./formatter.js";

export interface ClaudeSession {
  sessionId: string | undefined;
  abortController: AbortController;
}

type SendFn = (chatId: number, text: string) => Promise<void>;
type TypingFn = (chatId: number) => Promise<void>;

export class ClaudeBridge {
  private sessions = new Map<number, ClaudeSession>();
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  /**
   * Get or create a session for a given chat ID.
   */
  getSession(chatId: number): ClaudeSession {
    let session = this.sessions.get(chatId);
    if (!session) {
      session = { sessionId: undefined, abortController: new AbortController() };
      this.sessions.set(chatId, session);
    }
    return session;
  }

  /**
   * Start a fresh session for a chat (discard previous session ID).
   */
  newSession(chatId: number): void {
    const existing = this.sessions.get(chatId);
    if (existing) {
      existing.abortController.abort();
    }
    this.sessions.set(chatId, {
      sessionId: undefined,
      abortController: new AbortController(),
    });
  }

  /**
   * Stop any running query for a chat.
   */
  stopSession(chatId: number): void {
    const session = this.sessions.get(chatId);
    if (session) {
      session.abortController.abort();
      // Replace with a fresh controller so session can be resumed
      session.abortController = new AbortController();
    }
  }

  /**
   * Send a prompt to Claude and stream responses back to Telegram.
   */
  async sendMessage(
    chatId: number,
    prompt: string,
    send: SendFn,
    typing: TypingFn,
  ): Promise<void> {
    const session = this.getSession(chatId);

    // Fresh abort controller for this query
    session.abortController = new AbortController();

    const options: Record<string, unknown> = {
      cwd: this.config.claudeWorkingDir,
      abortController: session.abortController,
      permissionMode: "bypassPermissions" as const,
      allowDangerouslySkipPermissions: true,
    };

    // Resume existing session if we have one
    if (session.sessionId) {
      options.resume = session.sessionId;
    }

    await typing(chatId);
    console.log(`[claude] Starting query for chat ${chatId}, session=${session.sessionId || "new"}`);

    // Collect assistant text and tool use events
    let assistantText = "";
    let lastTypingTime = Date.now();
    const toolEvents: string[] = [];

    try {
      const stream = query({ prompt, options: options as any });
      console.log(`[claude] Stream created, iterating messages...`);

      for await (const message of stream) {
        console.log(`[claude] Message: type=${message.type}${("subtype" in message) ? ` subtype=${message.subtype}` : ""}`);

        // Keep typing indicator alive
        if (Date.now() - lastTypingTime > 4000) {
          await typing(chatId);
          lastTypingTime = Date.now();
        }

        switch (message.type) {
          case "system":
            if (message.subtype === "init") {
              session.sessionId = message.session_id;
              console.log(`[claude] Session initialized: ${message.session_id}`);
            }
            break;

          case "assistant": {
            const content = message.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text") {
                  assistantText += block.text;
                } else if (block.type === "tool_use") {
                  const toolLine = formatToolUse(
                    block.name,
                    (block.input as Record<string, unknown>) || {},
                  );
                  toolEvents.push(toolLine);
                  // Send tool use notifications immediately
                  await send(chatId, toolLine);
                }
              }
            }
            break;
          }

          case "result": {
            console.log(`[claude] Result: subtype=${message.subtype}, is_error=${message.is_error}`);
            if (message.subtype === "success" && message.result) {
              assistantText = message.result;
            } else if ("errors" in message && message.errors?.length) {
              assistantText = `Error: ${message.errors.join("\n")}`;
            }
            break;
          }
        }
      }
      console.log(`[claude] Stream finished. assistantText length=${assistantText.length}, toolEvents=${toolEvents.length}`);
    } catch (err: unknown) {
      console.error(`[claude] Error:`, err);
      if (err instanceof Error && err.name === "AbortError") {
        await send(chatId, "⏹ Operation cancelled.");
        return;
      }
      const errMsg = err instanceof Error ? err.message : String(err);
      await send(chatId, `❌ Error: ${errMsg}`);
      return;
    }

    // Send the final response
    if (assistantText) {
      const truncated = truncate(assistantText, 20000);
      const chunks = splitMessage(truncated);
      for (const chunk of chunks) {
        await send(chatId, chunk);
      }
    } else if (toolEvents.length === 0) {
      await send(chatId, "(No response from Claude)");
    }
  }
}
