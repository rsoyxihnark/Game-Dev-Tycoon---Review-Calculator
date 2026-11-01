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

const tailwind = (file) => join(ROOT, "node_modules", "tailwindcss", file).replaceAll("\\", "/");

// Valuable-Run-Lesson: diffing every computed style against the Tailwind 3 build at four widths showed these rules, with preflight kept in a layer, are what makes Tailwind 4 render the page with no box moved.
const V3_LOOK = `
@layer base {
  *,::after,::before,::backdrop,::file-selector-button{border-color:#e5e7eb}
  input::placeholder,textarea::placeholder{color:#9ca3af}
  button,[role=button]{cursor:pointer}
  :disabled{cursor:default}
  td,th{padding:1px}
  option{padding:revert}
  input,select,optgroup,textarea{background-color:revert;border-radius:revert}
  [type=search]{-webkit-appearance:textfield;outline-offset:-2px}
}
select{color:inherit;padding:0}
.hidden{display:none}
.transition{transition-property:color,background-color,border-color,text-decoration-color,fill,stroke,opacity,box-shadow,transform,filter,backdrop-filter}
@theme {
  --font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --text-xs--line-height: 1rem;
  --text-sm--line-height: 1.25rem;
  --text-base--line-height: 1.5rem;
  --text-lg--line-height: 1.75rem;
  --text-xl--line-height: 1.75rem;
  --text-2xl--line-height: 2rem;
  --text-3xl--line-height: 2.25rem;
  --text-4xl--line-height: 2.5rem;
  --text-5xl--line-height: 1;
}
`;

const work = mkdtempSync(join(tmpdir(), "gdt-styles-"));
try {
  writeFileSync(join(work, "scan.html"), before + after);
  writeFileSync(join(work, "in.css"), [
    "@layer base;",
    `@import "${tailwind("theme.css")}";`,
    `@import "${tailwind("preflight.css")}" layer(base);`,
    `@import "${tailwind("utilities.css")}" source(none);`,
    `@source "./scan.html";`,
    V3_LOOK,
  ].join("\n"));
  execFileSync(process.execPath, [
    join(ROOT, "node_modules", "@tailwindcss", "cli", "dist", "index.mjs"),
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
