import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
mkdirSync(resolve(root, "web/public"), { recursive: true });
copyFileSync(
  resolve(root, "target/wasm32-unknown-unknown/release/hunchnet.wasm"),
  resolve(root, "web/public/hunchnet.wasm"),
);
