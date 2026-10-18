import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUITES = [
  "release-consistency.mjs",
  "text-length.mjs",
  "data-parity.mjs",
  "score-parity.mjs",
  "reviewer-parity.mjs",
  "slider-boundary.mjs",
  "self-contained.mjs",
];

let failed = [];
for (const suite of SUITES) {
  console.log(`\n${"=".repeat(64)}\n${suite}\n${"=".repeat(64)}`);
  const r = spawnSync(process.execPath, [join(HERE, suite)], { stdio: "inherit" });
  if (r.status !== 0) failed.push(suite);
}

console.log(`\n${"=".repeat(64)}`);
if (failed.length) {
  console.log(`FAILED: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`all ${SUITES.length} suites passed`);
