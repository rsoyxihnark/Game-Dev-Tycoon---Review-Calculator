import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

function installedBrowsers() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return [];
  const found = [];
  for (const name of readdirSync(root)) {
    if (!name.startsWith("chromium")) continue;
    for (const leaf of ["chrome", "headless_shell"]) {
      const candidate = join(root, name, "chrome-linux", leaf);
      if (existsSync(candidate)) found.push(candidate);
    }
  }
  return found.sort().reverse();
}

export async function launchChromium() {
  const attempts = [];
  if (process.env.GDT_CHROMIUM) attempts.push(process.env.GDT_CHROMIUM);
  attempts.push(undefined);
  attempts.push(...installedBrowsers());

  const failures = [];
  for (const executablePath of attempts) {
    try {
      return await chromium.launch(executablePath ? { executablePath } : {});
    } catch (e) {
      failures.push(`${executablePath || "playwright default"}: ${e.message.split("\n")[0]}`);
    }
  }
  throw new Error("could not start chromium.\n" + failures.join("\n"));
}
