import { buildOracle, mulberry32 } from "./lib/oracle.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { broadSetup, headcount, oracleSpec, SIZES } from "./lib/generators.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const oracle = buildOracle();
const page = await loadCalculator();

const SIZE_POINTS = { small: 1.0, medium: 1.2, large: 1.4, aaa: 1.8 };
const SIZE_WEEKS = { small: 1, medium: 2, large: 3, aaa: 6 };
const yearFactor = (y) => (y <= 6 ? 1.15 : y > 23 ? 1.1 : 1.2);

function setup(R) {
  const ri = (n) => Math.floor(R() * n);
  const p = broadSetup(R);
  p.newStaff = R() < 0.8 ? 0 : p.newStaff;
  p.seq = false;
  const first = R() < 0.25;
  const top = { currentWeek: 600 + ri(400) };
  if (first) {
    p.lastTopScore = 0; p.tsa = 0; p.hadTopScoreOverride = false;
  } else {
    const record = R() < 0.3 ? 18 + R() * 17 : 20 + R() * 3000;
    const lastSize = SIZES[ri(SIZES.length)];
    const warm = 6 + 9 * SIZE_WEEKS[lastSize];
    p.lastTopScore = record;
    top.lastTopScoreIncrease = record * (0.01 + 0.3 * R());
    top.previousTopScore = R() < 0.2 ? 0 : 20 + R() * record;
    top.lastTopScoreGameSize = lastSize;
    top.lastTopScoreWeek = top.currentWeek - (R() < 0.4 ? ri(warm) : warm + ri(40));
  }
  return { p, top };
}

const RUNS = Number(process.env.GDT_TARGET_RUNS || 20000);
const R = mulberry32(8080);
const tally = { under: 0, kept: 0, set: 0, first: 0, ramp: 0 };
const wrong = [];

heading(`the next target the page projects, against codeNw.js (${RUNS} releases)`);
for (let i = 0; i < RUNS && wrong.length < 5; i++) {
  const { p, top } = setup(R);
  const n = headcount(p);
  const spec = { ...oracleSpec(p, n), ...top };

  const probe = oracle.rate(spec, mulberry32(i));
  const B = probe.B;
  const total = Math.max(1, Math.round(B * 2 * SIZE_POINTS[p.size] * (0.6 + 0.9 * R())));
  const share = R();
  p.D = Math.round(total * share); p.T = total - p.D;
  const game = oracle.rate({ ...oracleSpec(p, n), ...top }, mulberry32(i));

  const params = { ...p, teamSize: n, lastTop: game.B, recordBase: p.lastTopScore };
  const out = page.calcReview(params, mulberry32(i), true);
  const label = JSON.stringify({ ...params, ...top });
  if (out.error) { wrong.push(`page error ${out.error}\n${label}`); continue; }
  if (!Object.is(out.z_final, game.scoreFinal)) {
    wrong.push(`score differs: codeNw.js ${game.scoreFinal}, page ${out.z_final}\n${label}`);
    continue;
  }
  const nt = page.nextTarget(params, out);
  const moved = game.after.lastTopScore !== p.lastTopScore;
  tally[nt.kind] = (tally[nt.kind] || 0) + 1;

  if (nt.kind === "under" || nt.kind === "kept") {
    if (moved) wrong.push(`page said ${nt.kind}, codeNw.js set a record of ${game.after.lastTopScore}\n${label}`);
    continue;
  }
  if (nt.kind !== "set") { wrong.push(`page said ${nt.kind}\n${label}`); continue; }
  if (!moved || game.after.lastTopScore !== out.l_total) {
    wrong.push(`page projected a record, codeNw.js kept ${game.after.lastTopScore}\n${label}`);
    continue;
  }
  if (!p.lastTopScore) tally.first++;
  const release = game.after.lastTopScoreWeek;
  for (const year of new Set([p.year, 6, 7, 23, 24])) {
    for (let e = 0; e <= nt.weeks + 2; e++) {
      const want = oracle.targetAt(release + e, year);
      const got = nt.at(e, year);
      if (want !== got) {
        wrong.push(`week ${e} after release in year ${year}: codeNw.js ${want}, page ${got}\n${label}`);
        break;
      }
    }
  }
  if (nt.target !== oracle.targetAt(release + nt.weeks, p.year)) wrong.push(`full target differs\n${label}`);
  if (nt.at(0) !== nt.target) tally.ramp++;
}
check(`${tally.set} records (${tally.first} first ones, ${tally.ramp} with a warm-up), ` +
  `${tally.kept} kept, ${tally.under} under 9: every one matches`,
  wrong.length === 0 && tally.set > 500 && tally.kept > 20 && tally.under > 500 && tally.first > 50,
  wrong.slice(0, 3).join("\n"));

heading("the page asks for the record only when one is on file and it was not given");
{
  const base = {
    topic: "Fantasy", genre: "RPG", second: null, audience: "everyone", size: "medium",
    year: 10, tsa: 2, lastTop: 200, fans: 500000, platforms: ["PC"], D: 300, T: 180, bugs: 0,
    tl: 3, companyLevel: 2, trend: 1, newStaff: 0, teamSize: 0, teamContrib: 1, experts: 0,
    fatigue: false, seq: false, sameEng: false, betterEng: false, expansion: false, mmo: false,
    sliders: { Engine: 0, Gameplay: 100, "Story/Quests": 100, Dialogues: 100, "Level Design": 100,
      AI: 0, "World Design": 100, Graphic: 25, Sound: 0 },
  };
  const out = page.calcReview(base, mulberry32(1), true);
  const asked = page.nextTarget(base, out).kind;
  const given = page.nextTarget({ ...base, recordBase: 150 }, out).kind;
  check(`a record on file with no base score asks for it (${asked}), and a given one projects (${given})`,
    asked === "unknown" && given === "set" && out.z_raw * out.u_factor >= 9);
}

finish();
