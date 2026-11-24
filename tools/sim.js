// 헤드리스 난이도 시뮬레이션.
// index.html의 게임 스크립트를 화면 없이 그대로 실행하고, 봇이 여러 주를 통근한 결과를 집계한다.
// 사용: node tools/sim.js [런 수=40] [최대 주차=2] [시드=1] [--plans] [--allskills] [--char=han|oh|yu|jung] [--json 파일]
const fs=require("fs"),path=require("path"),vm=require("vm");
const args=process.argv.slice(2),flags=args.filter(a=>a.startsWith("--")),nums=args.filter(a=>/^\d+$/.test(a)).map(Number);
const RUNS=nums[0]||40,WEEKS=nums[1]||2,SEED=nums[2]||1;
const jsonAt=args.indexOf("--json"),jsonOut=jsonAt>=0?args[jsonAt+1]:null;
const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
const m=html.match(/<script>\s*([\s\S]*?)<\/script>/);
if(!m){console.error("게임 스크립트를 찾지 못했습니다.");process.exit(1);}

function makeContext(seed){
  // 화면 요소는 무엇을 해도 받아 주는 빈 객체로 대신한다
  const hole=new Proxy(function(){},{
    get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==="then")return undefined;if(k==="length"||k==="offsetHeight")return 0;if(k==="children")return{length:0};return hole;},
    set(){return true;},apply(){return hole;},construct(){return hole;}});
  let a=seed>>>0;
  const rnd=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
  const store={};
  const ctx={console,document:{getElementById:()=>hole,querySelectorAll:()=>[],createElement:()=>hole,body:hole,addEventListener(){},pointerLockElement:null},
    addEventListener(){},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},innerWidth:1280,innerHeight:720,performance:{now:()=>0},
    localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>{store[k]=v;}},Audio:function(){return hole;}};
  ctx.window=ctx;
  vm.createContext(ctx);
  vm.runInContext("Math.random=__r;",Object.assign(ctx,{__r:rnd}));
  vm.runInContext(m[1],ctx,{filename:"index.html(script)"});
  vm.runInContext(fs.readFileSync(path.join(__dirname,"sim-bot.js"),"utf8"),ctx,{filename:"sim-bot.js"});
  return ctx;
}

const PLAN=flags.includes("--plans");
const CARD=(flags.find(f=>f.startsWith("--cards="))||"--cards=base").split("=")[1];   // base(기준 선택만) | rest(회복 우선) | quiet(한산한 쪽) | random
const BOTS={
  "숙련":{asksRoom:true,stare:.8,avoidDoor:true,patience:2.5,react:.25,scan:.3,brace:.9,braceDepart:.8,archRead:true,readsBoard:true,yields:true,planPolicy:PLAN?"smart":null,planLikes:["scan","sitarrive","stamina","giveway","firm","asplanned","early","yield","quiet","eye","nofake","end"]},
  "보통":{asksRoom:true,stare:1.4,avoidDoor:true,patience:1.5,react:.5,scan:.4,brace:.6,braceDepart:.3,archRead:false,readsBoard:true,yields:true,planPolicy:PLAN?"smart":null,planLikes:["scan","sitarrive","stamina","early","giveway","yield","quiet","firm","asplanned"]},
  "초보":{stare:2.4,patience:.7,react:.9,scan:.6,brace:.3,braceDepart:0,archRead:false,readsBoard:false,yields:false,planPolicy:PLAN?"random":null},
};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0,f1=v=>v.toFixed(1),pct=v=>Math.round(v*100)+"%";
const out={runs:RUNS,weeks:WEEKS,seed:SEED,plans:PLAN,bots:{}};
const t0=Date.now();
console.log(`런 ${RUNS}회 × 봇 3종, 최대 ${WEEKS}주, 시드 ${SEED}${PLAN?", 계획표 사용":""}, 카드 정책 ${CARD}`);
for(const name in BOTS){
  const ctx=makeContext(SEED*1000+Object.keys(out.bots).length);BOTS[name].cardPolicy=CARD;{const ch=(flags.find(f=>f.startsWith("--char="))||"").split("=")[1];if(ch)vm.runInContext("profile.char="+JSON.stringify(ch)+";",ctx);}   // 캐릭터 (02)
  if(flags.includes("--allskills"))BOTS[name].skills=vm.runInContext("Object.fromEntries(SKILLS.map(s=>[s.k,s.cost.length]))",ctx);   // 모든 스킬 최대 단계
  if(flags.includes("--nogaze"))vm.runInContext("GAZE=false;",ctx);if(flags.includes("--nospecial"))vm.runInContext("SPECIALS=false;",ctx);
  const runs=[];for(let i=0;i<RUNS;i++)runs.push(ctx.__bot.runOne(BOTS[name],WEEKS));
  const legs=runs.flat(),done=legs.filter(l=>!l.fail);
  const weekDone=w=>runs.filter(r=>r.filter(l=>l.week===w&&!l.fail).length===10).length/RUNS;
  const wk1pts=runs.map(r=>r.filter(l=>l.week===1).reduce((s,l)=>s+(l.gained||0),0));
  const fails={};for(const l of legs)if(l.fail)fails[l.fail]=(fails[l.fail]||0)+1;
  const byDay=[0,1,2,3,4].map(d=>{const a=legs.filter(l=>l.week===1&&l.day===d);return a.length?pct(a.filter(l=>!l.fail).length/a.length):"-";});
  const r={
    "1주 개근":pct(weekDone(1)),"2주 개근":WEEKS>=2?pct(weekDone(2)):"-",
    "런당 편도 수":f1(avg(runs.map(r=>r.length))),
    "탈락 사유":Object.keys(fails).map(k=>k+" "+fails[k]).join(", ")||"없음",
    "1주차 요일별 편도 완주율":byDay.join(" / "),
    "편도당 포인트(완주)":f1(avg(done.map(l=>l.gained))),
    "1주차 획득 포인트(런 평균)":f1(avg(wk1pts)),
    "1주 개근 런의 1주차 포인트":f1(avg(runs.filter(r=>r.filter(l=>l.week===1&&!l.fail).length===10).map(r=>r.filter(l=>l.week===1).reduce((s,l)=>s+l.gained,0)))),
    "앉아서 지난 역/편도":f1(avg(done.map(l=>l.seatStops))),
    "계획대로·눈치 착석/편도":f1(avg(done.map(l=>l.planHits))),
    "충돌/편도":f1(avg(done.map(l=>l.bumps))),
    "도착 체력(완주)":f1(avg(done.map(l=>l.stamina))),
    "도착 민폐(완주)":f1(avg(done.map(l=>l.nuis))),
    "출발 체력(편도 평균)":f1(avg(legs.map(l=>l.start))),
    "가방에 밀림/편도":avg(legs.map(l=>l.packHits||0)).toFixed(2),
    "좁은 자리 착석/편도":avg(legs.map(l=>l.narrowSat||0)).toFixed(2),
    "눈 마주침/편도":avg(legs.map(l=>l.eyeN||0)).toFixed(2),
    "쓸려 내림/편도":avg(legs.map(l=>l.sweeps||0)).toFixed(2),
  };
  if(PLAN){
    const pl=legs.filter(l=>l.planN>0);
    r["계획표 포인트/편도"]=f1(avg(legs.map(l=>l.planPts)));
    r["계획 달성률"]=pl.length?pct(pl.reduce((s,l)=>s+l.planDone,0)/pl.reduce((s,l)=>s+l.planN,0)):"-";
    const per={};for(const l of legs)for(const[k,stt]of l.dp||[]){const o=per[k]||(per[k]={n:0,done:0,void:0});o.n++;if(stt==="done")o.done++;if(stt==="void")o.void++;}
    r["계획별 달성(달성/적음, 무효)"]=Object.keys(per).map(k=>k+" "+per[k].done+"/"+per[k].n+(per[k].void?"("+per[k].void+")":"")).join(", ");
    r["멘붕/편도"]=(avg(legs.map(l=>l.meltdowns))).toFixed(2);
    r["평균 콤보(편도 종료 시)"]=f1(avg(legs.map(l=>l.combo)));
  }
  out.bots[name]=r;
  console.log("\n["+name+"]");for(const k in r)console.log("  "+k+": "+r[k]);
}
console.log(`\n소요 ${((Date.now()-t0)/1000).toFixed(1)}초`);
if(jsonOut)fs.writeFileSync(jsonOut,JSON.stringify(out,null,1));
