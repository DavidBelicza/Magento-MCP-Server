import { copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../../README.md");
const dest = resolve(here, "../README.md");

if (existsSync(source)) {
  copyFileSync(source, dest);
  console.log("Synced README.md into packages/site.");
} else {
  console.log("Repo-root README.md not found; using the existing copy.");
}
