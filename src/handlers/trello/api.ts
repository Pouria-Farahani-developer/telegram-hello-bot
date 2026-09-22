import { getTrelloToken } from "../../db.js";
import { TRELLO_API_KEY } from "../../config.js";
import type { MyContext } from "../../bot.js";

// A Trello board or list, as returned by the API when only `fields=name` is requested.
export interface TrelloEntity {
  id: string;
  name: string;
}

export async function fetchTrelloJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Trello request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchTrelloBoards(apiKey: string, userToken: string): Promise<TrelloEntity[]> {
  return fetchTrelloJson(
    `https://api.trello.com/1/members/me/boards?key=${apiKey}&token=${userToken}&fields=name`
  );
}

export function fetchTrelloBoard(apiKey: string, userToken: string, boardId: string): Promise<TrelloEntity> {
  return fetchTrelloJson(
    `https://api.trello.com/1/boards/${boardId}?key=${apiKey}&token=${userToken}&fields=name`
  );
}

export function fetchTrelloLists(
  apiKey: string,
  userToken: string,
  boardId: string
): Promise<TrelloEntity[]> {
  return fetchTrelloJson(
    `https://api.trello.com/1/boards/${boardId}/lists?key=${apiKey}&token=${userToken}&fields=name`
  );
}

// One card from GET /1/lists/{id}/cards (only the fields we display are requested).
export interface TrelloCard {
  id: string;
  name: string;
  due: string | null;
}

export function fetchTrelloCards(
  apiKey: string,
  userToken: string,
  listId: string
): Promise<TrelloCard[]> {
  return fetchTrelloJson(
    `https://api.trello.com/1/lists/${listId}/cards?key=${apiKey}&token=${userToken}&fields=name,due`
  );
}

// Returns the caller's id, API key, and Trello token if they're connected, otherwise null.
// Callers decide how to report a missing connection (ctx.reply vs. editMessageText).
export function requireTrelloConnection(
  ctx: MyContext
): { userId: number; apiKey: string; userToken: string } | null {
  const userId = ctx.from?.id;
  const userToken = userId ? getTrelloToken(userId) : null;
  return TRELLO_API_KEY && userId && userToken
    ? { userId, apiKey: TRELLO_API_KEY, userToken }
    : null;
}
