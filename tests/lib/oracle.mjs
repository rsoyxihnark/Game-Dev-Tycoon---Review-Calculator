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
var RNG=function(){return 0.5};var TREND=1;var __D={};
var GameManager={};var Reviews={};
`;

const GAME_HELPERS = `
var GameGenre={Action:{id:"Action"},Adventure:{id:"Adventure"},RPG:{id:"RPG"},
  Simulation:{id:"Simulation"},Strategy:{id:"Strategy"},Casual:{id:"Casual"}};
GameGenre.getAll=function(){return[this.Action,this.Adventure,this.RPG,this.Simulation,this.Strategy,this.Casual]};
GameGenre.getGoldenRatio=function(a,b){if(b)return(2*GameGenre.getGoldenRatio(a)+GameGenre.getGoldenRatio(b))/3;
 if(a===GameGenre.Action)return 1.8;if(a===GameGenre.Adventure)return 0.4;if(a===GameGenre.RPG)return 0.6;
 if(a===GameGenre.Simulation)return 1.6;if(a===GameGenre.Strategy)return 1.4;if(a===GameGenre.Casual)return 0.5;
 throw"unknown genre: "+a;};
GameGenre.getGenreWeighting=function(a,b,c){if(void 0===a)return 1;
 if(c)return(GameGenre.getGenreWeighting(a,c)+2*GameGenre.getGenreWeighting(a,b))/3;
 if(b===GameGenre.Action)return a[0];if(b===GameGenre.Adventure)return a[1];if(b===GameGenre.RPG)return a[2];
 if(b===GameGenre.Simulation)return a[3];if(b===GameGenre.Strategy)return a[4];if(b===GameGenre.Casual)return a[5];
 throw"unknown genre: "+b;};
var Missions={BASE_DURATION:1800};
var __data=JSON.parse(__dataJson);
Missions.Stage1Missions=__data.stage1;Missions.Stage2Missions=__data.stage2;Missions.Stage3Missions=__data.stage3;
Missions.DevMissions=Missions.Stage1Missions.concat(Missions.Stage2Missions.concat(Missions.Stage3Missions));
Missions.DevMissions.forEach(function(m){m.missionType="dev";m.level=1;m.experience=0});
Missions.getAllMissions=function(){return Missions.DevMissions.slice()};
Missions.getMissionWithId=function(id){return Missions.DevMissions.first(function(m){return m.id===id})};
Missions.getGenreWeighting=function(a,b){var c=b.genre,f=b.secondGenre,d=a;
 d.genreWeightings||(d=Missions.getAllMissions().first(function(x){return x.id===d.id}));
 var k=d.genreWeightings.slice();
 if(b.topic.missionOverrides){var m=Missions.DevMissions.indexOf(d);
  if(-1!=m)for(var l=b.topic.missionOverrides,g=0;g<l.length;g++){var n=l[g][m];n&&(k[g]=n)}}
 return GameGenre.getGenreWeighting(k,c,f)};
var General={};
General.getGameSizeDurationFactor=function(a){return"small"===a?GameFlags.SMALL_GAME_DURATION_FACTOR:
 "medium"===a?GameFlags.MEDIUM_GAME_DURATION_FACTOR:"large"===a?GameFlags.LARGE_GAME_DURATION_FACTOR:
 "aaa"===a?GameFlags.AAA_GAME_DURATION_FACTOR:1};
General.getMultiPlatformDurationFactor=function(a,b){var c=a.platforms,l=1,g=1;
 a.engine&&void 0==b&&a.engine.parts.first(function(p){return"MultiPlatformOptimized"==p.id})&&(g=0.5);
 for(var f=1;f<c.length;f++)l*=1+(GameFlags.MULTIPLATFORM_DURATION_FACTOR-1)*g;return l};
General.getGameSizePointsFactor=function(a){return"small"===a.gameSize?GameFlags.SMALL_GAME_POINTS_FACTOR:
 "medium"===a.gameSize?GameFlags.MEDIUM_GAME_POINTS_FACTOR:"large"===a.gameSize?GameFlags.LARGE_GAME_POINTS_FACTOR:
 "aaa"===a.gameSize?GameFlags.AAA_GAME_POINTS_FACTOR:1};
General.getAudienceWeighting=function(a,b){if(void 0===b||void 0===a)return 1;
 if("young"===b)return a[0];if("everyone"===b)return a[1];if("mature"===b)return a[2];throw"unknown audience";};
General.getAudienceLabel=function(a){return a};
General.getOptimalTeamSize=function(a){switch(a.gameSize){case "aaa":return 6;case "large":return 5;
 case "medium":return 3;default:return 1}};
var Platforms={};
Platforms.getNormalizedAudienceWeighting=function(a){return 0.8<=a?a+0.2:0.7<=a?a+0.1:a+0.05};
Platforms.getNormalizedGenreWeighting=function(a){return 1==a?1.1:0.9==a?1.05:0.8==a?1:0.7==a?0.95:0.6==a?0.9:1};
Platforms.getNormGenreWeighting=function(a,c,f){if(void 0===a)return 1;
 if(f)return(Platforms.getNormGenreWeighting(a,f)+2*Platforms.getNormGenreWeighting(a,c))/3;
 if(c===GameGenre.Action)return Platforms.getNormalizedGenreWeighting(a[0]);
 if(c===GameGenre.Adventure)return Platforms.getNormalizedGenreWeighting(a[1]);
 if(c===GameGenre.RPG)return Platforms.getNormalizedGenreWeighting(a[2]);
 if(c===GameGenre.Simulation)return Platforms.getNormalizedGenreWeighting(a[3]);
 if(c===GameGenre.Strategy)return Platforms.getNormalizedGenreWeighting(a[4]);
 if(c===GameGenre.Casual)return Platforms.getNormalizedGenreWeighting(a[5]);throw"unknown genre: "+c;};
Platforms.getGenreWeighting=function(a,c,f){for(var d=1,k=1,m=0,l=0;l<a.length;l++){
 var g=Platforms.getNormGenreWeighting(a[l].genreWeightings,c,f);
 l<a.length-1?(d*=GameFlags.MULTIPLATFORM_WEIGHTING,m+=g*d,k-=d):m+=g*k}return m};
Platforms.getPlatformsAudienceWeighting=function(a,c,f){if(void 0===c||void 0===a)return f?0.8:1;
 if("young"===c)return f?a[0]:Platforms.getNormalizedAudienceWeighting(a[0]);
 if("everyone"===c)return f?a[1]:Platforms.getNormalizedAudienceWeighting(a[1]);
 if("mature"===c)return f?a[2]:Platforms.getNormalizedAudienceWeighting(a[2]);throw"unknown audience";};
var GameTrends={getCurrentTrendFactor:function(){return TREND}};
`;

const BUILDER = `
function __build(specJson){
  var sp=JSON.parse(specJson);
  var topic=__data.topics.first(function(t){return t.id===sp.topic});
  var all=Missions.DevMissions;
  var pl=[]; for(var i=0;i<sp.platforms.length;i++){ var pid=sp.platforms[i];
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
  var company={lastTopScore:sp.lastTopScore,previousTopScore:0,lastTopScoreWeek:0,
    lastTopScoreIncrease:0,lastTopScoreGameSize:sp.size,currentWeek:0,currentLevel:sp.companyLevel,
    fans:sp.fans,staff:staff,gameLog:gameLog,topScoreAchievements:sp.tsa,
    getCurrentDate:function(){return{year:sp.year}},getRandom:RNG,currentGame:game,
    getGameById:function(){return{title:"prev",releaseWeek:0,score:5,platforms:pl,flags:{}}}};
  GameManager.company=company; TREND=sp.trend;
  __D={}; Reviews.rateGame(company);
  __D.expertCount=want; __D.scoreFinal=game.score;
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
