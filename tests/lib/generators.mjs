import { gameData } from "./game-source.mjs";

const data = gameData();
export const GENRES = ["Action", "Adventure", "RPG", "Simulation", "Strategy", "Casual"];
export const AUDIENCES = ["young", "everyone", "mature"];
export const SIZES = ["small", "medium", "large", "aaa"];
export const OPTIMAL_TEAM = { small: 1, medium: 3, large: 5, aaa: 6 };
export const PAGE_MISSION_IDS = data.missions.map((m) => (m.id === "Dialogs" ? "Dialogues" : m.id));
export const PLATFORM_IDS = data.platforms.map((p) => p.id);
export const TOPIC_IDS = data.topics.map((t) => t.id);

const REACHABLE_TRENDS = [1, 1.2, 0.85, 1.1, 1.4];
const MISSION_INDEX = new Map(data.missions.map((m, i) => [m.id, i]));
const gi = (g) => GENRES.indexOf(g);

export function missionWeight(mission, topic, genre, second) {
  const w = mission.genreWeightings.slice();
  if (topic.missionOverrides) {
    const mi = MISSION_INDEX.get(mission.id);
    for (let g = 0; g < 6; g++) {
      const ov = topic.missionOverrides[g] && topic.missionOverrides[g][mi];
      if (ov) w[g] = ov;
    }
  }
  const raw = (g) => w[gi(g)];
  return second ? (raw(second) + 2 * raw(genre)) / 3 : raw(genre);
}

export function expertCapableCount(topicId, genre, second) {
  const topic = data.topics.find((t) => t.id === topicId);
  return data.missions.filter((m) => missionWeight(m, topic, genre, second) >= 0.9).length;
}

export function headcount(p) {
  return Math.max(p.teamSize > 0 ? p.teamSize : OPTIMAL_TEAM[p.size],
    1 + Math.min(p.newStaff, 20), Math.min(p.experts, 9));
}

export function broadSetup(R) {
  const ri = (n) => Math.floor(R() * n);
  const pick = (a) => a[ri(a.length)];
  const size = pick(SIZES);
  const platforms = [];
  const wanted = R() < 0.12 ? 4 + ri(26) : 1 + ri(3);
  while (platforms.length < wanted) { const x = pick(PLATFORM_IDS); if (!platforms.includes(x)) platforms.push(x); }
  const genre = pick(GENRES);
  let second = R() < 0.4 ? pick(GENRES) : null;

  const sliders = {};
  for (const id of PAGE_MISSION_IDS) sliders[id] = R() < 0.12 ? 0 : ri(101);
  if (R() < 0.08) for (const id of PAGE_MISSION_IDS) sliders[id] = 0;
  if (R() < 0.18) {
    const edge = [[30, 20, 20], [10, 30, 30], [5, 30, 35], [75, 100, 0], [100, 0, 0], [1, 1, 1]][ri(6)];
    PAGE_MISSION_IDS.forEach((id, i) => { sliders[id] = edge[i % 3]; });
  }

  const lastTopScore = R() < 0.5 ? 0 : 21 + ri(400);
  return {
    topic: pick(TOPIC_IDS), genre, second, audience: pick(AUDIENCES), size,
    year: 1 + ri(30), tsa: lastTopScore ? ri(5) : 0, lastTopScore, lastTop: lastTopScore || 20,
    fans: ri(3) === 0 ? ri(100001) : ri(5000000), platforms,
    D: ri(2000), T: ri(2000), bugs: R() < 0.5 ? 0 : ri(400),
    tl: ri(8), companyLevel: 1 + ri(4), trend: pick(REACHABLE_TRENDS),
    newStaff: R() < 0.7 ? 0 : ri(4), teamSize: R() < 0.5 ? 0 : 1 + ri(8),
    teamContrib: R() < 0.8 ? 1 : R(), experts: ri(7),
    fatigue: R() < 0.15, seq: R() < 0.15, sameEng: R() < 0.2, betterEng: R() < 0.2,
    expansion: R() < 0.1, mmo: R() < 0.15, sliders,
  };
}

export function boundarySetup(R) {
  const ri = (n) => Math.floor(R() * n);
  const pick = (a) => a[ri(a.length)];
  const topic = data.topics[ri(data.topics.length)];
  const genre = pick(GENRES);
  let second = R() < 0.35 ? pick(GENRES) : null;
  const size = pick(SIZES);
  const platforms = [];
  const wanted = R() < 0.25 ? 4 + ri(26) : 1 + ri(3);
  while (platforms.length < wanted) { const x = pick(PLATFORM_IDS); if (!platforms.includes(x)) platforms.push(x); }

  const sliders = {};
  const mode = ri(4);
  for (const [i, m] of data.missions.entries()) {
    const w = missionWeight(m, topic, genre, second);
    const id = PAGE_MISSION_IDS[i];
    if (mode === 0) sliders[id] = w >= 0.9 ? 100 : 0;
    else if (mode === 1) sliders[id] = w >= 0.9 ? 0 : 100;
    else if (mode === 2) sliders[id] = w >= 0.9 ? 100 : 50;
    else sliders[id] = ri(101);
  }

  let D, T;
  if (R() < 0.5) { const total = 20 + ri(21); D = ri(total + 1); T = total - D; }
  else { D = ri(600); T = ri(600); }

  const lastTopScore = R() < 0.8 ? 40 + ri(900) : 0;
  return {
    topic: topic.id, genre, second, audience: pick(AUDIENCES), size,
    year: 1 + ri(30), tsa: lastTopScore ? ri(5) : 0, lastTopScore, lastTop: lastTopScore || 20,
    fans: ri(2) ? ri(100001) : ri(5000000), platforms,
    D, T, bugs: R() < 0.7 ? 0 : ri(60), tl: ri(8), companyLevel: 1 + ri(4),
    trend: pick(REACHABLE_TRENDS),
    newStaff: R() < 0.85 ? 0 : ri(3), teamSize: R() < 0.5 ? 0 : 1 + ri(4),
    teamContrib: R() < 0.7 ? 1 : 0.75 + R() * 0.12,
    experts: ri(7),
    fatigue: R() < 0.1, seq: R() < 0.1, sameEng: R() < 0.15, betterEng: R() < 0.3,
    expansion: R() < 0.08, mmo: R() < 0.1, sliders,
  };
}

export function oracleSpec(p, n) {
  return {
    T: p.T, D: p.D, size: p.size, genre: p.genre, second: p.second, topic: p.topic,
    audience: p.audience, platforms: p.platforms, bugs: p.bugs, tl: p.tl, mmo: p.mmo,
    expansion: p.expansion, sameEng: p.sameEng, betterEng: p.betterEng, seq: p.seq,
    trend: p.trend, fans: p.fans, companyLevel: p.companyLevel, tsa: p.tsa, year: p.year,
    lastTopScore: p.lastTopScore, newStaff: p.newStaff, staffN: n, experts: p.experts,
    teamContrib: p.teamContrib, fatigue: p.fatigue,
    sliderByIndex: PAGE_MISSION_IDS.map((id) => p.sliders[id] ?? 0),
  };
}

export function wideThresholdCases() {
  const cases = [];
  const triples = [[5, 30, 35], [30, 20, 20], [10, 30, 30], [3, 2, 2]];
  for (let n = 1; n <= PLATFORM_IDS.length; n++) {
    for (const triple of triples) {
      for (const size of SIZES) {
        const sliders = {};
        PAGE_MISSION_IDS.forEach((id, i) => { sliders[id] = triple[i % 3]; });
        cases.push({
          topic: "Movies", genre: "RPG", second: null, audience: "young", size,
          year: 23, tsa: 4, lastTopScore: 120, lastTop: 120, fans: 3664502,
          platforms: PLATFORM_IDS.slice(0, n), D: 300, T: 200, bugs: 0, tl: 7,
          companyLevel: 4, trend: 1, newStaff: 0, teamSize: 0, teamContrib: 1, experts: 3,
          fatigue: false, seq: false, sameEng: false, betterEng: false,
          expansion: false, mmo: false, sliders,
        });
      }
    }
  }
  return cases;
}
