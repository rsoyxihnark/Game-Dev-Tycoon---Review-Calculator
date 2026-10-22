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

  await page.evaluate(() => {
    for (const k of ["topics", "genres", "audiences"]) localStorage.setItem("gdt_calc_locked_" + k + "_v1", "[]");
    location.reload();
  });
  await page.waitForTimeout(1600);
  const overrideEffect = await page.evaluate(async () => {
    const set = (id, v) => {
      const e = document.querySelector(id);
      e.value = v;
      e.dispatchEvent(new Event("change", { bubbles: true }));
      e.dispatchEvent(new Event("input", { bubbles: true }));
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    set("#i_topic", "Fantasy"); set("#i_genre", "RPG"); set("#i_aud", "everyone");
    set("#i_size", "medium"); set("#i_D", "14"); set("#i_T", "10"); set("#i_top", "20");
    set("#i_year", "6"); set("#i_tsa", "0"); set("#i_fans", "500000");
    set("#i_clevel", "2"); set("#i_team", "3");
    document.querySelectorAll("[data-mission]").forEach((el, i) => {
      el.value = [100, 100, 0, 100, 100, 0, 100, 0, 0][i];
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await wait(1400);
    const before = document.querySelector("#o_score").textContent;
    document.querySelector("#i_hadtop").click();
    await wait(1400);
    return { before, after: document.querySelector("#o_score").textContent };
  });
  check("ticking the past-top-score box opens the pity floor and the score moves",
    overrideEffect.before !== overrideEffect.after,
    `score stayed at ${overrideEffect.before}; a new input that is missing from paramsSignature looks exactly like this`);

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

  heading("it survives states a player can actually put it in");

  const freshPage = async (seed, locks) => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
    await p.route((url) => /^https?:/.test(url.href), (route) => route.abort());
    if (seed || locks) await p.addInitScript((v) => {
      try {
        if (v.seed) localStorage.setItem("gdt_calc_state_v2", v.seed);
        for (const [what, ids] of Object.entries(v.locks || {})) {
          localStorage.setItem("gdt_calc_locked_" + what + "_v1", JSON.stringify(ids));
        }
      } catch (e) {}
    }, { seed, locks });
    await p.goto("file://" + PAGE, { waitUntil: "load" });
    await p.waitForTimeout(900);
    return { ctx, p, errs };
  };

  for (const [what, bulk, wording] of [
    ["genre", '[data-bulk="genre"][data-bulkop="lock"]', "No genre unlocked"],
    ["audience", '[data-bulk="aud"][data-bulkop="lock"]', "No audience unlocked"],
  ]) {
    const { ctx, p, errs } = await freshPage(null);
    await p.evaluate((sel) => document.querySelectorAll(sel).forEach((b) => b.click()), bulk);
    await p.waitForTimeout(900);
    const seen = await p.evaluate(() => ({
      pill: document.querySelector("#o_pill").textContent.trim(),
      score: document.querySelector("#o_score").textContent.trim(),
    }));
    check(`locking every ${what} leaves the page working and names the library`,
      errs.length === 0 && seen.pill.startsWith(wording) && seen.score === "-",
      JSON.stringify({ errs: errs.slice(0, 3), seen }));
    await ctx.close();
  }

  for (const seed of ['{"platforms":"PC"}', '{"numeric":"abc"}', '{"checked":5,"sliders":[1,2]}',
                      '{"numeric":{"0":1},"checked":{"a b":true}}']) {
    const { ctx, p, errs } = await freshPage(seed);
    const resetWired = await p.evaluate(() => {
      document.querySelector("#btn_reset").click();
      return !document.querySelector("#reset_modal").classList.contains("hidden");
    });
    check(`a saved state of the wrong shape still loads and leaves Reset working ${seed}`,
      errs.length === 0 && resetWired === true,
      JSON.stringify({ errs: errs.slice(0, 3), resetWired }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null);
    const counts = [];
    for (const m of ["1", "12", "99", "-7"]) {
      await p.evaluate((v) => {
        const el = document.querySelector("#i_month");
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }, m);
      await p.waitForTimeout(400);
      counts.push(await p.evaluate((typed) => ({
        typed,
        listed: document.querySelectorAll("#dl_plats option").length,
        enabled: [...document.querySelectorAll("[data-plat]")].filter((c) => !c.disabled).length,
      }), m));
    }
    const agree = counts.every((c) => c.listed === c.enabled);
    const clamped = counts[1].listed === counts[2].listed && counts[0].listed === counts[3].listed;
    check("an out-of-range in-game month cannot split the platform list from the grid",
      errs.length === 0 && agree && clamped, JSON.stringify({ errs: errs.slice(0, 3), counts }));
    await ctx.close();
  }

  const ALL_UNLOCKED = { topics: [], genres: [], audiences: [] };

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const applied = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const year = document.querySelector("#i_year");
      year.value = "30";
      year.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(900);
      document.querySelector('.tab[data-tab="combo"]').click();
      await wait(400);
      const filter = document.querySelector("#cmb_topic");
      filter.value = "Pirate";
      filter.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(500);
      const arrow = document.querySelector("#cmb_tbody .cmb-arrow");
      const clicked = arrow ? arrow.dataset.ckey : null;
      const tier = document.querySelector("#cmb_count").textContent;
      if (arrow) arrow.click();
      await wait(1400);
      const got = [
        document.querySelector("#i_topic").value,
        document.querySelector("#i_genre").value,
        document.querySelector("#i_aud").value,
        ...[...document.querySelectorAll("[data-plat]:checked")].map((x) => x.dataset.plat),
      ].join("|");
      return { clicked, tier, got };
    });
    check("a combo applied from a filtered Perfect Combos table is the one that was clicked",
      errs.length === 0 && applied.tier.includes("top tier 3/4") && applied.clicked === applied.got,
      JSON.stringify({ errs: errs.slice(0, 3), applied }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const dist = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const multi = document.querySelector("#i_multiplat");
      multi.checked = true;
      multi.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(900);
      const filled = document.querySelector("#o_dist").innerText;
      const design = document.querySelector("#i_D");
      design.value = "77";
      design.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(60);
      const pc = document.querySelector('[data-plat="PC"]');
      pc.checked = false;
      pc.dispatchEvent(new Event("change", { bubbles: true }));
      await wait(900);
      return {
        filled,
        after: document.querySelector("#o_dist").innerText,
        median: document.querySelector("#o_dist_p50").textContent.trim(),
        score: document.querySelector("#o_score").textContent.trim(),
      };
    });
    check("the reviewer distribution does not come back after the setup goes invalid",
      errs.length === 0 && dist.filled.includes("%") && dist.score === "-" &&
        !dist.after.includes("%") && dist.median === "median -",
      JSON.stringify({ errs: errs.slice(0, 3), dist }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const label = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const btn = document.querySelector("#btn_report");
      const before = btn.textContent.replace(/\s+/g, " ").trim();
      btn.click();
      await wait(300);
      btn.click();
      await wait(2600);
      return { before, after: btn.textContent.replace(/\s+/g, " ").trim() };
    });
    check("the report button gets its own label back after a second click",
      errs.length === 0 && label.before === label.after,
      JSON.stringify({ errs: errs.slice(0, 3), label }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const pairs = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const copies = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async (t) => { copies.push(t); } },
      });
      const set = (id, v) => {
        const el = document.querySelector(id);
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const sample = async () => {
        await wait(1000);
        document.querySelector("#btn_report").click();
        await wait(2000);
        const line = (copies.at(-1) || "").split("\n").find((l) => l.startsWith("Average critic score")) || "";
        const r = line.match(/: ([\d.]+) \/ 10 .* between ([\d.]+) and ([\d.]+)$/);
        const s = document.querySelector("#o_reviewers_line").textContent.match(/^([\d.]+) \/ 10\s+\(range ([\d.]+)-([\d.]+)\)/);
        return { report: r ? [r[1], r[2], r[3]] : line, panel: s ? [s[1], s[2], s[3]] : null };
      };
      const out = [await sample()];
      set("#i_D", "13");
      set("#i_T", "11");
      out.push(await sample());
      set("#i_D", "60");
      set("#i_T", "45");
      out.push(await sample());
      return out;
    });
    check("the report carries the Average critic score and range the panel shows",
      errs.length === 0 && pairs.every((x) => x.panel && JSON.stringify(x.report) === JSON.stringify(x.panel)),
      JSON.stringify({ errs: errs.slice(0, 3), pairs }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const gr = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const read = () => {
        const fill = document.querySelector("#o_gra .chainbar > span");
        return { width: fill ? fill.style.width : null, color: fill ? fill.style.background : null };
      };
      const set = (id, v) => {
        const el = document.querySelector(id);
        el.value = v;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      };
      set("#i_genre", "Action");
      await wait(1000);
      const unscored = read();
      set("#i_D", "20");
      set("#i_T", "36");
      await wait(1000);
      return { unscored, onTarget: read() };
    });
    check("the golden ratio row claims no balance until the game scores one",
      errs.length === 0 && gr.unscored.width === "0%" && gr.onTarget.width === "100%",
      JSON.stringify({ errs: errs.slice(0, 3), gr }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const trend = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      for (const [name, value] of [["none", "1.0"], ["penalty", "0.85"], ["bonus", "1.2_genre"]]) {
        const el = document.querySelector("#i_trend");
        el.value = value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await wait(800);
        const row = document.querySelector("#o_trend");
        const spans = row.querySelectorAll(".chainbar > span");
        const fill = spans[spans.length - 1];
        const mark = row.querySelector("[title]");
        out[name] = {
          bars: spans.length,
          width: fill ? fill.style.width : null,
          left: fill ? fill.style.left : null,
          tip: mark ? mark.getAttribute("title") : null,
        };
      }
      return out;
    });
    check("the trend row marks no loss while no trend is running",
      errs.length === 0 && trend.none.width === "0%" && !/loss|losing/i.test(trend.none.tip) &&
        trend.penalty.left === "0%" && trend.penalty.width !== "0%" &&
        trend.bonus.left === "50%" && trend.bonus.width !== "0%",
      JSON.stringify({ errs: errs.slice(0, 3), trend }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const naming = await p.evaluate(() => {
      const btn = document.querySelector("#btn_pick_perfect");
      const strip = (t) => t.replace(/[^A-Za-z ]/g, " ").replace(/\s+/g, " ").trim();
      return {
        heading: strip(btn.closest(".card").querySelector("h2").textContent),
        button: strip(btn.textContent),
      };
    });
    check("the picker button and its panel carry one name",
      errs.length === 0 && naming.heading === naming.button, JSON.stringify(naming));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, ALL_UNLOCKED);
    const bar = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const scale = () => {
        const el = document.querySelector("#toast_host .toast");
        if (!el) return null;
        const m = getComputedStyle(el, "::after").transform.match(/matrix\(([^,]+)/);
        return m ? Number(m[1]) : null;
      };
      const year = document.querySelector("#i_year");
      year.value = "30";
      year.dispatchEvent(new Event("input", { bubbles: true }));
      await wait(900);
      document.querySelector('.tab[data-tab="combo"]').click();
      await wait(400);
      const chip = document.querySelector("#cmb_tbody .cmb-arrow");
      chip.click();
      await wait(1500);
      const halfway = scale();
      document.querySelector('.tab[data-tab="combo"]').click();
      await wait(200);
      document.querySelector("#cmb_tbody .cmb-arrow").click();
      await wait(150);
      return { halfway, restarted: scale(), toasts: document.querySelectorAll("#toast_host .toast").length };
    });
    check("a repeated notification restarts its countdown bar",
      errs.length === 0 && bar.toasts === 1 && bar.halfway !== null &&
        bar.halfway < 0.75 && bar.restarted > 0.9,
      JSON.stringify({ errs: errs.slice(0, 3), bar }));
    await ctx.close();
  }

  {
    const { ctx, p, errs } = await freshPage(null, { topics: [], genres: ["Casual"], audiences: ["young", "mature"] });
    const seen = await p.evaluate(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      for (const [id, v] of [["#i_year", "1"], ["#i_topic", "Military"], ["#i_genre", "Action"]]) {
        const el = document.querySelector(id);
        el.value = v;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
      await wait(1800);
      return {
        advice: document.querySelector("#o_sug").innerText,
        offMarket: [...document.querySelectorAll("[data-plat]")].filter((c) => c.disabled).map((c) => c.dataset.plat),
      };
    });
    const named = seen.offMarket.filter((id) => seen.advice.includes(id));
    check("the advice offers no platform that is off the market and no audience still locked",
      errs.length === 0 && named.length === 0 && seen.advice.includes("No audience you have unlocked"),
      JSON.stringify({ errs: errs.slice(0, 3), named, advice: seen.advice.slice(0, 300) }));
    await ctx.close();
  }
} finally {
  await browser.close();
}

finish();
