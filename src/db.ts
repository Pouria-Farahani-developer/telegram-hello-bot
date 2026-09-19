import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Keep the database file out of the repo root, grouped with other local data.
const dataDir = path.join(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, "bot.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS trello_accounts (
    telegram_user_id INTEGER PRIMARY KEY,
    trello_token TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Adds the board/list selection columns for installs that predate stage 2.
const existingColumns = new Set(
  (db.prepare(`PRAGMA table_info(trello_accounts)`).all() as { name: string }[]).map(
    (column) => column.name
  )
);
for (const column of ["board_id", "board_name", "list_id", "list_name"]) {
  if (!existingColumns.has(column)) {
    db.exec(`ALTER TABLE trello_accounts ADD COLUMN ${column} TEXT`);
  }
}

// Inserts or replaces the token for a user, keeping their original created_at.
export function saveTrelloToken(telegramUserId: number, token: string): void {
  db.prepare(
    `INSERT INTO trello_accounts (telegram_user_id, trello_token)
     VALUES (?, ?)
     ON CONFLICT(telegram_user_id) DO UPDATE SET trello_token = excluded.trello_token`
  ).run(telegramUserId, token);
}

export function getTrelloToken(telegramUserId: number): string | null {
  const row = db
    .prepare(`SELECT trello_token FROM trello_accounts WHERE telegram_user_id = ?`)
    .get(telegramUserId) as { trello_token: string } | undefined;
  return row?.trello_token ?? null;
}

export function deleteTrelloToken(telegramUserId: number): void {
  db.prepare(`DELETE FROM trello_accounts WHERE telegram_user_id = ?`).run(telegramUserId);
}

export interface TrelloSelection {
  boardId: string;
  boardName: string;
  listId: string;
  listName: string;
}

// Saves the chosen board and clears any list picked under a previous board.
export function saveBoardSelection(
  telegramUserId: number,
  boardId: string,
  boardName: string
): void {
  db.prepare(
    `UPDATE trello_accounts
     SET board_id = ?, board_name = ?, list_id = NULL, list_name = NULL
     WHERE telegram_user_id = ?`
  ).run(boardId, boardName, telegramUserId);
}

export function saveListSelection(telegramUserId: number, listId: string, listName: string): void {
  db.prepare(
    `UPDATE trello_accounts SET list_id = ?, list_name = ? WHERE telegram_user_id = ?`
  ).run(listId, listName, telegramUserId);
}

// Returns the saved board+list selection, or null if either half is missing.
export function getSelection(telegramUserId: number): TrelloSelection | null {
  const row = db
    .prepare(
      `SELECT board_id, board_name, list_id, list_name
       FROM trello_accounts WHERE telegram_user_id = ?`
    )
    .get(telegramUserId) as
    | { board_id: string | null; board_name: string | null; list_id: string | null; list_name: string | null }
    | undefined;

  if (!row?.board_id || !row.board_name || !row.list_id || !row.list_name) {
    return null;
  }

  return {
    boardId: row.board_id,
    boardName: row.board_name,
    listId: row.list_id,
    listName: row.list_name,
  };
}
