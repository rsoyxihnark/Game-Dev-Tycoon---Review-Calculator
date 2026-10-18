import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PAGE = join(ROOT, "GameDevTycoon_Calculator.html");
export const CHANGELOG = join(ROOT, "CHANGELOG.md");
