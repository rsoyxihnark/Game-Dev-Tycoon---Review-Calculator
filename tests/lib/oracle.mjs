import { createContext, runInContext } from "node:vm";
import { GAME_SOURCE, closingBracket, gameData } from "./game-source.mjs";

const IIFE_START = "(function(){var a=function(a){if(a.lastTopScore){";

export const MESSAGE_LOOP =
  `var A=void 0;do 0.2>=GameManager.company.getRandom()?0<=r&&6<=v&&0!=c.length?A=c.pickRandom():0>r&&6>v&&0!=l&&(A=l.pickRandom()):A=void 0,A||(A=Reviews.getGenericReviewMessage(a,v));
while(-1!=p.weakIndexOf(A));`;

const PROBES = [
  ["l=(l+l*s)*q;", "__D.s=s;__D.q=q;__D.v=v;__D.A=A;__D.rTech=r;__D.pGenre=p;l=(l+l*s)*q;"],
  ["B=a(d);z=l/B;", "B=a(d);z=l/B;__D.l_total=l;__D.B=B;__D.z0=z;"],
  ["p=!1;z=(10*z).clamp(1,10);", "p=!1;__D.zPre=z;z=(10*z).clamp(1,10);__D.z_raw=z;"],
  ["u=f(d,g)/10;", "u=f(d,g)/10;__D.u=u;"],
  ["g.score=z;", "__D.score=z;g.score=z;"],
  ["Reviews.reviewGame=function(a){", "Reviews.__target=a;Reviews.reviewGame=function(a){"],
];

const PRELUDE = `
Number.prototype.clamp=function(a,b){return Math.min(Math.max(this,a),b)};
Object.defineProperty(String.prototype,'localize',{value:function(){return String(this)}});
Object.defineProperty(String.prototype,'format',{value:function(){var a=arguments;return this.replace(/\\{(\\d+)\\}/g,function(m,i){return a[i]})}});
Object.defineProperty(String.prototype,'log',{value:function(){}});
Array.prototype.first=function(f){for(var i=0;i<this.length;i++)if(!f||f(this[i]))return this[i];return null};
Array.prototype.count=function(f){var n=0;for(var i=0;i<this.length;i++)if(f(this[i]))n++;return n};
Array.prototype.last=function(){return this.length?this[this.length-1]:null};
Array.prototype.sum=function(f){var s=0;for(var i=0;i<this.length;i++)s+=f?f(this[i]):this[i];return s};
Array.prototype.average=function(f){return this.length?this.sum(f)/this.length:0};
Array.prototype.pickRandom=function(){return this[0]};
Array.prototype.weakIndexOf=function(a){for(var i=0;i<this.length;i++)if(this[i]==a)return i;return -1};
Array.prototype.addRange=function(a){for(var i=0;i<a.length;i++)this.push(a[i]);return this};
Array.prototype.max=function(f){var b=null,bv=-Infinity;for(var i=0;i<this.length;i++){var v=f?f(this[i]):this[i];if(v>bv){bv=v;b=this[i]}}return b};
Math.randomSign=function(){return 0===Math.floor(2*RNG())?-1:1};
var GDT={fire:function(){},eventKeys:{gameplay:{beforeGameReview:0,afterGameReview:1}}};
var Media={createSequelStory:function(){},createExtensionPackStory:function(){}};
var Notification=function(){};var NotificationType={};
var RNG=function(){return 0.5};var TREND=1;var __D={};var __lastCompany=null;
var GameManager={};var Reviews={};
`;

function liftFunction(anchor, assignAs) {
  const at = GAME_SOURCE.indexOf(anchor);
  if (at < 0) throw new Error(`codeNw.js no longer contains: ${anchor}`);
  if (GAME_SOURCE.indexOf(anchor, at + 1) >= 0) throw new Error(`codeNw.js holds more than one: ${anchor}`);
  const fn = GAME_SOURCE.indexOf("function", at);
  const open = GAME_SOURCE.indexOf("{", fn);
  return `${assignAs}=${GAME_SOURCE.slice(fn, closingBracket(GAME_SOURCE, open, "{", "}") + 1)};\n`;
}

function liftConstant(key) {
  const found = [...GAME_SOURCE.matchAll(new RegExp(`[{,]${key}:([0-9.E]+)[,}]`, "g"))];
  if (found.length !== 1) throw new Error(`codeNw.js should declare ${key} once, found ${found.length}`);
  return found[0][1];
}

const LIFTED = [
  ["getGoldenRatio:function(", "GameGenre.getGoldenRatio"],
  ["getGenreWeighting:function(", "GameGenre.getGenreWeighting"],
  ["Missions.getGenreWeighting=function(", "Missions.getGenreWeighting"],
  ["General.getGameSizeDurationFactor=", "General.getGameSizeDurationFactor"],
  ["General.getMultiPlatformDurationFactor=function(", "General.getMultiPlatformDurationFactor"],
  ["General.getGameSizePointsFactor=function(", "General.getGameSizePointsFactor"],
  ["General.getAudienceWeighting=function(", "General.getAudienceWeighting"],
  ["General.getOptimalTeamSize=function(", "General.getOptimalTeamSize"],
  ["Platforms.getNormalizedAudienceWeighting=function(", "Platforms.getNormalizedAudienceWeighting"],
  ["Platforms.getNormalizedGenreWeighting=function(", "Platforms.getNormalizedGenreWeighting"],
  ["Platforms.getNormGenreWeighting=function(", "Platforms.getNormGenreWeighting"],
  ["Platforms.getGenreWeighting=function(", "Platforms.getGenreWeighting"],
  ["Platforms.getPlatformsAudienceWeighting=", "Platforms.getPlatformsAudienceWeighting"],
];

const GAME_HELPERS = `
var GameGenre={Action:{id:"Action"},Adventure:{id:"Adventure"},RPG:{id:"RPG"},
  Simulation:{id:"Simulation"},Strategy:{id:"Strategy"},Casual:{id:"Casual"}};
var Missions={BASE_DURATION:${liftConstant("BASE_DURATION")}};
var __data=JSON.parse(__dataJson);
Missions.Stage1Missions=__data.stage1;Missions.Stage2Missions=__data.stage2;Missions.Stage3Missions=__data.stage3;
Missions.DevMissions=Missions.Stage1Missions.concat(Missions.Stage2Missions.concat(Missions.Stage3Missions));
Missions.DevMissions.forEach(function(m){m.missionType="dev";m.level=1;m.experience=0});
Missions.getAllMissions=function(){return Missions.DevMissions.slice()};
Missions.getMissionWithId=function(id){return Missions.DevMissions.first(function(m){return m.id===id})};
var General={};
General.getAudienceLabel=function(a){return a};
var Platforms={};
${LIFTED.map(([anchor, name]) => liftFunction(anchor, name)).join("")}
var GameTrends={getCurrentTrendFactor:function(){return TREND}};
`;

const BUILDER = `
function __build(specJson){
  var sp=JSON.parse(specJson);
  var topic=__data.topics.first(function(t){return t.id===sp.topic});
  var all=Missions.DevMissions;
  var pl=[]; for(var i=0;i<sp.platforms.length;i++){ var pid=sp.platforms[i];
    if(sp.custom&&pid===sp.custom.id){pl.push({id:"c0ffee-console",isCustom:!0,
      genreWeightings:sp.custom.g,audienceWeightings:sp.custom.a,techLevel:sp.custom.tl});continue;}
    pl.push(__data.platforms.first(function(x){return x.id===pid})); }
  var game={technologyPoints:sp.T,designPoints:sp.D,gameSize:sp.size,
    genre:GameGenre[sp.genre],secondGenre:sp.second?GameGenre[sp.second]:null,
    topic:topic,targetAudience:sp.audience,platforms:pl,bugs:sp.bugs,engine:null,
    sequelTo:sp.seq?"prev":null,
    flags:{techLevel:sp.tl,featureResponsibility:{},staffContribution:{},mmo:!!sp.mmo,
      isExtensionPack:!!sp.expansion,usesSameEngineAsSequel:!!sp.sameEng,
      hasBetterEngineThanSequel:!!sp.betterEng},
    featureLog:[],getGenreDisplayName:function(){return sp.genre},
    getRatioWorked:function(){return sp.teamContrib}};
  var sizeDurF=General.getGameSizeDurationFactor(sp.size);
  var mpF=General.getMultiPlatformDurationFactor(game);
  for(var s=1;s<=3;s++){
    var ms=[],idx=[];
    for(var j=0;j<all.length;j++){var st=j<3?1:j<6?2:3; if(st===s){ms.push(all[j]);idx.push(j)}}
    var vals=[],sum=0;
    for(var j=0;j<ms.length;j++){var v=sp.sliderByIndex[idx[j]]||0;vals.push(v);sum+=v}
    var pcts=[];
    if(sum===0){pcts=[100/3,100/3,100/3]}else{for(var j=0;j<vals.length;j++)pcts.push(vals[j]/(sum/70)+10)}
    for(var j=0;j<ms.length;j++)
      game.featureLog.push({id:ms[j].id,missionType:"mission",
        duration:(3*Missions.BASE_DURATION/100*pcts[j])*sizeDurF*mpF});
  }
  var qualifying=[];
  for(var j=0;j<all.length;j++) if(0.9<=Missions.getGenreWeighting(all[j],game)) qualifying.push(all[j]);
  var want=Math.min(sp.experts,qualifying.length);
  var n=sp.staffN, staff=[];
  for(var i=0;i<n;i++){staff.push({id:"s"+i,flags:{gamesContributed:5,expert:null}});
    game.flags.staffContribution["s"+i]=1}
  for(var i=1;i<=sp.newStaff&&i<n;i++) staff[i].flags.gamesContributed=1;
  for(var j=0;j<want;j++){ game.flags.featureResponsibility[qualifying[j].id]=staff[n-1-j].id;
    staff[n-1-j].flags.expert=qualifying[j].id; }
  var gameLog=[];
  if(sp.fatigue) gameLog.push({genre:game.genre,secondGenre:game.secondGenre,topic:game.topic,
    score:5,platforms:pl,flags:{},sequelTo:null,title:"prev"});
  var company={lastTopScore:sp.lastTopScore,previousTopScore:sp.previousTopScore||0,
    lastTopScoreWeek:sp.lastTopScoreWeek||0,lastTopScoreIncrease:sp.lastTopScoreIncrease||0,
    lastTopScoreGameSize:sp.lastTopScoreGameSize||sp.size,currentWeek:sp.currentWeek||0,currentLevel:sp.companyLevel,
    fans:sp.fans,staff:staff,gameLog:gameLog,topScoreAchievements:sp.tsa,
    getCurrentDate:function(){return{year:sp.year}},getRandom:RNG,currentGame:game,
    getGameById:function(){return{title:"prev",releaseWeek:0,score:5,platforms:pl,flags:{}}}};
  GameManager.company=company; TREND=sp.trend;
  __D={}; Reviews.rateGame(company);
  __D.expertCount=want; __D.scoreFinal=game.score;
  __D.after={lastTopScore:company.lastTopScore,lastTopScoreIncrease:company.lastTopScoreIncrease,
    previousTopScore:company.previousTopScore,lastTopScoreWeek:company.lastTopScoreWeek};
  __lastCompany=company;
  return JSON.parse(JSON.stringify(__D));
}
`;

export const OPTIMAL_TEAM = { small: 1, medium: 3, large: 5, aaa: 6 };

export function buildOracle() {
  const data = gameData();

  const start = GAME_SOURCE.indexOf(IIFE_START);
  if (start < 0) throw new Error("codeNw.js no longer opens the Reviews module the same way");
  let iife = GAME_SOURCE.slice(start, closingBracket(GAME_SOURCE, start, "(", ")") + 1) + "();";
  for (const [anchor, replacement] of PROBES) {
    if (!iife.includes(anchor)) throw new Error(`probe anchor gone from codeNw.js: ${anchor}`);
    iife = iife.replace(anchor, replacement);
  }

  const flagsAt = GAME_SOURCE.indexOf("GameFlags={");
  const flagsOpen = GAME_SOURCE.indexOf("{", flagsAt);
  const gameFlags = GAME_SOURCE.slice(flagsOpen, closingBracket(GAME_SOURCE, flagsOpen, "{", "}") + 1);

  const ctx = createContext({ console });
  ctx.__dataJson = JSON.stringify(data);
  runInContext(PRELUDE, ctx);
  runInContext("var GameFlags=" + gameFlags + ";", ctx);
  runInContext(GAME_HELPERS, ctx);
  runInContext(iife, ctx);
  runInContext("Reviews.getReviews=function(){return[]};", ctx);
  runInContext(BUILDER, ctx);

  const build = runInContext("__build", ctx);

  return {
    data,
    context: ctx,
    rate(params, rng) {
      ctx.__rng = rng;
      runInContext("RNG=__rng;", ctx);
      return build(JSON.stringify(params));
    },
    targetAt(week, year) {
      ctx.__week = week;
      ctx.__year = year;
      return runInContext(
        "__lastCompany.currentWeek=__week;__lastCompany.getCurrentDate=function(){return{year:__year}};" +
        "Reviews.__target(__lastCompany)", ctx);
    },
    loadReviewerTransform() {
      const i = GAME_SOURCE.indexOf("Reviews.getReviews=function(a,b,c,l){");
      if (i < 0) throw new Error("codeNw.js no longer declares Reviews.getReviews the same way");
      const j = GAME_SOURCE.indexOf("};Reviews.getGenericReviewMessage", i);
      let body = GAME_SOURCE.slice(i, j + 1);
      if (!body.includes(MESSAGE_LOOP)) throw new Error("review-message loop anchor gone from codeNw.js");
      body = body.replace(MESSAGE_LOOP, 'var A="m"+t;');
      runInContext(body + ";__reviewerTransform=Reviews.getReviews;", ctx);
      const fn = runInContext("__reviewerTransform", ctx);
      return (score, psEnabled, rng) => {
        ctx.__rng = rng;
        runInContext("RNG=__rng;GameManager.company={getRandom:RNG,flags:{}};", ctx);
        return fn({ flags: { psEnabled } }, score, [], []).map((r) => r.score);
      };
    },
  };
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
