import { buildOracle, mulberry32 } from "./lib/oracle.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { broadSetup, boundarySetup, headcount, oracleSpec, expertCapableCount,
  wideThresholdCases, GENRES, TOPIC_IDS, PAGE_MISSION_IDS } from "./lib/generators.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const oracle = buildOracle();
const page = await loadCalculator();

function compare(generator, runs, seed) {
  const R = mulberry32(seed);
  let divergent = 0;
  const examples = [];
  for (let i = 0; i < runs; i++) {
    const p = generator(R);
    const n = headcount(p);
    let want, got;
    try { want = oracle.rate(oracleSpec(p, n), mulberry32(i)).scoreFinal; }
    catch (e) { want = "oracle threw: " + e.message; }
    try {
      const r = page.calcReview({ ...p, teamSize: n }, mulberry32(i), true);
      got = r.error ? "error: " + r.error : r.z_final;
    } catch (e) { got = "page threw: " + e.message; }
    if (!Object.is(want, got)) {
      divergent++;
      if (examples.length < 3) examples.push(`codeNw.js ${want}, page ${got}\n${JSON.stringify(p)}`);
    }
  }
  return { divergent, examples };
}

const RUNS = Number(process.env.GDT_FUZZ_RUNS || 40000);
const SEEDS = (process.env.GDT_FUZZ_SEEDS || "12345,777,20260101").split(",").map(Number);

heading(`broad setups scored against codeNw.js (${SEEDS.length} x ${RUNS})`);
for (const seed of SEEDS) {
  const r = compare(broadSetup, RUNS, seed);
  check(`seed ${seed}: identical`, r.divergent === 0, `${r.divergent} divergent\n${r.examples.join("\n")}`);
}

heading(`setups aimed at the branch boundaries (${SEEDS.length} x ${RUNS})`);
for (const seed of SEEDS) {
  const r = compare(boundarySetup, RUNS, seed + 1);
  check(`seed ${seed + 1}: identical`, r.divergent === 0, `${r.divergent} divergent\n${r.examples.join("\n")}`);
}

heading("the page infers the top-score flag rather than being told it");
{
  const R = mulberry32(31337);
  let inferred = 0, agreed = 0;
  for (let i = 0; i < 5000; i++) {
    const p = boundarySetup(R);
    const r = page.calcReview({ ...p, teamSize: headcount(p) }, mulberry32(i), true);
    if (r.error) continue;
    inferred++;
    if (r.hasTopScore === (p.lastTopScore > 0)) agreed++;
  }
  check(`${inferred} setups, the inference matched lastTopScore > 0 every time`, inferred === agreed,
    `${inferred - agreed} disagreed`);
}

heading("the expert count cannot exceed what the topic and genre allow");
{
  const problems = [];
  let combinations = 0;
  for (const topic of TOPIC_IDS) {
    for (const genre of GENRES) {
      for (const second of [null, ...GENRES]) {
        if (second === genre) continue;
        combinations++;
        const want = expertCapableCount(topic, genre, second);
        const r = page.calcReview({
          topic, genre, second, audience: "everyone", size: "aaa", year: 12, tsa: 1,
          lastTop: 120, fans: 500000, platforms: ["PC"], D: 900, T: 700, bugs: 0, tl: 5,
          companyLevel: 3, trend: 1, newStaff: 0, teamSize: 6, teamContrib: 1, experts: 9,
          fatigue: false, seq: false, sameEng: false, betterEng: false, expansion: false, mmo: false,
          sliders: Object.fromEntries(PAGE_MISSION_IDS.map((id) => [id, 33])),
        }, () => 0.5, true);
        if (r.expertCapable !== want) problems.push(`${topic}/${genre}/${second}: page ${r.expertCapable}, game ${want}`);
        if (r.experts !== Math.min(9, want)) problems.push(`${topic}/${genre}/${second}: capped to ${r.experts}`);
      }
    }
  }
  check(`${combinations} topic, genre and second-genre combinations match the game's own count`,
    problems.length === 0, problems.slice(0, 10).join("\n"));
}

heading("every platform count, on slider shares that sit exactly on a threshold");
{
  const cases = wideThresholdCases();
  let divergent = 0;
  const examples = [];
  for (const [i, p] of cases.entries()) {
    const n = headcount(p);
    let want, got;
    try { want = oracle.rate(oracleSpec(p, n), mulberry32(0)).scoreFinal; }
    catch (e) { want = "oracle threw: " + e.message; }
    try {
      const r = page.calcReview({ ...p, teamSize: n }, mulberry32(0), true);
      got = r.error ? "error: " + r.error : r.z_final;
    } catch (e) { got = "page threw: " + e.message; }
    if (!Object.is(want, got)) {
      divergent++;
      if (examples.length < 3) examples.push(`${p.platforms.length} platforms, ${p.size}: codeNw.js ${want}, page ${got}`);
    }
  }
  check(`${cases.length} cases across 1 to 29 platforms are identical`, divergent === 0,
    `${divergent} divergent\n${examples.join("\n")}`);
}

heading("the Design + Technology a 9 needs, judged by codeNw.js");
{
  const R = mulberry32(4242);
  let checked = 0, capped = 0;
  const wrong = [];
  for (let i = 0; i < 400; i++) {
    const p = broadSetup(R);
    const total = p.D + p.T;
    if (!(total > 0)) continue;
    const n = headcount(p);
    const r = page.pointsForNine({ ...p, teamSize: n });
    if (!r) continue;
    const gameNine = (k) => {
      const d = oracle.rate(oracleSpec({ ...p, D: p.D * k / total, T: p.T * k / total }, n), mulberry32(0));
      return d.z_raw * d.u >= 9;
    };
    if (!r.reachable) {
      capped++;
      if (gameNine(1e7)) wrong.push(`said out of reach, codeNw.js reaches 9\n${JSON.stringify(p)}`);
      continue;
    }
    checked++;
    if (!gameNine(r.need)) wrong.push(`codeNw.js is under 9 at ${r.need}\n${JSON.stringify(p)}`);
    else if (r.need > 1 && gameNine(r.need - 1)) wrong.push(`codeNw.js already reaches 9 at ${r.need - 1}\n${JSON.stringify(p)}`);
  }
  check(`${checked} setups land on the game's own boundary, ${capped} capped below 9 by tech-fit`,
    wrong.length === 0 && checked > 50 && capped > 0, wrong.slice(0, 3).join("\n"));
}

finish();
