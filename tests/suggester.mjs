import { loadCalculator } from "./lib/page.mjs";
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

finish();
