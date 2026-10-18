import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PAGE = join(ROOT, "GameDevTycoon_Calculator.html");
export const CHANGELOG = join(ROOT, "CHANGELOG.md");
export const VERSION_PATTERN = /^const APP_VERSION = "([^"]*)";[\r]?$/m;

export function readVersion() {
  const match = VERSION_PATTERN.exec(readFileSync(PAGE, "utf8"));
  if (!match) throw new Error("GameDevTycoon_Calculator.html has no APP_VERSION line");
  return match[1];
}

export function isThreePart(version) {
  return /^\d+\.\d+\.\d+$/.test(version);
}

export function changelogSections() {
  return [...readFileSync(CHANGELOG, "utf8").matchAll(/^## +(.+?)\s*$/gm)].map((m) => m[1]);
}

if (process.argv[1] && process.argv[1].endsWith("version.mjs")) process.stdout.write(readVersion());
