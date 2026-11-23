/* Articulated miniature puppets. The armature is measured from the soles up. */
(() => {
  'use strict';

  // The same commuter keeps their wardrobe and possessions throughout the trip.
  const cast = [
    ['suit', '푸른 정장 · 신문과 서류가방', '#4b444b','#332e38','#8e8181','#30303a', '#29393e', 'part'],
    ['tote', '자주색 니트 · 캔버스 가방', '#954a49','#733336','#c57e74','#333641', '#453331', 'bob'],
    ['field', '세이지색 야상 · 뿔테 안경', '#575239','#403d2b','#948866','#34383d', '#a9a9a0', 'silver'],
    ['hood', '남색 후드 · 헤드폰', '#29293a','#1d1d2a','#685f70','#38383f', '#362e31', 'wave'],
    ['scarf', '카멜색 코트 · 체크 머플러', '#965b2d','#6c4122','#c18b58','#453c3d', '#4c3734', 'bun'],
    ['suit', '먹색 정장 · 신문과 서류가방', '#3b322f','#282323','#847268','#333137', '#302d31', 'crop'],
    ['tote', '하늘색 카디건 · 주름치마와 캔버스 가방', '#626366','#47484b','#979599','#47414b', '#493632', 'long'],
    ['scarf', '보라색 코트 · 원피스와 체크 머플러', '#67484b','#463339','#a17b79','#3c343f', '#47373b', 'wave'],
    ['field', '갈색 야상 · 뿔테 안경', '#674024','#4a2e1b','#a47d51','#363841', '#433737', 'part'],
    ['tote', '녹색 점퍼 · 캔버스 가방', '#343820','#262817','#787958','#403a41', '#423532', 'cap'],
    ['suit', '회색 정장 · 신문과 서류가방', '#60554d','#443d38','#95877b','#3e3938', '#99988d', 'silver'],
    ['tote', '산호색 니트 · 캔버스 가방', '#984832','#783624','#c47456','#38404a', '#483634', 'long'],
    ['hood', '파란 후드 · 헤드폰', '#4a5060','#343945','#868795','#393944', '#3c3230', 'crop']
  ];
  const player = ['player','주황색 재킷 · 크로스백','#d7854c','#ad603d','#edac72','#455867','#493831','wave'];
  // Cheek color sampled in the same lighting as the fitted head and costume.
  const skinTones=['#bd7b40','#be7845','#a66a34','#be783e','#cd8d56','#cf8b50','#d38d55','#cb854e','#c67d42','#ce8346','#c57b41','#d48a50','#d18447'];
  const builds=[1.07,.94,1.08,1.14,1.03,1.12,.93,.98,1.1,1.06,.99,.95,1.12];
  const clamp = n => Math.max(0,Math.min(1,n));
  const mix = (a,b,u) => a+(b-a)*u;
  const ease = t => { const u=clamp(t); return u*u*(3-2*u); };
  const material = id => id==='player' ? player : cast[((Number(id)||0)%cast.length+cast.length)%cast.length];
  const outfit = id => id==null ? '빈 좌석' : material(id)[1];
  const details = {
    suit: ['펼친 신문을 양손에 들고 있다.','신문을 얼굴 가까이 들어 올린다.','신문을 접고 옆의 서류가방 손잡이를 잡는다.','접은 신문을 옆구리에 끼고 가방을 들어 올린다.'],
    field: ['무릎 위 휴대폰에 손을 얹고 있다.','휴대폰을 들어 화면을 들여다본다.','한 손으로 야상의 깊은 주머니를 벌려 휴대폰을 넣는다.','주머니 덮개를 누르고 반대 손으로 무릎을 짚는다.'],
    tote: ['무릎 위 캔버스 가방의 손잡이를 쥐고 있다.','가방 입구를 벌리고 안을 뒤적인다.','가방을 무릎에서 들어 어깨에 건다.','어깨끈을 쥔 채 두 발을 모은다.'],
    hood: ['후드 위로 헤드폰을 쓰고 있다.','두 손을 들어 양쪽 헤드폰을 잡는다.','헤드폰을 벗어 목에 걸친다.','두 손을 무릎에 짚고 문 쪽으로 몸을 틀고 있다.'],
    scarf: ['긴 머플러 끝이 무릎에 걸쳐 있다.','머플러 끝을 걷어 쥔다.','긴 머플러를 목에 한 번 더 감는다.','짧아진 머플러를 여미고 발을 안으로 당긴다.'],
    player: ['주황색 재킷 차림으로 앉아 있다.']
  };
  function describe(id, seat) {
    if (id==null) return '빈 좌석';
    const action=seat?.action||'idle', descriptions=details[material(id)[0]];
    const common={rise:'두 발을 딛고 자리에서 몸을 일으킨다.',settle:'다시 등을 기대고 손을 무릎으로 내린다.'};
    return outfit(id)+'. '+(common[action] || descriptions[{idle:0,check:1,gather:2,ready:3}[action]] || descriptions[0]);
  }
  function beatFor(action, t) {
    switch (action) {
      case 'check': return ease(t/1.12);
      case 'gather': return 1+ease(t/1.5);
      case 'ready': return 2+ease(t/1.45);
      case 'rise': return 3+ease(t/1.05);
      case 'settle': return 2*(1-ease(t/2));
      default: return 0;
    }
  }
  function sample(keys,b) {
    const i=Math.min(Math.floor(b),keys.length-1);
    return mix(keys[i],keys[Math.min(i+1,keys.length-1)],b-i);
  }
  const paths = new Map();
  function shape(c, d, fill, edge, w=1.2) {
    let p=paths.get(d);
    if (!p) { p=new Path2D(d); paths.set(d,p); }
    if (fill) { c.fillStyle=fill; c.fill(p); }
    if (edge) { c.strokeStyle=edge; c.lineWidth=w; c.stroke(p); }
  }
  function ellipse(c,x,y,rx,ry,fill) {
    c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fillStyle=fill; c.fill();
  }
  function curve(c,p,color,width) {
    c.beginPath(); c.moveTo(p[0],p[1]); c.bezierCurveTo(...p.slice(2)); c.strokeStyle=color; c.lineWidth=width; c.stroke();
  }
  function edgeNormal(a,b) {
    const dx=b[0]-a[0], dy=b[1]-a[1], length=Math.hypot(dx,dy)||1;
    return [-dy/length,dx/length];
  }
  const offset=(p,n,w)=>[p[0]+n[0]*w,p[1]+n[1]*w];
  const between=(p,q,t)=>[mix(p[0],q[0],t),mix(p[1],q[1],t)];

  const pigments = new Map();
  function pigment(hex, amount) {
    const key=hex+':'+amount;
    if (!pigments.has(key)) {
      const n=parseInt(hex.slice(1),16), source=[n>>16,(n>>8)&255,n&255];
      const target=amount>0?[255,231,197]:[23,17,23];
      pigments.set(key,'rgb('+source.map((v,i)=>Math.round(mix(v,target[i],Math.abs(amount)))).join(',')+')');
    }
    return pigments.get(key);
  }
  const stock = new Map();
  function woolSwatch(c,id) {
    // Borrow the photographed knit from the jacket's plain back panel, removing
    // the original illumination so the elbow can turn without turning the light.
    const units=12, size=60, swatch=document.createElement('canvas');
    swatch.width=swatch.height=size;
    const s=swatch.getContext('2d',{willReadFrequently:true});
    s.setTransform(5,0,0,5,65,222);
    if(!window.ClayHeads.torso(s,id,{back:true}))return null;
    const data=s.getImageData(0,0,size,size),pix=data.data, lum=new Float32Array(size*size);
    for(let i=0;i<lum.length;i++)lum[i]=.3*pix[4*i]+.57*pix[4*i+1]+.13*pix[4*i+2];
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const i=y*size+x;
      let sum=0;
      for(const v of [-5,0,5])for(const u of [-5,0,5])
        sum+=lum[Math.min(size-1,Math.max(0,y+v))*size+Math.min(size-1,Math.max(0,x+u))];
      const mean=sum/9, d=(lum[i]-mean)/(mean+10),light=d>0;
      pix[4*i]=light?246:24;pix[4*i+1]=light?218:17;pix[4*i+2]=light?178:19;
      pix[4*i+3]=Math.round(255*Math.min(.40,Math.abs(d)*(light?.68:1.55)));
    }
    s.putImageData(data,0,0);
    const tile=document.createElement('canvas');tile.width=tile.height=size*2;
    const g=tile.getContext('2d');
    for(const x of [0,1])for(const y of [0,1]){
      g.setTransform(x?-1:1,0,0,y?-1:1,x*size*2,y*size*2);g.drawImage(swatch,0,0);
    }
    const pat=c.createPattern(tile,'repeat');pat.setTransform(new DOMMatrix().scaleSelf(units/size));
    return pat;
  }
  function grain(c,type) {
    if(type[0]==='#'){
      const id=cast.findIndex(p=>p[2]===type),key='photo'+type;
      if(id>=0&&window.ClayHeads?.ready){
        if(!stock.has(key))stock.set(key,woolSwatch(c,id));
        if(stock.get(key))return stock.get(key);
      }
      type='wool';
    }
    if (!stock.has(type)) {
      const tile=document.createElement('canvas'), size=128, units=32;
      tile.width=tile.height=size;
      const g=tile.getContext('2d');
      let seed=type==='wool'?3472:type==='skin'?905:213;
      const next=()=>{ seed=(1664525*seed+1013904223)>>>0;return seed/4294967296; };
      const pixels=g.createImageData(size,size);
      for (let i=0;i<pixels.data.length;i+=4) {
        const warm=next()>.49, value=warm?247:28;
        pixels.data[i]=value; pixels.data[i+1]=warm?230:20; pixels.data[i+2]=warm?209:23;
        pixels.data[i+3]=Math.floor(next()*(type==='wool'?32:type==='skin'?15:22));
      }
      g.putImageData(pixels,0,0);
      g.lineCap='round';
      const wool=type==='wool',count=wool?800:175;
      for (let i=0;i<count;i++) {
        const x=next()*size,y=next()*size, angle=next()*Math.PI*2;
        const r=wool?1.1+next()**2*12:.4+next()**2*2.1;
        const dx=Math.cos(angle)*r,dy=Math.sin(angle)*r;
        const white=next()>.48;
        g.strokeStyle=white?'rgba(255,243,215,.17)':'rgba(32,21,26,.18)';
        g.lineWidth=wool?.45+next()*1.4:.9;
        // Wrap loose fibers across the edge of the repeating swatch.
        for(const ox of (x+r>=size?[0,-size]:x<r?[0,size]:[0]))
          for(const oy of (y+r>=size?[0,-size]:y<r?[0,size]:[0])){
            g.beginPath();g.moveTo(x+ox,y+oy);
            g.quadraticCurveTo(x+ox+dx*.6-dy*.30,y+oy+dy*.6+dx*.30,x+ox+dx,y+oy+dy);
            g.stroke();
          }
      }
      const pattern=c.createPattern(tile,'repeat');
      pattern.setTransform(new DOMMatrix().scaleSelf(units/size));
      stock.set(type,pattern);
    }
    return stock.get(type);
  }
  function felt(c,p,fill,type='wool') {
    c.fillStyle=fill;c.fill(p);c.fillStyle=grain(c,type);c.fill(p);
  }
  function linear(c,x,y,xx,yy,stops){
    const g=c.createLinearGradient(x,y,xx,yy);
    for(const [at,color] of stops)g.addColorStop(at,color);
    return g;
  }
  function dome(c,x,y,rx,ry,color,type,angle=0) {
    c.save();c.translate(x,y);c.rotate(angle);c.scale(rx,ry);
    const g=c.createRadialGradient(-.39,-.47,.04,-.17,-.21,1.25);
    for(const [at,amount] of [[0,.43],[.31,.23],[.63,-.025],[.86,-.22],[1,-.46]])
      g.addColorStop(at,pigment(color,amount));
    ellipse(c,0,0,1,1,g);c.restore();
    if(type){ c.beginPath();c.ellipse(x,y,rx,ry,angle,0,Math.PI*2);c.fillStyle=grain(c,type);c.fill(); }
  }
  function shade(c,path,dx,dy,opacity=.32){
    c.save();c.translate(dx,dy);shape(c,path,'rgba(39,26,26,'+opacity+')');c.restore();
  }
  function stitch(c,d,color,width=.92,spacing=[1.65,2.3]) {
    const p=new Path2D(d);
    c.save(); c.setLineDash(spacing);c.lineCap='round';c.lineWidth=width+.52;
    c.strokeStyle='rgba(36,21,22,.42)';c.stroke(p);
    c.translate(-.18,-.32);c.lineWidth=width;c.strokeStyle=color;c.stroke(p);c.restore();
  }
  function button(c,x,y,r) {
    ellipse(c,x+.5,y+.85,r+.22,r,'rgba(42,30,30,.53)');
    dome(c,x,y,r,r*.92,'#80694f');
    ellipse(c,x-.28*r,y,.18*r,.19*r,'#332e30');ellipse(c,x+.28*r,y,.18*r,.19*r,'#332e30');
    curve(c,[x-.25*r,y,x,y-.12*r,x+.15*r,y-.12*r,x+.3*r,y],'#c5ac7e',r*.20);
  }
  function plate(c,d,color,x,y,w,h,type='wool',lip=1.3) {
    const p=new Path2D(d);
    if(lip)shade(c,d,lip*.42,lip);
    felt(c,p,linear(c,x,y,x+w,y+h,[[0,pigment(color,.36)],[.32,pigment(color,.14)],[.70,color],[1,pigment(color,-.43)]]),type);
  }

  // A padded length of felt wrapped over a wire limb, lit from the upper left.
  function roll(c,a,b,ra,rb,color,type,sideSeam=false) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.max(.1,Math.hypot(dx,dy));
    const angle=Math.atan2(-dx,dy),r=Math.max(ra,rb);
    c.save();c.translate(...a);c.rotate(angle);
    const p=new Path2D();
    p.moveTo(-ra,.08*ra);p.bezierCurveTo(-ra,-.78*ra,.78*ra,-.82*ra,ra,0);
    p.bezierCurveTo(ra*1.07,len*.3,rb*.99,len*.70,rb,len);
    p.bezierCurveTo(rb*.87,len+rb*.64,-rb*.91,len+rb*.73,-rb,len);
    p.bezierCurveTo(-rb*.94,len*.76,-ra*1.07,len*.28,-ra,.08*ra);p.closePath();
    const lightSide=Math.cos(angle)*-.6+Math.sin(angle)*-.8<0?1:-1;
    const g=linear(c,-r*lightSide,0,r*lightSide,0,[[0,pigment(color,-.23)],[.16,pigment(color,.12)],
      [.36,pigment(color,.16)],[.58,color],[.82,pigment(color,-.26)],[1,pigment(color,-.48)]]);
    felt(c,p,g,type);
    if(sideSeam) stitch(c,'M'+(-lightSide*ra*.74)+' 2 Q'+(-lightSide*r*.93)+' '+(len*.52)+' '+(-lightSide*rb*.80)+' '+(len-2),pigment(color,.58),.66,[1.1,1.75]);
    c.restore();
  }

  function trousers(c,p,hip,ready,rise,walk,side,sneaker) {
    const stance=mix(23,13,rise);
    const knee=[side*stance+ready*4,mix(-48,-59,rise)+walk*side*4];
    const foot=[side*(mix(22,13,rise)-ready*(8-6*rise))+walk*side*12,-9-Math.max(0,walk*side)*5];
    const thigh=[side*11,hip-2], narrow=p===cast[6] || p===cast[7];
    const twill=cast[5][2];
    roll(c,thigh,knee,narrow?9.7:13,narrow?7.3:10.6,p[5],twill);
    roll(c,knee,foot,narrow?7.8:10.3,narrow?4.4:6.8,p[5],twill);
    const n=edgeNormal(knee,foot),a=offset(knee,n,side*6.1),z=offset(foot,n,side*4.9);
    stitch(c,'M'+a.join(' ')+' L'+z.join(' '),pigment(p[5],.17),.44,[.95,2.2]);
    const ky=knee[1],kx=knee[0];
    curve(c,[kx-6,ky+1,kx-3,ky-1,kx,ky-1,kx+4,ky+.1],pigment(p[5],-.24),1.2);
    curve(c,[kx-5,ky,kx-2,ky-2,kx,ky-2,kx+3,ky-.8],pigment(p[5],.23),.72);
    c.save(); c.translate(...foot); c.scale(side<0 && ready<.5 ? -1 : 1,1);
    const leather=sneaker?'#bba98a':'#59423a';
    const sole='M-7 3 Q-7 1 -2 2 L3 4 Q7 3 12 4 Q19 5 18.6 8.9 Q15 11 -5 10 Q-9 9 -7 3Z';
    const upper='M-6.5 2 Q-7 -3 -3 -3 Q1 -4 5 -1 Q6 2 11 2.8 Q17 3 18 6.8 Q16 9 -5 7.7 Q-7 7 -6.5 2Z';
    plate(c,sole,sneaker?'#d0bf9e':'#3c302b',-6,2,22,7,'leather',.5);
    plate(c,upper,leather,-4,-4,16,12,'leather',.5);
    stitch(c,'M-5 7 Q4 9 16 7.3',sneaker?'#e6d3ae':'#b89671',.49,[.7,1.05]);
    shape(c,'M3 -.9 L.5 1.1 M5 .8 L2.5 2.6 M7.1 2.2 L5 3.9',null,sneaker?'#efe0c3':'#a58c71',.85);
    c.restore();
  }
  function skirt(c,p,hip,ready,rise,walk) {
    const width=mix(32,30,rise), hem=hip+mix(25,70,rise), pull=3*ready+walk*3;
    c.beginPath(); c.moveTo(-16,hip-7); c.quadraticCurveTo(-24,hip-6,-width+pull,hem-3);
    c.bezierCurveTo(-20+pull,hem+1,-12+pull,hem+4,-4+pull,hem+1);
    c.bezierCurveTo(9+pull,hem+5,21+pull,hem+4,width+pull,hem-.5);
    c.quadraticCurveTo(25,hip+3,16,hip-7); c.closePath();
    const pleats=c.createLinearGradient(-width,0,width,0);
    for(const [at,v] of [[0,-.29],[.12,.10],[.19,-.31],[.28,.19],[.36,-.22],[.51,.21],[.62,-.27],[.79,.14],[1,-.35]])
      pleats.addColorStop(at,pigment(p[5],v));
    c.fillStyle=pleats;c.fill();c.fillStyle=grain(c,'wool');c.fill();
    for (const x of [-18,-9,4,16]) {
      curve(c,[x*.7,hip+2,x*.7+pull,hem-14,x+pull,hem-7,x*1.3+pull,hem], pigment(p[5],-.32),.9);
    }
  }

  // Each lock has a twisted pair of filaments wound around its curved centerline.
  function yarn(c,points,width,col,index) {
    const [x0,y0,x1,y1,x2,y2,x3,y3]=points;
    c.save();c.translate(.45,.72);curve(c,points,'rgba(24,17,17,.35)',width+.55);c.restore();
    curve(c,points,pigment(col,-.19),width);
    curve(c,points,pigment(col,.08),width*.74);
    curve(c,points,grain(c,'wool'),width*.95);
    let previous;
    const count=19;
    for(let i=0;i<=count;i++) {
      const t=i/count,u=1-t;
      const x=u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3;
      const y=u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3;
      const dx=3*(u*u*(x1-x0)+2*u*t*(x2-x1)+t*t*(x3-x2));
      const dy=3*(u*u*(y1-y0)+2*u*t*(y2-y1)+t*t*(y3-y2));
      const len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
      const phase=Math.sin(t*21+index*1.4),lift=width*.23*phase;
      if(previous) {
        c.beginPath();c.moveTo(previous[0],previous[1]);c.lineTo(x+nx*lift-.24,y+ny*lift-.35);
        c.strokeStyle=pigment(col,phase>.42?.27:.14);c.lineWidth=width*.115;c.stroke();
        c.beginPath();c.moveTo(previous[0]+nx*width*.32,previous[1]+ny*width*.32);
        c.lineTo(x+nx*(lift+width*.32),y+ny*(lift+width*.32));c.strokeStyle=pigment(col,.12);c.lineWidth=width*.065;c.stroke();
      }
      previous=[x+nx*lift-.24,y+ny*lift-.35];
    }
  }
  const parted=[
    [2,-37,-5,-42,-17,-36,-18,-24],[-1,-37,-10,-37,-20,-30,-18,-18],
    [2,-37,-2,-25,-16,-28,-17,-15],[5,-36,2,-24,-12,-26,-14,-12],
    [6,-35,3,-25,-10,-22,-12,-18],[5,-37,13,-39,18,-30,18,-23],
    [6,-36,11,-36,15,-31,15,-22],[5,-36,8,-31,11,-29,15,-27]
  ];
  const cropped=[
    [-15,-29,-19,-26,-18,-18,-16,-12],[-12,-32,-17,-30,-17,-24,-15,-20],
    [-15,-30,-12,-40,-6,-37,-8,-34],[-10,-34,-6,-40,-1,-39,0,-35],
    [-5,-36,-1,-41,4,-40,6,-36],[2,-37,6,-40,11,-38,13,-32],
    [6,-34,12,-37,16,-33,17,-28],[7,-30,13,-35,18,-30,17,-24],
    [-11,-29,-9,-34,-6,-36,-3,-31],[-6,-31,-2,-35,3,-36,4,-31],
    [-2,-32,3,-35,7,-35,9,-30],[4,-31,9,-33,13,-31,14,-27]
  ];
  const waved=[
    [-16,-21,-21,-20,-20,-27,-16,-27],[-16,-26,-20,-32,-14,-38,-10,-34],
    [-13,-32,-12,-41,-4,-42,-1,-36],[-7,-36,-6,-42,5,-40,4,-34],
    [1,-35,2,-42,12,-40,11,-33],[8,-34,12,-38,19,-33,16,-27],
    [14,-27,21,-30,21,-22,17,-21],[-16,-20,-20,-22,-19,-15,-15,-14],
    [-13,-26,-12,-35,-5,-31,-5,-27],[-6,-30,-2,-38,5,-33,3,-29],
    [1,-29,5,-36,12,-32,10,-27],[9,-27,14,-32,18,-29,17,-25]
  ];
  function hair(c,p,back,yaw=0) {
    const style=p[7],color=p[6],long=style==='long'||style==='bob';
    if(back||long) {
      const end=style==='long'?10:style==='bob'?1:-8;
      const base='M-17 -24 Q-16 -39 2 -38 Q20 -37 19 -17 L18 '+end+
        ' Q5 '+(end+7)+' -18 '+end+' Q-20 -11 -17 -24Z';
      shape(c,base,pigment(color,-.25));
      for(let i=0;i<11;i++){
        const u=i/10,x=-17+u*34;
        const to=end+3.1*Math.sin(u*Math.PI)+1.9*Math.sin(i*2.39);
        const bend=long?(x*.29):(-5+u*7);
        const n=[x*.34+1.8,-36+Math.abs(x)*.20,x*1.18-1,-31,x*1.05+bend+Math.sin(i*3)*4,-13,x+bend*.42+Math.sin(i*1.3)*1.45,to];
        yarn(c,n,style==='long'?4.2:3.9,color,i);
      }
      if(!back)return;
    }
    if(style==='bun'){
      dome(c,-16,-30,9,8.5,color,'wool',-.4);
      for(let j=0;j<4;j++)yarn(c,[-22+j,-31+j,-23+j,-38+j,-14+j,-40+j,-14+j,-34+j],2.9,color,j);
    }
    if(back&&style!=='cap') {
      for(let i=0;i<7;i++) {
        const side=i<3?-1:1,amp=4+Math.abs(i-3)*3;
        yarn(c,[.7,-37+Math.abs(i-3)*.3,side*amp*.66,-41,side*amp,-35,side*(amp+1),-31+Math.abs(i-3)*1.2],3.75,color,i);
      }
      return;
    }
    const frontBase='M-17 -17 Q-22 -32 -9 -38 C1 -43 15 -39 18 -30 Q21 -26 17 -18 Q14 -26 9 -28 Q0 -24 -8 -25 L-14 -15Z';
    shape(c,frontBase,pigment(color,-.24));
    const locks=style==='wave'?waved:style==='crop'?cropped:parted;
    c.save();c.translate(yaw*.8,0);
    for(let i=0;i<locks.length;i++)yarn(c,locks[i],style==='wave'?4.9:style==='crop'?4.3:4.0,color,i);
    if(!back&&long){
      yarn(c,[-9,-32,-16,-29,-17,-15,-15,-8],4.6,color,2);
      yarn(c,[-7,-30,-13,-26,-15,-15,-13,-6],3.3,color,1);
    }
    c.restore();
    if(style==='cap'){
      plate(c,'M-19 -24 Q-19 -35 -10 -39 Q7 -46 16 -33 L18 -27 Q5 -31 -17 -21Z','#547666',-14,-38,32,16);
      plate(c,'M-19 -24 Q-3 -32 14 -29 Q21 -29 24 -25 Q18 -22 12 -24 Q-2 -27 -17 -21Z','#466957',-6,-29,16,6);
      stitch(c,'M-6 -39 Q-13 -34 -11 -26','#a7a286',.62);
    }
  }
  function fallbackHead(c,p,skin,turn,back,blink,down) {
    const yaw=clamp((turn-.08)/.85), base=skin;
    const style=p[7],hairColor=p[6];
    if(back){hair(c,p,true);return;}
    if(style==='long'||style==='bob')hair(c,p,false);
    const far=1-.77*yaw;
    dome(c,15+yaw*.55,-14,3.1*far,4.7,base,'skin');
    const cheek='M-16 -21 C-16 -34 0 -38 10 -32 Q18 -29 17 -19 Q16 -12 14.8 -6 Q13 1 6 3 Q-1 5 -7 .8 Q-13 -4 -14 -10 Q-17 -12 -16 -21Z';
    const g=c.createRadialGradient(-6,-23,1,-3,-19,26);
    for(const [at,amount] of [[0,.43],[.37,.23],[.63,0],[.83,-.17],[1,-.42]]) g.addColorStop(at,pigment(base,amount));
    felt(c,new Path2D(cheek),g,'skin');
    dome(c,-15+.3*yaw,-12.1,4.0,5.25,base,'skin',-.22);
    dome(c,-15.25+.3*yaw,-12.0,2.05,2.9,'#b88068','skin',-.22);
    dome(c,-14.6+.3*yaw,-11.5,1.4,2.2,base,'skin',-.20);
    c.save();c.translate(yaw*3.4,down*1.1);
    const eyes=[[-6.3+3.3*yaw,1],[7+3.1*yaw,far]];
    for(const [x,s] of eyes){
      c.save();c.translate(x,-16);c.scale(s,1);
      const lid='M-3.65 .4 Q-.6 -2.75 3.25 -.4 Q2.50 1.6 -.6 1.65 Q-2.7 1.65 -3.65 .4Z';
      if(!blink){
        shade(c,lid,.25,.58,.25);shape(c,lid,'#f0ddbf');
        c.save();c.clip(new Path2D(lid));dome(c,.57+1.15*yaw,0,1.48,1.71,'#32251f');c.restore();
        curve(c,[-3.7,.4,-2.1,-1.7,1.55,-2.1,3.25,-.4],pigment(base,-.58),.92);
      }else curve(c,[-3.4,.3,-1.2,1.65,1.65,1.2,3.2,-.38],pigment(base,-.58),1.08);
      curve(c,[-3.6,-3.6,-2.0,-5.35,.7,-5.0,2.7,-4.0],pigment(hairColor,-.21),1.83);
      curve(c,[-3.3,-4.0,-1.8,-5.3,.4,-5.05,2.25,-4.4],pigment(hairColor,.18),.5);
      c.restore();
    }
    const nx=1.5+8.8*yaw;
    const nose='M'+(nx-.1)+' -18 Q'+(nx+1.75)+' -17.35 '+(nx+2.7)+' -13.7 Q'+(nx+3.2+1.2*yaw)+' -11.1 '+(nx+4.3+1.7*yaw)+' -9.8 Q'+(nx+5.5+yaw)+' -6.85 '+(nx+1.5)+' -7 Q'+(nx-2.4)+' -6.65 '+(nx-2.4)+' -9.3 Q'+(nx-1.5)+' -11.2 '+(nx-.1)+' -18Z';
    shade(c,nose,.66,1.05,.29);felt(c,new Path2D(nose),linear(c,nx-2,-13,nx+3,-7,[[0,pigment(base,.26)],[.40,pigment(base,.35)],[.70,base],[1,pigment(base,-.20)]]),'skin');
    ellipse(c,nx+.3,-7.8,.75,.35,pigment(base,-.45));
    const mx=1+6.4*yaw;
    curve(c,[mx-3,-3.2,mx-1,-3.95,mx+1.9,-3.2,mx+3.2,-3.85],'#966351',.99);
    curve(c,[mx-2.4,-2.5,mx-.2,-1.9,mx+1.5,-2.1,mx+2.25,-2.65],pigment(base,.30),.82);
    if(p[0]==='field'){
      c.save();c.translate(0,-15);
      for(const [x,s] of eyes){
        c.save();c.translate(x,0);c.scale(s,1);
        const frame='M-4.6 -2.0 Q-.2 -3.3 4.6 -2.15 L4.0 1 Q3.6 3.8 .2 4.0 Q-3.4 4.25 -4.10 1.9Z';
        shape(c,frame,'rgba(184,215,210,.12)','#413831',1.17);
        shape(c,'M-3.6 -1.5 Q-.4 -2.3 2.1 -2',null,'#baa17d',.48);c.restore();
      }
      curve(c,[eyes[0][0]+4.4,-1.8,0,-3.3,1,-2.7,eyes[1][0]-4.4*far,-1.8],'#463e37',1.05);
      curve(c,[-15,-.8,-11,0,-13,-1.1,eyes[0][0]-4.1,-1.6],'#493a32',1.02);c.restore();
    }
    c.restore();
    // Long styles already have their rear locks; the fringe lies over the brow.
    if(style==='long'||style==='bob'){
      for(let i=0;i<parted.length;i++)yarn(c,parted[i],4.2,hairColor,i);
      yarn(c,[-9,-32,-16,-29,-17,-15,-15,-8],4.7,hairColor,1);
    }else hair(c,p,false,yaw);
  }
  const heads=new Map(), torsos=new Map();
  function cachedPart(c,store,key,bounds,paint) {
    if(!store.has(key)){
      const [x,y,w,h]=bounds, density=4, im=document.createElement('canvas');
      im.width=w*density;im.height=h*density;
      const g=im.getContext('2d');g.scale(density,density);g.translate(-x,-y);g.lineCap='round';g.lineJoin='round';
      paint(g);store.set(key,im);
    }
    c.drawImage(store.get(key),...bounds);
  }
  // Keep the last exposure of each puppet's upper and lower armature. Camera
  // translation and breathing can then move the photograph without repainting wool.
  const exposures=new Map();
  function exposure(c,key,pose,bounds,paint) {
    const [x,y,w,h]=bounds, matrix=c.getTransform();
    const density=Math.max(1,Math.min(5,Math.ceil(Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)))));
    const signature=pose+'/'+density;
    let shot=exposures.get(key);
    if(!shot){
      if(exposures.size>=64)exposures.delete(exposures.keys().next().value);
      shot={canvas:document.createElement('canvas'),signature:''};exposures.set(key,shot);
    }
    if(shot.signature!==signature){
      const im=shot.canvas,g=im.getContext('2d');
      if(im.width!==w*density||im.height!==h*density){im.width=w*density;im.height=h*density;}
      else{g.resetTransform();g.clearRect(0,0,im.width,im.height);}
      g.setTransform(density,0,0,density,-x*density,-y*density);
      g.lineCap='round';g.lineJoin='round';paint(g);
      shot.signature=signature;
    }
    c.drawImage(shot.canvas,x,y,w,h);
  }

  function coatNeck(c,skin) {
    const neck='M-5.35 -85 Q.4 -81.5 5.5 -85 L5.6 -72 Q3.1 -68.8 0 -68.5 Q-3.4 -69.2 -5.6 -72Z';
    plate(c,neck,skin,-8,-82,17,13,'skin',0);
    shape(c,'M-5 -81 Q0 -76 5.3 -80 L5.35 -75 Q2 -72.3 -5 -73Z','rgba(101,61,47,.22)');
  }
  function coatBody(c,p,back) {
    const [family,,coat,dark,hi]=p, long=family==='scarf';
    const body=long?'M-12 -73 C-20 -73 -28 -70 -29 -60 Q-28 -53 -24 -42 Q-22 -17 -28 20 Q-17 26 1 23 Q16 26 28 21 Q23 -11 22 -40 Q29 -52 28 -61 Q26 -69 12 -73Z'
      :'M-12 -73 Q-26 -73 -29 -62 Q-29 -53 -23 -43 Q-21 -23 -24 -.5 Q-14 5 -2 4 Q9 5 24 .1 Q22 -20 22 -43 Q29 -54 28 -63 Q25 -71 12 -73Z';
    const coatPath=new Path2D(body);
    const g=c.createRadialGradient(-12,-59,2,-5,-49,68);
    for(const [at,color] of [[0,pigment(coat,.35)],[.32,pigment(coat,.10)],[.61,coat],[.82,dark],[1,pigment(dark,-.36)]])g.addColorStop(at,color);
    felt(c,coatPath,g);
    c.save();c.clip(coatPath);
    const sides=linear(c,-30,0,28,0,[[0,'rgba(26,18,23,.45)'],[.16,'rgba(51,41,35,.10)'],[.40,'rgba(255,213,168,.02)'],[.68,'rgba(68,52,45,.02)'],[.91,'rgba(23,21,26,.23)'],[1,'rgba(38,24,27,.45)']]);
    c.fillStyle=sides;c.fillRect(-33,-78,66,110);
    const hem=long?20:0;
    stitch(c,'M-24 '+(hem-1)+' Q-8 '+(hem+5)+' 3 '+(hem+1)+' Q12 '+(hem+3)+' 24 '+(hem-2),pigment(hi,.18),.85,[1.5,2.35]);
    for(const side of [-1,1]){
      stitch(c,'M'+side*14+' -71 Q'+side*24+' -69 '+side*25+' -61 Q'+side*25+' -50 '+side*20+' -45',pigment(hi,.25),.76,[1.24,2]);
    }
    c.restore();
    if(back){
      if(family==='hood'){
        plate(c,'M-21 -67 Q-16 -80 0 -80 Q16 -82 22 -70 Q24 -59 12 -50 Q8 -46 2 -44 Q-16 -49 -21 -67Z',dark,-13,-76,33,30,'wool',2.2);
        stitch(c,'M-17 -66 Q-14 -53 1 -48 Q11 -51 18 -63',hi,.85);
      }else if(family==='scarf'){
        plate(c,'M-17 -73 Q1 -78 16 -72 L17 -64 Q4 -64 -5 -62 Q-13 -63 -17 -67Z','#a96b52',-10,-75,22,12);
        stitch(c,'M-15 -69 Q-3 -63 14 -68','#e9c38b',1.10,[2,2.7]);
      }else {
        plate(c,'M-13 -74 Q0 -71 13 -74 L17 -69 Q2 -62 -17 -69Z',coat,-14,-74,30,10);
        stitch(c,'M-12 -69 Q0 -66 12 -70',hi,.68);
      }
      stitch(c,'M-19 -61 Q-1 -54 20 -61 M0 -57 Q2 -31 1 -4',hi,.68,[1.3,2.4]);
      return;
    }
    if(family==='suit'||family==='player'){
      plate(c,'M-11 -73 L-6 -76 Q0 -71 7 -75 L12 -70 L1 -30Z','#d8cbae',-9,-76,21,40,'wool',.45);
      if(family==='suit'){
        plate(c,'M-2.6 -67 L1.6 -69 L4.8 -65 L2.5 -60 L4.2 -40 L1 -33 L-2 -39 L-.5 -61Z','#93543e',-2,-68,5,28,'wool',.6);
        shape(c,'M-7 -74 L0 -70 L-4 -64 L-10 -70Z M8 -75 L2 -70 L6 -65 L12 -71Z','#e1d5b9');
      }
      const lapel='M-12 -74 L-6 -75.5 L1 -30 L-14.8 -54 L-10 -55.5 L-17 -62Z';
      plate(c,lapel,coat,-13,-73,16,36,'wool',1.35);
      plate(c,'M12 -75 L17 -64 L11.5 -57 L15.5 -55 L1 -29Z',coat,9,-73,8,42,'wool',1.5);
      stitch(c,'M-12 -72 L-15.5 -62 L-9 -55.5 M14.7 -54.8 L3 -34.2',hi,.73,[1.1,1.95]);
      plate(c,'M8 -52.7 L19 -54 L19 -51 L8 -49.7Z',coat,8,-53,10,3);
      stitch(c,'M1 -29 L0 -3',hi,.53);
      button(c,2.5,-23,1.6);button(c,2.5,-13,1.6);
    }else if(family==='field'){
      plate(c,'M-13 -71 L-8 -76 L0 -70 L-3 -60Z',coat,-12,-74,9,11);
      plate(c,'M10 -76 L16 -70 L5 -60 L1 -69Z',coat,3,-73,11,12);
      plate(c,'M-.8 -68 L2.6 -68 L4 .2 L.2 1Z',coat,-1,-45,5,0);
      stitch(c,'M.5 -64 L1.4 -4',hi,.68,[.66,1]);
      for(const x of [-18,5]){
        const patch='M'+x+' -56 l13 -1 -.5 12 q-5 3 -12 .7Z';
        plate(c,patch,coat,x,-57,12,15);
        plate(c,'M'+(x-1)+' -56 l15 -1 -.6 4 -7 3.4 -7 -3Z',coat,x,-58,12,7);
        stitch(c,'M'+(x+1)+' -53 l5.3 2.6 5.6 -3',hi,.56,[.75,1.1]);
        button(c,x+6,-52.4,1.0);
      }
      stitch(c,'M-21 -14 Q-8 -10 0 -12 M4 -12 Q12 -12 20 -16',hi,.70);
      plate(c,'M-18 -25 L-7 -22 L-10 -9 Q-15 -7 -20 -11Z',dark,-17,-24,12,14);
    }else if(family==='hood'){
      plate(c,'M-21 -67 Q-26 -73 -16 -79 Q-8 -84 -2 -76 Q7 -82 18 -79 Q24 -76 23 -69 Q15 -59 2 -55 Q-10 -57 -21 -67Z',dark,-14,-77,31,20,'wool',2);
      stitch(c,'M-18 -70 Q-12 -63 -1 -60 Q9 -61 18 -71',hi,.95);
      for(const [x,dy] of [[-7,0],[5,3]]){
        curve(c,[x,-61,x-1,-57,x+1,-52,x,-48+dy],'#574f48',2);
        curve(c,[x-.3,-61,x-1.3,-57,x+.8,-52,x-.35,-48+dy],'#e3cfab',1.18);
      }
      plate(c,'M-12 -27 Q-4 -30 9 -28 L17 -15 L14 -10 Q0 -8 -16 -11 L-16 -15Z',coat,-9,-28,23,19);
      stitch(c,'M-11 -26 L-16 -17 M8 -26 L14 -18 M-14 -11 Q0 -8 13 -11',hi,.65);
    }else if(family==='scarf'){
      plate(c,'M-11 -73 L-5 -77 L3 -45 L-14 -60 L-9 -62 L-16 -67Z',coat,-11,-73,14,25);
      plate(c,'M11 -74 L17 -67 L10 -61 L14 -59 L2 -42Z',coat,8,-70,9,26);
      stitch(c,'M3 -44 Q5 -14 5 21 M-23 -19 L-12 -15 M12 -16 L24 -20',hi,.81);
      for(const y of [-36,-22,-8,6])button(c,8,y,1.95);
    }else {
      plate(c,'M-14 -72 L-8 -75 Q.5 -68 7 -75 L14 -72 Q12 -64 1 -59 Q-10 -61 -14 -72Z',dark,-10,-73,22,13);
      for(let i=0;i<12;i++){
        const t=i/11,x=-11+t*22,y=-72+Math.sin(t*Math.PI)*7;
        curve(c,[x,y,x,y+1,x+.7,y+2.7,x+1,y+3],hi,.85);
      }
      stitch(c,'M-19 -4 Q0 1 20 -4',hi,1.05,[1.55,1.05]);
      if(p===cast[6]){
        plate(c,'M-.8 -62 L2 -62 L3 2 L-.9 3Z',coat,-1,-40,4,0);
        for(const y of [-52,-40,-28,-16,-4])button(c,1,y,1.2);
      }
    }
  }

  // Each quartet is elbow x/y and palm x/y. Hands follow the object they handle.
  const arms={
    suit:[
      [[-31,-33,-22,-24],[31,-33,21,-24]],[[-34,-47,-21,-53],[33,-47,21,-53]],
      [[-29,-31,-15,-15],[33,-22,30,14]],[[-27,-37,-17,-20],[34,-26,30,-1]]],
    field:[
      [[-29,-28,-4,-7],[29,-27,9,-8]],[[-29,-40,-3,-50],[30,-29,11,-15]],
      [[-23,-23,12,-18],[31,-31,18,-21]],[[-30,-24,-17,3],[29,-33,15,-18]]],
    tote:[
      [[-31,-30,-12,-18],[31,-28,13,-17]],[[-31,-32,-12,-24],[30,-33,3,-13]],
      [[-37,-43,-22,-64],[27,-29,-9,-31]],[[-33,-43,-21,-59],[30,-22,18,3]]],
    hood:[
      [[-27,-31,-7,-8],[29,-29,9,-7]],[[-42,-67,-16,-94],[41,-67,16,-94]],
      [[-35,-43,-11,-68],[34,-46,12,-68]],[[-29,-24,-17,3],[29,-22,18,3]]],
    scarf:[
      [[-30,-28,-13,-3],[29,-32,12,-12]],[[-30,-33,-14,-16],[30,-45,11,-57]],
      [[-33,-46,9,-70],[33,-52,18,-63]],[[-29,-24,-16,3],[27,-39,13,-46]]],
    player:[
      [[-32,-31,-16,-8],[31,-32,14,-9]],[[-32,-31,-16,-8],[31,-32,14,-9]],
      [[-32,-31,-16,-8],[31,-32,14,-9]],[[-32,-31,-16,-8],[31,-32,14,-9]]]
  };
  function armPose(family,side,b,stand,hang,walk,time) {
    const index=Math.min(2,Math.floor(b)), keys=arms[family], k=b-index, s=side<0?0:1;
    const values=keys[index][s].map((v,i)=>mix(v,keys[index+1][s][i],k));
    const elbow=values.slice(0,2), palm=values.slice(2,4);
    if (family==='field' && side===-1) palm[1]+=Math.sin(time*5)*2*(1-clamp(Math.abs(b-2)*2));
    if (family==='tote' && side===1) palm[1]+=Math.sin(time*5.5)*3*(1-clamp(Math.abs(b-1)*2));
    if (family==='hood' && b>1 && b<2) {
      const lift=Math.sin(Math.PI*(b-1)); palm[0]+=side*7*lift; palm[1]-=12*lift;
      elbow[0]+=side*3*lift; elbow[1]-=8*lift;
    }
    if (stand && (family==='player' || hang)) {
      elbow[0]=side*27; elbow[1]=-37; palm[0]=side*24+walk*7*side; palm[1]=-6;
      if (hang && side>0) {
        elbow[0]=34; elbow[1]=-93; palm[0]=25; palm[1]=-122;
      }
    }
    return {elbow,palm};
  }
  function upperSleeve(c,p,side,pose){
    // The inset sleeve is sewn under the jacket's shoulder cap.
    roll(c,[side*17.7,-56.8],pose.elbow,7.65,7.5,p[2],p[2],true);
  }
  function sleeve(c,p,skin,side,pose) {
    const {elbow,palm}=pose,wrist=between(elbow,palm,.83);
    roll(c,elbow,wrist,7.6,5.35,p[2],p[2],true);
    const start=between(elbow,wrist,.8),end=between(wrist,palm,.10);
    roll(c,wrist,palm,3.6,3.55,skin,'skin');
    roll(c,start,end,5.55,5.5,p[3],p[2]);
    const n=edgeNormal(elbow,wrist),a=offset(end,n,4.7),z=offset(end,n,-4.7);
    stitch(c,'M'+a.join(' ')+' Q'+end[0]+' '+(end[1]+.7)+' '+z.join(' '),p[4],.72,[.82,1.3]);
  }
  function hand(c,skin,side,pose,open) {
    const {elbow,palm}=pose,color=skin;
    c.save(); c.translate(...palm);c.rotate(Math.atan2(palm[1]-elbow[1],palm[0]-elbow[0])-Math.PI/2);c.scale(side,1);
    dome(c,-.05,-1.45,4.45,5.2,color,'skin',-.09);
    for(let i=0;i<4;i++){
      const x=-3.35+i*1.8,dy=[-.9,.4,0,-1.1][i];
      const from=[x,open?.55:.8], to=open?[x+(i-1.5)*.29,5.9+dy]:[x+.8,3.35+dy];
      roll(c,from,to,open?1.22:1.4,open?1.04:1.27,color,'skin');
    }
    roll(c,[2.6,-3.65],open?[5.8,.6]:[3.7,.25],1.9,1.6,color,'skin');
    if(!open)roll(c,[3.8,.1],[1.15,1.0],1.47,1.27,color,'skin');
    c.restore();
  }

  function paperCase(c,b,back) {
    const fold=ease(b-1), ready=ease(b-2);
    const x=sample([-23,-23,-18,-22],b), y=sample([-40,-68,-31,-40],b);
    c.save(); c.translate(x,y); c.rotate(mix(-.045,-.16,ready)); c.scale(mix(1,.23,fold),1);
    if (back) { c.beginPath(); c.rect(-8,0,12,35); c.clip(); }
    plate(c,'M0 3 Q10 0 23 4 Q33 .4 48 1 L47 28 Q33 26 23 30 Q11 26 -.5 29Z','#d7c5a0',0,0,45,30,'paper',1.1);
    shape(c,'M.5 3 Q11 .8 23 4 L23 28.8 Q10 24.4 0 27.5Z',linear(c,0,0,24,1,[[0,'#e3d6b8'],[.38,'#eee0be'],[1,'#b7a48a']]));
    shape(c,'M23 4 Q23 17 23 29 M1 27 Q15 25 22 29 M27 27 Q37 24 46 26',null,'#aaa99a',1.05);
    shape(c,'M4 6 L19 7.2 L19 10 L4 9Z M27 7.3 L44 5.8 L44 7.4 L27 8.9Z','#647377');
    shape(c,'M5 13 L13.2 13.5 L13 20.7 L5 20Z M28 17.7 L40.6 16.7 L40.6 22.6 L28 23.6Z','#a8b6ad');
    shape(c,'M15 14 L20 14.5 M15 17 L20 17.5 M4 23 L19 24 M27 11.5 L44 10 M27 14 L42 12.8',null,'#9b9e91',1);
    c.restore();
    c.save(); c.translate(30,sample([25,25,21,6],b)); c.rotate(-.03+ready*.07);
    shape(c,'M-8 0 Q-8 -9 -3 -9 L3 -9 Q8 -9 7 0',null,'#6f5547',2.7);
    plate(c,'M-15 -.8 Q-16 -2 0 -2 Q13 -3 15 -.3 L16 19 Q16 22 13 23 L-13 23 Q-16 22 -16 19Z','#765036',-12,-1,24,23,'leather',1.1);
    plate(c,'M-15 1 Q-14 -1 14 -.5 L13 8 Q2 12 -14 8Z','#9b6946',-7,-1,16,13,'leather',1.2);
    stitch(c,'M-12 11 L-12 19 Q-2 20 12 19','#c69b6b',.75,[.8,1.3]);
    shape(c,'M-2 7 L2 7 L2 12 L-2 12Z','#d0b384','#76634e',.8); c.restore();
  }
  function phonePocket(c,p,b) {
    const packed=ease((b-1.5)/.5);
    if (packed<1) {
      c.save(); c.translate(sample([-6,-5,10,10],b),sample([-23,-69,-22,-22],b));
      c.rotate(sample([.15,-.11,.12,.12],b)); c.beginPath(); c.rect(-3,-1,14,23*(1-packed)); c.clip();
      shape(c,'M2 0 L9 0 Q11 0 11 2 L11 19 Q11 21 9 21 L2 21 Q0 21 0 19 L0 2 Q0 0 2 0Z','#3e4b58','#38424a',1.15);
      shape(c,'M1.3 3 L9.7 3 L9.7 16.5 L1.3 16.5Z','#a9cdce');
      shape(c,'M2.2 12 L8 5 M5 15 L9 10',null,'#cfdfd6',1);
      c.restore();
    }
    plate(c,'M5 -24 Q13 -21 21 -25 L22 -9 Q17 -5 6 -8Z',p[2],4,-22,18,16);
    plate(c,'M4 -24 L21 -26 L21 -21 Q12 -18 5 -21Z',p[2],7,-26,10,6);
    stitch(c,'M7 -19 L8 -10 Q13 -8 19 -10',p[4],.78,[.95,1.25]);
    button(c,14,-21.5,1.15);
  }
  function tote(c,b) {
    const lift=b>1 && b<2 ? Math.sin(Math.PI*(b-1)) : 0;
    const x=sample([0,-1,-25,-24],b), y=sample([-7,-10,-20,-20],b)-lift*18;
    const strapTop=sample([-28,-30,-71,-71],b)-y-lift*7;
    c.save(); c.translate(x,y); c.rotate(sample([.02,-.06,-.12,-.13],b));
    curve(c,[-13,3,-15,strapTop-1,9,strapTop-13,12,2],'#715538',4.1);
    curve(c,[-12.6,3,-14.5,strapTop,9,strapTop-12,12.4,2],'#d3b68c',1.4);
    const bag='M-20 0 Q-10 2 0 1 Q10 0 18 -1 Q16 12 19 26 Q12 32 -15 29 Q-20 26 -18 20Z';
    shade(c,bag,1.6,2);
    felt(c,new Path2D(bag),linear(c,-19,0,20,4,[[0,'#96764f'],[.14,'#ccb287'],[.33,'#e1c79b'],[.75,'#c7a777'],[.91,'#ae8e61'],[1,'#d0af7c']]));
    plate(c,'M-19 1 Q-.2 5 17 0 L16.5 4 Q1 9 -18 5Z','#d6bd95',-13,1,28,4);
    stitch(c,'M-16 5 Q-14 16 -16 24 M-12 27 Q5 30 15 25 M12 8 Q11 18 15 25','#806a4f',.76,[.9,1.65]);
    plate(c,'M-5 15 Q-3 9 4 10 Q5 15 -1 18 Q-6 18 -5 15Z','#6d8167',-4,11,10,7,'wool',.6);
    stitch(c,'M-3 16 L2.5 12','#b2ba8d',.56,[.8,.7]);
    c.restore();
  }
  function scarf(c,b) {
    const middle=[sample([5,4,-4,10],b),sample([-30,-39,-68,-64],b)];
    const end=[sample([-13,-15,15,23],b),sample([1,-14,-65,-47],b)];
    roll(c,[8,-68],middle,6.6,6.4,'#ad654e','wool');
    roll(c,middle,end,6.35,5.8,'#ad654e','wool');
    const normal=edgeNormal(middle,end);
    for (const t of [.25,.34,.67,.78]) {
      const at=between(middle,end,t), a=offset(at,normal,-5), z=offset(at,normal,5);
      curve(c,[...a,...between(a,z,.3),...between(a,z,.7),...z],'#d8ac85',1.3);
    }
    const a=offset(middle,normal,2), z=offset(end,normal,2);
    curve(c,[...a,...between(a,z,.33),...between(a,z,.66),...z],'#804f4b',1.15);
    for(let k=-4;k<=4;k+=2){
      const fringe=offset(end,normal,k), tip=[fringe[0]+(end[0]-middle[0])*.06,fringe[1]+(end[1]-middle[1])*.06+1];
      roll(c,fringe,tip,.76,.62,'#bd815c','wool');
    }
    plate(c,'M-14 -75 Q-7 -78 0 -73 Q8 -75 13 -73 L16 -66 Q8 -63 1 -62 Q-8 -64 -14 -67Z','#ad6953',-11,-74,26,10);
    shape(c,'M-11 -73 Q-5 -69 3 -67 M-6 -75 Q1 -71 7 -70 M6 -72 L9 -66',null,'#e0b794',1.25);
  }
  function phones(c,b,hx,hy,cups,back) {
    const slide=clamp(b-1), lift=Math.sin(slide*Math.PI);
    const spread=mix(18.7,11.5,slide)+lift*7;
    const top=mix(hy-39,-75,slide)-lift*12, ear=mix(hy-14,-67,slide)-lift*12;
    c.save(); c.translate(hx*(1-slide),0);
    if (!cups) {
      curve(c,[-spread,ear,-spread-4,top-9,spread+4,top-9,spread,ear],'#51585c',3.5);
      curve(c,[-spread,ear-2,-spread-3,top-10,spread+3,top-10,spread,ear-2],'#d3ac78',1.8);
    } else {
      for (const side of [-1,1]) {
        c.save(); c.translate(side*spread,ear); c.rotate(side*.16);
        dome(c,0,0,4,7.3,'#41474a','leather'); dome(c,side*.9,-.2,3.2,6.0,'#b28d58','leather');
        dome(c,side*1.4,-.5,1.55,3.95,'#c4a071'); c.restore();
      }
      if (!back) curve(c,[spread,ear+5,spread+2,ear+19,5,ear+20,7,ear+29],'#697779',.75);
    }
    c.restore();
  }
  function messenger(c) {
    plate(c,'M18 -69 L23 -65 L-14 -14 L-19 -17Z','#76593d',6,-50,12,13,'leather');
    plate(c,'M-27 -25 Q-14 -28 -5 -22 L-7 -2 Q-17 3 -29 -3Z','#a68056',-25,-25,22,20,'leather');
    plate(c,'M-27 -25 L-5 -22 L-8 -13 Q-18 -10 -28 -15Z','#bf996b',-22,-25,17,14,'leather');
    stitch(c,'M-26 -17 Q-16 -12 -8 -15','#e3c39a',.72,[1.2,1.6]);
    shape(c,'M-18 -15 L-15 -15 L-15 -10 L-18 -10Z','#9a7655');
  }
  function draw(c,o) {
    if (!c || !o || o.id==null || !(o.height>0)) return;
    const id=o.id==='player'?14:Number(o.id)||0, p=material(o.id), family=p[0];
    const skin=skinTones[id]||skinTones[0];
    const t=Math.floor((Number(o.time)||0)*12)/12, seated=!!o.seated, back=o.view==='back', profile=o.view==='profile';
    const walking=!!o.walking && !seated;
    const stride=walking ? (Number.isFinite(o.stride)?Math.max(-1,Math.min(1,o.stride)):Math.sin(t*8.5+id)) : 0;
    const carry=family==='suit'||family==='tote';
    const stage=seated ? beatFor(o.action,Math.max(0,Math.floor((Number(o.actionTime)||0)*12)/12)) :
      walking || o.action==='rise' || carry ? 3 : 0;
    const b=Math.min(stage,3), ready=seated||walking?ease(b-2):0, rise=seated?clamp(stage-3):1;
    const turn=o.view==='profile' ? .92 : back ? .15 : .09+.76*ready;
    const hang=back && !walking && !seated && id%3!==2;
    const breath=Math.sin(t*2+id*1.43)*.68;
    const hip=mix(-55,-120,rise)+Math.max(0,stride)*.7;
    const restTilt=[-.045,.043,.075,-.049,.03,-.035,-.06,.035,-.04,.06,-.026,.038,.022][id]||0;
    const lean=seated ? sample([-.022,.033,.067,.139,.035],stage) : walking?.035:hang?0:restTilt*.42;
    const headY=-79+(seated?sample([.5,2.2,2,-1.2,-.8],stage):0);
    const headX=turn*4.1, downward=seated ? 1-ease(b-1.7) : 0;
    const scale=o.height/236;
    c.save(); c.translate(o.x,o.y); c.scale((o.doorSide===-1?-1:1)*scale*(builds[id]||1),scale);
    c.lineJoin='round'; c.lineCap='round';
    const photoReady=!!window.ClayHeads?.ready;
    const shotKey=[id,seated?'seat':walking?'walk':'stand',o.view].join('/');
    exposure(c,shotKey+'/legs',[ready,rise,stride,photoReady].join('/'),[-52,-140,104,145],g=>{
      trousers(g,p,hip,ready,rise,stride,-1,family==='hood'||family==='tote');
      trousers(g,p,hip,ready,rise,stride,1,family==='hood'||family==='tote');
      if(p===cast[6]||p===cast[7])skirt(g,p,hip,ready,rise,stride);
    });
    c.translate(seated?ready*(1-rise)*5:0,hip+breath);
    c.rotate(lean);
    c.scale(1-turn*.23,1);
    const blink=(t+id*.57)%4.9<.115;
    const working=seated&&(family==='field'&&Math.abs(b-2)<.5||family==='tote'&&Math.abs(b-1)<.5);
    const upperPose=[stage,stride,blink&&!back,working?t:0,photoReady,o.action==='rise'].join('/');
    exposure(c,shotKey+'/top',upperPose,[-53,-136,106,188],dress);
    c.restore();

    function dress(c){
      const poses=[-1,1].map(side=>armPose(family,side,b,!seated,hang,stride,t));
      if (!seated && !walking && !back && family==='field') {
        // One standing reader checks their phone in the aisle.
        poses[0]=armPose(family,-1,1,false,false,0,t);
      }
      for(let i=0;i<2;i++)upperSleeve(c,p,i===0?-1:1,poses[i]);
      coatNeck(c,skin);
      if(!window.ClayHeads?.torso?.(c,o.id,{back,profile})){
        cachedPart(c,torsos,id+'/'+back,[-32,-82,64,109],g=>coatBody(g,p,back));
      }else if(!back){
        const bottom=family==='suit'||family==='field'?-69.7:family==='tote'&&id!==9?-68:-71;
        const neck='M-5.1 -82 Q0 -79 5.15 -82 L5.35 -73.5 Q4.60 '+bottom+' .4 '+bottom+' Q-4.75 '+bottom+' -5.25 -73.3Z';
        plate(c,neck,skin,-5,-79,10,10,'skin',0);
      }
      if (back) {
        if (family==='suit') paperCase(c,b,true);
        if (family==='tote') {
          shape(c,'M-20 -68 Q-27 -58 -29 -20',null,'#b39c7b',4.1);
          plate(c,'M-31 -25 Q-22 -24 -20 -18 L-22 10 Q-31 11 -39 6 L-39 -18Z','#bd9d73',-36,-23,17,30);
          stitch(c,'M-36 -17 L-36 3 Q-32 7 -25 7','#e9ca99',.75);
        }
        if (family==='player') messenger(c);
      }
      for (let i=0;i<2;i++) sleeve(c,p,skin,i===0?-1:1,poses[i]);
      if (!back) {
        if (family==='suit') paperCase(c,b);
        if (family==='field') phonePocket(c,p,!seated && !walking && o.action!=='rise'?1:b);
        if (family==='tote') tote(c,b);
        if (family==='scarf') scarf(c,b);
        if (family==='player') messenger(c);
      }
      if (family==='hood') phones(c,b,headX,headY,false,back);
      c.save(); c.translate(headX,headY); c.rotate(-lean*.5+restTilt*(1-ready)+(seated?downward*.052:0));
      c.scale(1,1-downward*.033);
      if(!window.ClayHeads?.draw?.(c,o.id,{turn,back,blink,down:downward,profile})){
        const yaw=back?0:Math.round(turn*5), gaze=downward>.48?1:0;
        cachedPart(c,heads,[id,back,yaw,blink&&!back,gaze].join('/'),[-30,-47,60,64],
          g=>fallbackHead(g,p,skin,yaw/5,back,blink,gaze));
      }
      c.restore();
      if (family==='hood') phones(c,b,headX,headY,true,back);
      for (let i=0;i<2;i++) hand(c,skin,i===0?-1:1,poses[i],ready>.65 && family!=='suit' && !hang);
    }
  }
  window.Commuters={draw,outfit,describe};
})();
