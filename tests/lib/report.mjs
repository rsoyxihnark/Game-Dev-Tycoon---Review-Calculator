let failures = 0;
let checks = 0;

export function check(name, ok, detail) {
  checks++;
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}`);
    if (detail) for (const line of String(detail).split("\n").slice(0, 20)) console.log(`         ${line}`);
  }
  return ok;
}

export function heading(name) {
  console.log(`\n${name}`);
}

export function finish() {
  console.log(`\n${checks - failures}/${checks} checks passed`);
  if (failures) process.exitCode = 1;
  return failures;
}
