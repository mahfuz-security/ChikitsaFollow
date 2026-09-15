import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function privateConfig() {
  const directory = process.env.PRIVATE_DATA_DIR || fileURLToPath(new URL(".private/", import.meta.url));
  let key = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("PAYOUT_ENCRYPTION_KEY is required in production.");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = resolve(directory, "payout.key");
    if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("base64"), { flag: "wx", mode: 0o600 });
    key = readFileSync(path, "utf8").trim();
  }
  return { path: resolve(directory, "private.sqlite"), key: Buffer.from(key, "base64") };
}
