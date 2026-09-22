import "dotenv/config";

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error("BOT_TOKEN is not set. Did you create a .env file?");
}
export const BOT_TOKEN = token;

// Used by /gold; checked lazily so a missing key only breaks that one command.
export const BRS_API_KEY = process.env.BRS_API_KEY;

// Used by /connect_trello; checked lazily so a missing key only breaks that command.
export const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
