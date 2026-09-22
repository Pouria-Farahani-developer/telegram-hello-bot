import type { Bot, Context } from "grammy";
import { BRS_API_KEY } from "../config.js";
import type { MyContext } from "../bot.js";

// One entry in BrsApi's "gold" array (see https://brsapi.ir/free-api-gold-currency-webservice/).
export interface GoldPriceItem {
  date: string;
  time: string;
  symbol: string;
  name: string;
  price: number;
  unit: string;
}

// Symbols to include in the /gold reply, in display order (18K gold is required by spec).
export const featuredGoldSymbols = ["IR_GOLD_18K", "IR_GOLD_24K", "IR_COIN_EMAMI"];

// Fetches live prices from BrsApi and formats the featured gold/coin entries.
export async function fetchGoldPriceMessage(): Promise<string> {
  if (!BRS_API_KEY) {
    throw new Error("BRS_API_KEY is not set");
  }

  const response = await fetch(
    `https://Api.BrsApi.ir/Market/Gold_Currency.php?key=${BRS_API_KEY}`
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
export async function replyWithGoldPrice(ctx: Context) {
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

export function registerGoldHandlers(bot: Bot<MyContext>): void {
  bot.command("gold", replyWithGoldPrice);
  bot.hears("Gold Price", replyWithGoldPrice);
}
