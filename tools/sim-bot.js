// 시뮬레이션용 봇. sim.js가 게임 스크립트와 같은 문맥에서 실행한다 (게임의 G, run, keys 등을 그대로 쓴다).
// 봇은 사람처럼 "보이는 것"만 안다: 시야에 들어온(p.vis) 승객의 몸짓과 차림새로만 판단한다.
var __bot=(function(){
  const DT=1/20;
  let st={},last=null;
  view="t";                       // 조작 좌표를 객차 기준으로 쓴다 (규칙은 3D와 같다)
  profile.voice=false;
  const _endLeg=endLeg;
  endLeg=function(fail){
    const b=run.points,pb=profile.points,g=G;
    last={fail:fail||null,stamina:g.stamina,nuis:g.nuis,bumps:g.bumps,seatStops:g.seatStops,planHits:g.planHits,yields:g.yields,st:g.st,
      dp:(g.dp||[]).map(d=>[d.k,d.status]),planPts:g.planPts||0,planDone:g.planDone||0,planFail:g.planFail||0,planN:g.planN||0,meltdowns:g.meltdowns||0,sweeps:g.sweeps||0,combo:run.combo||0};
    _endLeg(fail);
    last.dp=(g.dp||[]).map(d=>[d.k,d.status]);last.planPts=g.planPts||0;last.planDone=g.planDone||0;last.planN=g.planN||0;last.combo=run?run.combo:0;
    last.gained=run?run.points-b:profile.points-pb-b;
  };
  // 계획표: smart는 봇이 지킬 만한 계획만, random은 아무거나 3개 적는다
  function botPickPlans(cfg){
    if(!run.cand)return;
    if(cfg.planPolicy==="random"){const c=run.cand.slice();run.picks=[];while(run.picks.length<3&&c.length)run.picks.push(c.splice(irand(0,c.length-1),1)[0]);}
    else run.picks=(cfg.planLikes||[]).filter(k=>run.cand.includes(k)).slice(0,3);
  }
  function pickDoor(cfg){
    if(!cfg.readsBoard)return irand(0,3);
    const c=run.crowd.map(o=>o.w),dv=[c[0],(c[0]+c[1])/2,(c[1]+c[2])/2,c[2]].map(v=>v+rand(-.18,.18));
    let b=0;for(let i=1;i<4;i++)if(dv[i]<dv[b])b=i;return b;
  }
  // 이 좌석 승객이 곧 내릴 것 같은 정도 (0이면 근거 없음)
  function prio(s,cfg){
    const p=s.occ,g=G;if(!p||p==="player"||s.pink||(p.vis||0)<.5)return 0;
    if(p.dest===g.st&&g.phase==="dwell"&&p.delay!=null)return 4;
    const ts=tellState(p);
    if(ts===1||(ts===2&&sk("obs")<2))return hint(p).stage>=2?4:3;
    if(cfg.archRead&&g.st+1<=g.N&&likelyStop(p)===g.route[g.st+1])return 1;
    return 0;
  }
  function tick(cfg){
    const g=G,P=g.pl;
    for(const k in keys)keys[k]=false;
        if(g.melt>0&&!P.seat)return;   // 멘붕: 가만히 심호흡
    if(P.seat){if(g.yieldEv&&g.yieldEv.active&&cfg.yields&&g.yieldEv.t>1)trySit(null);return;}
    // 시선: 0.35초마다 주변 좌석을 훑는다. 목표가 있으면 절반은 목표를 본다
    st.lookT=(st.lookT||0)-DT;
    if(st.lookT<=0){st.lookT=cfg.scan;
      const near=g.seats.filter(s=>hyp(s.x-P.x,s.y-P.y)<300);
      st.look=st.target&&Math.random()<.5?st.target:(near.length?pick(near):null);}
    if(st.look){mouse.inside=true;mouse.x=st.look.x;mouse.y=st.look.y;}else mouse.inside=false;
    // 내리는 사람 길 터 주기
    if(g.exitBlock&&!P.turn){
      const s=g.seats.find(x=>x.exiting&&Math.abs(P.x-x.fx)<14&&Math.abs(P.y-x.fy)<24);
      if(s){st.turnW=(st.turnW||0)+DT;if(st.turnW>=cfg.react){st.turnW=0;turnBody(s,pick([-1,1]));}}
    }
    // 빈자리가 닿으면 앉는다
    const fs=nearestFreeSeat();
    if(fs&&!fs.pink&&!(st.noSit&&st.noSit())){st.sitW=(st.sitW||0)+DT;if(st.sitW>=cfg.react){st.sitW=0;trySit(fs);return;}}else st.sitW=0;
    if(P.turn)return;
    // 환승역(S)에 가까워지면 문 앞을 벗어난다
    if(cfg.avoidDoor&&P.y>AY1+2&&((g.phase==="dwell"&&XFER[g.route[g.st]]==="S"&&g.st<g.N)||(g.phase==="run"&&XFER[g.route[g.st+1]]==="S"&&g.t>T_RUN*.5))){keys.KeyW=true;return;}
    // 손잡이
    if(g.phase==="run"){
      const j=g.jolts.find(j=>!j.done&&g.t>=j.at-.45);
      if(j){if(j.roll==null)j.roll=Math.random()<(j.warn?cfg.brace:cfg.braceDepart);if(j.roll){keys.ShiftLeft=true;return;}}
    }
    // 목표 좌석 고르기 (0.5초마다)
    st.thinkT=(st.thinkT||0)-DT;
    if(st.thinkT<=0){st.thinkT=.5;
      let best=null,bs=0;
      for(const s of g.seats){const pr=prio(s,cfg);if(!pr)continue;
        const sc=pr-hyp(s.fx-P.x,s.fy-P.y)/220-(s.holder?1.2:0);if(!best||sc>bs){best=s;bs=sc;st.bestPr=pr;}}
      if(best&&!(st.noPlan&&st.noPlan(best))){
        const has=g.plans.some(pl=>pl.seat===best);
        if(!has&&(g.plans.length<1+sk("plan")||st.bestPr>=3))togglePlan(best);
        st.target=best;
      }else if(playerSlot()){st.target=null;   // 이미 좌석 앞에 서 있으면 근거 없이 돌아다니지 않는다
      }else if(!st.target||st.target.occ==="player"||!st.target.occ){
        // 근거가 없으면 앞자리가 비어 있는 가까운 좌석 앞에 선다
        let b=null,bd=1e9;for(const s of g.seats)if(!s.pink&&!s.holder){const d=hyp(s.fx-P.x,s.fy-P.y);if(d<bd){bd=d;b=s;}}
        st.target=b;
      }
    }
    const s=st.target;if(!s)return;
    let tx=s.fx,ty=s.fy;
    if(s.holder)tx+=(P.x<s.fx?-28:28);
    if(Math.abs(P.x-tx)>40)ty=(AY0+AY1)/2;
    const dx=tx-P.x,dy=ty-P.y,d=hyp(dx,dy);
    if(d<=5){st.stuck=0;return;}
    if(g.nuis>55){st.cool=true;}if(st.cool){if(g.nuis<30)st.cool=false;else return;}   // 눈총을 받으면 잠시 가만히 있는다
    // 사람을 피해 걷는다: 8방향 중 앞이 비어 있고 목표 쪽에 가까운 방향. 없으면 기다리고, 오래 막히면 밀고 간다
    const clear=(ux,uy)=>{const px=P.x+ux*20,py=P.y+uy*20;
      for(const q of g.ps){if(q.state==="seated"||q.state==="gone"||(q.state==="boarding"&&q.step===0))continue;if(hyp(q.x-px,q.y-py)<23)return false;}return true;};
    let bx=0,by=0,bd=.2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4,ux=Math.round(Math.cos(a)),uy=Math.round(Math.sin(a)),n=hyp(ux,uy),dot=(ux*dx+uy*dy)/(n*d);
      if(dot>bd&&clear(ux/n,uy/n)){bd=dot;bx=ux;by=uy;}}
    if(!bx&&!by){st.stuck=(st.stuck||0)+DT;if(st.stuck<cfg.patience)return;
      bx=Math.abs(dx)>4?Math.sign(dx):0;by=Math.abs(dy)>4?Math.sign(dy):0;if(st.stuck>cfg.patience+.8)st.stuck=0;}
    else st.stuck=Math.max(0,(st.stuck||0)-DT*.5);
    if(bx)keys[bx>0?"KeyD":"KeyA"]=true;
    if(by)keys[by>0?"KeyS":"KeyW"]=true;
  }
  function runOne(cfg,maxWeeks){
    profile.skills=Object.assign({},cfg.skills||{});profile.points=0;
    startRun();const legs=[];
    while(run&&run.week<=maxWeeks){
      const info={week:run.week,day:run.day,leg:run.leg,start:run.stamina};
      if(cfg.planPolicy)botPickPlans(cfg);
      startLeg(pickDoor(cfg));st={};last=null;
      if(G.dp&&G.dp.some(d=>d.k==="stand"))st.noSit=()=>G.st<standHalf();
      info.standing=G.target;
      let guard=0;
      while((mode==="play"||mode==="reboard")&&guard++<60000){
        if(mode==="reboard"){let b=0,bn=1e9;DOORS.forEach((d,i)=>{const n=G.ps.filter(p=>p.state!=="seated"&&Math.abs(p.x-d.cx)<110).length;if(n<bn){bn=n;b=i;}});reboard(cfg.readsBoard?b:irand(0,3));continue;}
        tick(cfg);update(DT);}
      if(!last){info.fail="timeout";legs.push(info);break;}
      Object.assign(info,last);legs.push(info);
      if(run){
        if(run.needCard){showCard();   // 회사·집 카드: base는 기준 선택만, rest는 회복량이 큰 것, random은 아무거나
          const o=run.cardOpts,work=run.leg==="pm",deck=work?WORK_CARDS:HOME_CARDS,pol=cfg.cardPolicy||"base";
          let k=o.find(x=>deck.find(c=>c.k===x).base)||o[0];
          if(pol==="random")k=pick(o);else if(pol==="rest")k=o.slice().sort((a,b)=>cardGain(deck.find(c=>c.k===b),work).sta-cardGain(deck.find(c=>c.k===a),work).sta)[0];
          else if(pol==="quiet"){const q=o.find(x=>{const cc=deck.find(c=>c.k===x);return cc.fx&&cc.fx.crowd;});if(q)k=q;}
          info.card=k;chooseCard(k);}
        else showPlatform();
      }
    }
    run=null;return legs;
  }
  return {runOne};
})();
