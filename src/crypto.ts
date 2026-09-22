import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { TOKEN_ENCRYPTION_KEY } from "./config.js";

// config.ts has already validated TOKEN_ENCRYPTION_KEY is present and is a
// 32-byte value encoded as 64 hex characters.
const key = Buffer.from(TOKEN_ENCRYPTION_KEY, "hex");

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
