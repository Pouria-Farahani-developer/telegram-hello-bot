import "dotenv/config";
import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { toJalaali } from "jalaali-js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set. Did you create a .env file?");
}

const bot = new Bot(token);

// Reply keyboard shown to the user, with buttons mirroring the commands below.
const mainKeyboard = new Keyboard().text("Restart").text("Today").resized();

// Persian names for weekdays (indexed by JS Date#getDay(), 0 = Sunday) and months.
const persianWeekdays = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];
const persianMonths = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

// Converts a non-negative integer's digits to their Persian-numeral form.
const toPersianDigits = (n: number): string =>
  String(n)
    .split("")
    .map((digit) => persianDigits[Number(digit)])
    .join("");

// Builds "Today is <Weekday>, <Month> <Day>, <Year>" / Persian equivalent for a given date.
function formatTodayMessage(date: Date): string {
  const { jy, jm, jd } = toJalaali(date);
  const jalaliLine = `امروز ${persianWeekdays[date.getDay()]}، ${toPersianDigits(jd)} ${persianMonths[jm - 1]} ${toPersianDigits(jy)} است`;

  const gregorianLine = `Today is ${date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  return `${jalaliLine}\n${gregorianLine}`;
}

// Inline keyboard shown by /menu, with one callback_data value per option.
const optionsKeyboard = new InlineKeyboard()
  .text("Option A", "opt_a")
  .text("Option B", "opt_b")
  .text("Option C", "opt_c");

// /start shows the greeting and attaches the reply keyboard.
bot.command("start", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);

bot.command("menu", (ctx) =>
  ctx.reply("Choose an option:", { reply_markup: optionsKeyboard })
);
bot.command("today", (ctx) => ctx.reply(formatTodayMessage(new Date())));

// Reply keyboard buttons trigger the same behavior as their matching commands.
bot.hears("Restart", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);
bot.hears("Today", (ctx) => ctx.reply(formatTodayMessage(new Date())));

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
