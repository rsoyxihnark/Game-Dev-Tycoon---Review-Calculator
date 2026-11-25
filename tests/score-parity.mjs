import { buildOracle, mulberry32 } from "./lib/oracle.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { broadSetup, boundarySetup, headcount, oracleSpec, expertCapableCount,
  wideThresholdCases, GENRES, TOPIC_IDS, PAGE_MISSION_IDS } from "./lib/generators.mjs";
import { check, heading, finish } from "./lib/report.mjs";
import { runInContext } from "node:vm";
import { GAME_SOURCE } from "./lib/game-source.mjs";

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

heading("a game on a console of your own, scored against codeNw.js");
{
  const R = mulberry32(9090);
  const shuffle = (list) => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const anyOf = (list) => list[Math.floor(R() * list.length)];
  let divergent = 0, onlyCustom = 0, offSet = 0;
  const examples = [];
  for (let i = 0; i < 20000; i++) {
    const p = R() < 0.5 ? broadSetup(R) : boundarySetup(R);
    const odd = R() < 0.2;
    p.customConsole = {
      id: page.CUSTOM_CONSOLE_ID,
      g: odd ? GENRES.map(() => anyOf([1, 0.9, 0.8, 0.7])) : shuffle([1, 1, 0.9, 0.8, 0.8, 0.7]),
      a: odd ? [0, 1, 2].map(() => anyOf([1, 0.9, 0.8])) : shuffle([1, 0.9, 0.8]),
      tl: 1 + Math.floor(R() * 7),
    };
    const others = p.platforms.slice(0, Math.floor(R() * 3));
    others.splice(Math.floor(R() * (others.length + 1)), 0, page.CUSTOM_CONSOLE_ID);
    p.platforms = others;
    if (others.length === 1) onlyCustom++;
    if (!page.isGameConsoleSet(p.customConsole)) offSet++;
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
  check(`20000 setups with your console in any slot (${onlyCustom} on it alone) are identical`,
    divergent === 0, `${divergent} divergent\n${examples.join("\n")}`);
  const r = page.calcReview({ ...broadSetup(mulberry32(5)), platforms: [page.CUSTOM_CONSOLE_ID] }, mulberry32(0), true);
  check("your console without its fits is refused rather than scored", !!r.error);
  check(`the fits check knows a set the game can build from one it cannot (${offSet} off-set)`,
    offSet > 1000 && page.isGameConsoleSet({ g: [0.8, 1, 0.7, 1, 0.9, 0.8], a: [0.9, 0.8, 1] }) &&
    !page.isGameConsoleSet({ g: [1, 1, 1, 0.8, 0.8, 0.7], a: [1, 0.9, 0.8] }));
}

heading("the console fits Game Dev Tycoon builds from your game history");
{
  const anchor = "var b=function(a,b,d){b===GameGenre.Action&&(a[0]+=d)";
  const start = GAME_SOURCE.indexOf(anchor);
  const end = GAME_SOURCE.indexOf(";a.getLabCostPerMonth=", start);
  check("codeNw.js still builds console fits the same way", start >= 0 && end > start);
  runInContext(`var __gm={company:{gameLog:[]}};(function(a){${GAME_SOURCE.slice(start, end)};})(__gm);`,
    oracle.context);
  const R = mulberry32(2468);
  const rule = (tally, fits) => {
    const out = new Array(tally.length);
    const order = tally.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0] || x[1] - y[1]);
    order.forEach(([, i], k) => { out[i] = fits[k]; });
    return out;
  };
  const wrong = [];
  for (let i = 0; i < 5000 && wrong.length < 3; i++) {
    const games = Array.from({ length: Math.floor(R() * 25) }, () => ({
      genre: GENRES[Math.floor(R() * 6)],
      second: R() < 0.4 ? GENRES[Math.floor(R() * 6)] : null,
      audience: ["young", "everyone", "mature"][Math.floor(R() * 3)],
    }));
    oracle.context.__games = JSON.stringify(games);
    const got = runInContext(`__gm.company.gameLog=JSON.parse(__games).map(function(g){return{genre:GameGenre[g.genre],
      secondGenre:g.second?GameGenre[g.second]:null,targetAudience:g.audience}});
      JSON.stringify([__gm.getCalculatedPlatformGenreWeightings(),__gm.getCalculatedPlatformAudienceWeightings()])`,
      oracle.context);
    const [g, a] = JSON.parse(got);
    const gt = GENRES.map((x) => games.reduce((s, m) => s + (m.genre === x ? 1 : 0) + (m.second === x ? 0.5 : 0), 0));
    const at = ["young", "everyone", "mature"].map((x) => games.filter((m) => m.audience === x).length);
    const wantG = rule(gt, [1, 1, 0.9, 0.8, 0.8, 0.7]), wantA = rule(at, [1, 0.9, 0.8]);
    if (JSON.stringify(g) !== JSON.stringify(wantG) || JSON.stringify(a) !== JSON.stringify(wantA)) {
      wrong.push(`${JSON.stringify(games)}\ngame ${got}, rule ${JSON.stringify([wantG, wantA])}`);
    }
    if (!page.isGameConsoleSet({ g, a })) wrong.push(`the game built a set the page calls impossible: ${got}`);
  }
  check("5000 game histories give the fits the Your own console panel describes", wrong.length === 0,
    wrong.join("\n"));
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
