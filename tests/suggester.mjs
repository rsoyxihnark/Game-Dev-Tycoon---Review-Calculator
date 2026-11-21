import { createContext, runInContext } from "node:vm";
import { loadCalculator } from "./lib/page.mjs";
import { buildOracle } from "./lib/oracle.mjs";
import { GAME_SOURCE, closingBracket } from "./lib/game-source.mjs";
import { oracleSpec, PAGE_MISSION_IDS } from "./lib/generators.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const { calcReview, suggestSliders, missionGenreWeight, mulberry32,
  MISSIONS, MISSIONS_BY_STAGE, TOPICS, GENRES } = await loadCalculator();

const TOPICS_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

const BASE = {
  audience: "everyone", size: "small", year: 1, tsa: 0, lastTop: 20, fans: 0,
  platforms: ["PC"], D: 0, T: 0, bugs: 0, tl: 0, companyLevel: 1, trend: 1,
  newStaff: 0, teamSize: 0, teamContrib: 1, experts: 0,
  fatigue: false, seq: false, sameEng: false, betterEng: false, expansion: false, mmo: false,
};

function quality(topic, genre, second, sliders) {
  const r = calcReview({ ...BASE, topic, genre, second, sliders }, mulberry32(1), true);
  if (r.error) throw new Error(r.error);
  return r.s;
}

const STAGES = [1, 2, 3];
const byWeight = (topic, genre, second, stage) =>
  MISSIONS_BY_STAGE[stage]
    .map((m) => ({ id: m.id, w: missionGenreWeight(m, genre, second, topic) }))
    .sort((a, b) => b.w - a.w || a.id.localeCompare(b.id));

const PATTERNS = [
  [100, 100, 100], [100, 0, 0], [100, 100, 0], [0, 100, 100], [0, 0, 100],
  [100, 50, 50], [100, 100, 50], [30, 20, 20], [0, 0, 0],
];

function spread(order, triples) {
  const sliders = {};
  for (const [i, stage] of STAGES.entries()) {
    order[stage].forEach((m, j) => { sliders[m.id] = triples[i][j]; });
  }
  return sliders;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function ratios(values) {
  const seen = new Map();
  for (const a of values) for (const b of values) for (const c of values) {
    const g = gcd(gcd(a, b), c) || 1;
    const k = `${a / g}:${b / g}:${c / g}`;
    if (!seen.has(k)) seen.set(k, [a, b, c]);
  }
  return [...seen.values()];
}
const GRID = ratios([0, 25, 50, 75, 100]);

const shapeKey = (topic, genre, second) =>
  MISSIONS.map((m) => missionGenreWeight(m, genre, second, topic).toFixed(4)).join("|");

const COMBOS = [];
for (const t of TOPICS) {
  for (const genre of GENRES) {
    for (const second of [null, ...GENRES]) {
      if (second === genre) continue;
      COMBOS.push({ topic: t.id, genre, second });
    }
  }
}

const ALL_HUNDRED = {};
for (const m of MISSIONS) ALL_HUNDRED[m.id] = 100;

function panelBest(topic, genre, second) {
  const order = {};
  for (const stage of STAGES) order[stage] = byWeight(TOPICS_BY_ID.get(topic), genre, second, stage);
  let best = -Infinity, at = null;
  for (const a of PATTERNS) for (const b of PATTERNS) for (const c of PATTERNS) {
    const sliders = spread(order, [a, b, c]);
    const v = quality(topic, genre, second, sliders);
    if (v > best) { best = v; at = sliders; }
  }
  return { best, at };
}

heading("the comparison catches a suggester that stopped suggesting");
{
  const beaten = COMBOS.filter((c) => {
    const flat = quality(c.topic, c.genre, c.second, ALL_HUNDRED);
    return flat < panelBest(c.topic, c.genre, c.second).best - 1e-9;
  });
  check(`every slider at 100 is beaten on ${beaten.length} of ${COMBOS.length} pairings`,
    beaten.length > COMBOS.length / 2, `beaten on ${beaten.length}`);
}

heading(`the suggester is the best of ${PATTERNS.length ** 3} whole-game strategies`);
{
  const cache = new Map();
  const short = [];
  const landed = new Map();
  for (const c of COMBOS) {
    const key = shapeKey(TOPICS_BY_ID.get(c.topic), c.genre, c.second);
    if (!cache.has(key)) cache.set(key, panelBest(c.topic, c.genre, c.second).best);
    const want = cache.get(key);
    const got = quality(c.topic, c.genre, c.second, suggestSliders(c.genre, c.second, TOPICS_BY_ID.get(c.topic)));
    if (got < want - 1e-9) short.push({ ...c, got, want });
    const at = got.toFixed(4);
    if (!landed.has(at)) landed.set(at, c);
  }
  check(`${COMBOS.length} topic and genre pairings, ${cache.size} distinct weight shapes, none beaten`,
    short.length === 0,
    short.slice(0, 8).map((x) => `${x.topic}/${x.genre}${x.second ? "+" + x.second : ""}: ${x.got} vs ${x.want}`).join("\n"));
  check(`every pairing lands on the same quality factor, ${[...landed.keys()].sort().join(" and ")}`,
    landed.size === 1,
    [...landed.entries()].map(([v, c]) => `${v} at ${c.topic}/${c.genre}${c.second ? "+" + c.second : ""}`).join("\n"));
}

heading(`no slider set in a ${GRID.length} by ${GRID.length} by ${GRID.length} sweep beats it`);
{
  const pick = mulberry32(7);
  const seen = new Set();
  const sample = [];
  while (sample.length < 4) {
    const c = COMBOS[Math.floor(pick() * COMBOS.length)];
    const key = shapeKey(TOPICS_BY_ID.get(c.topic), c.genre, c.second);
    if (seen.has(key)) continue;
    seen.add(key);
    sample.push(c);
  }
  for (const c of sample) {
    const topic = TOPICS_BY_ID.get(c.topic);
    const order = {};
    for (const stage of STAGES) order[stage] = byWeight(topic, c.genre, c.second, stage);
    const got = quality(c.topic, c.genre, c.second, suggestSliders(c.genre, c.second, topic));
    let best = -Infinity;
    for (const a of GRID) for (const b of GRID) for (const d of GRID) {
      const v = quality(c.topic, c.genre, c.second, spread(order, [a, b, d]));
      if (v > best) best = v;
    }
    const flat = quality(c.topic, c.genre, c.second, ALL_HUNDRED);
    const label = `${c.topic} / ${c.genre}${c.second ? " + " + c.second : ""}`;
    check(`${label}: suggester ${got.toFixed(2)} matches the sweep best ${best.toFixed(2)}`,
      got >= best - 1e-9 && best > flat + 1e-9,
      `suggester ${got}, sweep ${best}, every slider at 100 ${flat}`);
  }
}

const oracle = buildOracle();
const shareContext = createContext({});
{
  const anchor = "UI._getSelectedFeaturePercentages=function(";
  const at = GAME_SOURCE.indexOf(anchor);
  if (at < 0 || GAME_SOURCE.indexOf(anchor, at + 1) >= 0) throw new Error(`codeNw.js should hold one ${anchor}`);
  const fn = GAME_SOURCE.indexOf("function", at);
  const body = GAME_SOURCE.slice(fn, closingBracket(GAME_SOURCE, GAME_SOURCE.indexOf("{", fn), "{", "}") + 1);
  runInContext("Array.prototype.sum=function(){var s=0;for(var i=0;i<this.length;i++)s+=this[i];return s};" +
    "var UI={};UI._getSelectedSliderValues=function(){return __vals};UI._getSelectedFeaturePercentages=" + body + ";",
    shareContext);
}
const gameShares = (values) =>
  JSON.parse(runInContext(`__vals=[${values.join(",")}];JSON.stringify(UI._getSelectedFeaturePercentages())`, shareContext));

function evenOutput(sliders) {
  let D = 0, T = 0;
  for (const stage of STAGES) {
    const idx = PAGE_MISSION_IDS.map((id, i) => i).filter((i) => (i < 3 ? 1 : i < 6 ? 2 : 3) === stage);
    const shares = gameShares(idx.map((i) => sliders[PAGE_MISSION_IDS[i]] ?? 0));
    idx.forEach((i, j) => {
      D += shares[j] * oracle.data.missions[i].designFactor;
      T += shares[j] * oracle.data.missions[i].technologyFactor;
    });
  }
  return { D, T };
}

function gameQuality(topic, genre, second, sliders, D, T) {
  const p = { ...BASE, topic, genre, second, sliders, D, T, lastTopScore: 0 };
  return oracle.rate(oracleSpec(p, 1), () => 0.5).s;
}
const balanceTerm = (topic, genre, second, sliders) => {
  const { D, T } = evenOutput(sliders);
  return Math.round((gameQuality(topic, genre, second, sliders, D, T) - gameQuality(topic, genre, second, sliders, 0, 0)) * 10);
};

const GUIDE_SETS = {
  RPG: [[0, 100, 100], [100, 100, 0], [100, 25, 0]],
  Strategy: [[100, 25, 0], [0, 25, 100], [25, 100, 33]],
  Adventure: [[0, 100, 100], [100, 0, 0], [100, 25, 0]],
  Casual: [[0, 100, 0], [66, 100, 0], [0, 25, 100]],
  Simulation: [[100, 25, 0], [0, 25, 100], [0, 100, 25]],
  Action: [[100, 25, 0], [0, 25, 100], [0, 100, 25]],
};

heading("the suggester leans the time toward the golden ratio, judged by codeNw.js at an even output");
{
  const topic = TOPICS_BY_ID.get("Fantasy");
  for (const [genre, triples] of Object.entries(GUIDE_SETS)) {
    const guide = {};
    STAGES.forEach((stage, i) => MISSIONS_BY_STAGE[stage].forEach((m, j) => { guide[m.id] = triples[i][j]; }));
    const mine = suggestSliders(genre, null, topic);
    const got = balanceTerm(topic.id, genre, null, mine);
    const want = balanceTerm(topic.id, genre, null, guide);
    const focus = quality(topic.id, genre, null, mine);
    check(`Fantasy / ${genre}: balance ${got / 10} against ${want / 10} for the guides' set, focus ${focus.toFixed(2)}`,
      got >= want && Math.abs(focus - 0.2) < 1e-9, `suggester ${got / 10}, guide ${want / 10}, focus ${focus}`);
  }

  const seen = new Set();
  let mineBonus = 0, flatBonus = 0, total = 0;
  const worse = [];
  for (const c of COMBOS) {
    const topic = TOPICS_BY_ID.get(c.topic);
    const key = shapeKey(topic, c.genre, c.second) + "#" + c.genre + "+" + c.second;
    if (seen.has(key)) continue;
    seen.add(key);
    const flat = {};
    for (const m of MISSIONS) flat[m.id] = missionGenreWeight(m, c.genre, c.second, topic) >= 0.9 ? 100 : 0;
    const got = balanceTerm(c.topic, c.genre, c.second, suggestSliders(c.genre, c.second, topic));
    const base = balanceTerm(c.topic, c.genre, c.second, flat);
    total++;
    if (got > 0) mineBonus++;
    if (base > 0) flatBonus++;
    if (got < base) worse.push(`${c.topic}/${c.genre}${c.second ? "+" + c.second : ""}: ${got / 10} vs ${base / 10}`);
  }
  check(`on ${total} genre pairings the +0.1 is paid ${mineBonus} times, against ${flatBonus} with every 0.9 mission at 100`,
    worse.length === 0 && mineBonus > flatBonus, worse.slice(0, 8).join("\n"));
}

heading("every suggested share stays 2 points clear of the lines the game judges it by");
{
  const close = [];
  for (const c of COMBOS) {
    const topic = TOPICS_BY_ID.get(c.topic);
    const sug = suggestSliders(c.genre, c.second, topic);
    for (const stage of STAGES) {
      const ms = MISSIONS_BY_STAGE[stage];
      const shares = gameShares(ms.map((m) => sug[m.id]));
      ms.forEach((m, j) => {
        const w = missionGenreWeight(m, c.genre, c.second, topic);
        const lines = w >= 0.9 ? [20, 40] : w < 0.8 ? [40] : [];
        if (lines.some((l) => Math.abs(shares[j] - l) < 2)) close.push(`${c.topic}/${c.genre}: ${m.id} at ${shares[j].toFixed(2)}`);
        if (![0, 25, 50, 75, 100].includes(sug[m.id])) close.push(`${c.topic}/${c.genre}: ${m.id} slider ${sug[m.id]}`);
      });
    }
  }
  check(`${COMBOS.length} pairings, every slider a quarter step and every share clear`, close.length === 0,
    close.slice(0, 8).join("\n"));
}

finish();
