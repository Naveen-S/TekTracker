/**
 * Share-link token generation (share-view-export.md decision 4). The `/share/<token>` URL is a
 * bearer capability with no further auth (decision 2), so the token must be unguessable — the
 * schema's `@default(cuid())` is timestamp+counter-based and too predictable for that. 24 random
 * bytes → 32-char base64url (192 bits), always supplied explicitly on create.
 */
import { randomBytes } from "node:crypto";

export function generateShareToken() {
  return randomBytes(24).toString("base64url");
}
