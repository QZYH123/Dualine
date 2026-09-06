import { randomBytes } from "node:crypto";

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export const SLUG_LENGTH = 7;

// 256 is not a multiple of 62. Bytes at or above this value are
// discarded so that every character is equally likely.
const UNBIASED_MAX = 256 - (256 % ALPHABET.length); // 248

export function randomSlug(length = SLUG_LENGTH): string {
  let out = "";
  while (out.length < length) {
    const bytes = randomBytes(length * 2);
    for (const byte of bytes) {
      if (byte >= UNBIASED_MAX) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

const SLUG_PATTERN = /^[0-9A-Za-z]{4,16}$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
