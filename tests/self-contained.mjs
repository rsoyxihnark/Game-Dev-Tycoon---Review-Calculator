import { launchChromium } from "./lib/browser.mjs";
import { statSync } from "node:fs";
import { PAGE } from "./lib/paths.mjs";
import { PAGE_TEXT } from "./lib/page.mjs";
import { check, heading, finish } from "./lib/report.mjs";

heading("the page references nothing outside itself");
const externals = [
  ...PAGE_TEXT.matchAll(/\b(?:src|href)\s*=\s*["'](?!data:)([a-z]+:|\/\/)[^"']*/gi),
  ...PAGE_TEXT.matchAll(/@import[^;]*/gi),
  ...PAGE_TEXT.matchAll(/\bfetch\s*\(|XMLHttpRequest|importScripts/g),
].map((m) => m[0].slice(0, 90));
check("no external src, href, @import, fetch or XHR", externals.length === 0, externals.join("\n"));
check("the generated stylesheet is present",
  PAGE_TEXT.includes('<style id="generated-utilities">'));
check("the page is one file under 1 MB", statSync(PAGE).size < 1024 * 1024,
  `${statSync(PAGE).size} bytes`);

heading("it loads and runs with the network switched off");
const browser = await launchChromium();
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errors = [];
  const attempted = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  page.on("request", (r) => { if (/^https?:/.test(r.url())) attempted.push(r.url()); });
  await page.route((url) => /^https?:/.test(url.href), (route) => route.abort());
  await page.goto("file://" + PAGE, { waitUntil: "load" });
  await page.waitForTimeout(2500);

  check("the page made no network requests", attempted.length === 0, attempted.slice(0, 5).join("\n"));
  check("the page threw no errors", errors.length === 0, errors.slice(0, 5).join("\n"));

  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll(".modal-bg")].map((m) => [m.id, getComputedStyle(m).display]));
  check("every modal starts hidden, so none can get stuck open",
    hidden.length > 0 && hidden.every(([, display]) => display === "none"),
    JSON.stringify(hidden));

  const styled = await page.evaluate(() => {
    const card = document.querySelector(".card");
    const body = getComputedStyle(document.body);
    return {
      cardRadius: card ? getComputedStyle(card).borderRadius : "",
      bodyBackground: body.backgroundColor,
      headingSize: getComputedStyle(document.querySelector("h1")).fontSize,
    };
  });
  check("the stylesheet applied, so the page is not rendering unstyled",
    styled.cardRadius !== "0px" && styled.bodyBackground !== "rgba(0, 0, 0, 0)",
    JSON.stringify(styled));

  const toast = await page.evaluate(() => document.querySelector("#toast_host")?.innerText || "");
  check("no warning toast on load", toast.trim() === "", JSON.stringify(toast));

  const modalFlow = await page.evaluate(async () => {
    const modal = document.querySelector("#calib_modal");
    document.querySelector("#btn_calibrate").click();
    await new Promise((r) => setTimeout(r, 120));
    const opened = getComputedStyle(modal).display !== "none";
    document.querySelector("#calib_cancel").click();
    await new Promise((r) => setTimeout(r, 120));
    return { opened, closed: getComputedStyle(modal).display === "none" };
  });
  check("the back-solve dialog opens on its button and closes on Cancel",
    modalFlow.opened && modalFlow.closed, JSON.stringify(modalFlow));
} finally {
  await browser.close();
}

finish();
