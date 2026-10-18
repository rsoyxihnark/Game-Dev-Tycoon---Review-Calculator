import { buildOracle, mulberry32 } from "./lib/oracle.mjs";
import { loadCalculator } from "./lib/page.mjs";
import { check, heading, finish } from "./lib/report.mjs";

const oracle = buildOracle();
const gameReviewers = oracle.loadReviewerTransform();
const page = await loadCalculator();

function pageReviewers(score, psEnabled, rand) {
  const g = page.displayedScore(score);
  const floorIs10 = Math.floor(score) === 10;
  const reviewers = [];
  let u = 1;
  for (let t = 0; t < 4; t++) {
    if (g === 5 || g === 6) u = rand() < 0.05 ? 2 : 1;
    const sign1 = rand() < 0.5 ? -1 : 1;
    const r = sign1 === 1 ? 0 : u * (rand() < 0.5 ? -1 : 1);
    let v = Math.max(1, Math.min(10, g + r));
    if (v === 10 && reviewers.length === 3 && reviewers.every((x) => x === 10)) {
      if (psEnabled) { if (floorIs10 && rand() < 0.4) v = v + 1; }
      else if (!floorIs10 || rand() < 0.8) v = Math.max(1, v - 1);
    }
    reviewers.push(v);
  }
  return reviewers;
}

heading("reviewer parity");
const RUNS = Number(process.env.GDT_REVIEWER_RUNS || 60000);
let divergent = 0;
const examples = [];
for (let seed = 0; seed < RUNS; seed++) {
  const R = mulberry32(seed);
  const score = 1 + R() * 9.6;        // spans 1..10.6, so floor(score)===10 and score>=9.5 both occur
  const psEnabled = R() < 0.5;
  const stream = seed * 7919 + 13;
  const want = gameReviewers(score, psEnabled, mulberry32(stream));
  const got = pageReviewers(score, psEnabled, mulberry32(stream));
  if (JSON.stringify(want) !== JSON.stringify(got)) {
    divergent++;
    if (examples.length < 3) examples.push(`score ${score.toFixed(4)} psEnabled ${psEnabled}: codeNw.js ${JSON.stringify(want)}, page ${JSON.stringify(got)}`);
  }
}
check(`${RUNS} reviewer vectors match codeNw.js exactly`, divergent === 0,
  `${divergent} divergent\n${examples.join("\n")}`);

heading("simulateReviewers agrees with that rule");
for (const [score, ps] of [[9.7, true], [9.7, false], [10.4, true], [5.4, false], [6.2, false], [3.1, false]]) {
  const runs = 4000;
  const { sumHist } = page.simulateReviewers(score, ps, runs, 99);
  const mine = new Array(45).fill(0);
  const rand = page.mulberry32(99);
  for (let i = 0; i < runs; i++) mine[pageReviewers(score, ps, rand).reduce((a, b) => a + b, 0)]++;
  check(`score ${score} psEnabled ${ps}: identical sum histogram`,
    JSON.stringify(sumHist) === JSON.stringify(mine));
}

finish();
