import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildOracle, mulberry32 } from "./lib/oracle.mjs";
import { broadSetup, boundarySetup, headcount, oracleSpec, wideThresholdCases } from "./lib/generators.mjs";
import { PAGE } from "./lib/paths.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const SOURCE = readFileSync(PAGE, "utf8");
const oracle = buildOracle();

function moduleSource(html) {
  const L = html.split("\n");
  const ln = (re) => { const i = L.findIndex((l) => re.test(l)); if (i < 0) throw new Error("no " + re); return i + 1; };
  const sl = (a, b) => L.slice(a - 1, b).join("\n");
  return [
    sl(ln(/^const TOPSCORE_MAX/), ln(/^function ymwToWeek/) - 1),
    sl(ln(/^const TOPICS_BY_ID/), ln(/^const OPT_TEAM_SIZE/)),
    sl(ln(/^const gi = /), ln(/^function findCombos/) - 1),
    sl(ln(/^function mulberry32/), ln(/^function mulberry32/) + 8),
    "export { calcReview };",
  ].join("\n");
}

async function load(html) {
  const dir = mkdtempSync(join(tmpdir(), "gdt-mutant-"));
  const file = join(dir, "mutant.mjs");
  writeFileSync(file, moduleSource(html));
  try { return await import("file://" + file); } finally { rmSync(dir, { recursive: true, force: true }); }
}

const FIXED_CASES = wideThresholdCases();

function detections(mod, generator, runs, seed) {
  const R = mulberry32(seed);
  let found = 0;
  for (let i = 0; i < runs; i++) {
    const p = generator ? generator(R) : FIXED_CASES[i];
    const n = headcount(p);
    let want, got;
    try { want = oracle.rate(oracleSpec(p, n), mulberry32(i)).scoreFinal; } catch { want = "oracle threw"; }
    try { const r = mod.calcReview({ ...p, teamSize: n }, mulberry32(i), true); got = r.error ? "error" : r.z_final; }
    catch { got = "page threw"; }
    if (!Object.is(want, got)) found++;
  }
  return found;
}

const MUTANTS = [
  ["golden ratio bonus band", "if(pct <= 25){ s += 0.1;", "if(pct <= 26){ s += 0.1;"],
  ["golden ratio penalty band", "else if(pct > 50){ s -= 0.1;", "else if(pct > 51){ s -= 0.1;"],
  ["golden ratio point cutoff", "if(D+T >= 30){", "if(D+T >= 29){"],
  ["good focus share", "if(w >= 0.9 && pct >= 0.4) good.push", "if(w >= 0.9 && pct >= 0.41) good.push"],
  ["odd focus weight", "if(w <  0.8 && pct >= 0.4) odd.push", "if(w <  0.75 && pct >= 0.4) odd.push"],
  ["forgot share", "if(w >= 0.9 && pct <= 0.2) forgot.push", "if(w >= 0.9 && pct <= 0.21) forgot.push"],
  ["odd penalty counts exactly two", "if(odd.length === 2){ s -= 0.2*mmoFactor;", "if(odd.length >= 2){ s -= 0.2*mmoFactor;"],
  ["no focus penalty", "else { s -= 0.15*mmoFactor;", "else { s -= 0.14*mmoFactor;"],
  ["fatigue penalty", "if(!p.expansion && p.fatigue){ s -= 0.4;", "if(!p.expansion && p.fatigue){ s -= 0.35;"],
  ["sequel penalty", "if(p.seq){ s -= 0.4; tCount++;", "if(p.seq){ s -= 0.3; tCount++;"],
  ["same engine penalty", "if(p.sameEng && !p.expansion){ s -= 0.1;", "if(p.sameEng && !p.expansion){ s -= 0.15;"],
  ["better engine bonus", "else if(p.betterEng){ s += 0.2;", "else if(p.betterEng){ s += 0.25;"],
  ["mmo topic penalty", "if(p.mmo && p_val < 1.0){ s -= 0.15;", "if(p.mmo && p_val < 1.0){ s -= 0.1;"],
  ["bug factor", "A_val = 1 - 0.8 * (Math.min", "A_val = 1 - 0.75 * (Math.min"],
  ["tech spread divisor", "r_val -= (Math.max(...nonpc)-Math.min(...nonpc))/20;", "r_val -= (Math.max(...nonpc)-Math.min(...nonpc))/25;"],
  ["tech spread skips PC", 'const nonpc = plats.filter(x=>x.id!=="PC").map(x=>x.tl);', "const nonpc = plats.map(x=>x.tl);"],
  ["aaa size factor", "aaa:1.8};\nconst SIZE_DF", "aaa:1.7};\nconst SIZE_DF"],
  ["multi platform blend", "const MULTIPLAT = 0.7;", "const MULTIPLAT = 0.75;"],
  ["multi platform duration built with pow", "  let multiPlatDurF = 1;\n  for(let i = 1; i < plats.length; i++) multiPlatDurF *= MULTIPLAT_DUR;", "  const multiPlatDurF = Math.pow(MULTIPLAT_DUR, plats.length - 1);"],
  ["normalised genre weight", "if(x === 1.0) return 1.1;", "if(x === 1.0) return 1.15;"],
  ["half penalty gate", "if(z >= 0.6 && (v_val <= 0.7 || p_val <= 0.7)){", "if(z >= 0.65 && (v_val <= 0.7 || p_val <= 0.7)){"],
  ["half penalty weight", "(v_val <= 0.7 || p_val <= 0.7)){", "(v_val <= 0.75 || p_val <= 0.75)){"],
  ["platform audience gate", "if(z > 0.7){", "if(z > 0.75){"],
  ["platform audience multiplier", "l_total *= raw;", "l_total *= na;"],
  ["platform audience stops at the first", "        break;\n      }\n    }\n  }", "      }\n    }\n  }"],
  ["score clamp upper bound", "let z_raw = Math.max(1, Math.min(10, 10*z));", "let z_raw = Math.max(1, Math.min(11, 10*z));"],
  ["rescue gate", "z_raw <= 5.2 - 0.2*plats.length;", "z_raw <= 5.3 - 0.2*plats.length;"],
  ["rescue starting value", "    let r2 = 6;", "    let r2 = 6.5;"],
  ["rescue team penalty", "r2 -= (teamDiff - 1);", "r2 -= teamDiff;"],
  ["rescue tech spread", "r2 -= (Math.max(...tls)-Math.min(...tls))/0.5;", "r2 -= (Math.max(...tls)-Math.min(...tls))/1;"],
  ["rescue ceiling", "r2 = Math.min(r2, 7.7);", "r2 = Math.min(r2, 7.8);"],
  ["rescue bug threshold", "if(A_val < 0.9)      r2 -= 0.5;", "if(A_val < 0.85)      r2 -= 0.5;"],
  ["rescue revives the dead branch", "if(A_val < 0.9)      r2 -= 0.5;", "if(A_val <= 0.6) r2 -= 1; else if(A_val < 0.9) r2 -= 0.5;"],
  ["small game office gate", "u_factor = (p.companyLevel >= 2) ? 0.9 : 1.0;", "u_factor = (p.companyLevel >= 3) ? 0.9 : 1.0;"],
  ["medium game fan gate", "u_factor = (p.fans <= 100000) ? 0.9 : 1.0;", "u_factor = (p.fans <= 50000) ? 0.9 : 1.0;"],
  ["large game tech need", "u_factor = (10 - Math.max(0, Math.min(3, 3 - p.tl)))/10;", "u_factor = (10 - Math.max(0, Math.min(3, 4 - p.tl)))/10;"],
  ["aaa tech need", "Math.min(3, 5 - p.tl)) - 0.6*", "Math.min(3, 6 - p.tl)) - 0.6*"],
  ["aaa missing expert cost", "- 0.6*Math.max(0, Math.min(3, 3-experts))", "- 0.5*Math.max(0, Math.min(3, 3-experts))"],
  ["ceiling gate", "  if(z_final >= 9){", "  if(z_final >= 9.1){"],
  ["ceiling quality gate", "if(s < 0.1 && rng() < 0.8) demoteByLowS", "if(s < 0.05 && rng() < 0.8) demoteByLowS"],
  ["ceiling chance", "if(s < 0.1 && rng() < 0.8) demoteByLowS", "if(s < 0.1 && rng() < 0.7) demoteByLowS"],
  ["ceiling floor", ": 8.45 + 0.65*rng();", ": 8.5 + 0.65*rng();"],
  ["ceiling floor with new staff", "? 8.15 + 0.95/Math.max(1,p.newStaff)*rng()", "? 8.2 + 0.95/Math.max(1,p.newStaff)*rng()"],
  ["ceiling lift chance", "if(rng() < 0.1) low = 9 + 0.25*rng();", "if(rng() < 0.15) low = 9 + 0.25*rng();"],
  ["early cap achievement gate", "if(p.tsa < 2 && p.year < 4){", "if(p.tsa < 3 && p.year < 4){"],
  ["early cap year gate", "if(p.tsa < 2 && p.year < 4){", "if(p.tsa < 2 && p.year < 5){"],
  ["early cap at ten", "{ z_final -= 1.05 + 0.45*rng();", "{ z_final -= 1.0 + 0.45*rng();"],
  ["early cap at nine", "z_final -= 1.05 + 0.2*rng();", "z_final -= 1.05 + 0.25*rng();"],
  ["early cap above 8.5", "else if(z_final > 8.5){ z_final -= 0.4 + 0.2*rng();", "else if(z_final > 8.5){ z_final -= 0.45 + 0.2*rng();"],
  ["forced ten", "if(p.tsa === 2 && z_final >= 9 && z_final < 10){", "if(p.tsa === 1 && z_final >= 9 && z_final < 10){"],
  ["final clamp put back", "  const displayed = displayedScore(z_final);", "  z_final = Math.max(1, Math.min(10, z_final));\n  const displayed = displayedScore(z_final);"],
  ["slider share floor", "slider/(sum/70) + 10 : 100/3;", "slider/(sum/70) + 11 : 100/3;"],
  ["slider share span", "slider/(sum/70) + 10 : 100/3;", "slider/(sum/69) + 10 : 100/3;"],
  ["second genre blend", "return (weights[gi(second)] + 2*weights[gi(genre)])/3;", "return (2*weights[gi(second)] + weights[gi(genre)])/3;"],
  ["golden ratio blend", "if(second) return (2*GENRE_GOLDEN[genre] + GENRE_GOLDEN[second])/3;", "if(second) return (GENRE_GOLDEN[genre] + 2*GENRE_GOLDEN[second])/3;"],
  ["topic audience weight normalised", "const v_val = topic.a[ai(audience)];", "const v_val = normAud(topic.a[ai(audience)]);"],
  ["good focus raises the counter once", "if(good.length >= 2){ s += 0.2; uCount += good.length;", "if(good.length >= 2){ s += 0.2; uCount += 1;"],
  ["odd focus raises the bad counter", "if(odd.length === 2){ s -= 0.2*mmoFactor; tCount += odd.length;", "if(odd.length === 2){ s -= 0.2*mmoFactor;"],
  ["rescue gated on achievements again", "    : (!!p.hadTopScoreOverride || hasRecordedTopScore(p));", "    : (p.tsa > 0);"],
  ["top score override ignored", "(!!p.hadTopScoreOverride || hasRecordedTopScore(p))", "(hasRecordedTopScore(p))"],
];

const RUNS = Number(process.env.GDT_MUTATION_RUNS || 2500);

heading(`the differential test is sensitive to a wrong number (${MUTANTS.length} planted faults)`);
check(`${FIXED_CASES.length} fixed wide-platform threshold cases are checked alongside the fuzz`, FIXED_CASES.length > 200);
const missing = [], escaped = [], margins = [];
let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!SOURCE.includes(from)) { missing.push(name); continue; }
  let found;
  try {
    const mod = await load(SOURCE.replace(from, to));
    found = detections(mod, broadSetup, RUNS, 12345)
      + detections(mod, boundarySetup, RUNS, 4242)
      + detections(mod, null, FIXED_CASES.length, 0);
  } catch (e) { found = RUNS; }
  if (found === 0) escaped.push(name); else { caught++; margins.push([found, name]); }
}
check(`every planted fault is detected (${caught} of ${MUTANTS.length - missing.length})`,
  escaped.length === 0, escaped.join("\n"));
check("every mutation anchor still exists in the page", missing.length === 0, missing.join("\n"));
margins.sort((a, b) => a[0] - b[0]);
console.log(`         thinnest margins at ${RUNS} runs per generator: ` +
  margins.slice(0, 3).map(([n, name]) => `${name} (${n})`).join(", "));

finish();
