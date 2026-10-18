import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = join(ROOT, "GameDevTycoon_Calculator.html");
const OPEN_TAG = '<style id="generated-utilities">';
const CLOSE_TAG = "</style>";

const checkOnly = process.argv.includes("--check");
const html = readFileSync(PAGE, "utf8");

const blockStart = html.indexOf(OPEN_TAG);
if (blockStart < 0) {
  console.error(`${PAGE} has no ${OPEN_TAG} element to write into.`);
  process.exit(1);
}
const blockEnd = html.indexOf(CLOSE_TAG, blockStart);
if (blockEnd < 0) {
  console.error(`${PAGE} never closes ${OPEN_TAG}.`);
  process.exit(1);
}
const before = html.slice(0, blockStart);
const after = html.slice(blockEnd + CLOSE_TAG.length);

// Valuable-Run-Lesson: rendering both ways and diffing computed styles showed this block must follow the hand-written <style>, because the old CDN injected at the end of head. Moving it earlier changed 134 properties across 1212 elements.
if (!/^\s*<\/head>/.test(after)) {
  console.error("The generated stylesheet must be the last element inside <head>.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "gdt-styles-"));
try {
  const scanned = join(work, "scan.html");
  writeFileSync(scanned, before + after);
  writeFileSync(join(work, "in.css"), "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n");
  writeFileSync(join(work, "tailwind.config.js"),
    `module.exports={content:[${JSON.stringify(scanned)}],theme:{extend:{}},plugins:[]};\n`);
  execFileSync(process.execPath, [
    join(ROOT, "node_modules", "tailwindcss", "lib", "cli.js"),
    "-c", join(work, "tailwind.config.js"),
    "-i", join(work, "in.css"),
    "-o", join(work, "out.css"),
    "--minify",
  ], { stdio: ["ignore", "ignore", "inherit"] });

  const css = readFileSync(join(work, "out.css"), "utf8").trim();
  const next = before + OPEN_TAG + css + CLOSE_TAG + after;

  if (next === html) {
    console.log("stylesheet is up to date");
    process.exit(0);
  }
  if (checkOnly) {
    console.error("The stylesheet inside GameDevTycoon_Calculator.html is stale.");
    console.error("Run: node tools/build-styles.mjs");
    process.exit(1);
  }
  writeFileSync(PAGE, next);
  console.log(`stylesheet rewritten, ${css.length} bytes`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
