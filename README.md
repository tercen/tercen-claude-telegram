# Claude-Telegram Bridge

Two-way Telegram bridge for Claude Code — chat with Claude, monitor sessions, and receive notifications remotely.

## Features

- Send messages via Telegram, get Claude's responses back
- Session management: `/new` to start fresh, `/stop` to cancel
- Notification server for Claude Code hooks (task completions, alerts)
- Long message splitting for Telegram's 4096 char limit
- Chat ID allowlist for security

## Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Get Your Chat ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. It will reply with your chat ID

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
TELEGRAM_BOT_TOKEN=your-bot-token-here
TELEGRAM_ALLOWED_CHAT_IDS=your-chat-id-here
CLAUDE_WORKING_DIR=/path/to/your/project
```

### 4. Install & Run

```bash
npm install
npm run build
npm start
```

## Usage

### Telegram Commands

- `/start` — Show help
- `/new` — Start a fresh Claude session
- `/stop` — Cancel the current operation
- Any text message — Send to Claude

### Notifications from Claude Code

Add hooks to `~/.claude/settings.json` to receive notifications in Telegram:

```json
{
  "hooks": {
    "Notification": [{
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:7777/notify -H 'Content-Type: application/json' -d \"$(cat)\""
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "curl -s -X POST http://localhost:7777/notify -H 'Content-Type: application/json' -d '{\"type\":\"stop\",\"message\":\"Claude Code session ended\"}'"
      }]
    }]
  }
}
```

## Architecture

```
Telegram User
    ↕ (Bot API, long polling)
Telegram Bot (grammY)
    ↕
Claude Agent SDK
    ↕
Claude Code (local execution with tools)

Claude Code Hooks
    → HTTP POST → Notification Server → Telegram
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | — | Bot token from BotFather |
| `TELEGRAM_ALLOWED_CHAT_IDS` | Yes | — | Comma-separated allowed chat IDs |
| `CLAUDE_WORKING_DIR` | No | `cwd` | Working directory for Claude |
| `NOTIFICATION_PORT` | No | `7777` | Port for hook HTTP server |
| `ANTHROPIC_API_KEY` | Yes* | — | *Required if not set globally |
