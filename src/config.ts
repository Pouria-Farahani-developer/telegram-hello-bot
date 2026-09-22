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

// Used by crypto.ts to encrypt/decrypt stored Trello tokens at rest.
const encryptionKeyHex = process.env.TOKEN_ENCRYPTION_KEY;
if (!encryptionKeyHex) {
  throw new Error(
    "TOKEN_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}
if (Buffer.from(encryptionKeyHex, "hex").length !== 32) {
  throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte value encoded as 64 hex characters.");
}
export const TOKEN_ENCRYPTION_KEY = encryptionKeyHex;
