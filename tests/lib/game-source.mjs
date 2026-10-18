import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";
import { join } from "node:path";
import { ROOT } from "./paths.mjs";

export const GAME_SOURCE = readFileSync(join(ROOT, "codeNw.js"), "utf8");

export function closingBracket(src, from, open, close) {
  let depth = 0, quote = null, escaped = false;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === "\\") { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return i; }
  }
  throw new Error(`unbalanced ${open}${close} from offset ${from}`);
}

export function literalAfter(marker, open = "[", close = "]") {
  const i = GAME_SOURCE.indexOf(marker);
  if (i < 0) throw new Error(`codeNw.js no longer contains: ${marker}`);
  const start = GAME_SOURCE.indexOf(open, i + marker.length - 1);
  return GAME_SOURCE.slice(start, closingBracket(GAME_SOURCE, start, open, close) + 1);
}

const literalContext = createContext({});
runInContext(
  "Object.defineProperty(String.prototype,'localize',{value:function(){return String(this)}});",
  literalContext);

export function evalLiteral(text) {
  return runInContext("(" + text + ")", literalContext);
}

export function gameData() {
  const topics = evalLiteral(literalAfter("Topics.topics="));

  const pcIndex = GAME_SOURCE.indexOf('var a=[{id:"PC",name:"PC"');
  if (pcIndex < 0) throw new Error("codeNw.js no longer declares the platform array the same way");
  let platforms = evalLiteral(
    GAME_SOURCE.slice(GAME_SOURCE.indexOf("[", pcIndex),
      closingBracket(GAME_SOURCE, GAME_SOURCE.indexOf("[", pcIndex), "[", "]") + 1));

  let scan = GAME_SOURCE.indexOf("Platforms.allPlatforms=[]");
  const addRange = "Platforms.allPlatforms.addRange(";
  for (;;) {
    const k = GAME_SOURCE.indexOf(addRange, scan);
    if (k < 0) break;
    scan = k + addRange.length;
    const bracket = GAME_SOURCE.indexOf("[", k);
    if (bracket < 0 || bracket > GAME_SOURCE.indexOf(")", k)) continue;
    platforms = platforms.concat(
      evalLiteral(GAME_SOURCE.slice(bracket, closingBracket(GAME_SOURCE, bracket, "[", "]") + 1)));
  }

  const stage1 = evalLiteral(literalAfter("Missions.Stage1Missions="));
  const stage2 = evalLiteral(literalAfter("Missions.Stage2Missions="));
  const stage3 = evalLiteral(literalAfter("Missions.Stage3Missions="));

  return { topics, platforms, stage1, stage2, stage3, missions: [...stage1, ...stage2, ...stage3] };
}
