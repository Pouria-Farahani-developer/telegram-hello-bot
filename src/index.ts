import "dotenv/config";
import { Bot, Context, InlineKeyboard, Keyboard } from "grammy";
import { isLeapJalaaliYear, j2d, toJalaali } from "jalaali-js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set. Did you create a .env file?");
}

// Used by /gold; checked lazily so a missing key only breaks that one command.
const brsApiKey = process.env.BRS_API_KEY;

const bot = new Bot(token);

// Reply keyboard shown to the user, with buttons mirroring the commands below.
const mainKeyboard = new Keyboard()
  .text("Restart")
  .text("Today")
  .row()
  .text("Gold Price")
  .resized();

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

// Length of the text-based year-progress bar, in segments.
const progressBarLength = 20;

// Builds "██████░░░░"-style bar with `filledCount` of `progressBarLength` segments filled.
function buildProgressBar(filledCount: number): string {
  return "█".repeat(filledCount) + "░".repeat(progressBarLength - filledCount);
}

// Builds "Today is <Weekday>, <Month> <Day>, <Year>" / Persian equivalent, plus how much
// of the current Jalali year has elapsed, for a given date.
function formatTodayMessage(date: Date): string {
  const { jy, jm, jd } = toJalaali(date);
  const jalaliLine = `امروز ${persianWeekdays[date.getDay()]}، ${toPersianDigits(jd)} ${persianMonths[jm - 1]} ${toPersianDigits(jy)} است`;

  const gregorianLine = `Today is ${date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  // Day-of-year via Julian Day numbers: distance from Farvardin 1st plus one.
  const dayOfYear = j2d(jy, jm, jd) - j2d(jy, 1, 1) + 1;
  const totalDaysInYear = isLeapJalaaliYear(jy) ? 366 : 365;
  const percentPassed = Math.round((dayOfYear / totalDaysInYear) * 100);
  const filledCount = Math.round((percentPassed / 100) * progressBarLength);

  const progressLine = `${toPersianDigits(percentPassed)}% از سال ${toPersianDigits(jy)} گذشته است`;

  return [jalaliLine, gregorianLine, "", progressLine, buildProgressBar(filledCount)].join("\n");
}

// One entry in BrsApi's "gold" array (see https://brsapi.ir/free-api-gold-currency-webservice/).
interface GoldPriceItem {
  date: string;
  time: string;
  symbol: string;
  name: string;
  price: number;
  unit: string;
}

// Symbols to include in the /gold reply, in display order (18K gold is required by spec).
const featuredGoldSymbols = ["IR_GOLD_18K", "IR_GOLD_24K", "IR_COIN_EMAMI"];

// Fetches live prices from BrsApi and formats the featured gold/coin entries.
async function fetchGoldPriceMessage(): Promise<string> {
  if (!brsApiKey) {
    throw new Error("BRS_API_KEY is not set");
  }

  const response = await fetch(
    `https://Api.BrsApi.ir/Market/Gold_Currency.php?key=${brsApiKey}`
  );
  if (!response.ok) {
    throw new Error(`BrsApi request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { gold: GoldPriceItem[] };
  const featured = data.gold.filter((item) =>
    featuredGoldSymbols.includes(item.symbol)
  );
  const gold18k = featured.find((item) => item.symbol === "IR_GOLD_18K");
  if (!gold18k) {
    throw new Error("18K gold entry missing from BrsApi response");
  }

  const lines = featured.map(
    (item) => `${item.name}: ${item.price.toLocaleString("en-US")} ${item.unit}`
  );

  return [`قیمت لحظه‌ای طلا و سکه (${gold18k.date} - ${gold18k.time}):`, ...lines].join("\n");
}

// Shared handler for both /gold and the "Gold Price" button.
async function replyWithGoldPrice(ctx: Context) {
  try {
    const message = await fetchGoldPriceMessage();
    await ctx.reply(message);
  } catch (error) {
    console.error("Failed to fetch gold prices:", error);
    await ctx.reply(
      "متاسفانه در حال حاضر امکان دریافت قیمت طلا وجود ندارد. لطفاً بعداً دوباره تلاش کنید."
    );
  }
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
bot.command("gold", replyWithGoldPrice);

// Reply keyboard buttons trigger the same behavior as their matching commands.
bot.hears("Restart", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);
bot.hears("Today", (ctx) => ctx.reply(formatTodayMessage(new Date())));
bot.hears("Gold Price", replyWithGoldPrice);

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
