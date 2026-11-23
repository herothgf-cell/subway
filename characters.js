// 승객 캐릭터 (character-lineup.html 에서 뽑아 낸 공용 코드). 라인업 시트를 고치면 make_3d 로 다시 뽑는다.
"use strict";
window.Chars=(function(){
if(!window.THREE)return null;
const V=(x,y,z)=>new THREE.Vector3(x,y,z),DOWN=V(0,-1,0),TAU=Math.PI*2;
const lerp=(a,b,t)=>a+(b-a)*t,sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
const lv=(a,b,t)=>V(lerp(a[0],b[0],t),lerp(a[1],b[1],t),lerp(a[2],b[2],t));
const INK="#1f2a44",PAPER="#fffdf5",SEG=20;
/* ---------- 재질 ---------- */
const gradTex=(a)=>{const d=new Uint8Array([a[0],a[1],a[2],255,255,255,255,255]),t=new THREE.DataTexture(d,2,1,THREE.RGBAFormat);t.minFilter=t.magFilter=THREE.NearestFilter;t.needsUpdate=true;return t;};
const GT=gradTex([170,172,214]),GTS=gradTex([240,196,184]);   // 옷 그림자는 푸른빛, 피부 그림자는 따뜻한 빛
const OM=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});
OM.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace("#include <begin_vertex>","vec3 transformed = vec3(position) + normalize(normal)*(0.0115+0.005*sin(position.y*41.0+position.x*29.0+position.z*33.0));");};
const OM2=new THREE.MeshBasicMaterial({color:INK,side:THREE.BackSide});   // 손, 신발 밑창 같은 작은 부분용 가는 선
OM2.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace("#include <begin_vertex>","vec3 transformed = vec3(position) + normalize(normal)*(0.0065+0.002*sin(position.y*41.0+position.x*29.0+position.z*33.0));");};
const SKIN={skin:true},SKIN_THIN={skin:true,thin:true},THIN={thin:true};
const toon=(c,map,skin)=>new THREE.MeshToonMaterial(map?{map,gradientMap:GT}:{color:c,gradientMap:skin?GTS:GT});
const basic=(c,o)=>new THREE.MeshBasicMaterial(Object.assign({color:c},o||{}));
function mk(geo,color,map,opt){opt=opt||{};const m=new THREE.Mesh(geo,toon(color,map,opt.skin));m.add(new THREE.Mesh(geo,opt.thin?OM2:OM));return m;}
const box=(w,h,d,c)=>mk(new THREE.BoxGeometry(w,h,d),c);
const sph=(r,c,opt)=>mk(new THREE.SphereGeometry(r,16,12),c,null,opt);
const cyl=(r,len,c,r2)=>mk(new THREE.CylinderGeometry(r,r2==null?r:r2,len,14),c);
// 관절 쪽이 굵고 끝으로 갈수록 가늘어지는 팔다리
function limb(r,len,color,r2,opt){r2=r2||r*.92;const g=new THREE.Group(),m=mk(new THREE.CylinderGeometry(r,r2,len,16),color,null,opt);m.position.y=-len/2;g.add(m);g.add(sph(r,color,opt));const e=sph(r2,color,opt);e.position.y=-len;g.add(e);return g;}
function canvasTex(w,h,draw){const c=document.createElement("canvas");c.width=w;c.height=h;draw(c.getContext("2d"),w,h);return new THREE.CanvasTexture(c);}
// 몸통에 입히는 옷 그림. 앞 중심 x=128, 뒤 중심 x=384, 어깨 y≈50, 허리 y≈200
function cloth(base,draw){return canvasTex(512,256,(x,W,H)=>{x.fillStyle=base;x.fillRect(0,0,W,H);x.lineCap="round";x.lineJoin="round";x.strokeStyle=INK;x.fillStyle=INK;if(draw)draw(x,128,384);});}
const line=(x,pts,w,c)=>{x.strokeStyle=c||INK;x.lineWidth=w||4;x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.stroke();};
const poly=(x,pts,c)=>{x.fillStyle=c;x.beginPath();pts.forEach((p,i)=>i?x.lineTo(p[0],p[1]):x.moveTo(p[0],p[1]));x.closePath();x.fill();};
const dot=(x,cx,cy,r,c)=>{x.fillStyle=c||INK;x.beginPath();x.arc(cx,cy,r,0,TAU);x.fill();};

/* ---------- 사람 ---------- */
// 몸통 단면 [높이 비율, 반지름]: 기본, 어깨가 넓은 정장, 밑단이 퍼지는 재킷, 부푼 패딩
const PROF={def:[[0,.15],[.06,.185],[.22,.19],[.45,.174],[.68,.184],[.86,.186],[.95,.16],[1,.09]],
  v:[[0,.14],[.06,.17],[.22,.172],[.45,.164],[.68,.188],[.86,.198],[.95,.168],[1,.09]],
  a:[[0,.19],[.06,.215],[.22,.2],[.45,.178],[.68,.184],[.86,.186],[.95,.16],[1,.09]],
  puffy:[[0,.17],[.08,.21],[.3,.226],[.6,.224],[.86,.202],[.95,.168],[1,.09]]};
function person(o){
  o=Object.assign({},o);{const shade=c=>new THREE.Color(c).multiplyScalar(.82).getStyle();
    for(const k of["skirt","collarC","cuffC","hemC"])if(o[k]==="same")o[k]=o.shirt;else if(o[k]==="shade")o[k]=shade(o.sleeve||o.shirt);}
  const wx=o.wx||1,wz=o.wz||1,skin=o.skin||"#ffe2c4",sleeve=o.sleeve||o.shirt,pants=o.pants||"#3b4a6b";
  const root=new THREE.Group(),torso=new THREE.Group();root.add(torso);root.scale.setScalar(o.h||1);
  const prof=PROF[o.shape||"def"],rAt=t=>{for(let i=1;i<prof.length;i++)if(t<=prof[i][0]){const [t0,r0]=prof[i-1],[t1,r1]=prof[i];return r0+(r1-r0)*(t-t0)/(t1-t0);}return prof[prof.length-1][1];};
  const pts=[];for(let i=0;i<=18;i++){const t=i/18;pts.push(new THREE.Vector2(i===0?.002:rAt(t),-.02+t*.54));}pts.push(new THREE.Vector2(.002,.535));
  const tgeo=new THREE.LatheGeometry(pts,28);tgeo.rotateY(-Math.PI/2);
  const tm=mk(tgeo,o.shirt,o.cloth?cloth(o.shirt,o.cloth):null);tm.scale.set(wx,1,.64*wz);torso.add(tm);
  const nk=mk(new THREE.CylinderGeometry(.047,.054,.09,14),skin,null,SKIN_THIN);nk.position.y=.51;torso.add(nk);   // 목
  // 입체 옷깃, 밑단
  const cfz=rAt(.95)*.64*wz;
  if(o.collar==="shirt"||o.collar==="coat"){const big=o.collar==="coat";for(const sx of[-1,1]){const w=mk(new THREE.BoxGeometry(big?.13:.1,.02,big?.09:.066),o.collarC,null,THIN);
      w.position.set(sx*(big?.07:.055),.508,cfz+(big?.02:.026));w.rotation.set(.6,sx*-.5,sx*-.42);torso.add(w);}}
  if(o.collar==="rib"||o.collar==="round"){const c=mk(new THREE.TorusGeometry(.08,o.collar==="round"?.02:.028,8,20),o.collarC,null,THIN);c.rotation.x=Math.PI/2;c.position.y=.512;torso.add(c);}
  if(o.collar==="high"){const c=mk(new THREE.CylinderGeometry(.088,.1,.08,18,1,true),o.collarC,null,THIN);c.position.y=.535;torso.add(c);}
  if(o.hemC){const c=mk(new THREE.TorusGeometry(rAt(.07)*wx,.027,8,24),o.hemC,null,THIN);c.rotation.x=Math.PI/2;c.scale.y=.64*wz/wx;c.position.y=.02;torso.add(c);}
  const neck=new THREE.Group();neck.position.set(0,.528,0);torso.add(neck);neck.scale.setScalar(o.head||1.4);
  const hy=.14,head=mk(new THREE.SphereGeometry(.13,SEG,14),skin,null,SKIN);head.position.y=hy;neck.add(head);
  for(const sx of[-1,1]){const ear=sph(.03,skin,SKIN_THIN);ear.scale.set(.6,1,.8);ear.position.set(sx*.127,hy-.012,-.004);neck.add(ear);}
  // 머리 모양
  const hc=o.hair||"#2b2b3a";
  const cap=(th,rx,c)=>{const m=mk(new THREE.SphereGeometry(.137,SEG,12,0,TAU,0,Math.PI*th),c||hc);m.position.y=hy+.004;m.rotation.x=rx;neck.add(m);return m;};
  const hadd=(m,x,y,z)=>{m.position.set(x,y,z);neck.add(m);return m;};
  switch(o.hairStyle||"short"){
    case"short":cap(.52,-.3);break;
    case"side":cap(.5,-.3).rotation.z=.2;break;
    case"messy":cap(.55,-.32);for(const [a,b,c,r] of[[-.075,.1,.05,.062],[.07,.105,.04,.06],[0,.125,.01,.066],[-.05,.11,-.065,.06],[.065,.1,-.06,.058],[0,.095,-.105,.056],[-.105,.06,-.02,.05],[.108,.055,-.01,.048]]){const t=sph(r,hc);t.scale.set(1.1,.72,1.1);hadd(t,a,hy+b,c);}
      {const t=sph(.028,hc,THIN);t.scale.set(.6,1.7,.6);hadd(t,.035,hy+.168,-.03).rotation.z=-.55;}break;
    case"bob":cap(.6,-.42);for(const s of[-1,1])hadd(sph(.072,hc),s*.105,hy-.05,-.02);break;
    case"pony":cap(.52,-.3);{const t=sph(.06,hc);t.scale.set(.8,1.7,.8);hadd(t,0,hy-.03,-.175).rotation.x=.5;hadd(sph(.03,o.tie||"#ffd43b"),0,hy+.045,-.14);}break;
    case"perm":cap(.5,-.3);for(let i=0;i<9;i++){const a=i/9*TAU;hadd(sph(.058,hc),Math.cos(a)*.1,hy+.085+(i%2)*.02,Math.sin(a)*.1-.02);}hadd(sph(.07,hc),0,hy+.13,-.01);break;
    case"long":cap(.55,-.42);{const b=sph(.12,hc);b.scale.set(1.05,1.75,.5);hadd(b,0,hy-.1,-.1);}break;
    case"thin":cap(.4,-1.2);break;
  }
  if(["short","side","bob","pony","long"].includes(o.hairStyle||"short")&&!["brim","beanie","flat"].includes(o.hat)){
    const part=o.hairStyle==="side"?-.035:0;   // 가르마 위치
    for(const [x,w,rz] of[[-.07,.05,.5],[-.015,.058,.12],[.05,.055,-.3],[.095,.04,-.6]]){const f=sph(w,hc,THIN);f.scale.set(1.15,.62,.5);f.position.set(x+part,hy+.078-Math.abs(x)*.22,.107-Math.abs(x)*.18);f.rotation.z=rz;neck.add(f);}}
  // 모자
  switch(o.hat){
    case"brim":hadd(cyl(.2,.018,o.hatC),0,hy+.085,0);hadd(cyl(.105,.1,o.hatC,.125),0,hy+.14,0);break;
    case"beanie":cap(.5,-.1,o.hatC).scale.setScalar(1.05);{const c=mk(new THREE.TorusGeometry(.136,.024,8,20),o.hatC);c.rotation.x=Math.PI/2;hadd(c,0,hy+.035,0);hadd(sph(.035,o.hatC),0,hy+.155,-.015);}break;
    case"flat":{const c=sph(.14,o.hatC);c.scale.set(1.12,.42,1.2);hadd(c,0,hy+.105,.01);const v=box(.15,.014,.07,o.hatC);hadd(v,0,hy+.075,.15);}break;
    case"hood":{const c=sph(.12,o.shirt);c.scale.set(1.25,1,.8);hadd(c,0,-.02,-.095);}break;
  }
  // 얼굴
  const ink=basic("#14181c"),E={open:[],closed:[],wide:[]};
  for(const sx of[-1,1]){
    const a=new THREE.Mesh(new THREE.SphereGeometry(.0185,12,12),ink);a.scale.set(1,1.38,.5);a.position.set(sx*.047,hy+.012,.12);neck.add(a);E.open.push(a);
    const ah=new THREE.Mesh(new THREE.SphereGeometry(.0065,8,8),basic("#ffffff"));ah.position.set(sx*.047-.006,hy+.024,.129);neck.add(ah);E.open.push(ah);
    const b=new THREE.Mesh(new THREE.BoxGeometry(.036,.007,.004),ink);b.position.set(sx*.047,hy+.008,.123);neck.add(b);E.closed.push(b);
    const c=new THREE.Mesh(new THREE.SphereGeometry(.023,10,10),ink);c.position.set(sx*.047,hy+.014,.118);neck.add(c);E.wide.push(c);
    const ch=new THREE.Mesh(new THREE.SphereGeometry(.008,8,8),basic("#ffffff"));ch.position.set(sx*.047-.008,hy+.026,.137);neck.add(ch);E.wide.push(ch);
    const br=new THREE.Mesh(new THREE.BoxGeometry(.04,.009,.004),ink);br.position.set(sx*.047,hy+.05+(o.brow==="up"?.012:0),.118);
    br.rotation.z=sx*({sad:-.32,angry:.3,flat:0,up:.1}[o.brow||"flat"]);neck.add(br);
    if(o.blush){const bl=new THREE.Mesh(new THREE.CircleGeometry(.022,14),basic("#ff9db5",{transparent:true,opacity:.65}));bl.position.set(sx*.08,hy-.03,.103);bl.rotation.y=sx*.55;neck.add(bl);}
    if(o.wrinkle){const w=new THREE.Mesh(new THREE.BoxGeometry(.022,.005,.004),ink);w.position.set(sx*.09,hy+.0,.098);w.rotation.set(0,sx*.7,sx*-.5);neck.add(w);}
    if(o.glasses){const g=new THREE.Mesh(new THREE.TorusGeometry(.041,.005,8,22),ink);g.position.set(sx*.049,hy+.014,.129);neck.add(g);}
    if(o.earbuds)hadd(sph(.018,"#ffffff"),sx*.13,hy-.005,.01);
  }
  if(o.glasses){const g=new THREE.Mesh(new THREE.BoxGeometry(.03,.006,.004),ink);g.position.set(0,hy+.016,.132);neck.add(g);}
  if(o.headphones){hadd(mk(new THREE.TorusGeometry(.15,.017,8,22,Math.PI),o.headphones),0,hy+.01,0);
    for(const sx of[-1,1]){const c=cyl(.055,.05,o.headphones);c.rotation.z=Math.PI/2;hadd(c,sx*.143,hy,0);}}
  const mouth=new THREE.Mesh(new THREE.BoxGeometry(o.mouth==="smile"?.034:.024,.007,.004),ink);mouth.position.set(0,hy-.046,.123);neck.add(mouth);
  const eyes=n=>{for(const k in E)for(const m of E[k])m.visible=k===n;};eyes(o.eyes||"open");
  if(o.belly){const b=sph(.16,o.shirt);b.scale.set(1.05,1,.85);b.position.set(0,.13,.09);torso.add(b);}
  // 팔
  const arms={};
  for(const sx of[-1,1]){
    const S=V(sx*.196*wx,.424,0),sh=limb(.051,.25,sleeve,.047);sh.position.copy(S);torso.add(sh);
    const el=limb(.047,.23,sleeve,.041);el.position.y=-.25;sh.add(el);
    const hand=sph(.055,skin,SKIN_THIN);hand.position.y=-.25;hand.scale.set(1.28,1.5,1.05);el.add(hand);   // 벙어리장갑 손과 엄지
    const thumb=sph(.026,skin,SKIN_THIN);thumb.position.set(-sx*.022,-.225,.052);el.add(thumb);
    if(o.cuffC){const c=mk(new THREE.CylinderGeometry(.05,.048,.046,16),o.cuffC,null,THIN);c.position.y=-.2;el.add(c);}
    arms[sx]={S,sh,el,a:.25,b:.24,side:sx};
  }
  // 다리 (치마를 입으면 허벅지는 치마 색, 종아리는 살색)
  const legs=[];
  for(const sx of[-1,1]){
    const bare=o.skirt&&!o.coat;
    const th=limb(.086,.4,o.skirt?o.skirt:pants,.07);th.position.set(sx*.095,.02,.02);root.add(th);
    const shn=limb(bare?.058:.07,.4,bare?skin:pants,bare?.046:.057,bare?SKIN:null);shn.position.y=-.4;th.add(shn);
    const shoe=o.shoe||INK,light=new THREE.Color(shoe).getHSL({h:0,s:0,l:0}).l>.6;
    const ft=sph(.066,shoe);ft.scale.set(1,.68,1.75);ft.position.set(0,-.405,.055);shn.add(ft);   // 둥근 신발과 밑창
    const sole=mk(new THREE.BoxGeometry(.124,.022,.25),light?"#b9bfc9":new THREE.Color(shoe).multiplyScalar(.6).getStyle(),null,THIN);sole.position.set(0,-.443,.055);shn.add(sole);legs.push({th,shn});
  }
  const pv=sph(.15,o.skirt&&!o.coat?o.skirt:pants);pv.scale.set(1.08*wx,.62,.74*wz);pv.position.y=.005;root.add(pv);   // 골반: 다리와 몸통을 이어 준다
  let skirt=null;
  if(o.skirt){skirt=cyl(.165*wx,o.coat?.5:.36,o.skirt,.23*wx);skirt.scale.z=.72;skirt.position.y=o.coat?-.2:-.14;root.add(skirt);}
  return {root,torso,neck,arms,legs,skirt,eyes,wx,o,prop:{}};
}
function setSit(p,s){for(const l of p.legs){l.th.rotation.x=s?-Math.PI/2:0;l.shn.rotation.x=s?Math.PI/2:0;}if(p.skirt)p.skirt.visible=!s;}
function reach(arm,T){
  const v=T.clone().sub(arm.S);let d=Math.min(v.length(),arm.a+arm.b-.004);const dir=v.normalize();
  const A=Math.acos(Math.max(-1,Math.min(1,(arm.a*arm.a+d*d-arm.b*arm.b)/(2*arm.a*d))));
  const pole=V(arm.side*.9,-1,-.45).normalize(),n=new THREE.Vector3().crossVectors(dir,pole).normalize();
  const u=dir.clone().applyAxisAngle(n,A);
  arm.sh.quaternion.setFromUnitVectors(DOWN,u);
  const E=arm.S.clone().addScaledVector(u,arm.a),f=T.clone().sub(E).normalize().applyQuaternion(arm.sh.quaternion.clone().invert());
  arm.el.quaternion.setFromUnitVectors(DOWN,f);
}
const R=(p,s,a)=>reach(p.arms[s],Array.isArray(a)?V(a[0],a[1],a[2]):a);
const hang=(p,s)=>R(p,s,[s*.25*p.wx,-.04,.04]);
const put=(m,a,r)=>{m.position.set(a[0],a[1],a[2]);if(r)m.rotation.set(r[0],r[1],r[2]);};
/* ---------- 소품 ---------- */
const phone=()=>{const g=new THREE.Group();g.add(box(.075,.15,.014,"#15181c"));const s=new THREE.Mesh(new THREE.PlaneGeometry(.06,.125),basic("#8fd0ff"));s.position.z=-.008;s.rotation.y=Math.PI;g.add(s);return g;};
const handle=(r,c)=>{const h=mk(new THREE.TorusGeometry(r,.012,8,16,Math.PI),c||"#8a8f98");return h;};
const bagBox=(w,h,d,c,hc)=>{const g=new THREE.Group();g.add(box(w,h,d,c));const hd=handle(w*.24,hc);hd.position.y=h/2;g.add(hd);return g;};
const pack=(c,w)=>{const g=new THREE.Group();g.add(box(w||.3,.34,.15,c));const pk=box((w||.3)*.7,.14,.04,c);pk.position.set(0,-.06,-.09);g.add(pk);return g;};

/* ---------- 승객 유형 11종 ---------- */
// stand(p,t): 서 있는 자세, sit(p,k,t): 앉은 자세 (k 0 평소 → 1 내릴 낌새)
const TYPES=[
 {key:"student",vars:[{shirt:"#8b2f3a",hair:"#5a3a2a",hairStyle:"short",h:.96,skin:"#f6cfa8"},{shirt:"#2f7a4f",glasses:true,hairStyle:"side",h:1.03,pants:"#2b2f36"}],name:"과잠 대학생",color:"#2f4fa8",desc:"전공책을 끌어안고 졸음과 싸우는 중.",item:"과잠, 배낭, 두꺼운 전공책",tell:"책을 배낭에 넣고 끈을 잡는다",
  o:{shirt:"#2f4fa8",shape:"a",collar:"rib",collarC:"#f3ead2",cuffC:"same",hemC:"#f3ead2",sleeve:"#f3ead2",pants:"#4a5568",hair:"#2b2b3a",hairStyle:"messy",brow:"sad",h:1,shoe:"#fffdf5",
     cloth:(x,F,B)=>{x.fillStyle="#f3ead2";x.font="900 62px sans-serif";x.textAlign="center";x.fillText("S",F+40,128);x.font="900 56px sans-serif";x.fillText("UNIV",B,132);
       x.fillRect(0,226,512,7);x.fillRect(0,240,512,7);line(x,[[F,40],[F,225]],4);for(let y=70;y<220;y+=38)dot(x,F,y,5,"#f3ead2");}},
  build:p=>{p.prop.pack=pack("#1f2a44",.42);p.torso.add(p.prop.pack);p.prop.book=box(.19,.26,.055,"#c0392b");const pg=box(.17,.24,.045,PAPER);pg.position.x=.012;p.prop.book.add(pg);p.torso.add(p.prop.book);},
  habit:(p,t,m)=>{p.legs[1].th.rotation.z=m===1?Math.sin(t*15)*.05:0;},
  stand:(p,t)=>{put(p.prop.pack,[0,.31,-.21]);p.prop.book.visible=true;put(p.prop.book,[-.31,-.13,.06],[0,0,.1]);R(p,-1,[-.28,-.03,.07]);R(p,1,[.15,.37,.12]);p.neck.rotation.set(.2+Math.sin(t*1.2)*.06,0,0);p.torso.rotation.x=.1;},
  sit:(p,k,t)=>{put(p.prop.pack,[0,.2,.27],[0,Math.PI,0]);const b=lv([0,.42,.3],[0,.24,.3],k);put(p.prop.book,b,[-.9*(1-k),0,0]);p.prop.book.visible=k<.85;
    R(p,1,lv([.12,.4,.33],[.14,.37,.37],k));R(p,-1,lv([-.12,.4,.33],[-.14,.37,.37],k));p.neck.rotation.set(lerp(.42+Math.sin(t*1.5)*.12,-.05,k),Math.sin(t*1.8)*.3*k,0);p.torso.rotation.x=.05;}},
 {key:"office",vars:[{shirt:"#27344f",pants:"#1f2a44",hairStyle:"short",glasses:true,h:1.04,skin:"#f6cfa8"},{shirt:"#6b7078",pants:"#4a4f57",hairStyle:"bob",hair:"#3a2a20",wx:1.02,h:1}],name:"정장 직장인",color:"#3b3f46",desc:"사원증 줄이 셔츠 주머니에 꽂혀 있다.",item:"정장, 넥타이, 사원증, 서류 가방",tell:"휴대폰을 안주머니에 넣고 가방 손잡이를 쥔다",
  o:{shirt:"#3b3f46",shape:"v",collar:"shirt",collarC:"#ffffff",cuffC:"#ffffff",pants:"#2b2f36",hair:"#15151c",hairStyle:"side",wx:1.14,h:1.08,shoe:"#15151c",
     cloth:(x,F)=>{poly(x,[[F-36,22],[F+36,22],[F,150]],"#ffffff");poly(x,[[F-9,40],[F+9,40],[F+12,120],[F,140],[F-12,120]],"#e5484d");
       line(x,[[F-36,22],[F,150],[F+36,22]],5);x.fillStyle="#ffffff";x.fillRect(F-16,168,32,40);x.lineWidth=4;x.strokeRect(F-16,168,32,40);line(x,[[F-8,184],[F+8,184]],3);line(x,[[F-8,196],[F+8,196]],3);dot(x,F+3,158,5);}},
  build:p=>{p.prop.case=bagBox(.36,.25,.09,"#5a3d2b","#3a2618");p.torso.add(p.prop.case);p.prop.phone=phone();p.torso.add(p.prop.phone);},
  stand:(p,t)=>{hang(p,1);put(p.prop.case,[.27*p.wx,-.24,.04],[0,Math.PI/2,0]);p.prop.phone.visible=true;put(p.prop.phone,[-.06,.31,.28],[-.5,0,0]);R(p,-1,[-.08,.26,.26]);p.neck.rotation.set(.38,-.1,0);p.torso.rotation.x=0;},
  sit:(p,k,t)=>{put(p.prop.case,lv([0,.14,.3],[0,.23,.32],k),[lerp(-Math.PI/2,0,k),0,0]);const l=lv([-.08,.3,.27],[.07,.3,.13],k);R(p,-1,l);put(p.prop.phone,[l[0],l[1]+.05*(1-k),l[2]+.02],[-.5,0,0]);p.prop.phone.visible=k<.85;
    R(p,1,lv([.1,.17,.32],[.02,.4,.33],k));p.neck.rotation.set(lerp(.45,-.05,k),Math.sin(t*1.5)*.3*k,0);p.torso.rotation.x=.03;}},
 {key:"hiker",vars:[{shirt:"#1f8a8a",hatC:"#8a5a2c",h:.95,wz:1.2},{shirt:"#d94f8a",hatC:"#5a5f6b",hair:"#3a2a20",hairStyle:"perm",h:.88,wx:1.08}],name:"등산복 어르신",color:"#e8622c",desc:"배낭 옆에 등산 스틱이 꽂혀 있다.",item:"챙 모자, 등산복, 스틱, 작은 배낭",tell:"스틱을 고쳐 쥐고 몸을 앞으로 숙인다",
  o:{shirt:"#e8622c",collar:"high",collarC:"#4a4f57",cuffC:"#4a4f57",pants:"#4a4f57",hair:"#c9c5bd",hairStyle:"short",hat:"brim",hatC:"#6b7a3a",wz:1.32,wx:1.16,h:.92,shoe:"#5a3d2b",wrinkle:true,mouth:"smile",skin:"#f2c9a0",
     cloth:(x,F,B)=>{x.fillStyle="#4a4f57";x.fillRect(0,0,512,74);line(x,[[0,74],[512,74]],5);line(x,[[F,30],[F,256]],5);x.lineWidth=4;x.strokeRect(F+22,104,44,34);x.strokeRect(F-66,104,44,34);
       x.fillStyle="#c8e04a";x.fillRect(0,214,512,14);line(x,[[0,214],[512,214]],4);}},
  build:p=>{p.prop.pack=pack("#3f7a4a",.26);p.torso.add(p.prop.pack);put(p.prop.pack,[0,.27,-.2]);p.prop.stick=cyl(.014,1.04,"#4a4f57");const g=cyl(.022,.12,"#e5484d");g.position.y=.46;p.prop.stick.add(g);p.torso.add(p.prop.stick);},
  stand:(p,t)=>{put(p.prop.stick,[.3,-.36,.2],[0,0,-.04]);R(p,1,[.29,.1,.2]);hang(p,-1);p.neck.rotation.set(0,Math.sin(t*.7)*.3,0);p.torso.rotation.x=.04;},
  sit:(p,k,t)=>{put(p.prop.stick,[0,-.03,lerp(.44,.4,k)],[lerp(0,-.14,k),0,0]);R(p,1,lv([.02,.44,.42],[.02,.3,.4],k));R(p,-1,lv([-.02,.37,.42],[-.02,.2,.4],k));
    p.neck.rotation.set(lerp(0,.1,k),Math.sin(t*.7)*.35*(1-k)+Math.sin(t*1.6)*.25*k,0);p.torso.rotation.x=lerp(.04,.3,k);p.root.position.y+=.03*k*p.o.h;}},
 {key:"lawyer",vars:[{shirt:"#8f949c",hairStyle:"short",hair:"#15151c",glasses:false,h:1.09,wx:.95},{shirt:"#3b4a6b",hairStyle:"long",h:1}],name:"서류 봉투를 든 사람",color:"#b08a5a",desc:"봉투에 법무법인 로고가 찍혀 있다.",item:"트렌치코트, 안경, 서류 봉투",tell:"봉투를 겨드랑이에 끼고 손목시계를 본다",
  o:{shirt:"#c9a877",collar:"coat",collarC:"same",pants:"#2b2b3a",hair:"#3a2a20",hairStyle:"bob",glasses:true,wx:.87,h:1.06,shoe:"#2b2b3a",skirt:"same",coat:true,brow:"angry",
     cloth:(x,F)=>{poly(x,[[F-30,22],[F+30,22],[F,118]],"#2b2b3a");line(x,[[F-30,22],[F,118],[F+30,22]],5);line(x,[[F+8,118],[F+8,256]],4);
       for(const y of[136,170])for(const s of[-1,1])dot(x,F+8+s*20,y,6);x.fillStyle="#9c7a4d";x.fillRect(0,196,512,18);line(x,[[0,196],[512,196]],4);line(x,[[0,214],[512,214]],4);x.fillStyle="#f3ead2";x.fillRect(F-4,193,24,24);x.lineWidth=4;x.strokeRect(F-4,193,24,24);}},
  build:p=>{p.prop.env=box(.25,.34,.022,"#b5793a");const lb=new THREE.Mesh(new THREE.PlaneGeometry(.12,.07),basic("#fffdf5"));lb.position.set(0,.06,.013);p.prop.env.add(lb);p.torso.add(p.prop.env);},
  stand:(p,t)=>{put(p.prop.env,[-.27,.17,.07],[0,-.5,.12]);R(p,-1,[-.24,.08,.14]);hang(p,1);p.neck.rotation.set(-.03,Math.sin(t*.9)*.15,0);p.torso.rotation.x=0;},
  sit:(p,k,t)=>{put(p.prop.env,lv([0,.15,.31],[-.26,.2,.09],k),[lerp(-1.35,0,k),lerp(0,-.5,k),lerp(0,.12,k)]);R(p,-1,lv([-.1,.18,.33],[-.23,.1,.16],k));
    R(p,1,lv([.1,.18,.33],[.02,.3,.27],k));p.neck.rotation.set(lerp(.42,.4-.3*Math.max(0,Math.sin(t*1.4)),k),Math.sin(t*1.4)*.2*k,0);p.torso.rotation.x=.03;}},
 {key:"transfer",vars:[{shirt:"#3f9a6a",headphones:"#fffdf5",hair:"#5a3a2a",h:1},{shirt:"#e8843c",headphones:null,earbuds:true,hairStyle:"side",h:1.08,skin:"#f6cfa8"}],name:"환승 검색하는 사람",color:"#7d55c7",desc:"지도 앱으로 빠른 환승 칸을 찾고 있다.",item:"후드티, 노란 헤드폰, 얼굴 가까이 든 휴대폰",tell:"헤드폰에 손을 대고 출입문과 휴대폰을 번갈아 본다",
  o:{shirt:"#7d55c7",cuffC:"shade",hemC:"shade",pants:"#3b3f46",hair:"#1d1b1a",hairStyle:"short",hat:"hood",headphones:"#ffd43b",wx:.88,h:1.05,shoe:"#fffdf5",brow:"up",
     cloth:(x,F)=>{x.lineWidth=5;x.beginPath();x.roundRect(F-52,160,104,58,18);x.stroke();for(const s of[-1,1]){line(x,[[F+s*14,34],[F+s*17,112]],5,"#ffffff");dot(x,F+s*17,116,6,"#ffffff");}}},
  build:p=>{p.prop.phone=phone();p.torso.add(p.prop.phone);},
  stand:(p,t)=>{put(p.prop.phone,[0,.42,.3],[-.3,0,0]);R(p,1,[.06,.36,.28]);R(p,-1,[-.06,.35,.28]);p.neck.rotation.set(.28,0,0);p.torso.rotation.x=.04;},
  sit:(p,k,t)=>{const r=lv([.06,.36,.28],[.07,.25,.29],k);put(p.prop.phone,[r[0]-.05*(1-k),r[1]+.06,r[2]+.02],[-.3-.3*k,0,0]);R(p,1,r);R(p,-1,lv([-.06,.35,.28],[-.2,.63,.06],k));
    p.neck.rotation.set(lerp(.28,0,k),Math.sin(t*1.7)*.55*k,0);p.torso.rotation.x=.04;}},
 {key:"sleeper",vars:[{shirt:"#4a4f5a",hatC:"#b23a3a",h:1.04},{shirt:"#7a8450",hatC:"#f3ead2",wx:1.1,h:.95,skin:"#f6cfa8"}],name:"깊이 잠든 승객",color:"#9aa0a8",desc:"고개가 꾸벅꾸벅. 종점까지 갈 기세다.",item:"패딩, 비니, 팔짱",tell:"화들짝 깨서 두리번거린다 (늦게 알아챔)",
  o:{shirt:"#a9afb8",shape:"puffy",collar:"high",collarC:"same",cuffC:"#374151",hemC:"#374151",pants:"#3b3f46",hair:"#1d1b1a",hairStyle:"short",hat:"beanie",hatC:"#374151",wx:1.2,wz:1.25,h:1,eyes:"closed",
     cloth:(x,F)=>{for(const y of[58,104,150,196,238])line(x,[[0,y],[512,y]],5);line(x,[[F,20],[F,256]],5);}},
  build:p=>{const z=new THREE.Sprite(new THREE.SpriteMaterial({map:canvasTex(160,160,x=>{x.fillStyle=INK;x.font="700 86px Gaegu";x.fillText("z",18,140);x.font="700 60px Gaegu";x.fillText("z",76,84);x.font="700 42px Gaegu";x.fillText("z",116,42);}),transparent:true,depthTest:false}));
    z.scale.set(.32,.32,1);z.userData.fx=true;p.prop.zz=z;p.root.add(z);},
  stand:(p,t)=>{p.eyes("closed");R(p,1,[-.07,.22,.24]);R(p,-1,[.07,.17,.25]);p.neck.rotation.set(.5+Math.sin(t*1.3)*.06,0,.15);p.torso.rotation.x=.06;p.root.rotation.z=Math.sin(t*.8)*.03;put(p.prop.zz,[.26,1.08,.1]);p.prop.zz.visible=true;},
  sit:(p,k,t)=>{p.eyes(k>.5?"wide":"closed");R(p,1,lv([-.07,.22,.24],[.13,.09,.38],k));R(p,-1,lv([.07,.17,.25],[-.13,.09,.38],k));
    p.neck.rotation.set(lerp(.62+Math.sin(t*1.3)*.06,-.12,k),Math.sin(t*6)*.45*k,.17*(1-k));p.torso.rotation.x=lerp(.08,0,k);p.root.rotation.z=0;put(p.prop.zz,[.26,1.02,.1]);p.prop.zz.visible=k<.4;}},
 {key:"teen",vars:[{shirt:"#2c3e6b",hairStyle:"bob",h:.86},{shirt:"#7a2f3f",hairStyle:"short",hair:"#15151c",pants:"#3b3f46",h:.9,blush:false}],name:"교복 입은 학생",color:"#2f8f7a",desc:"이어폰을 끼고 단어장을 넘긴다.",item:"교복 재킷, 넥타이, 노란 배낭, 단어장",tell:"단어장을 주머니에 넣고 배낭 끈을 잡는다",habit:(p,t,m)=>{if(m<2)p.neck.rotation.z=Math.sin(t*5)*.08;},
  o:{shirt:"#2f8f7a",shape:"a",collar:"shirt",collarC:"#ffffff",cuffC:"#ffffff",pants:"#6b7280",hair:"#2b211c",hairStyle:"pony",earbuds:true,wx:.9,h:.84,shoe:"#fffdf5",blush:true,
     cloth:(x,F)=>{poly(x,[[F-30,22],[F+30,22],[F,112]],"#ffffff");poly(x,[[F-8,40],[F+8,40],[F+10,92],[F,104],[F-10,92]],"#ffd43b");line(x,[[F-30,22],[F,112],[F+30,22]],5);line(x,[[F,112],[F,256]],4);
       dot(x,F-10,150,6,"#ffd43b");dot(x,F-10,190,6,"#ffd43b");x.fillStyle="#ffd43b";x.beginPath();x.moveTo(F+34,92);x.lineTo(F+58,92);x.lineTo(F+58,112);x.lineTo(F+46,124);x.lineTo(F+34,112);x.closePath();x.fill();x.lineWidth=3;x.stroke();}},
  build:p=>{p.prop.pack=pack("#ffd43b",.3);p.torso.add(p.prop.pack);put(p.prop.pack,[0,.25,-.2]);p.prop.cards=box(.075,.11,.03,PAPER);const r=mk(new THREE.TorusGeometry(.016,.005,6,12),"#8a8f98");r.position.set(-.025,.06,0);p.prop.cards.add(r);p.torso.add(p.prop.cards);},
  stand:(p,t)=>{p.prop.cards.visible=true;put(p.prop.cards,[0,.35,.28],[-.5,0,Math.sin(t*3)*.08]);R(p,1,[.05,.3,.27]);R(p,-1,[-.05,.3,.27]);p.neck.rotation.set(.42,0,0);p.torso.rotation.x=.03;},
  sit:(p,k,t)=>{const r=lv([.05,.3,.27],[.17,.1,.15],k);put(p.prop.cards,[r[0]-.05*(1-k),r[1]+.05,r[2]+.01],[-.5,0,Math.sin(t*3)*.08*(1-k)]);p.prop.cards.visible=k<.85;R(p,1,r);R(p,-1,lv([-.05,.3,.27],[-.15,.37,.13],k));
    p.neck.rotation.set(lerp(.42,-.05,k),Math.sin(t*2)*.4*k,0);p.torso.rotation.x=.14;}},
 {key:"shopper",vars:[{shirt:"#f08fa8",hairStyle:"bob",hair:"#2b211c",h:.95,wx:1.08},{shirt:"#7fcfb0",hairStyle:"long",hair:"#5a3a2a",wx:1.1,wz:1.1,h:.9}],name:"쇼핑백을 든 사람",color:"#f0b429",desc:"백화점 쇼핑백을 무릎에 올려 두었다.",item:"카디건, 파마머리, 쇼핑백 두 개",tell:"쇼핑백 손잡이를 모아 쥐고 들어 올린다",
  o:{shirt:"#f0b429",shape:"a",cuffC:"shade",hemC:"shade",pants:"#8a6a4a",hair:"#7a4a2c",hairStyle:"perm",wx:1.17,wz:1.2,h:.92,shoe:"#8a6a4a",mouth:"smile",blush:true,
     cloth:(x,F)=>{x.fillStyle="#fffdf5";x.fillRect(F-20,18,40,238);line(x,[[F-20,18],[F-20,256]],5);line(x,[[F+20,18],[F+20,256]],5);for(const y of[80,130,180,230])dot(x,F+32,y,6);
       line(x,[[F-20,60],[F,82],[F+20,60]],4);}},
  build:p=>{p.prop.b1=bagBox(.24,.28,.11,"#e5484d","#7b1f24");p.prop.b2=bagBox(.22,.26,.1,"#fffdf5","#8a8f98");p.torso.add(p.prop.b1);p.torso.add(p.prop.b2);},
  stand:(p,t)=>{hang(p,1);hang(p,-1);put(p.prop.b1,[.29*p.wx,-.3,.05],[0,Math.PI/2,0]);put(p.prop.b2,[-.29*p.wx,-.29,.05],[0,Math.PI/2,0]);p.neck.rotation.set(0,Math.sin(t*.8)*.2,0);p.torso.rotation.x=0;},
  sit:(p,k,t)=>{const y=lerp(.21,.3,k);put(p.prop.b1,[.14,y,.31],[0,0,0]);put(p.prop.b2,[-.13,y-.01,.31],[0,0,0]);R(p,1,lv([.14,.36,.33],[.1,.47,.33],k));R(p,-1,lv([-.13,.35,.33],[-.09,.46,.33],k));
    p.neck.rotation.set(lerp(.1,-.08,k),Math.sin(t*.8)*.2*(1-k)+Math.sin(t*1.5)*.3*k,0);p.torso.rotation.x=lerp(.02,.14,k);}},
 {key:"plain",vars:[{shirt:"#e9edf2",glasses:true,hairStyle:"short",h:1.02,pants:"#2b2f36"},{shirt:"#7fb08a",hairStyle:"bob",hair:"#2b211c",wx:.98,h:.92,blush:true}],name:"평범한 통근객",color:"#6f8fb3",desc:"멍하니 광고판을 보고 있다.",item:"셔츠, 크로스백, 테이크아웃 커피",tell:"가방을 무릎으로 당기고 전광판을 본다",
  o:{shirt:"#7f9fc4",collar:"shirt",collarC:"same",cuffC:"shade",pants:"#4a5568",hair:"#3a2a20",hairStyle:"side",wx:1.07,h:.97,
     cloth:(x,F,B)=>{line(x,[[F,36],[F,256]],4);line(x,[[F-24,28],[F,54],[F+24,28]],4);for(const y of[90,140,190])dot(x,F,y,4.5);line(x,[[F-78,30],[F+82,222]],15,"#5a3d2b");line(x,[[B+78,30],[B-82,222]],15,"#5a3d2b");}},
  build:p=>{p.prop.bag=box(.22,.15,.08,"#5a3d2b");const f=box(.22,.07,.085,"#6b4a35");f.position.y=.045;p.prop.bag.add(f);p.torso.add(p.prop.bag);
    p.prop.cup=cyl(.037,.11,"#fffdf5",.031);const ld=cyl(.04,.014,"#5a3d2b");ld.position.y=.06;p.prop.cup.add(ld);const sl=cyl(.0385,.045,"#c98a4b",.034);sl.position.y=-.005;p.prop.cup.add(sl);p.torso.add(p.prop.cup);},
  stand:(p,t)=>{put(p.prop.bag,[.2*p.wx,-.04,.06],[0,.3,0]);R(p,-1,[-.04,.3,.16]);const s=Math.pow(Math.max(0,Math.sin(t*.9)),6),h=lv([.14,.24,.26],[.05,.47,.21],s);   // 가끔 커피를 한 모금
    R(p,1,h);put(p.prop.cup,[h[0]-.01,h[1]+.1,h[2]+.03],[-.6*s,0,0]);p.neck.rotation.set(-.1-.1*s,Math.sin(t*.5)*.12*(1-s),0);p.torso.rotation.x=0;},
  sit:(p,k,t)=>{put(p.prop.bag,lv([.2*p.wx,.0,.08],[-.02,.15,.3],k),[0,lerp(.3,0,k),0]);const h=lv([.14,.2,.3],[.19,.16,.3],k);R(p,1,h);put(p.prop.cup,[h[0]-.01,h[1]+.1,h[2]+.03],[0,0,0]);R(p,-1,lv([-.1,.09,.3],[-.06,.24,.34],k));
    p.neck.rotation.set(lerp(-.14,-.1,k),lerp(Math.sin(t*.5)*.1,Math.sin(t*1.6)*.45,k),0);p.torso.rotation.x=lerp(-.03,.08,k);}},
 {key:"mom",vars:[{shirt:"#8fd0b8",hairStyle:"bob",h:.98,shoe:"#5a8f7c"},{shirt:"#f2c65a",hairStyle:"pony",hair:"#2b211c",h:.92,shoe:"#b88a2c"}],name:"임산부 배지를 단 승객",color:"#f08fb5",desc:"가방에 분홍색 배지가 달려 있다.",item:"원피스, 긴 머리, 배지 단 가방",tell:"좌석을 짚고 천천히 일어설 자세를 잡는다",
  o:{shirt:"#f08fb5",collar:"round",collarC:"#fffdf5",hair:"#5a3d2e",hairStyle:"long",belly:true,skirt:"same",wz:1.05,h:.95,blush:true,mouth:"smile",shoe:"#b5506f",
     cloth:(x,F)=>{x.fillStyle="#fffdf5";x.beginPath();x.ellipse(F,26,40,22,0,0,Math.PI);x.fill();x.lineWidth=4;x.stroke();poly(x,[[F-14,50],[F,58],[F-14,66]],"#e5487d");poly(x,[[F+14,50],[F,58],[F+14,66]],"#e5487d");}},
  build:p=>{p.prop.tote=bagBox(.26,.24,.1,"#fffdf5","#8a8f98");const b=mk(new THREE.CylinderGeometry(.04,.04,.012,16),"#ff5f9a");b.rotation.x=Math.PI/2;b.position.set(.06,.02,.056);p.prop.tote.add(b);p.torso.add(p.prop.tote);},
  stand:(p,t)=>{put(p.prop.tote,[-.29,-.27,.05],[0,Math.PI/2,0]);hang(p,-1);R(p,1,[.1,.16,.26]);p.neck.rotation.set(.05,Math.sin(t*.7)*.12,0);p.torso.rotation.x=-.05;},
  sit:(p,k,t)=>{put(p.prop.tote,lv([-.34,-.34,.28],[-.3,-.1,.26],k),[0,.4,0]);R(p,1,[.1,.15,.26]);R(p,-1,lv([-.1,.1,.26],[-.3,-.04,.14],k));
    p.neck.rotation.set(lerp(.12,-.05,k),Math.sin(t*1.2)*.25*k,0);p.torso.rotation.x=lerp(-.04,.16,k);}},
 {key:"elder",vars:[{shirt:"#56618a",sleeve:"#e9edf2",collarC:"#e9edf2",hatC:"#3b3f46",glasses:false,h:.85},{shirt:"#9a6fa8",sleeve:"#f3ead2",collarC:"#f3ead2",hat:null,hairStyle:"perm",hair:"#d9d6ce",h:.78,wx:1.05,blush:true,brow:"flat",mouth:"smile"}],name:"지팡이를 짚은 어르신",color:"#a89a7c",desc:"손잡이를 잡은 손이 떨린다.",item:"납작한 모자, 안경, 조끼, 지팡이",tell:"지팡이에 몸을 싣고 앞으로 기운다",
  o:{shirt:"#a89a7c",collar:"shirt",collarC:"#7a5a3c",sleeve:"#7a5a3c",pants:"#5a5246",hair:"#e5e2da",hairStyle:"thin",hat:"flat",hatC:"#6b5a48",glasses:true,wrinkle:true,wx:.98,h:.82,shoe:"#3a2a20",brow:"sad",skin:"#efc8a2",
     cloth:(x,F)=>{poly(x,[[F-26,22],[F+26,22],[F,104]],"#7a5a3c");line(x,[[F-26,22],[F,104],[F+26,22]],5);line(x,[[F,104],[F,256]],4);for(const y of[130,170,210])dot(x,F+12,y,5.5);
       x.lineWidth=4;x.strokeRect(F+26,150,36,30);x.strokeRect(F-62,150,36,30);}},
  build:p=>{p.prop.cane=cyl(.017,.84,"#5a3d2b");const h=mk(new THREE.TorusGeometry(.05,.017,8,14,Math.PI),"#5a3d2b");h.position.set(0,.42,-.05);h.rotation.y=Math.PI/2;p.prop.cane.add(h);p.torso.add(p.prop.cane);},
  stand:(p,t)=>{p.torso.rotation.x=.3;put(p.prop.cane,[.06,-.4,.52],[-.3,0,0]);R(p,1,[.06,.06,.42]);R(p,-1,[-.02,.0,.42]);p.neck.rotation.set(-.2,Math.sin(t*.6)*.15,0);},
  sit:(p,k,t)=>{p.torso.rotation.x=lerp(.14,.42,k);put(p.prop.cane,[0,-.1,lerp(.44,.56,k)],[-lerp(.14,.42,k),0,0]);R(p,1,lv([.02,.34,.42],[.02,.34,.44],k));R(p,-1,lv([-.02,.27,.42],[-.02,.27,.44],k));
    p.neck.rotation.set(lerp(-.05,-.3,k),Math.sin(t*.6)*.15,0);p.root.position.y+=.04*k*p.o.h;p.root.position.z=.02+Math.sin(t*14)*.003*k;}},
];

return {V,person,TYPES,setSit,reach,R,hang,put,mk,box,sph,cyl,limb,basic,toon,canvasTex,OM,OM2,INK,PAPER,GT,GTS};
})();
