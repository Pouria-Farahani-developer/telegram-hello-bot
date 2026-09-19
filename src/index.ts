import "dotenv/config";
import { Bot, Context, InlineKeyboard, Keyboard, session, SessionFlavor } from "grammy";
import { isLeapJalaaliYear, j2d, toJalaali } from "jalaali-js";
import { deleteTrelloToken, saveTrelloToken } from "./db.js";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set. Did you create a .env file?");
}

// Used by /gold; checked lazily so a missing key only breaks that one command.
const brsApiKey = process.env.BRS_API_KEY;

// Used by /connect_trello; checked lazily so a missing key only breaks that command.
const trelloApiKey = process.env.TRELLO_API_KEY;

// Session tracks whether we're waiting for the user to paste their Trello token.
interface SessionData {
  awaitingTrelloToken: boolean;
}
type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(token);
bot.use(session({ initial: (): SessionData => ({ awaitingTrelloToken: false }) }));

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

// True if the given Gregorian year is a leap year.
const isLeapGregorianYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

// Builds "Today is <Weekday>, <Month> <Day>, <Year>" / Persian equivalent, plus how much
// of the current Jalali and Gregorian years have elapsed, for a given date.
function formatTodayMessage(date: Date): string {
  const { jy, jm, jd } = toJalaali(date);
  const jalaliLine = `امروز ${persianWeekdays[date.getDay()]}، ${toPersianDigits(jd)} ${persianMonths[jm - 1]} ${toPersianDigits(jy)} است`;

  const gregorianLine = `Today is ${date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;

  // Jalali year progress, via Julian Day numbers: distance from Farvardin 1st plus one.
  const jalaliDayOfYear = j2d(jy, jm, jd) - j2d(jy, 1, 1) + 1;
  const jalaliTotalDays = isLeapJalaaliYear(jy) ? 366 : 365;
  const jalaliPercent = Math.round((jalaliDayOfYear / jalaliTotalDays) * 100);
  const jalaliFilledCount = Math.round((jalaliPercent / 100) * progressBarLength);
  const jalaliProgressLine = `${toPersianDigits(jalaliPercent)}% از سال ${toPersianDigits(jy)} گذشته است`;

  // Gregorian year progress, via plain Date arithmetic (both dates at local midnight).
  const gy = date.getFullYear();
  const msPerDay = 24 * 60 * 60 * 1000;
  const gregorianDayOfYear =
    Math.round((Date.UTC(gy, date.getMonth(), date.getDate()) - Date.UTC(gy, 0, 1)) / msPerDay) + 1;
  const gregorianTotalDays = isLeapGregorianYear(gy) ? 366 : 365;
  const gregorianPercent = Math.round((gregorianDayOfYear / gregorianTotalDays) * 100);
  const gregorianFilledCount = Math.round((gregorianPercent / 100) * progressBarLength);
  const gregorianProgressLine = `${gregorianPercent}% از سال ${gy} گذشته است`;

  return [
    jalaliLine,
    gregorianLine,
    "",
    jalaliProgressLine,
    buildProgressBar(jalaliFilledCount),
    gregorianProgressLine,
    buildProgressBar(gregorianFilledCount),
  ].join("\n");
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

// Builds the Trello "authorize" link a user opens to generate their personal token.
function buildTrelloAuthorizeUrl(apiKey: string): string {
  const params = new URLSearchParams({
    expiration: "never",
    scope: "read",
    response_type: "token",
    name: "TelegramBot",
    key: apiKey,
  });
  return `https://trello.com/1/authorize?${params.toString()}`;
}

// Checks a pasted Trello token against the API, then saves it or reports failure.
// The token itself is never logged, only whether the check succeeded.
async function handleTrelloToken(ctx: MyContext, pastedToken: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!trelloApiKey || !userId) {
    await ctx.reply("اتصال به Trello در حال حاضر پیکربندی نشده است.");
    return;
  }

  try {
    const response = await fetch(
      `https://api.trello.com/1/members/me?key=${trelloApiKey}&token=${pastedToken}`
    );
    if (!response.ok) {
      throw new Error(`Trello token check failed with status ${response.status}`);
    }

    const member = (await response.json()) as { username?: string };
    saveTrelloToken(userId, pastedToken);
    await ctx.reply(`حساب Trello شما با نام کاربری «${member.username}» متصل شد ✅`);
  } catch (error) {
    console.error("Failed to validate Trello token:", error);
    await ctx.reply(
      "توکن نامعتبر است یا مشکلی در اتصال پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
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

bot.command("connect_trello", async (ctx) => {
  if (!trelloApiKey) {
    await ctx.reply("اتصال به Trello در حال حاضر پیکربندی نشده است.");
    return;
  }

  ctx.session.awaitingTrelloToken = true;
  await ctx.reply(
    [
      "برای اتصال حساب Trello خود:",
      `۱. این لینک را باز کنید: ${buildTrelloAuthorizeUrl(trelloApiKey)}`,
      "۲. روی Allow بزنید.",
      "۳. توکنی که نمایش داده می‌شود را کپی کرده و همینجا برای من ارسال کنید.",
    ].join("\n")
  );
});

bot.command("disconnect_trello", (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;
  deleteTrelloToken(userId);
  ctx.reply("حساب Trello شما قطع شد.");
});

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

// Captures the message right after /connect_trello and treats it as the pasted token.
// Slash commands are left alone so /disconnect_trello etc. still work while waiting.
bot.on("message:text", async (ctx, next) => {
  if (!ctx.session.awaitingTrelloToken || ctx.message.text.startsWith("/")) {
    return next();
  }
  ctx.session.awaitingTrelloToken = false;
  await handleTrelloToken(ctx, ctx.message.text.trim());
});

// Fallback: echo any other text message.
bot.on("message:text", (ctx) => ctx.reply(ctx.message.text));

bot.start();
