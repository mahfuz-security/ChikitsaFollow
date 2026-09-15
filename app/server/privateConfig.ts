import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export function privateConfig() {
  const directory = process.env.PRIVATE_DATA_DIR || fileURLToPath(new URL(".private/", import.meta.url));
  let key = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!key) {
    // The Release hosting surface has no runtime secret injection, so production
    // falls back to a generated key file in PRIVATE_DATA_DIR instead of refusing
    // to boot. A managed key plus a durable volume is still required for real
    // refund data: an ephemeral filesystem regenerates the key on restart.
    if (process.env.NODE_ENV === "production") console.warn("PAYOUT_ENCRYPTION_KEY is not set; using a generated key in PRIVATE_DATA_DIR. Configure a managed key and a durable volume before storing real refund data.");
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const path = resolve(directory, "payout.key");
    if (!existsSync(path)) writeFileSync(path, randomBytes(32).toString("base64"), { flag: "wx", mode: 0o600 });
    key = readFileSync(path, "utf8").trim();
  }
  return { path: resolve(directory, "private.sqlite"), key: Buffer.from(key, "base64") };
}
