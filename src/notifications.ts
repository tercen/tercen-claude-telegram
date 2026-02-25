import { createServer, type Server, type IncomingMessage, type ServerResponse } from "node:http";

type SendFn = (chatId: number, text: string) => Promise<void>;

export interface NotificationServer {
  server: Server;
  start(port: number): void;
  stop(): Promise<void>;
}

interface NotificationPayload {
  type?: string;
  message?: string;
  title?: string;
  hook_event_name?: string;
  [key: string]: unknown;
}

/**
 * Create an HTTP server that receives Claude Code hook POST notifications
 * and forwards them to Telegram.
 */
export function createNotificationServer(
  allowedChatIds: Set<number>,
  send: SendFn,
): NotificationServer {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Only accept POST /notify
    if (req.method !== "POST" || req.url !== "/notify") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    try {
      const body = await readBody(req);
      const payload: NotificationPayload = JSON.parse(body);

      const text = formatNotification(payload);

      // Send to all allowed chats
      const sends = Array.from(allowedChatIds).map((chatId) => send(chatId, text));
      await Promise.allSettled(sends);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
    }
  });

  return {
    server,
    start(port: number) {
      server.listen(port, () => {
        console.log(`Notification server listening on port ${port}`);
      });
    },
    async stop() {
      return new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function formatNotification(payload: NotificationPayload): string {
  const eventType = payload.hook_event_name || payload.type || "notification";
  const title = payload.title;
  const message = payload.message || JSON.stringify(payload);

  let icon: string;
  switch (eventType.toLowerCase()) {
    case "stop":
      icon = "🛑";
      break;
    case "notification":
      icon = "🔔";
      break;
    case "taskcompleted":
      icon = "✅";
      break;
    default:
      icon = "📨";
  }

  let text = `${icon} ${eventType}`;
  if (title) text += `: ${title}`;
  text += `\n${message}`;

  return text;
}
