import { gameData } from "./lib/game-source.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const game = gameData();
const page = await loadCalculator();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

heading("missions");
check("same count", game.missions.length === page.MISSIONS.length,
  `${game.missions.length} in codeNw.js, ${page.MISSIONS.length} in the page`);
check("same order (missionOverrides are indexed by it)",
  same(game.missions.map((m) => m.id), page.MISSIONS.map((m) => (m.id === "Dialogues" ? "Dialogs" : m.id))),
  game.missions.map((m) => m.id).join(", "));
for (const [i, m] of game.missions.entries()) {
  const p = page.MISSIONS[i];
  if (!p) continue;
  check(`${m.id} genre weightings`, same(m.genreWeightings, p.w),
    `codeNw.js ${JSON.stringify(m.genreWeightings)}  page ${JSON.stringify(p.w)}`);
  check(`${m.id} stage`, p.stage === (i < 3 ? 1 : i < 6 ? 2 : 3));
}

heading("topics");
check("same count", game.topics.length === page.TOPICS.length,
  `${game.topics.length} in codeNw.js, ${page.TOPICS.length} in the page`);
const pageTopics = new Map(page.TOPICS.map((t) => [t.id, t]));
const zeroFill = (o) => (o ? o.map((row) => row.map((x) => x || 0)) : null);
let topicProblems = [];
for (const t of game.topics) {
  const p = pageTopics.get(t.id);
  if (!p) { topicProblems.push(`${t.id}: missing from the page`); continue; }
  if (!same(t.genreWeightings, p.g)) topicProblems.push(`${t.id} genre: ${JSON.stringify(t.genreWeightings)} vs ${JSON.stringify(p.g)}`);
  if (!same(t.audienceWeightings, p.a)) topicProblems.push(`${t.id} audience: ${JSON.stringify(t.audienceWeightings)} vs ${JSON.stringify(p.a)}`);
  if (!same(zeroFill(t.missionOverrides || null), zeroFill(p.o || null))) topicProblems.push(`${t.id} missionOverrides differ`);
}
for (const p of page.TOPICS) if (!game.topics.some((t) => t.id === p.id)) topicProblems.push(`${p.id}: in the page but not in codeNw.js`);
check("every topic's genre weightings, audience weightings and mission overrides match",
  topicProblems.length === 0, topicProblems.join("\n"));

heading("platforms");
check("same count", game.platforms.length === page.PLATFORMS.length,
  `${game.platforms.length} in codeNw.js, ${page.PLATFORMS.length} in the page`);
const gamePlatforms = new Map(game.platforms.map((p) => [p.id, p]));
const ymw = (s) => String(s).split("/").map(Number);
let platProblems = [];
for (const p of page.PLATFORMS) {
  const g = gamePlatforms.get(p.id);
  if (!g) { platProblems.push(`${p.id}: not a platform in codeNw.js`); continue; }
  if (!same(g.genreWeightings, p.g)) platProblems.push(`${p.id} genre: ${JSON.stringify(g.genreWeightings)} vs ${JSON.stringify(p.g)}`);
  if (!same(g.audienceWeightings, p.a)) platProblems.push(`${p.id} audience: ${JSON.stringify(g.audienceWeightings)} vs ${JSON.stringify(p.a)}`);
  const expected = p.id === "PC" ? 0 : g.techLevel;
  if (expected !== p.tl) platProblems.push(`${p.id} techLevel: ${g.techLevel} vs ${p.tl}`);
}
for (const g of game.platforms) if (!page.PLATFORMS.some((p) => p.id === g.id)) platProblems.push(`${g.id}: missing from the page`);
check("every platform's genre weightings, audience weightings and tech level match",
  platProblems.length === 0, platProblems.join("\n"));
check("PC still carries no techLevel in codeNw.js (the page's 0 placeholder stays unused)",
  gamePlatforms.get("PC").techLevel === undefined);

let dateProblems = [];
for (const g of game.platforms) {
  const d = page.PLATFORM_DATES[g.id];
  const m = page.PLATFORM_MARKET[g.id];
  if (!d || !m) { dateProblems.push(`${g.id}: no date/market entry in the page`); continue; }
  if (!same(ymw(g.published), d.pub)) dateProblems.push(`${g.id} release: ${g.published} vs ${JSON.stringify(d.pub)}`);
  if (g.platformRetireDate) {
    if (!same(ymw(g.platformRetireDate), d.ret)) dateProblems.push(`${g.id} retire: ${g.platformRetireDate} vs ${JSON.stringify(d.ret)}`);
  } else if (d.ret[0] < 260) dateProblems.push(`${g.id} retires in the page but never in codeNw.js`);
  if (g.startAmount !== m.s) dateProblems.push(`${g.id} startAmount: ${g.startAmount} vs ${m.s}`);
  if (g.unitsSold !== m.u) dateProblems.push(`${g.id} unitsSold: ${g.unitsSold} vs ${m.u}`);
  const keyPoints = (g.marketKeyPoints || []).map((k) => [k.date, k.amount]);
  if (!same(keyPoints, m.kp)) dateProblems.push(`${g.id} market key points differ`);
}
check("every platform's release date, retirement, market size and key points match",
  dateProblems.length === 0, dateProblems.join("\n"));

heading("the market size curve");
const weekOf = (s) => {
  const p = String(s).split("/");
  if (p.length !== 3) return 0;
  return 48 * (p[0] - 1) + 4 * (p[1] - 1) + (p[2] - 1);
};
const gameUnits = (p, week) => {
  const pub = weekOf(p.published);
  let m = week - pub;
  if (m < 0) return 0;
  const retire = p.platformRetireDate === "260/12/4" || !p.platformRetireDate
    ? week + 1000
    : weekOf(p.platformRetireDate);
  let from = p.startAmount, to = p.unitsSold, span = retire - pub;
  if (p.marketKeyPoints && p.marketKeyPoints.length) {
    let start = pub, end = retire;
    for (const k of p.marketKeyPoints) {
      const kw = weekOf(k.date);
      if (week >= kw) { m = week - kw; from = k.amount; start = kw; }
    }
    for (let i = p.marketKeyPoints.length - 1; i >= 0; i--) {
      const kw = weekOf(p.marketKeyPoints[i].date);
      if (week <= kw) { end = kw; to = p.marketKeyPoints[i].amount; }
    }
    span = end - start;
  }
  if (span === 0) return from;
  if (m > span) m = span;
  return (m / span) * (to - from) + from;
};
const LAST_WEEK = 48 * 40;
const sweep = (bend) => {
  let differed = 0, first = "";
  for (const p of game.platforms) {
    for (let week = 0; week <= LAST_WEEK; week++) {
      const want = gameUnits(p, week) * bend;
      const got = page.platformMarketUnits(p.id, week);
      if (Math.abs(want - got) > 1e-12) {
        differed++;
        if (!first) first = `${p.id} week ${week}: codeNw.js ${want}, page ${got}`;
      }
    }
  }
  return { differed, first };
};
check("the sweep finds a curve bent by one percent",
  sweep(1.01).differed > 0, "a wrong market curve would have gone unnoticed");
const curve = sweep(1);
check(`${game.platforms.length * (LAST_WEEK + 1)} platform weeks on the same curve as codeNw.js`,
  curve.differed === 0, curve.first);

finish();
