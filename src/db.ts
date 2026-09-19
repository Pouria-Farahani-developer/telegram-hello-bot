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
