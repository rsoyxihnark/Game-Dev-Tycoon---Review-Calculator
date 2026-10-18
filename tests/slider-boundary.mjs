import { buildOracle, mulberry32, OPTIMAL_TEAM } from "./lib/oracle.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const oracle = buildOracle();
const page = await loadCalculator();
const PAGE_MISSION_IDS = oracle.data.missions.map((m) => (m.id === "Dialogs" ? "Dialogues" : m.id));

const boundaryTriples = [];
for (let a = 0; a <= 100; a++) for (let b = 0; b <= 100; b++) for (let c = 0; c <= 100; c++) {
  const sum = a + b + c;
  if (sum === 0) continue;
  let hit = false;
  for (const v of [a, b, c]) { const share = v / (sum / 70) + 10; if (share === 40 || share === 20) { hit = true; break; } }
  if (hit) boundaryTriples.push([a, b, c]);
}
heading("slider boundary cases");
check("codeNw.js's share formula can land exactly on a threshold", boundaryTriples.length > 0,
  `${boundaryTriples.length} slider triples found`);

const SIZES = ["small", "medium", "large", "aaa"];
const PLATFORM_SETS = [["PC"], ["mBox", "Playsystem 2"], ["mBox", "Playsystem 2", "Wuu"]];
const seen = new Set();
const cases = [];
for (const t of boundaryTriples) {
  const key = t.join(",");
  if (seen.has(key)) continue;
  seen.add(key);
  cases.push(t);
}

let runs = 0, divergent = 0;
const examples = [];
for (const triple of cases) {
  for (const size of SIZES) {
    for (const platforms of PLATFORM_SETS) {
      const sliders = {};
      PAGE_MISSION_IDS.forEach((id, i) => { sliders[id] = triple[i % 3]; });
      const p = {
        topic: "Fantasy", genre: "RPG", second: null, audience: "everyone", size,
        year: 12, tsa: 1, lastTopScore: 120, lastTop: 120, fans: 500000, platforms,
        D: 900, T: 700, bugs: 0, tl: 5, companyLevel: 3, trend: 1,
        newStaff: 0, teamSize: 0, teamContrib: 1, experts: 0,
        fatigue: false, seq: false, sameEng: false, betterEng: false,
        expansion: false, mmo: false, sliders,
      };
      const n = OPTIMAL_TEAM[size];
      const want = oracle.rate({
        T: p.T, D: p.D, size, genre: p.genre, second: p.second, topic: p.topic,
        audience: p.audience, platforms, bugs: p.bugs, tl: p.tl, mmo: false,
        expansion: false, sameEng: false, betterEng: false, seq: false, trend: 1,
        fans: p.fans, companyLevel: p.companyLevel, tsa: p.tsa, year: p.year,
        lastTopScore: p.lastTopScore, newStaff: 0, staffN: n, experts: 0,
        teamContrib: 1, fatigue: false,
        sliderByIndex: PAGE_MISSION_IDS.map((id) => sliders[id]),
      }, mulberry32(7)).scoreFinal;
      const got = page.calcReview({ ...p, teamSize: n, hasTopScore: true }, mulberry32(7), true).z_final;
      runs++;
      if (!Object.is(want, got)) {
        divergent++;
        if (examples.length < 3) examples.push(`sliders ${triple.join("/")} size ${size} platforms ${platforms.length}: codeNw.js ${want}, page ${got}`);
      }
    }
  }
}
check(`${runs} boundary setups (${cases.length} slider triples x ${SIZES.length} sizes x ${PLATFORM_SETS.length} platform counts) score identically`,
  divergent === 0, `${divergent} divergent\n${examples.join("\n")}`);

finish();
