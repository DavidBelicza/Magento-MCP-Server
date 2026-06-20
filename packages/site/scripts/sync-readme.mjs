import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dest = resolve(here, "../README.md");
const repoRoot = resolve(here, "../../../README.md");

const source = existsSync(repoRoot) ? repoRoot : dest;

if (!existsSync(source)) {
  console.log("No README.md source found; skipping site README sync.");
  process.exit(0);
}

const raw = readFileSync(source, "utf8");

const headingIndex = raw.search(/^## /m);
const withoutHeader = headingIndex === -1 ? raw : raw.slice(headingIndex);

const withoutMermaid = withoutHeader.replace(/^```mermaid\n[\s\S]*?^```\n?/gm, "");

writeFileSync(dest, withoutMermaid);
console.log("Synced README.md into packages/site (branding header and mermaid stripped).");
