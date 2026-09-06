export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

const BLOCKED_HOSTS = new Set(["localhost", "0.0.0.0", "127.0.0.1", "[::1]"]);

export function normalizeUrl(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "") {
    throw new ValidationError("url is required");
  }
  if (input.length > MAX_URL_LENGTH) {
    throw new ValidationError("url is too long");
  }

  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new ValidationError("url is not valid");
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new ValidationError("only http and https urls are allowed");
  }
  if (BLOCKED_HOSTS.has(parsed.hostname) || isPrivateAddress(parsed.hostname)) {
    throw new ValidationError("that host cannot be shortened");
  }

  parsed.hash = "";
  return parsed.toString();
}

function isPrivateAddress(host: string): boolean {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}
