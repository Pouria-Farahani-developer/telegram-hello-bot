import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// TOKEN_ENCRYPTION_KEY is populated by dotenv, which is loaded by config.ts.
// config.ts is always imported (directly or transitively) before any module
// that imports db.ts (and therefore this module) — see bot.ts's import order,
// where "./config.js" precedes the handler imports that pull in db.ts — so
// process.env is already populated by the time this file is evaluated.
const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
if (!keyHex) {
  throw new Error(
    "TOKEN_ENCRYPTION_KEY is not set. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
}
const key = Buffer.from(keyHex, "hex");
if (key.length !== 32) {
  throw new Error("TOKEN_ENCRYPTION_KEY must be a 32-byte value encoded as 64 hex characters.");
}

// Encrypts a string with AES-256-GCM, returning base64(iv || authTag || ciphertext).
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

// Reverses encrypt(): expects base64(iv || authTag || ciphertext).
export function decrypt(encoded: string): string {
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
