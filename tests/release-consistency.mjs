import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readVersion, isThreePart, changelogSections, ROOT } from "../tools/version.mjs";
import { check, heading, finish } from "./lib/report.mjs";

heading("version");
let version = null;
try { version = readVersion(); } catch (e) { check("APP_VERSION is readable", false, e.message); }
if (version) {
  check(`APP_VERSION reads as ${version}`, true);
  check("it has three parts", isThreePart(version), version);
  const page = readFileSync(join(ROOT, "GameDevTycoon_Calculator.html"), "utf8");
  const occurrences = page.split(`"${version}"`).length - 1;
  check("the version is written in exactly one place in the source", occurrences === 1,
    `found ${occurrences} occurrences`);
}

heading("changelog");
check("CHANGELOG.md exists", existsSync(join(ROOT, "CHANGELOG.md")));
if (version && existsSync(join(ROOT, "CHANGELOG.md"))) {
  const sections = changelogSections();
  check(`the top section is ${version}`, sections[0] === version,
    `sections: ${sections.slice(0, 4).join(", ")}`);
  check("no Unreleased heading is left behind",
    !sections.some((s) => /^unreleased$/i.test(s)), sections.join(", "));
  const body = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
  const section = body.split(/^## /m).find((s) => s.startsWith(version));
  const bullets = (section || "").split("\n").filter((l) => l.startsWith("- "));
  check(`the ${version} section has entries`, bullets.length > 0);
}

heading("release workflow");
const workflow = join(ROOT, ".github", "workflows", "release.yml");
check("the release workflow is present", existsSync(workflow));
if (existsSync(workflow)) {
  const text = readFileSync(workflow, "utf8");
  check("it runs the tests before publishing", text.includes("npm test"));
  check("it checks the stylesheet is not stale", text.includes("build-styles.mjs --check"));
  check("it reads the version from the source", text.includes("tools/version.mjs"));
  check("it attaches the calculator to the release",
    text.includes("GameDevTycoon_Calculator.html"));
}

finish();
