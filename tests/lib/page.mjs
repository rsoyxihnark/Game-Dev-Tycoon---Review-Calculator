import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PAGE } from "./paths.mjs";

const lines = readFileSync(PAGE, "utf8").split("\n");

function lineOf(re) {
  const i = lines.findIndex((l) => re.test(l));
  if (i < 0) throw new Error(`GameDevTycoon_Calculator.html no longer has a line matching ${re}`);
  return i + 1;
}
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

export async function loadCalculator() {
  const source = [
    slice(lineOf(/^const TOPSCORE_MAX/), lineOf(/^function ymwToWeek/) - 1),
    slice(lineOf(/^const TOPICS_BY_ID/), lineOf(/^const OPT_TEAM_SIZE/)),
    slice(lineOf(/^const gi = /), lineOf(/^function findCombos/) - 1),
    slice(lineOf(/^function mulberry32/), lineOf(/^function mulberry32/) + 8),
    "export { calcReview, simulateReviewers, displayedScore, hasRecordedTopScore, mulberry32,",
    "  TOPICS, PLATFORMS, MISSIONS, PLATFORM_DATES, PLATFORM_MARKET, GENRES, AUDIENCES, GAME_SIZES };",
  ].join("\n");

  const dir = mkdtempSync(join(tmpdir(), "gdt-page-"));
  const file = join(dir, "calculator.mjs");
  writeFileSync(file, source);
  try {
    return await import("file://" + file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export const PAGE_TEXT = readFileSync(PAGE, "utf8");
