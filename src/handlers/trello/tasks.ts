import { InlineKeyboard } from "grammy";
import type { Bot } from "grammy";
import { getSelection } from "../../db.js";
import type { TrelloSelection } from "../../db.js";
import { buildEntityKeyboard, buildStageMenuKeyboard, manualListPickerText, stageLabels } from "../../keyboards.js";
import type { MyContext } from "../../bot.js";
import { fetchTrelloCards, fetchTrelloLists, requireTrelloConnection } from "./api.js";
import { startBoardSelection } from "./boards.js";

// Readable due-date formatting, e.g. "Tue, Sep 23, 2025, 02:30 PM".
export function formatDueDate(due: string): string {
  return new Date(due).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// One of the three pipeline lists (todo/doing/done), whichever were actually found.
export interface PipelineStage {
  listId: string;
  listName: string;
}

// Fetches the board's current lists and returns whichever of todo/doing/done stages
// exist, with fresh names (in case a list was renamed since the board was picked).
export async function getPipelineStages(
  apiKey: string,
  userToken: string,
  selection: TrelloSelection
): Promise<PipelineStage[]> {
  const boardLists = await fetchTrelloLists(apiKey, userToken, selection.boardId);
  const nameOf = (listId: string) => boardLists.find((l) => l.id === listId)?.name ?? listId;

  return [
    { listId: selection.listId, listName: nameOf(selection.listId) },
    ...(selection.doingListId
      ? [{ listId: selection.doingListId, listName: nameOf(selection.doingListId) }]
      : []),
    ...(selection.doneListId
      ? [{ listId: selection.doneListId, listName: nameOf(selection.doneListId) }]
      : []),
  ];
}

// Shows cards from exactly ONE pipeline stage (not the other two), each with a button
// per other stage, side by side, so a card can move directly to either of them.
export async function replyWithStageTasks(
  ctx: MyContext,
  stageKey: "todo" | "doing" | "done"
): Promise<void> {
  const connection = requireTrelloConnection(ctx);
  if (!connection) {
    await ctx.reply("ابتدا با /connect_trello حساب Trello خود را وصل کنید.");
    return;
  }

  const selection = getSelection(connection.userId);
  if (!selection) {
    await ctx.reply("ابتدا روی دکمه‌ی Tasks بزنید تا یک بورد انتخاب کنید.");
    return;
  }

  const targetListId =
    stageKey === "todo"
      ? selection.listId
      : stageKey === "doing"
        ? selection.doingListId
        : selection.doneListId;
  if (!targetListId) {
    const missingName = stageKey === "doing" ? "Doing" : "Done";
    await ctx.reply(`لیست «${missingName}» برای این بورد پیدا نشد.`);
    return;
  }

  try {
    const stages = await getPipelineStages(connection.apiKey, connection.userToken, selection);
    const currentStage = stages.find((stage) => stage.listId === targetListId);
    const otherStages = stages.filter((stage) => stage.listId !== targetListId);
    const currentListName = currentStage?.listName ?? targetListId;

    const cards = await fetchTrelloCards(connection.apiKey, connection.userToken, targetListId);
    if (cards.length === 0) {
      await ctx.reply(`هیچ کارتی در لیست «${currentListName}» نیست 🎉`);
      return;
    }

    // One message per card, each with its own row of buttons, so moving one card
    // only edits that message.
    for (const card of cards) {
      const dueLine = card.due ? `\n📅 موعد: ${formatDueDate(card.due)}` : "";
      const keyboard = new InlineKeyboard();
      for (const target of otherStages) {
        keyboard.text(`➡️ ${target.listName}`, `advance_card:${card.id}:${target.listId}`);
      }
      await ctx.reply(`📌 ${card.name} [${currentListName}]${dueLine}`, {
        reply_markup: keyboard,
      });
    }
  } catch (error) {
    console.error("Failed to fetch Trello cards:", error);
    await ctx.reply(
      "مشکلی در دریافت کارت‌های Trello پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
    );
  }
}

// Shared handler for both /tasks and the "Tasks" button. No board picked yet? Start
// there first (folding the old /select_board step into this same flow). A board with
// no Doing/Done list has no fixed stage to jump to, so — same as right after picking
// such a board — show a fresh picker of its real lists every time, instead of always
// reopening whichever one was viewed last. Otherwise show the normal "which stage?" menu.
export async function startTasksMenu(ctx: MyContext): Promise<void> {
  const connection = requireTrelloConnection(ctx);
  if (!connection) {
    await ctx.reply("ابتدا با /connect_trello حساب Trello خود را وصل کنید.");
    return;
  }

  const selection = getSelection(connection.userId);
  if (!selection) {
    await startBoardSelection(ctx);
    return;
  }

  if (!selection.doingListId && !selection.doneListId) {
    try {
      const lists = await fetchTrelloLists(connection.apiKey, connection.userToken, selection.boardId);
      const keyboard = buildEntityKeyboard(
        lists,
        (list) => `manual_list:${selection.boardId}:${list.id}`
      );
      await ctx.reply(manualListPickerText(selection.boardName), { reply_markup: keyboard });
    } catch (error) {
      console.error("Failed to fetch Trello lists:", error);
      await ctx.reply(
        "مشکلی در دریافت لیست‌های Trello پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
      );
    }
    return;
  }

  await ctx.reply("کدام دسته از کارت‌ها را می‌خواهید ببینید؟", {
    reply_markup: buildStageMenuKeyboard(selection),
  });
}

export function registerTrelloTaskHandlers(bot: Bot<MyContext>): void {
  bot.command("tasks", startTasksMenu);
  bot.hears("Tasks", startTasksMenu);

  // Stage tapped in /tasks's inline menu: clears the menu and sends that stage's cards.
  bot.callbackQuery(/^show_stage:(todo|doing|done)$/, async (ctx) => {
    const stageKey = ctx.match[1] as "todo" | "doing" | "done";
    await ctx.editMessageText(`نمایش کارت‌های ${stageLabels[stageKey]}...`, {
      reply_markup: new InlineKeyboard(),
    });
    await ctx.answerCallbackQuery();
    await replyWithStageTasks(ctx, stageKey);
  });

  // A stage-advance button tapped in /tasks (todo→doing or doing→done): moves the card
  // to the target list embedded in the callback data.
  bot.callbackQuery(/^advance_card:([^:]+):(.+)$/, async (ctx) => {
    const [, cardId, targetListId] = ctx.match;
    const connection = requireTrelloConnection(ctx);
    if (!connection) {
      await ctx.editMessageText("اتصال Trello شما یافت نشد. لطفاً دوباره با /connect_trello تلاش کنید.");
      await ctx.answerCallbackQuery();
      return;
    }

    try {
      const response = await fetch(
        `https://api.trello.com/1/cards/${cardId}?idList=${targetListId}&key=${connection.apiKey}&token=${connection.userToken}`,
        { method: "PUT" }
      );
      if (!response.ok) {
        throw new Error(`Trello card update failed with status ${response.status}`);
      }

      // Label the confirmation using whichever known stage the card landed in.
      const selection = getSelection(connection.userId);
      let resultLabel = "➡️ منتقل شد";
      if (targetListId === selection?.doneListId) {
        resultLabel = "✅ انجام شد";
      } else if (targetListId === selection?.doingListId) {
        resultLabel = "🔧 به Doing منتقل شد";
      } else if (targetListId === selection?.listId) {
        resultLabel = "↩️ به Todo برگشت";
      }

      const originalText = ctx.callbackQuery.message?.text ?? "کارت";
      await ctx.editMessageText(`${originalText}\n\n${resultLabel}`, {
        reply_markup: new InlineKeyboard(),
      });
      await ctx.answerCallbackQuery();
    } catch (error) {
      console.error("Failed to advance Trello card:", error);
      await ctx.editMessageText(
        "مشکلی در جابه‌جایی کارت پیش آمد. لطفاً دوباره با /connect_trello تلاش کنید."
      );
      await ctx.answerCallbackQuery();
    }
  });
}
