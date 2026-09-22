import { Bot, Context, session, SessionFlavor } from "grammy";
import { BOT_TOKEN } from "./config.js";
import { mainKeyboard } from "./keyboards.js";
import { registerTodayHandlers } from "./handlers/today.js";
import { registerGoldHandlers } from "./handlers/gold.js";
import { registerTrelloAuthHandlers } from "./handlers/trello/auth.js";
import { registerTrelloBoardHandlers } from "./handlers/trello/boards.js";
import { registerTrelloTaskHandlers } from "./handlers/trello/tasks.js";

// Session tracks whether we're waiting for the user to paste their Trello token.
export interface SessionData {
  awaitingTrelloToken: boolean;
}
export type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(BOT_TOKEN);
bot.use(session({ initial: (): SessionData => ({ awaitingTrelloToken: false }) }));

// /start shows the greeting and attaches the reply keyboard.
bot.command("start", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);

// Reply keyboard buttons trigger the same behavior as their matching commands.
bot.hears("Restart", (ctx) =>
  ctx.reply("Hello! I'm a simple bot 👋", { reply_markup: mainKeyboard })
);

registerTodayHandlers(bot);
registerGoldHandlers(bot);
registerTrelloAuthHandlers(bot);
registerTrelloBoardHandlers(bot);
registerTrelloTaskHandlers(bot);

bot.start();
