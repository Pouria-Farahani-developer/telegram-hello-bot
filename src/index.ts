import "dotenv/config";
import { Bot, InlineKeyboard, Keyboard } from "grammy";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set. Did you create a .env file?");
}

const bot = new Bot(token);

// Reply keyboard shown to the user, with buttons mirroring the commands below.
const mainKeyboard = new Keyboard()
  .text("Help")
  .text("About")
  .text("Restart")
  .resized();

const helpText = [
  "Available commands:",
  "/start - show the welcome message and buttons",
  "/help - show this list of commands",
  "/about - learn what this bot is",
  "/menu - show an inline option menu",
].join("\n");

const aboutText = "This bot is a small learning project built with grammY and TypeScript.";

// Inline keyboard shown by /menu, with one callback_data value per option.
const optionsKeyboard = new InlineKeyboard()
  .text("Option A", "opt_a")
  .text("Option B", "opt_b")
  .text("Option C", "opt_c");

// /start shows the greeting and attaches the reply keyboard.
bot.command("start", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);

bot.command("help", (ctx) => ctx.reply(helpText));
bot.command("about", (ctx) => ctx.reply(aboutText));
bot.command("menu", (ctx) =>
  ctx.reply("Choose an option:", { reply_markup: optionsKeyboard })
);

// Reply keyboard buttons trigger the same behavior as their matching commands.
bot.hears("Help", (ctx) => ctx.reply(helpText));
bot.hears("About", (ctx) => ctx.reply(aboutText));
bot.hears("Restart", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);

// Inline menu option taps: update the message and drop the keyboard.
const optionLabels: Record<string, string> = {
  opt_a: "Option A",
  opt_b: "Option B",
  opt_c: "Option C",
};

for (const [data, label] of Object.entries(optionLabels)) {
  bot.callbackQuery(data, async (ctx) => {
    // Passing an empty keyboard clears the buttons on the edited message.
    await ctx.editMessageText(`You selected: ${label}`, {
      reply_markup: new InlineKeyboard(),
    });
    await ctx.answerCallbackQuery();
  });
}

// Fallback: echo any other text message.
bot.on("message:text", (ctx) => ctx.reply(ctx.message.text));

bot.start();
