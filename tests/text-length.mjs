import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse, parseFragment } from "parse5";
import { PAGE_TEXT } from "./lib/page.mjs";
import { CHANGELOG, ROOT } from "./lib/paths.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const LIMIT = 248;
const BLOCK_COMMENT = /\/\*/;
const MEASURED_ATTRS = new Set(["title", "placeholder", "aria-label", "alt"]);
const squash = (t) => t.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const show = (t) => (t.length > 120 ? t.slice(0, 117) + "..." : t);

function markupTexts(html) {
  const found = [];
  const walk = (node) => {
    if (node.attrs) {
      for (const a of node.attrs) {
        if (MEASURED_ATTRS.has(a.name)) found.push({ what: `${a.name} attribute`, text: squash(a.value) });
      }
    }
    if (node.nodeName === "#text") {
      const parent = node.parentNode ? node.parentNode.nodeName : "";
      if (parent === "script" || parent === "style") return;
      if (parent === "noscript") { walk(parseFragment(node.value)); return; }
      for (const para of node.value.split(/\n\s*\n/)) {
        const t = squash(para);
        if (t) found.push({ what: "page text", text: t });
      }
    }
    for (const child of node.childNodes || []) walk(child);
  };
  walk(parse(html));
  return found;
}

const scriptOf = (html) => html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

function readLiteral(src, from, quote) {
  let out = "", escaped = false, depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (escaped) { out += c; escaped = false; continue; }
    if (c === "\\") { escaped = true; out += c; continue; }
    if (c === quote && depth === 0) return out;
    if (quote === "`") {
      if (c === "{" && src[i - 1] === "$") depth++;
      else if (c === "}" && depth > 0) depth--;
    }
    out += c;
  }
  return out;
}

const stripMarkup = (t) =>
  squash(t.replace(/\$\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, "NN").replace(/<[^>]+>/g, ""));

function messageLiterals(html) {
  const js = scriptOf(html);
  const found = [];
  for (const m of js.matchAll(/\b(toast|flash|clearOutputs|alert)\(\s*(`|"|')/g)) {
    found.push({ what: `${m[1]}() message`, text: stripMarkup(readLiteral(js, m.index + m[0].length, m[2])) });
  }
  return found;
}

function adviceLines(html) {
  const js = scriptOf(html);
  const found = [];
  for (const m of js.matchAll(/html\s*:\s*`/g)) {
    for (const part of readLiteral(js, m.index + m[0].length, "`").split(/<br\s*\/?>/i)) {
      const t = stripMarkup(part);
      if (t) found.push({ what: "advice line", text: t });
    }
  }
  return found;
}

function dashLines(text) {
  const found = [];
  for (const [i, line] of text.split("\n").entries()) {
    for (const ch of line) {
      const code = ch.codePointAt(0);
      if (code === 0x2014 || code === 0x2013) {
        found.push({ line: i + 1, code: `U+${code.toString(16).toUpperCase()}` });
        break;
      }
    }
  }
  return found;
}

function commentLines(text) {
  const found = [];
  for (const [i, line] of text.split("\n").entries()) {
    if (!/^\s*\/\//.test(line)) continue;
    if (/^\s*\/\/\s*Valuable-Run-Lesson:/.test(line)) continue;
    found.push({ line: i + 1, text: line.trim().slice(0, 60) });
  }
  return found;
}

function runLessonNotes(text) {
  return [...text.matchAll(/^\s*\/\/\s*(Valuable-Run-Lesson:.*)$/gm)]
    .map((m) => ({ what: "Valuable-Run-Lesson note", text: m[1].trim() }));
}

heading("the scanners find a case they are pointed at");
const CONTROL = join(ROOT, "tests", "fixtures", "scan-control.html");
{
  const html = readFileSync(CONTROL, "utf8");
  const body = scriptOf(html);
  const overIn = (list) => list.filter((e) => e.text.length > LIMIT).length;
  check("the markup scanner finds the planted over-length attribute and paragraphs",
    overIn(markupTexts(html)) >= 3, `found ${overIn(markupTexts(html))}`);
  check("the message scanner finds the planted over-length toast",
    overIn(messageLiterals(html)) === 1, `found ${overIn(messageLiterals(html))}`);
  check("the advice scanner finds the planted over-length advice line",
    overIn(adviceLines(html)) === 1, `found ${overIn(adviceLines(html))}`);
  check("the dash scanner finds the planted em dash and en dash",
    dashLines(html).length === 1, JSON.stringify(dashLines(html)));
  check("the comment scanner finds the planted comment and allows a Valuable-Run-Lesson note",
    commentLines(body).length === 1, JSON.stringify(commentLines(body)));
  check("the block-comment scanner finds the planted block comment", BLOCK_COMMENT.test(body));
}

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const CONTROL_REL = join("tests", "fixtures", "scan-control.html");
const EXEMPT = new Set(["CLAUDE.md", "codeNw.js", "slot_1", "slot_2", "package-lock.json",
  "GameDevTycoon Experts-Specialists.xlsx", "Game Dev Tycoon brain shortcut.lnk"]);
const textFiles = [];
const collect = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (statSync(full).isDirectory()) { if (!SKIP_DIRS.has(name)) collect(full); continue; }
    if (EXEMPT.has(rel) || EXEMPT.has(name) || rel === CONTROL_REL) continue;
    let text;
    try { text = readFileSync(full, "utf8"); } catch { continue; }
    if (text.includes("\u0000")) continue;
    textFiles.push({ rel, text });
  }
};
collect(ROOT);

heading(`no text over ${LIMIT} characters`);
const changelogLines = existsSync(CHANGELOG)
  ? readFileSync(CHANGELOG, "utf8").split("\n").map((l) => ({ what: "changelog line", text: l.trimEnd() })).filter((e) => e.text)
  : [];
for (const [name, entries] of [
  ["page markup", markupTexts(PAGE_TEXT)],
  ["toast and flash messages", messageLiterals(PAGE_TEXT)],
  ["generated advice lines", adviceLines(PAGE_TEXT)],
  ["CHANGELOG.md", changelogLines],
  ["Valuable-Run-Lesson notes", textFiles.flatMap((f) => runLessonNotes(f.text))],
]) {
  const over = entries.filter((e) => e.text.length > LIMIT);
  check(`${name}: ${entries.length} texts measured, none over ${LIMIT}`, over.length === 0,
    over.map((e) => `${e.what} is ${e.text.length}: ${show(e.text)}`).join("\n"));
}

heading("no em dash or en dash anywhere in the repository");
const dashHits = textFiles.flatMap((f) => dashLines(f.text).map((d) => `${f.rel}:${d.line} has ${d.code}`));
check(`${textFiles.length} files read and scanned by code point, none carry U+2014 or U+2013`,
  dashHits.length === 0, dashHits.slice(0, 20).join("\n"));

heading("no code comments outside a Valuable-Run-Lesson note");
const commentHits = [];
for (const f of textFiles) {
  if (!/\.(mjs|js|html|yml|yaml)$/.test(f.rel)) continue;
  const body = f.rel.endsWith(".html") ? scriptOf(f.text) : f.text;
  for (const c of commentLines(body)) commentHits.push(`${f.rel}:${c.line}: ${c.text}`);
  if (f.rel.endsWith(".html") && /<!--/.test(f.text)) commentHits.push(`${f.rel} has an html comment`);
  if (BLOCK_COMMENT.test(body)) commentHits.push(`${f.rel} has a block comment`);
}
check("no line or block comments and no html comments, bar Valuable-Run-Lesson notes",
  commentHits.length === 0, commentHits.slice(0, 20).join("\n"));

finish();
