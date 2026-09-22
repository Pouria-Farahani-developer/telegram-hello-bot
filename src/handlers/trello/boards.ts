import { InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import {
  getSelection,
  saveBoardSelection,
  saveDoingListSelection,
  saveDoneListSelection,
  saveListSelection,
} from "../../db.js";
import { buildEntityKeyboard, buildStageMenuKeyboard, manualListPickerText } from "../../keyboards.js";
import type { MyContext } from "../../bot.js";
import { fetchTrelloBoard, fetchTrelloBoards, fetchTrelloLists, requireTrelloConnection } from "./api.js";
import { replyWithStageTasks } from "./tasks.js";

// Shows a board picker. Used as the first step of /tasks when no board is selected
// yet, and directly by /change_board / the "Change Board" button to switch boards.
export async function startBoardSelection(ctx: MyContext): Promise<void> {
  const connection = requireTrelloConnection(ctx);
  if (!connection) {
    await ctx.reply("ابتدا با /connect_trello حساب Trello خود را وصل کنید.");
    return;
  }

  try {
    const boards = await fetchTrelloBoards(connection.apiKey, connection.userToken);
    if (boards.length === 0) {
      await ctx.reply("هیچ بوردی در حساب Trello شما پیدا نشد.");
      return;
    }

    const keyboard = buildEntityKeyboard(boards, (board) => `select_board:${board.id}`);
    await ctx.reply("یکی از بوردهای خود را انتخاب کنید:", { reply_markup: keyboard });
  } catch (error) {
    console.error("Failed to fetch Trello boards:", error);
    await ctx.reply(
      "مشکلی در دریافت بوردهای Trello پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
    );
  }
}

export function registerTrelloBoardHandlers(bot: Bot<MyContext>): void {
  bot.command("change_board", startBoardSelection);
  bot.hears("Change Board", startBoardSelection);

  // Board tapped in /select_board's keyboard: auto-detect the To Do/Doing/Done lists.
  // A board needs at least one of Doing/Done to count as having a pipeline at all —
  // otherwise (same rule startTasksMenu uses) it falls back to a plain list picker,
  // whether none of the three names matched or only "To Do" happened to match alone.
  bot.callbackQuery(/^select_board:(.+)$/, async (ctx) => {
    const boardId = ctx.match[1];
    const connection = requireTrelloConnection(ctx);
    if (!connection) {
      await ctx.editMessageText("اتصال Trello شما یافت نشد. لطفاً دوباره با /connect_trello تلاش کنید.");
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const [board, lists] = await Promise.all([
        fetchTrelloBoard(connection.apiKey, connection.userToken, boardId),
        fetchTrelloLists(connection.apiKey, connection.userToken, boardId),
      ]);

      const todoList = lists.find((item) => /to.?do/i.test(item.name));
      const doingList = lists.find((item) => /doing/i.test(item.name));
      const doneList = lists.find((item) => /done/i.test(item.name));
      const hasPipeline = Boolean(doingList || doneList);

      if (hasPipeline && !todoList) {
        await ctx.editMessageText(
          `لیستی به نام «To Do» روی بورد «${board.name}» پیدا نشد. لطفاً یکی از لیست‌های بورد را به این اسم تغییر دهید و دوباره روی Tasks بزنید.`,
          { reply_markup: new InlineKeyboard() }
        );
        await ctx.answerCallbackQuery();
        return;
      }

      if (!hasPipeline) {
        const keyboard = buildEntityKeyboard(lists, (list) => `manual_list:${boardId}:${list.id}`);
        await ctx.editMessageText(manualListPickerText(board.name), { reply_markup: keyboard });
        await ctx.answerCallbackQuery();
        return;
      }

      saveBoardSelection(connection.userId, board.id, board.name);
      saveListSelection(connection.userId, todoList!.id, todoList!.name);
      saveDoingListSelection(connection.userId, doingList?.id ?? null);
      saveDoneListSelection(connection.userId, doneList?.id ?? null);

      const missing = [!doingList && "«Doing»", !doneList && "«Done»"].filter(
        (name): name is string => Boolean(name)
      );
      const missingNote =
        missing.length > 0
          ? `\n(لیست ${missing.join(" و ")} پیدا نشد، پس گزینه‌ی مربوطه در دسترس نیست.)`
          : "";

      // Continue the flow right here instead of asking the user to tap Tasks again.
      const selection = getSelection(connection.userId)!;
      await ctx.editMessageText(
        `✅ به بورد «${board.name}» وصل شدید (لیست‌های To Do/Doing/Done به‌صورت خودکار شناسایی شدند).${missingNote}\nکدام دسته از کارت‌ها را می‌خواهید ببینید؟`,
        { reply_markup: buildStageMenuKeyboard(selection) }
      );
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error("Failed to save Trello board selection:", error);
      await ctx.editMessageText(
        "مشکلی در ذخیره انتخاب شما پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
      );
      await ctx.answerCallbackQuery();
    }
  });

  // List tapped in the "no To Do/Doing/Done" fallback keyboard: save it as a plain,
  // single-list selection (no doing/done list) and show its cards read-only.
  bot.callbackQuery(/^manual_list:([^:]+):(.+)$/, async (ctx) => {
    const [, boardId, listId] = ctx.match;
    const connection = requireTrelloConnection(ctx);
    if (!connection) {
      await ctx.editMessageText("اتصال Trello شما یافت نشد. لطفاً دوباره با /connect_trello تلاش کنید.");
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const [board, lists] = await Promise.all([
        fetchTrelloBoard(connection.apiKey, connection.userToken, boardId),
        fetchTrelloLists(connection.apiKey, connection.userToken, boardId),
      ]);

      const list = lists.find((item) => item.id === listId);
      if (!list) {
        throw new Error("Selected list no longer exists on the board");
      }

      saveBoardSelection(connection.userId, board.id, board.name);
      saveListSelection(connection.userId, list.id, list.name);
      saveDoingListSelection(connection.userId, null);
      saveDoneListSelection(connection.userId, null);

      await ctx.editMessageText(
        `✅ لیست «${list.name}» از بورد «${board.name}» انتخاب شد. در حال نمایش کارت‌ها (فقط‌خواندنی)...`,
        { reply_markup: new InlineKeyboard() }
      );
      await ctx.answerCallbackQuery();
      await replyWithStageTasks(ctx, "todo");
    } catch (error) {
      console.error("Failed to save manual Trello list selection:", error);
      await ctx.editMessageText(
        "مشکلی در ذخیره انتخاب شما پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
      );
      await ctx.answerCallbackQuery();
    }
  });
}
