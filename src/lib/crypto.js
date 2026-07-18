/**
 * Token-at-rest encryption (AES-256-GCM) for `JiraCredential.encryptedToken`.
 *
 * §13 hardening item 1 / §16: personal Jira API tokens are encrypted at rest with a key from a
 * secret store (`TOKEN_ENCRYPTION_KEY`); the raw token is never persisted. Pure module — no DB, no
 * Jira, no Next — so it is unit-testable in isolation and safe to import anywhere.
 *
 * Stored format (base64): `iv(12) ‖ authTag(16) ‖ ciphertext`. A fresh random IV per call means the
 * same plaintext encrypts to different ciphertext each time; the GCM auth tag makes tampering fail
 * loudly on decrypt.
 *
 * The key is read + validated at call time (not module load) so `yarn build` stays env-free.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_BYTES = 32;

/** @returns {Buffer} the 32-byte key; throws loudly if missing/wrong-length. */
function getKey() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY is not set (expected a base64-encoded 32-byte key; generate one with `openssl rand -base64 32`)",
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length}); generate one with \`openssl rand -base64 32\``,
    );
  }
  return key;
}

/**
 * Encrypt a secret (the Jira API token) for storage.
 * @param {string} plaintext
 * @returns {string} base64 of `iv ‖ authTag ‖ ciphertext`
 */
export function encryptToken(plaintext) {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

/**
 * Decrypt a value produced by {@link encryptToken}. Throws if the key is wrong or the payload was
 * tampered with (GCM auth-tag check).
 * @param {string} payload base64 of `iv ‖ authTag ‖ ciphertext`
 * @returns {string} the original plaintext
 */
export function decryptToken(payload) {
  const key = getKey();
  const buf = Buffer.from(String(payload), "base64");
  const iv = buf.subarray(0, IV_BYTES);
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buf.subarray(IV_BYTES + AUTH_TAG_BYTES);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
