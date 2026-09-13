# bot-telegram

A simple Telegram bot built with [grammY](https://grammy.dev) and TypeScript. It replies to `/start` with a greeting and echoes back any text message it receives.

## 1. Create a bot with BotFather

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather).
2. Send `/newbot` and follow the prompts to choose a name and username for your bot.
3. BotFather will reply with an API token that looks like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`. Copy it.

## 2. Configure your environment

Copy the example env file and paste your token into it:

```bash
cp .env.example .env
```

Then open `.env` and set:

```
BOT_TOKEN=your-token-here
```

## 3. Install and run

```bash
npm install
npm run dev
```

`npm run dev` starts the bot with `tsx watch`, restarting automatically on file changes. Use `npm start` to run it once without watching.
