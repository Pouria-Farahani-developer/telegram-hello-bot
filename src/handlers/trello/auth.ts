import type { Bot } from "grammy";
import { deleteTrelloToken, saveTrelloToken } from "../../db.js";
import { TRELLO_API_KEY } from "../../config.js";
import type { MyContext } from "../../bot.js";

// Builds the Trello "authorize" link a user opens to generate their personal token.
export function buildTrelloAuthorizeUrl(apiKey: string): string {
  const params = new URLSearchParams({
    expiration: "never",
    scope: "read,write",
    response_type: "token",
    name: "TelegramBot",
    key: apiKey,
  });
  return `https://trello.com/1/authorize?${params.toString()}`;
}

// Shared handler for both /connect_trello and the "Connect Trello" button.
export async function startTrelloConnection(ctx: MyContext): Promise<void> {
  if (!TRELLO_API_KEY) {
    await ctx.reply("اتصال به Trello در حال حاضر پیکربندی نشده است.");
    return;
  }

  ctx.session.awaitingTrelloToken = true;
  await ctx.reply(
    [
      "برای اتصال حساب Trello خود:",
      `۱. این لینک را باز کنید: ${buildTrelloAuthorizeUrl(TRELLO_API_KEY)}`,
      "۲. روی Allow بزنید.",
      "۳. توکنی که نمایش داده می‌شود را کپی کرده و همینجا برای من ارسال کنید.",
    ].join("\n")
  );
}

// Checks a pasted Trello token against the API, then saves it or reports failure.
// The token itself is never logged, only whether the check succeeded.
export async function handleTrelloToken(ctx: MyContext, pastedToken: string): Promise<void> {
  const userId = ctx.from?.id;
  if (!TRELLO_API_KEY || !userId) {
    await ctx.reply("اتصال به Trello در حال حاضر پیکربندی نشده است.");
    return;
  }

  try {
    const response = await fetch(
      `https://api.trello.com/1/members/me?key=${TRELLO_API_KEY}&token=${pastedToken}`
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

// Shared handler for both /disconnect_trello and the "Disconnect Trello" button.
export function disconnectTrello(ctx: MyContext) {
  const userId = ctx.from?.id;
  if (!userId) return;
  deleteTrelloToken(userId);
  ctx.reply("حساب Trello شما قطع شد.");
}

export function registerTrelloAuthHandlers(bot: Bot<MyContext>): void {
  bot.command("connect_trello", startTrelloConnection);
  bot.command("disconnect_trello", disconnectTrello);

  bot.hears("Connect Trello", startTrelloConnection);
  bot.hears("Disconnect Trello", disconnectTrello);

  // Captures the message right after /connect_trello and treats it as the pasted token.
  // Slash commands are left alone so /disconnect_trello etc. still work while waiting.
  bot.on("message:text", async (ctx, next) => {
    if (!ctx.session.awaitingTrelloToken || ctx.message.text.startsWith("/")) {
      return next();
    }
    ctx.session.awaitingTrelloToken = false;
    await handleTrelloToken(ctx, ctx.message.text.trim());
  });
}
