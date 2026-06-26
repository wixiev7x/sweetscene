import "server-only";
import crypto from "crypto";

/**
 * AES-256-GCM encryption for message content at rest. The encryption
 * key is derived from the `MESSAGE_ENCRYPTION_KEY` env var (server-only,
 * never exposed to the browser via NEXT_PUBLIC_).
 *
 * Flow:
 *   - `sendMessage()` server action encrypts plaintext before INSERT.
 *   - `getMatchMessages()` server action decrypts ciphertext after SELECT.
 *   - Realtime delivers ciphertext — the client calls
 *     `decryptMessageContent()` to decrypt for display.
 *   - The AI wrapper decrypts chat history server-side before building
 *     the provider messages array.
 *
 * Encrypted format: base64(iv || authTag || ciphertext)
 *   - iv:      12 random bytes (GCM standard nonce length)
 *   - authTag: 16 bytes (GCM authentication tag)
 *   - ciphertext: variable length
 *
 * The auth tag ensures tamper detection — if anyone modifies the
 * ciphertext in the DB, decryption fails with an auth error.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 32-byte AES key from the env var. Uses SHA-256 so any
 * string key works regardless of length. Falls back to a dev-only
 * key when the env var is missing — encrypted but NOT secure in dev.
 */
function getKey(): Buffer {
  const raw =
    process.env.MESSAGE_ENCRYPTION_KEY ??
    "dev-only-key-change-in-production";
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a plaintext string into a base64-encoded ciphertext bundle.
 * Uses a fresh random IV per call so identical messages produce
 * different ciphertexts.
 */
export function encryptMessage(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypts a base64-encoded ciphertext bundle back to plaintext.
 * Throws if the auth tag verification fails (tampered or corrupted
 * data). Callers should catch and return a graceful error.
 */
export function decryptMessage(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
