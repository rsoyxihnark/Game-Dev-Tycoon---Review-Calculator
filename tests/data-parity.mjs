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

finish();
