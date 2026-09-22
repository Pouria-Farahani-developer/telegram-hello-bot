import { InlineKeyboard, Keyboard } from "grammy";
import type { TrelloSelection } from "./db.js";
import type { TrelloEntity } from "./handlers/trello/api.js";

// Reply keyboard shown to the user, with buttons mirroring the commands below.
export const mainKeyboard = new Keyboard()
  .text("Restart")
  .text("Today")
  .text("Gold Price")
  .row()
  .text("Connect Trello")
  .text("Disconnect Trello")
  .row()
  .text("Tasks")
  .text("Change Board")
  .resized();

// Builds one inline button per Trello entity, each row containing a single button.
export function buildEntityKeyboard(
  entities: TrelloEntity[],
  callbackPrefix: (entity: TrelloEntity) => string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const entity of entities) {
    keyboard.text(entity.name, callbackPrefix(entity)).row();
  }
  return keyboard;
}

// Display label for each stage key, used on the inline menu buttons below.
export const stageLabels: Record<"todo" | "doing" | "done", string> = {
  todo: "Todo",
  doing: "Doing",
  done: "Done",
};

// Builds the "which stage?" inline keyboard, offering only stages that were found.
export function buildStageMenuKeyboard(selection: TrelloSelection): InlineKeyboard {
  const keyboard = new InlineKeyboard().text(stageLabels.todo, "show_stage:todo");
  if (selection.doingListId) {
    keyboard.text(stageLabels.doing, "show_stage:doing");
  }
  if (selection.doneListId) {
    keyboard.text(stageLabels.done, "show_stage:done");
  }
  return keyboard;
}

// Message shown above the manual list-picker, for a board with no Doing/Done list
// to build a Todo/Doing/Done stage menu from.
export function manualListPickerText(boardName: string): string {
  return `بورد «${boardName}» پایپ‌لاین Todo/Doing/Done ندارد. یکی از لیست‌های زیر را برای مشاهده‌ی کارت‌ها (فقط‌خواندنی) انتخاب کنید:`;
}
