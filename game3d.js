// 3D 그리기: 게임 규칙(3d.html 안의 코드)은 그대로 두고, 화면만 어깨 너머 시점의 3D로 그린다.
// 게임 좌표(픽셀)를 미터로 바꾼다: 좌석 한 칸 34px = 0.5m
"use strict";
(function(){
const C=window.Chars;
if(!window.THREE||!C||typeof CAR==="undefined"){window.draw3D=null;return;}
const S=1/68,X=x=>(x-640)*S,Z=y=>(y-370)*S,HW=CAR.h/2*S,HL=CAR.w/2*S;
const V=C.V,basic=C.basic,TYPE={};for(const T of C.TYPES)TYPE[T.key]=T;
const lerp=(a,b,t)=>a+(b-a)*t;
let R=null;

function paper(grid,rx,ry,base){const t=C.canvasTex(512,512,x=>{x.fillStyle=base||"#f7f0dc";x.fillRect(0,0,512,512);
    for(let i=0;i<6000;i++){x.fillStyle=`rgba(120,100,60,${Math.random()*.07})`;x.fillRect(Math.random()*512,Math.random()*512,1.6,1.6);}
    if(grid){x.strokeStyle="rgba(90,140,200,.34)";x.lineWidth=1.6;for(let i=0;i<=512;i+=64){x.beginPath();x.moveTo(i,0);x.lineTo(i,512);x.moveTo(0,i);x.lineTo(512,i);x.stroke();}}});
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);return t;}

/* ---------- 객차 ---------- */
function init(){
  const gl=document.getElementById("gl"),renderer=new THREE.WebGLRenderer({canvas:gl,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(W,H,false);
  const scene=new THREE.Scene();scene.background=new THREE.Color("#161b20");
  scene.add(new THREE.AmbientLight(0xffffff,.7));const dl=new THREE.DirectionalLight(0xffffff,.4);dl.position.set(1,3,1.5);scene.add(dl);
  const cam=new THREE.PerspectiveCamera(64,W/H,.08,40);
  const add=(m,x,y,z)=>{m.position.set(x,y,z);scene.add(m);return m;};
  const slab=(w,h,d,mat)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  const pm=(grid,rx,ry,base)=>new THREE.MeshBasicMaterial({map:paper(grid,rx,ry,base)});
  add(slab(HL*2,.1,HW*2,pm(false,12,3,"#efe6cf")),0,-.05,0);                         // 바닥
  add(slab(HL*2,.1,HW*2,basic("#fbf6e8")),0,2.42,0);                                 // 천장
  add(slab(HL*2+8,.1,3.4,basic("#cfcbc0")),0,-.06,HW+1.75);                          // 승강장
  add(slab(HL*2+8,.02,.2,basic("#F2B705")),0,0,HW+.45);
  for(const s of[-1,1])add(slab(.1,2.5,HW*2,pm(true,3,2)),s*(HL+.05),1.2,0);          // 양 끝 벽
  const wallMat=pm(true,3,2),doors=[],poles=[],win=basic("#2c3550"),green=basic("#39b36b");
  const adTex=n=>C.canvasTex(512,128,x=>{x.fillStyle="#fffdf2";x.fillRect(0,0,512,128);x.strokeStyle=C.INK;x.lineWidth=8;x.strokeRect(4,4,504,120);
    x.fillStyle="rgba(255,225,60,.8)";x.fillRect(n?70:40,66,n?250:330,34);x.fillStyle=C.INK;x.font='700 60px "Gaegu","Malgun Gothic",sans-serif';x.fillText(["오늘의 계획: 앉아서 간다","월요병엔 착석","계획대로, 2호선"][n%3],n%3===0?28:72,88);});
  for(const side of[-1,1]){const zw=side*(HW+.05),zi=side*(HW-.012);
    // 좌석 구간: 벽, 창문, 2호선 띠, 광고
    for(let b=0;b<3;b++){const x0=DOORS[b].x+DOOR_W,cx=X(x0+BW/2),w=BW*S;
      add(slab(w,2.5,.1,wallMat),cx,1.2,zw);add(slab(w-.5,.62,.03,win),cx,1.58,zi);add(slab(w,.05,.03,green),cx,1.18,zi);
      const ad=new THREE.Mesh(new THREE.PlaneGeometry(1.5,.34),new THREE.MeshBasicMaterial({map:adTex(b+(side>0?1:0))}));ad.rotation.y=side>0?Math.PI:0;add(ad,cx,2.1,side*(HW-.02));}
    add(slab((DOORS[0].x-CAR.x)*S,2.5,.1,wallMat),X((CAR.x+DOORS[0].x)/2),1.2,zw);
    add(slab((CAR.x+CAR.w-DOORS[3].x-DOOR_W)*S,2.5,.1,wallMat),X((DOORS[3].x+DOOR_W+CAR.x+CAR.w)/2),1.2,zw);
    // 출입문: 아래쪽(+z) 문만 열린다
    for(const d of DOORS){const cx=X(d.cx),dw=DOOR_W*S;add(slab(dw,.38,.1,wallMat),cx,2.21,zw);
      for(const dir of[-1,1]){const pn=C.box(dw/2-.01,2.02,.05,"#e9eef0");const g=slab(dw/2-.14,.8,.06,win);g.position.y=.42;pn.add(g);add(pn,cx+dir*dw/4,1.01,zi+side*.02);if(side>0)doors.push({m:pn,cx,dir,dw});}
      for(const ex of[d.x,d.x+DOOR_W]){const pole=C.cyl(.022,2.4,"#dfe6ea");add(pole,X(ex),1.2,side*(HW-.62));poles.push(pole);}}
    // 손잡이 봉과 손잡이
    const bar=new THREE.Mesh(new THREE.CylinderGeometry(.018,.018,HL*2-.4,8),basic("#dfe6ea"));bar.rotation.z=Math.PI/2;add(bar,0,2.08,side*(HW-.9));
    for(let b=0;b<3;b++)for(let k=0;k<BENCH;k++){const x=X(DOORS[b].x+DOOR_W+SEAT_W*(k+.5));
      add(slab(.03,.2,.012,basic("#f4f1e8")),x,1.97,side*(HW-.9));const ring=new THREE.Mesh(new THREE.TorusGeometry(.055,.012,6,14),basic("#dfe6ea"));add(ring,x,1.82,side*(HW-.9));}
  }
  // 좌석
  for(const s of makeSeats()){const dir=s.side==="top"?-1:1,x=X(s.x),z=Z(s.y);
    add(C.box(.48,.1,.5,s.pink?"#ffb3cf":"#9fcbec"),x,.4,z);add(C.box(.48,.5,.09,s.pink?"#ffd0e2":"#c3e0f5"),x,.74,z+dir*.27);}
  for(let b=0;b<3;b++)for(const side of[-1,1]){const cx=X(DOORS[b].x+DOOR_W+BW/2),z=side*(HW-.4);add(C.box(BW*S,.34,.46,"#7fb0d6"),cx,.17,z);
    for(const ex of[-1,1])add(C.box(.04,.72,.56,"#dfe6ea"),cx+ex*(BW*S/2+.02),.62,z);}
  // 나
  const meP=C.person({shirt:"#2fbf71",collar:"shirt",collarC:"same",cuffC:"shade",pants:"#2b3340",hair:"#1d1b1a",hairStyle:"short",shoe:"#fffdf5",h:1,
    cloth:(x,F)=>{x.strokeStyle="#ffffff";x.lineWidth=7;x.beginPath();x.moveTo(F-26,34);x.lineTo(F,150);x.lineTo(F+26,34);x.stroke();x.fillStyle="#ffffff";x.fillRect(F-15,150,30,38);x.lineWidth=4;x.strokeStyle=C.INK;x.strokeRect(F-15,150,30,38);}});
  const meHold=new THREE.Group();meHold.add(meP.root);scene.add(meHold);
  R={renderer,scene,cam,doors,poles,units:new Map(),pool:{},me:{p3:meP,hold:meHold,walk:0,lx:0,ly:0},camPos:V(0,1.7,0),fp:0,pd:0,g:null,v:new THREE.Vector3()};
}
/* ---------- 승객 ---------- */
function unitFor(p){
  let u=R.units.get(p.id);if(u)return u;
  const T=TYPE[p.arch]||TYPE.plain,v=p.id%3,key=T.key+v,pool=R.pool[key]||(R.pool[key]=[]);
  u=pool.pop();
  if(!u){const p3=C.person(Object.assign({},T.o,v?T.vars[v-1]:{}));T.build(p3);const hold=new THREE.Group();hold.add(p3.root);
    u={T,p3,hold,key,outl:[]};p3.root.traverse(o=>{if(o.isMesh&&(o.material===C.OM||o.material===C.OM2))u.outl.push(o);});}
  u.k=0;u.walk=0;u.lx=p.x;u.ly=p.y;u.spd=0;u.far=false;R.scene.add(u.hold);R.units.set(p.id,u);return u;
}
function release(id,u){R.scene.remove(u.hold);(R.pool[u.key]||(R.pool[u.key]=[])).push(u);R.units.delete(id);}
function legs(p3,walk,amt){p3.legs[0].th.rotation.x=Math.sin(walk)*.5*amt;p3.legs[1].th.rotation.x=-Math.sin(walk)*.5*amt;
  p3.legs[0].shn.rotation.x=Math.max(0,-Math.sin(walk))*.5*amt;p3.legs[1].shn.rotation.x=Math.max(0,Math.sin(walk))*.5*amt;}
function syncPerson(p,dt,time,camX,camZ,fx,fz){
  const u=unitFor(p),p3=u.p3,T=u.T,h=p3.o.h||1;
  {const sx=X(p.seat?p.seat.x:p.x)-camX,sz=Z(p.seat?p.seat.y:p.y)-camZ;   // 카메라 뒤에 있으면 그리지도, 움직이지도 않는다
    if(sx*fx+sz*fz<-.7){u.hold.visible=false;u.lx=p.x;u.ly=p.y;return;}}
  p3.root.rotation.set(0,0,0);p3.root.position.set(0,0,0);p3.torso.position.y=0;
  if(p.state==="seated"){
    const s=p.seat;u.hold.position.set(X(s.x),0,Z(s.y));u.hold.rotation.y=s.side==="top"?0:Math.PI;u.hold.visible=true;
    // 낌새를 몸짓으로: 진짜는 끝까지, 페이크는 하다 말다, 안내방송에 고개만 드는 경우
    const hn=hint(p);let tk=0;
    if(hn.stage>=1)tk=hn.real?1:.35+.3*Math.sin(time*2.4+p.ph);
    u.k+=(tk-u.k)*Math.min(1,dt*3.5);
    C.setSit(p3,true);p3.root.position.set(0,.46+.07*h,.02);T.sit(p3,u.k,time);
    if(T.habit)T.habit(p3,time,u.k>.5?2:1);
    if(T.key==="sleeper"){if(u.k<.5)p3.eyes("closed");}else p3.eyes(p3.o.eyes||"open");
    if(hn.stage===.5)p3.neck.rotation.y+=Math.sin(time*3+p.ph)*.5;                                            // 고개를 들어 두리번
    if(hn.stage>=2){p3.root.position.y+=.05+Math.sin(time*9)*.008;p3.torso.rotation.x+=.18;}                   // 일어서려고 엉덩이를 든다
    u.lx=p.x;u.ly=p.y;
  }else{
    let x=p.x+(p.state==="standing"?(p.sway||0):0),y=p.y,lean=0;
    if(p.contend&&p.ct!=null&&p.ct<.35){lean=1-p.ct/.35;x+=Math.sign(p.contend.fx-p.x)*lean*5;}               // 빈자리 쪽으로 몸을 기울인다
    const dx=X(x)-camX,dz=Z(y)-camZ,along=dx*fx+dz*fz,lat=Math.abs(dx*fz-dz*fx);
    u.hold.visible=dx*dx+dz*dz>.42&&!(along<R.pd+.2&&lat<.5);                                                    // 카메라 코앞이거나 카메라와 나 사이를 가리면 숨김
    u.hold.position.set(X(x),0,Z(y));
    let ry=Math.PI/2-(p.face||0);if(p.state==="leaving"&&p.step===-1)ry=p.exitSeat&&p.exitSeat.side==="top"?0:Math.PI;
    u.hold.rotation.y=ry;
    C.setSit(p3,false);p3.root.position.y=.86*h;T.stand(p3,time);if(T.habit)T.habit(p3,time,0);
    if(T.key!=="sleeper")p3.eyes(p3.o.eyes||"open");
    const sp=Math.hypot(p.x-u.lx,p.y-u.ly)*S/Math.max(dt,.001);u.spd+=(Math.min(1,sp/.7)-u.spd)*Math.min(1,dt*8);u.lx=p.x;u.ly=p.y;
    u.walk+=dt*10*u.spd;if(u.spd>.05)legs(p3,u.walk,u.spd);
    if(lean)p3.torso.rotation.x+=.2*lean;
  }
  // 멀리 있는 사람은 외곽선을 끈다 (그리기 부담 줄이기)
  const ddx=u.hold.position.x-camX,ddz=u.hold.position.z-camZ,far=ddx*ddx+ddz*ddz>20;
  if(far!==u.far){u.far=far;for(const o of u.outl)o.visible=!far;}
}
function syncMe(g,dt,time){
  const P=g.pl,me=R.me,p3=me.p3;p3.root.rotation.set(0,0,0);p3.torso.rotation.set(0,0,0);
  if(P.seat||me.hide){me.hold.visible=false;me.lx=P.x;me.ly=P.y;return;}                                                                     // 앉으면 1인칭
  me.hold.visible=true;me.hold.position.set(X(P.x),0,Z(P.y));
  // 좌석 앞에서 좌석을 바라볼 때는 내 몸이 승객을 가리므로 반투명하게 한다
  if(!me.mats){me.mats=[];me.outl=[];me.fade=1;p3.root.traverse(o=>{if(!o.isMesh)return;if(o.material===C.OM||o.material===C.OM2)me.outl.push(o);else if(!me.mats.includes(o.material)){o.material.transparent=true;me.mats.push(o.material);}});}
  {const pz=Z(P.y),fz=Math.sin(P.gaze),front=Math.abs(pz)>HW-1.3&&fz*pz>0&&Math.abs(fz)>.45;
    me.fade+=((front?.16:1)-me.fade)*Math.min(1,dt*8);const solid=me.fade>.93;
    for(const m of me.mats){m.opacity=solid?1:me.fade;m.depthWrite=solid;}for(const o of me.outl)o.visible=solid;}
  const want=Math.PI/2-(P.turn?P.face:P.gaze);let d=want-me.hold.rotation.y;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;me.hold.rotation.y+=d*Math.min(1,dt*12);
  C.setSit(p3,false);p3.root.position.set(0,.86,0);
  C.reach(p3.arms[1],V(.245,-.04,.04));C.reach(p3.arms[-1],V(-.245,-.04,.04));p3.neck.rotation.set(.05,0,0);
  if(P.brace)C.reach(p3.arms[1],V(.2,.84,.08));                                                                 // 손잡이를 잡는다
  if(P.turn){const s=P.turn.side*(Math.cos(me.hold.rotation.y)>0?1:-1);C.reach(p3.arms[1],V(.1,.3,.44));C.reach(p3.arms[-1],V(-.1,.3,.44));p3.neck.rotation.y=-s*.9;}   // 몸을 돌리고 팔로 막는다
  const sp=Math.hypot(P.x-me.lx,P.y-me.ly)*S/Math.max(dt,.001),k=Math.min(1,sp/1.2);me.lx=P.x;me.ly=P.y;me.walk+=dt*11*k;legs(p3,me.walk,k);
}
/* ---------- 덧그림 (말풍선, 표시) ---------- */
function proj(x,y,z){const v=R.v.set(x,y,z).project(R.cam);return v.z>1||v.z<-1?null:[(v.x*.5+.5)*W,(-v.y*.5+.5)*H];}
function overlay(g,time){
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.textBaseline="middle";
  const P=g.pl;
  // 찜 표시
  for(const pl of g.plans){const s=pl.seat,q=proj(X(s.x),1.72,Z(s.y));if(!q)continue;
    ctx.fillStyle="#ffe34d";ctx.strokeStyle="#1f2a44";ctx.lineWidth=3;ctx.beginPath();ctx.arc(q[0],q[1],17,0,TAU);ctx.fill();ctx.stroke();
    ctx.fillStyle="#1f2a44";ctx.font="800 15px "+FONT;ctx.textAlign="center";ctx.fillText("찜",q[0],q[1]+1);}
  // 보고 있는 승객
  if(focus&&focus.state!=="gone"&&g.ps.includes(focus)){const sx=focus.seat?focus.seat.x:focus.x,sy=focus.seat?focus.seat.y:focus.y,q=proj(X(sx),focus.seat?1.12:1.3,Z(sy));
    if(q){const r=34+Math.sin(time*6)*2;ctx.strokeStyle="rgba(31,42,68,.85)";ctx.lineWidth=3;for(const [a,b] of[[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(q[0]+a*r-a*11,q[1]+b*r);ctx.lineTo(q[0]+a*r,q[1]+b*r);ctx.lineTo(q[0]+a*r,q[1]+b*r-b*11);ctx.stroke();}}}
  // 앉을 수 있는 자리
  const can=!P.seat?nearestFreeSeat():null;
  if(can){const q=proj(X(can.x),.62,Z(can.y));if(q){ctx.fillStyle="#00A84D";ctx.strokeStyle="#fff";ctx.lineWidth=3;ctx.beginPath();ctx.arc(q[0],q[1],19,0,TAU);ctx.fill();ctx.stroke();
      ctx.fillStyle="#fff";ctx.font="800 20px "+FONT;ctx.textAlign="center";ctx.fillText("E",q[0],q[1]+1);}}
  // 말풍선과 점수
  for(const e of g.ps)if(e.bubble){const sx=e.seat?e.seat.x:e.x,sy=e.seat?e.seat.y:e.y,q=proj(X(sx),e.seat?1.5:1.85,Z(sy));if(q)bubble(q[0],q[1],e.bubble,false);}
  if(P.bubble){const q=proj(X(P.x),1.9,Z(P.y));if(q)bubble(q[0],q[1],P.bubble,true);}
  for(const f of g.fx){ctx.globalAlpha=1-f.t/1.3;ctx.fillStyle="#007a38";ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.font="800 22px "+FONT;ctx.textAlign="center";const y=H*.42-f.t*40;ctx.strokeText(f.txt,W/2,y);ctx.fillText(f.txt,W/2,y);ctx.globalAlpha=1;}
  // 조준점
  ctx.fillStyle="rgba(255,255,255,.85)";ctx.strokeStyle="rgba(31,42,68,.8)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2,4,0,TAU);ctx.fill();ctx.stroke();
  if(P.seat&&!g.yieldEv){ctx.fillStyle="rgba(255,255,255,.9)";ctx.strokeStyle="rgba(20,24,28,.7)";ctx.lineWidth=4;ctx.font="700 15px "+FONT;ctx.textAlign="center";const t="▶▶ 앉아 있는 동안은 시간이 빨리 갑니다";ctx.strokeText(t,W/2,H-74);ctx.fillText(t,W/2,H-74);}
}
/* ---------- 한 프레임 ---------- */
let lastT=0;
window.__r3=()=>R;
window.draw3D=function(time){
  if(!R)init();
  const g=G,P=g.pl,dt=Math.min(.05,Math.max(.001,time-lastT));lastT=time;
  if(R.g!==g){for(const [id,u] of[...R.units])release(id,u);R.g=g;R.camPos.set(X(P.x),1.7,Z(P.y)+1.3);}        // 새 구간: 승객을 다시 맞춘다
  // 카메라: 서 있으면 오른쪽 어깨 너머, 앉으면 1인칭
  const yaw=P.gaze,fx=Math.cos(yaw),fz=Math.sin(yaw),rx=-fz,rz=fx,px=X(P.x),pz=Z(P.y),pt=typeof pitch3==="number"?pitch3:0;
  let cx,cy,cz,tx,ty,tz;
  if(P.seat){cx=X(P.seat.x)+fx*.12;cy=1.2;cz=Z(P.seat.y)+fz*.12;tx=cx+fx*2;ty=1.2-pt*2;tz=cz+fz*2;}
  else{cx=px-fx*1.15+rx*.36;cy=1.72;cz=pz-fz*1.15+rz*.36;tx=px+fx*1.8+rx*.2;ty=1.15-pt*2.2;tz=pz+fz*1.8+rz*.2;
    // 뒤에 벽이 있어 카메라가 물러날 자리가 없으면 1인칭으로 바꾼다
    const lim=HW-.16;let room=1;if(Math.abs(cz)>lim)room=clamp((lim-Math.abs(pz))/Math.max(.001,Math.abs(cz)-Math.abs(pz)),0,1);
    if(Math.abs(cx)>HL-.2)room=Math.min(room,clamp((HL-.2-Math.abs(px))/Math.max(.001,Math.abs(cx)-Math.abs(px)),0,1));
    R.fp+=((room<.62?1:0)-R.fp)*.2;
    if(R.fp>.5){cx=px+fx*.1;cy=1.58;cz=pz+fz*.1;tx=px+fx*2;ty=1.5-pt*2.2;tz=pz+fz*2;}
    else{cx=px+(cx-px)*room;cz=pz+(cz-pz)*room;}}
  R.camPos.lerp(V(cx,cy,cz),P.seat?.35:.3);R.me.hide=!P.seat&&R.fp>.5;
  const sh=g.shake>0?(Math.random()-.5)*g.shake*.12:0;
  R.cam.position.set(R.camPos.x+sh,R.camPos.y,R.camPos.z);R.cam.lookAt(tx,ty,tz);
  for(const q of R.poles){const dx=q.position.x-R.camPos.x,dz=q.position.z-R.camPos.z;q.visible=dx*dx+dz*dz>.5;}   // 카메라 바로 앞의 봉은 숨긴다
  const cfl=Math.hypot(tx-R.camPos.x,tz-R.camPos.z)||1,cfx=(tx-R.camPos.x)/cfl,cfz=(tz-R.camPos.z)/cfl;   // 카메라가 보는 방향
  R.pd=P.seat?0:(px-R.camPos.x)*cfx+(pz-R.camPos.z)*cfz;                                                    // 카메라에서 나까지의 거리
  // 문
  for(const d of R.doors)d.m.position.x=d.cx+d.dir*(d.dw/4+g.door*(d.dw/2-.06));
  // 승객
  const alive=new Set();
  for(const p of g.ps){if(p.state==="gone")continue;alive.add(p.id);syncPerson(p,dt,time,R.camPos.x,R.camPos.z,cfx,cfz);}
  for(const [id,u] of[...R.units])if(!alive.has(id))release(id,u);
  syncMe(g,dt,time);
  R.renderer.render(R.scene,R.cam);
  overlay(g,time);
};
})();
