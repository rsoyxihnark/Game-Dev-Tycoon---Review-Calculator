import { buildOracle, mulberry32, OPTIMAL_TEAM } from "./lib/oracle.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const oracle = buildOracle();
const page = await loadCalculator();

const GENRES = ["Action", "Adventure", "RPG", "Simulation", "Strategy", "Casual"];
const AUDIENCES = ["young", "everyone", "mature"];
const SIZES = ["small", "medium", "large", "aaa"];
const TOPICS = oracle.data.topics.map((t) => t.id);
const PLATFORMS = oracle.data.platforms.map((p) => p.id);
const PAGE_MISSION_IDS = oracle.data.missions.map((m) => (m.id === "Dialogs" ? "Dialogues" : m.id));

function headcount(p) {
  return Math.max(p.teamSize > 0 ? p.teamSize : OPTIMAL_TEAM[p.size],
    1 + Math.min(p.newStaff, 20), Math.min(p.experts, 9));
}

function randomSetup(R) {
  const ri = (n) => Math.floor(R() * n);
  const pick = (a) => a[ri(a.length)];
  const size = pick(SIZES);
  const platforms = [];
  while (platforms.length < 1 + ri(3)) { const x = pick(PLATFORMS); if (!platforms.includes(x)) platforms.push(x); }
  const genre = pick(GENRES);
  let second = R() < 0.4 ? pick(GENRES) : null;
  if (second === genre) second = null;

  const sliders = {};
  for (const id of PAGE_MISSION_IDS) sliders[id] = R() < 0.12 ? 0 : ri(101);
  if (R() < 0.08) for (const id of PAGE_MISSION_IDS) sliders[id] = 0;
  if (R() < 0.18) {
    const edge = [[30, 20, 20], [10, 30, 30], [5, 30, 35], [75, 100, 0], [100, 0, 0], [1, 1, 1]][ri(6)];
    PAGE_MISSION_IDS.forEach((id, i) => { sliders[id] = edge[i % 3]; });
  }

  const lastTopScore = R() < 0.5 ? 0 : 21 + ri(400);
  return {
    topic: pick(TOPICS), genre, second, audience: pick(AUDIENCES), size,
    year: 1 + ri(30), tsa: ri(5), lastTopScore, lastTop: lastTopScore || 20,
    fans: ri(3) === 0 ? ri(100001) : ri(5000000),
    platforms, D: ri(2000), T: ri(2000), bugs: R() < 0.5 ? 0 : ri(400),
    tl: ri(8), companyLevel: 1 + ri(4), trend: [1, 1.2, 0.85, 0.9, 1.1][ri(5)],
    newStaff: R() < 0.7 ? 0 : ri(4), teamSize: R() < 0.5 ? 0 : 1 + ri(8),
    teamContrib: R() < 0.8 ? 1 : R(), experts: ri(5),
    fatigue: R() < 0.15, seq: R() < 0.15, sameEng: R() < 0.2, betterEng: R() < 0.2,
    expansion: R() < 0.1, mmo: R() < 0.15, sliders,
  };
}

const RUNS = Number(process.env.GDT_FUZZ_RUNS || 40000);
const SEEDS = (process.env.GDT_FUZZ_SEEDS || "12345,777,20260101").split(",").map(Number);

heading(`score parity (${SEEDS.length} x ${RUNS} randomised setups against codeNw.js)`);
for (const base of SEEDS) {
  const R = mulberry32(base);
  let divergent = 0;
  const examples = [];
  for (let i = 0; i < RUNS; i++) {
    const p = randomSetup(R);
    const n = headcount(p);
    let want, got;
    try {
      want = oracle.rate({
        T: p.T, D: p.D, size: p.size, genre: p.genre, second: p.second, topic: p.topic,
        audience: p.audience, platforms: p.platforms, bugs: p.bugs, tl: p.tl, mmo: p.mmo,
        expansion: p.expansion, sameEng: p.sameEng, betterEng: p.betterEng, seq: p.seq,
        trend: p.trend, fans: p.fans, companyLevel: p.companyLevel, tsa: p.tsa, year: p.year,
        lastTopScore: p.lastTopScore, newStaff: p.newStaff, staffN: n, experts: p.experts,
        teamContrib: p.teamContrib, fatigue: p.fatigue,
        sliderByIndex: PAGE_MISSION_IDS.map((id) => p.sliders[id] ?? 0),
      }, mulberry32(i)).scoreFinal;
    } catch (e) { want = "threw: " + e.message; }
    try {
      const r = page.calcReview({ ...p, teamSize: n, hasTopScore: p.lastTopScore > 0 }, mulberry32(i), true);
      got = r.error ? "error: " + r.error : r.z_final;
    } catch (e) { got = "threw: " + e.message; }
    if (!Object.is(want, got)) {
      divergent++;
      if (examples.length < 3) examples.push(`codeNw.js ${want}, page ${got}\n${JSON.stringify(p)}`);
    }
  }
  check(`seed ${base}: ${RUNS} setups score identically`, divergent === 0,
    `${divergent} divergent\n${examples.join("\n")}`);
}

finish();
