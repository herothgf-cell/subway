/* First-person carriage. Project the artwork, commuters and pointer hits through the same camera. */
(() => {
  "use strict";
  const W = 1440, H = 650, FOCAL = 735, BAY = 840, WALL = -44, ROOF = 210;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const frac = n => n - Math.floor(n);
  const noise = n => frac(Math.sin(n * 17.41 + 6.25) * 43758.545);
  const memo = new Map();

  function texture(key, w, h, paint, ratio = 2) {
    if (!memo.has(key)) {
      const image = document.createElement("canvas");
      image.width = w * ratio;
      image.height = h * ratio;
      const c = image.getContext("2d");
      c.scale(ratio, ratio);
      paint(c);
      memo.set(key, image);
    }
    return memo.get(key);
  }

  function gradient(c, x, y, xx, yy, stops) {
    const g = c.createLinearGradient(x,y,xx,yy);
    for (const [at,col] of stops) g.addColorStop(at,col);
    return g;
  }

  function box(c,x,y,w,h,color) { c.fillStyle=color; c.fillRect(x,y,w,h); }
  function rounded(c,x,y,w,h,r,fill,stroke,width=1) {
    c.beginPath(); c.roundRect(x,y,w,h,r);
    if (fill) { c.fillStyle=fill; c.fill(); }
    if (stroke) { c.lineWidth=width; c.strokeStyle=stroke; c.stroke(); }
  }
  function polygon(c,points,fill,stroke,width=1) {
    c.beginPath(); c.moveTo(points[0].x,points[0].y);
    for (let i=1;i<points.length;i++) c.lineTo(points[i].x,points[i].y);
    c.closePath(); c.fillStyle=fill; c.fill();
    if (stroke) { c.strokeStyle=stroke; c.lineWidth=width; c.stroke(); }
  }
  function line(c,x,y,xx,yy,color,width=1) {
    c.beginPath(); c.moveTo(x,y); c.lineTo(xx,yy);
    c.strokeStyle=color; c.lineWidth=width; c.stroke();
  }
  function oval(c,x,y,rx,ry,color) {
    c.beginPath(); c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,2*Math.PI);
    c.fillStyle=color;c.fill();
  }
  function words(c,label,x,y,sz,color,weight=600) {
    c.fillStyle=color;
    c.font=weight+" "+sz+"px system-ui, 'Malgun Gothic', sans-serif";
    c.fillText(label,x,y);
  }

  function rubbedSurface(c,name,x,y,w,h,scale,strength) {
    const sample=window.ClaySetMaterials?.[name];
    if(!sample)return;
    c.save();
    c.translate(x,y);c.scale(scale,scale);
    c.globalCompositeOperation="soft-light";c.globalAlpha=strength;
    c.fillStyle=c.createPattern(sample,"repeat");
    c.fillRect(0,0,w/scale,h/scale);
    c.restore();
  }
  function bevel(c,x,y,w,h,r,colors,edge,width) {
    rounded(c,x,y,w,h,r,gradient(c,x,y,x+w*.13,y+h,colors),edge,width);
  }
  function screw(c,x,y,r) {
    oval(c,x+.25,y+.35,r*1.16,r,"#736956");
    oval(c,x,y,r,r,gradient(c,x-r,y-r,x+r,y+r,[[0,"#fff1cc"],[.34,"#d0c2a6"],[.64,"#867e6c"],[1,"#c2b6a2"]]));
    line(c,x-r*.52,y+r*.37,x+r*.54,y-r*.37,"#635c52",r*.26);
  }

  function camera(state) {
    const seated=state.seatedIndex!=null && (state.phase==="seated" || state.phase==="result");
    const p=state.player, lateral=p.x-423, forward=seated ? 0 : p.y-258;
    const yaw=-.20-lateral*.00084;
    return {x:375+lateral*.91-forward*.40, z:272+forward*.83,
      eye:seated?98:140, horizon:seated?214:171+Math.min(0,forward)*2.25,
      sin:Math.sin(yaw), cos:Math.cos(yaw), seated};
  }
  function project(cam,x,z,h=0) {
    const dx=x-cam.x, dz=cam.z-z;
    const d=Math.max(6,dz*cam.cos+dx*cam.sin);
    const k=FOCAL/d;
    return {x:W/2+k*(dx*cam.cos-dz*cam.sin), y:cam.horizon+k*(cam.eye-h), k, d};
  }
  function ground(cam,x,y) {
    const z=(y-182)*1.46;
    return project(cam,x-z*.36,z);
  }
  function groundInverse(cam,x,y) {
    if (y<=cam.horizon+1) return null;
    const d=FOCAL*cam.eye/(y-cam.horizon), h=(x-W/2)*d/FOCAL;
    const z=cam.z-(d*cam.cos-h*cam.sin);
    return {x:cam.x+h*cam.cos+d*cam.sin+z*.36, y:182+z/1.46};
  }
  // Clip long rails and floor seams before projecting. The continuation of the
  // carriage behind the eye must not change the position or thickness of a visible edge.
  function planeDistance(v,p,plane) {
    const dx=p[0]-v.x, dz=v.z-p[1], d=dz*v.cos+dx*v.sin;
    const across=FOCAL*(dx*v.cos-dz*v.sin), vertical=FOCAL*(v.eye-p[2]);
    switch(plane) {
      case 0:return d-12;
      case 1:return (W/2+12)*d+across;
      case 2:return (W/2+12)*d-across;
      case 3:return (v.horizon+12)*d+vertical;
      default:return (H+12-v.horizon)*d-vertical;
    }
  }
  function crossing(a,b,da,db) {
    const f=da/(da-db);
    return [a[0]+f*(b[0]-a[0]),a[1]+f*(b[1]-a[1]),a[2]+f*(b[2]-a[2])];
  }
  function clippedLine(v,a,b) {
    for(let plane=0;plane<5;plane++){
      const da=planeDistance(v,a,plane),db=planeDistance(v,b,plane);
      if(da<0 && db<0)return null;
      if(da<0)a=crossing(a,b,da,db);
      else if(db<0)b=crossing(a,b,da,db);
    }
    return [project(v,...a),project(v,...b)];
  }
  function strip(c,cam,points,color,edge,width) {
    for(let plane=0;plane<5;plane++){
      const clipped=[];
      let a=points[points.length-1],da=planeDistance(cam,a,plane);
      for(const b of points){
        const db=planeDistance(cam,b,plane);
        if((da<0)!==(db<0))clipped.push(crossing(a,b,da,db));
        if(db>=0)clipped.push(b);
        a=b;da=db;
      }
      if(clipped.length<3)return;
      points=clipped;
    }
    polygon(c,points.map(p=>project(cam,...p)),color,edge,width);
  }
  function wire(c,cam,a,b,color,w=1) {
    const ends=clippedLine(cam,a,b);if(!ends)return;
    const [p,q]=ends;
    line(c,p.x,p.y,q.x,q.y,color,w*(p.k+q.k)/2);
  }

  // A vertical strip is affine to subpixel precision. This keeps the illustrated wall's
  // lettering and print textures sharp while the near and far ends recede independently.
  function mural(c,cam,im,x,w,z,top,bottom,span=24) {
    const n=Math.ceil(w/span), slice=im.width/n;
    let p=project(cam,x,z,top);
    for(let i=0;i<n;i++) {
      const q=project(cam,x+w*(i+1)/n,z,top);
      if(q.x>=-1 && p.x<=W+1 && q.x>p.x+.01) {
        const mid=project(cam,x+w*(i+.5)/n,z,0);
        c.save(); c.transform((q.x-p.x)/slice,(q.y-p.y)/slice,0,(top-bottom)*mid.k/im.height,p.x,p.y);
        c.drawImage(im,i*slice,0,slice,im.height,0,0,slice+.4,im.height);
        c.restore();
      }
      p=q;
    }
  }

  function city(evening) {
    return texture("city"+evening,640,170,c=>{
      box(c,0,0,640,170,gradient(c,0,0,0,170,evening?[[0,"#475f7c"],[.58,"#bd9a99"],[1,"#a39998"]]:
        [[0,"#b3c6cc"],[.5,"#f6d2b2"],[1,"#bda799"]]));
      for(let i=0;i<15;i++) {
        const x=noise(i+2)*640, y=18+noise(i+5)*43;
        oval(c,x,y,16+noise(i)*30,2.5,evening?"#c6abb066":"#f1eee490");
      }
      for(let l=0;l<2;l++){
        c.beginPath();c.moveTo(0,105);
        for(let x=0;x<=640;x+=5) c.lineTo(x,87+l*9+Math.sin(x*Math.PI/160+l)*9+Math.sin(x*Math.PI/40)*2);
        c.lineTo(640,170);c.lineTo(0,170);c.fillStyle=evening?["#8894a0","#899197"][l]:["#a4b6b4","#93aaa6"][l];c.fill();
      }
      for(let layer=0;layer<2;layer++) for(let i=0;i<47;i++) {
        const x=i*14-4+noise(i+91*layer)*5;
        const w=9+noise(i+25*layer)*11, h=12+noise(i+31+layer)*43;
        const bottom=116+layer*16, y=bottom-h;
        const hues=evening?["#839099","#7c8993","#6e8089","#9a969c"]:["#adc0bc","#bdc8bc","#91a9a6","#a6b8b1"];
        box(c,x,y,w,h,hues[Math.floor(noise(i+layer*13)*4)]);
        box(c,x+w-2,y,2,h,evening?"#626e7a":"#849b98");
        if(i%4===0) box(c,x+3,y-3,w*.5,3,evening?"#81909a":"#a6b6b2");
        for(let yy=y+4;yy<bottom-2;yy+=5)for(let xx=x+2;xx<x+w-3;xx+=4)
          box(c,xx,yy,1.8,1.6,evening&&noise(xx+yy)>.66?"#e4c89e":evening?"#a0a6a3":"#d1d4c4");
      }
      box(c,0,131,640,39,evening?"#87979a":"#adc1b5");
      for(let x=0;x<640;x+=50) {box(c,x,133,4,31,"#7f9793");line(c,x,137,x+50,125,"#a6b1a3",1.6);}
      box(c,0,130,640,2.5,"#7f9290");
      const sky=window.ClaySetMaterials?.sky;
      if(sky) {
        c.save();c.globalAlpha=evening?.46:.94;
        for(let i=0;i<4;i++){
          c.save();c.translate(i*160+(i%2?160:0),0);if(i%2)c.scale(-1,1);
          c.drawImage(sky,0,0,160,104);
          c.drawImage(sky,0,sky.height-2,sky.width,2,0,104,160,34);c.restore();
        }
        c.restore();
      }
      box(c,0,0,640,170,gradient(c,0,0,0,170,evening?
        [[0,"#363f693d"],[.7,"#d4917933"],[1,"#53666b57"]]:
        [[0,"#fff3dd8a"],[.6,"#fff0d531"],[1,"#d9b69a36"]]));
    },1.5);
  }
  function poster(c,x,y,w,h,theme) {
    rounded(c,x,y,w,h,1.4,"#9daba4","#88958f",.65);
    box(c,x+1,y+1,w-2,h-2,theme?"#dfc2a1":"#d7e4d8");
    c.save(); c.beginPath();c.rect(x+1,y+1,w-2,h-2);c.clip();
    if(theme) {
      box(c,x+2,y+2,w-4,h*.57,"#dea991");
      oval(c,x+w*.56,y+h*.28,w*.24,w*.24,"#eacc9b");
      c.fillStyle="#647774";c.beginPath();c.moveTo(x,y+h*.6);c.lineTo(x+w*.46,y+h*.3);c.lineTo(x+w,y+h*.57);c.closePath();c.fill();
      words(c,"한강의 하루",x+3,y+h*.77,w*.17,"#4a5e59",800);
      words(c,"HANGANG PARK",x+3,y+h*.89,w*.075,"#796a5c");
    } else {
      box(c,x+2,y+2,w-4,h*.55,"#6d9891");
      oval(c,x+w*.67,y+h*.19,w*.16,w*.16,"#ecd6a9");
      for(let i=0;i<4;i++){
        c.beginPath();c.moveTo(x-1,y+h*(.47+i*.06));c.bezierCurveTo(x+w*.3,y+h*(.17+i*.07),x+w*.72,y+h*(.62-i*.025),x+w+2,y+h*(.29+i*.075));
        c.lineTo(x+w+2,y+h*.62);c.lineTo(x-1,y+h*.62);c.fillStyle=["#9ab6a4","#7a9e91","#628a81","#416c65"][i];c.fill();
      }
      words(c,"서울 산책",x+3,y+h*.80,w*.18,"#365953",850);
      words(c,"WALK SEOUL",x+3,y+h*.91,w*.08,"#758276");
    }
    c.restore();
  }
  function route(c,x,y,w) {
    rounded(c,x,y,w,11,1,"#e8ecde","#9caca0",.55);
    words(c,"2",x+2,y+5,4,"#308367",800);
    box(c,x+8,y+5,w-13,1.0,"#43896b");
    for(let i=0;i<12;i++){
      const sx=x+9+i*(w-17)/11;oval(c,sx,y+5.5,1.25,1.25,"#42886c");oval(c,sx,y+5.5,.62,.62,"#f3efe3");
      box(c,sx-1.6,y+(i%2?8:1.7),3.4,.6,"#839086");
    }
  }
  function wallPlate() {
    return texture("wall",BAY,ROOF,c=>{
      box(c,0,0,BAY,ROOF,gradient(c,0,0,0,ROOF,[[0,"#837865"],[.08,"#b3a690"],[.22,"#ded4bf"],[.41,"#ece1cc"],[.64,"#dad1bf"],[.81,"#b1aa98"],[1,"#7c7f73"]]));
      for(const x of [6,69,277,310,531,558,773]) {
        box(c,x,0,31,ROOF,gradient(c,x,0,x+31,0,[[0,"#65584824"],[.20,"#af9c8316"],[.59,"#fff5d819"],[1,"#fff3d300"]]));
      }
      rubbedSurface(c,"enamel",0,0,BAY,ROOF,.49,.55);
      for(let i=0;i<52;i++){
        const x=noise(i+731)*BAY, y=5+noise(i+756)*188;
        const sx=.5+noise(i+927)*2.2,sy=.16+noise(i+828)*.75;
        oval(c,x+.15,y+.24,sx,sy,"#fff2cb91");oval(c,x,y,sx,sy,"#a58d705d");
      }
      bevel(c,-2,-3,BAY+4,10,2,[[0,"#a49c8c"],[.41,"#e8dec8"],[.72,"#c3b5a0"],[1,"#685e50"]]);
      box(c,0,20,BAY,3.1,"#337c58");box(c,0,23.2,BAY,.7,"#95aa7f");
      for(const x of [3,67,273,308,529,558,770,835]){
        box(c,x,26,.9,168,"#a49883");box(c,x+1,26,.7,167,"#f5e9d1");
        for(const y of [31,147,175])screw(c,x+3.1,y,.72);
      }
      for(const x of [64,555]) {
        bevel(c,x-5.2,39.5,228,93,8.7,[[0,"#796c5c"],[.13,"#c3b399"],[.39,"#e6d8c1"],[.76,"#a4947e"],[1,"#f5e7ce"]],"#ae9e88",.58);
        bevel(c,x-2.7,41.8,223,88.4,7.2,[[0,"#4b423b"],[.29,"#6d655b"],[.75,"#373b36"],[1,"#928776"]],"#716956",.68);
        rounded(c,x+.1,44.8,218,82.4,4.9,"#3c403c");
        c.save();c.beginPath();c.roundRect(x+2,46.4,214,78,3);c.clip();c.clearRect(x,44,220,84);
        for(const delta of [4,10,136]) {
          c.fillStyle=delta===10?"#f3f0d320":"#f8f4d934";
          c.beginPath();c.moveTo(x+delta+21,45);c.lineTo(x+delta+29,45);c.lineTo(x+delta-10,126);c.lineTo(x+delta-18,126);c.closePath();c.fill();
        }
        box(c,x+104.2,44,4.0,83,gradient(c,x+104,0,x+108.3,0,[[0,"#363735"],[.22,"#716c61"],[.49,"#eddfca"],[.64,"#bca88d"],[1,"#5d5850"]]));
        box(c,x+2,115,214,2.8,gradient(c,0,115,0,118,[[0,"#c7bba6"],[.4,"#fff0d4"],[.67,"#8d8172"],[1,"#4f4d4d"]]));
        box(c,x+2,46.3,214,4.2,gradient(c,0,46,0,50.8,[[0,"#4a3c354f"],[1,"#453c3400"]]));
        c.restore();
        route(c,x+20,27,80);
      }
      for (const x of [18,789]) poster(c,x,53,32,49,x>100);
      for(const cx of [297,541]){
        oval(c,cx,68,8.2,8.4,"#28623e");oval(c,cx,68,6.7,6.9,"#e4d8bf");
        c.save();c.textAlign="center";words(c,"2",cx,72.6,12.9,"#326844",850);c.restore();
        box(c,cx-9.5,80.3,19,3.5,"#529269");
      }
      box(c,0,180,BAY,2,"#9d9784");box(c,0,200,BAY,10,"#72756a");
      bevel(c,310,24,218,184,5,[[0,"#8c7a64"],[.21,"#dfd0b6"],[.64,"#b3a795"],[1,"#6d6e63"]],"#9c917c",1.2);
      bevel(c,317,28,204,177,4,[[0,"#665b50"],[.54,"#514f48"],[1,"#8c8979"]]);
      c.clearRect(320,31,198,171);
      bevel(c,333,5,172,16,3,[[0,"#7d7565"],[.28,"#e0d0b5"],[.75,"#8f8a76"],[1,"#5f6559"]],"#a49880",.7);
      rounded(c,335,6.5,168,13,2,"#283a30");
      words(c,"②  서울교통공사",341,16.6,7.3,"#ccdbad",650);
      words(c,"SEOUL METRO",426,16.3,5.8,"#c6cfa7",550);
      for(const x of [315,510]) for(let j=0;j<4;j++)box(c,x,8+j*1.7,10,.65,"#8a9b91");
      box(c,321,202,197,3,"#7d8980");for(let x=322;x<518;x+=5)box(c,x,202,.6,3,"#c1c7b7");
      // Fine, low-contrast manufacture marks keep the large panels from looking flat.
      for(let i=0;i<560;i++){const x=noise(i*3+13)*840,y=noise(i*3+14)*210;
        if ((x>60&&x<286 || x>551&&x<777) && y>41&&y<132 || x>312&&x<525&&y>23) continue;
        box(c,x,y,.45+.55*noise(i),.45,i%3?"#fff9e31a":"#50655c12");}
    });
  }

  function doorPlate(side) {
    return texture("door"+side,100,174,c=>{
      box(c,0,0,100,174,gradient(c,0,0,88,151,[[0,"#a69a85"],[.21,"#dfd3bc"],[.42,"#eee2ce"],[.67,"#c7bdac"],[1,"#a29e91"]]));
      rubbedSurface(c,"enamel",0,0,100,174,.41,.57);
      box(c,0,97.7,100,3.8,"#527f5c");box(c,0,101.5,100,.55,"#e8d7b4");
      box(c,side?0:98,0,2,174,"#474a40");box(c,side?2:96,0,1,174,"#f3e7d0");
      bevel(c,9.3,12.4,81.4,84.3,7.6,[[0,"#776853"],[.16,"#a4967e"],[.43,"#cdc0a8"],[1,"#eae0ca"]],"#938773",1);
      bevel(c,12,15,76,79.5,5.4,[[0,"#403e37"],[.3,"#665f55"],[.83,"#4a4c44"],[1,"#a09481"]]);
      c.save();c.beginPath();c.roundRect(14.5,17,71,75,3);c.clip();c.clearRect(14,16,73,77);
      c.fillStyle="#d3e2d638";c.beginPath();c.moveTo(43,16);c.lineTo(55,16);c.lineTo(20,94);c.lineTo(9,94);c.closePath();c.fill();
      box(c,13,50,76,1.5,"#d8cdb7a8");c.restore();
      const xx=side?15:21;
      rounded(c,xx,106,64,10,1.2,"#e8e8db","#a9b3a8",.55);
      words(c,"출입문에 기대지 마세요",xx+3,112.6,4.5,"#65746a",650);
      for(const x of [4.5,94.5])for(const y of [8,144,164])screw(c,x,y,.7);
      box(c,3,151,94,.9,"#c0b6a3");box(c,0,171,100,3,"#777b6c");
    });
  }

  function cushion(part,variant) {
    return texture("woven"+part+variant,132,66,c=>{
      const back=part==="back", front=part==="front";
      const colors=back?[[0,"#426c61"],[.055,"#b1c4a4"],[.12,"#81a99b"],[.40,"#608f84"],[.8,"#517f77"],[1,"#365d55"]]:
        front?[[0,"#9eb199"],[.19,"#6f9a89"],[.61,"#547f70"],[1,"#3a6258"]]:
        [[0,"#42685e"],[.14,"#709789"],[.37,"#9fb5a0"],[.78,"#9bb8a0"],[.95,"#b1bfa1"],[1,"#839b84"]];
      box(c,0,0,132,66,gradient(c,0,0,0,66,colors));
      rubbedSurface(c,"seat",0,0,132,66,variant%2?.64:.55,.85);
      box(c,0,0,132,66,gradient(c,0,0,132,5,[[0,"#304c4569"],[.05,"#25493600"],[.45,"#bdd9bf14"],[.92,"#193d3700"],[1,"#29473e70"]]));
      for(let i=0;i<280;i++){
        const x=noise(i*3+variant*43)*132, y=noise(i*3+1)*66, s=noise(i*3+2);
        line(c,x,y,x+s*1.2,y+.35,s>.46?"#d4d4ad61":"#36534751",.22+s*.27);
      }
      if(!front){
        for(const xx of [4.6,127.4]){
          line(c,xx,4,xx,63,"#335d5366",1.1);
          for(let y=7;y<62;y+=4.8)line(c,xx-.45,y,xx-.45,y+2.55,"#cdca9e9c",.63);
        }
        const yy=back?6:61.5;
        line(c,4.6,yy+1,127.4,yy+1,"#375f5554",.95);
        for(let x=6;x<127;x+=5.7)line(c,x,yy,x+3.2,yy+.13,"#d6d1a4b0",.66);
      }
    },1.25);
  }
  // Map each textured cushion between its actual back and front edges.
  function panel(c,v,im,x1,x2,zTop,hTop,zBottom,hBottom) {
    const left=project(v,x1,zTop,hTop),right=project(v,x2,zTop,hTop);
    if(Math.min(left.y,right.y)>H+6)return;
    let p=left;
    const n=4, sw=im.width/n;
    const corners=[p,right,project(v,x2,zBottom,hBottom),project(v,x1,zBottom,hBottom)];
    if(corners.every(pt=>pt.x< -6)||corners.every(pt=>pt.x>W+6)||corners.every(pt=>pt.y< -6))return;
    c.save();
    c.beginPath();corners.forEach((pt,i)=>i?c.lineTo(pt.x,pt.y):c.moveTo(pt.x,pt.y));c.closePath();c.clip();
    for(let i=0;i<n;i++){
      const x=x1+(x2-x1)*i/n, q=project(v,x1+(x2-x1)*(i+1)/n,zTop,hTop);
      const r=project(v,x,zBottom,hBottom);
      c.save();c.transform((q.x-p.x)/sw,(q.y-p.y)/sw,(r.x-p.x)/im.height,(r.y-p.y)/im.height,p.x,p.y);
      c.drawImage(im,i*sw,0,sw,im.height,0,0,sw+4,im.height);c.restore();p=q;
    }
    c.restore();
  }

  function floorMaterial() {
    return texture("linoleum",144,72,c=>{
      // Granules are part of each sheet of linoleum and travel with the floor.
      for(let i=0;i<3400;i++){
        const x=noise(i*4)*144,y=noise(i*4+1)*72,r=noise(i*4+2),l=noise(i*4+3);
        oval(c,x,y,.10+.54*r,.10+.33*l,r>.49?"#ede2c644":"#38393948");
      }
      for(let i=0;i<4;i++) {
        const x=noise(i+65)*144,y=noise(i+129)*72;
        line(c,x,y,x+3+i,y+.8,"#dacdb523",.38);
      }
    },1.5);
  }
  function benchShadow() {
    return texture("under bench",128,48,c=>{
      const g=c.createLinearGradient(0,0,0,48);
      for(const [y,a] of [[0,.48],[.34,.41],[.60,.25],[.83,.095],[1,0]])
        g.addColorStop(y,`rgba(43,45,39,${a})`);
      box(c,0,0,128,48,g);
      c.globalCompositeOperation="destination-in";
      box(c,0,0,128,48,gradient(c,0,0,128,0,[[0,"#0000"],[.07,"#000"],[.93,"#000"],[1,"#0000"]]));
    },1);
  }
  function bench(c,v,offset,start) {
    const x=offset+start, end=x+202;
    // Visible under-seat heating grille and cast steel support.
    strip(c,v,[[x+5,-32,44],[end-5,-32,44],[end-5,-32,12],[x+5,-32,12]],"#777c6d","#676a5c",1);
    for(let h=18;h<35;h+=3) {
      wire(c,v,[x+14,-31,h],[end-14,-31,h],"#484e46",1);
      wire(c,v,[x+14,-31,h-.85],[end-14,-31,h-.85],"#a9aa97",.5);
    }
    for(const xx of [x+12,end-16])strip(c,v,[[xx,-19,23],[xx+8,-19,23],[xx+8,-18,1],[xx,-18,1]],"#5b6458");
    rail(c,v,[x-1,-39,91],[end+1,-39,91],2.3);
    for(let i=0;i<3;i++) {
      const a=x+i*67, b=a+66;
      panel(c,v,cushion("back",i),a,b,-40,90,-33,55);
      panel(c,v,cushion("top",i),a,b,-32,55,-4,44);
      panel(c,v,cushion("front",i),a,b,-4,44,-4,38);
      wire(c,v,[a+.4,-4,38],[b-.3,-4,38],"#344d43",.8);
    }
    for(const xx of [x-2,end+1]) {
      rail(c,v,[xx,-35,63],[xx,-4,52],2.8);
      rail(c,v,[xx,-4,52],[xx,-4,35],2.8);
    }
  }

  let shellImage, shellKey, previousShellKey;
  function carriage(c,v,state) {
    const evening=state.leg==="pm";
    box(c,0,0,W,H,gradient(c,0,0,0,H,[[0,"#918778"],[.23,"#ddd2b8"],[.61,"#939a8b"],[1,"#b3aa96"]]));
    // Move scenery on a deeper plane so that both the train and the viewer have parallax.
    const skyline=city(evening);
    const scroll=(state.doorsOpen?state.stopIndex*50:state.progress*175)%640;
    for(let k=-4;k<=4;k++) mural(c,v,skyline,k*640-scroll,640,-161,223,-62,40);
    const rising=state.doorsOpen&&state.seats.find(s=>s.action==="rise");
    const opening=state.doorsOpen?(rising?clamp(rising.actionTime/.68,0,1):1):0;
    const key=[v.x,v.z,v.sin,v.eye,evening,state.doorsOpen,opening,materialCount].join("/");
    if(key===shellKey){c.drawImage(shellImage,0,0);return;}
    // The landscape and people move independently of the carriage. Keep its projected
    // set while the viewpoint is still, and draw straight through when the player walks.
    const output=c, keep=key===previousShellKey;
    previousShellKey=key;
    if(keep){
      if(!shellImage){shellImage=document.createElement("canvas");shellImage.width=W;shellImage.height=H;}
      c=shellImage.getContext("2d");c.clearRect(0,0,W,H);
    }
    const bays=[];
    for(let k=-2;k<=2;k++) {
      const x=k*BAY;
      if(project(v,x+BAY,WALL).x<0||project(v,x,WALL).x>W)continue;
      bays.push(x);
    }
    // A floor plane with seams converging on the longitudinal and transverse vanishing points.
    strip(c,v,[[-3200,WALL,0],[3500,WALL,0],[3500,310,0],[-3200,310,0]],gradient(c,0,250,0,H,[[0,"#686e65"],[.5,"#8b8c7d"],[.78,"#aaa794"],[1,"#a09d8c"]]));
    for(let x=-700;x<1700;x+=100)for(let z=WALL;z<210;z+=37){
      panel(c,v,floorMaterial(),x,x+100,z,0,z+37,0);
    }
    for(let x=-850;x<1900;x+=78) {
      wire(c,v,[x,WALL,0],[x,282,0],"#66695c80",.43);
      wire(c,v,[x+.8,WALL,0],[x+.8,282,0],"#dcd5bc56",.36);
    }
    for(let z=12;z<=246;z+=53) wire(c,v,[-1000,z,0],[2000,z,0],"#6869515e",.48);
    for(const x of bays) {
      for(const start of [83,557])panel(c,v,benchShadow(),x+start-12,x+start+214,-41,.04,31,.04);
      for(const wx of [x+83,x+185,x+562,x+680]){
        strip(c,v,[[wx,-18,.1],[wx+48,-18,.1],[wx+12,128,.1],[wx-40,128,.1]],evening?"#d5b0a01b":"#ffdfa733");
      }
      // Sliding leaves are clipped to the recessed opening.
      c.save();const cut=[[x+319,WALL,ROOF-29],[x+519,WALL,ROOF-29],[x+519,WALL,4],[x+319,WALL,4]].map(a=>project(v,...a));
      c.beginPath();cut.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();
      if(state.doorsOpen) {
        strip(c,v,[[x+305,-84,161],[x+540,-84,161],[x+540,-84,0],[x+305,-84,0]],"#afbaaa");
        for(let i=0;i<3;i++) {
          const xx=x+321+i*71;
          strip(c,v,[[xx,-83,137],[xx+61,-83,137],[xx+61,-83,28],[xx,-83,28]],"#78928a","#80988b",1.2);
          wire(c,v,[xx,-83,96],[xx+61,-83,96],"#ced3b6",3);
        }
      }
      mural(c,v,doorPlate(0),x+319-opening*78,100,WALL-1,180,6,18);
      mural(c,v,doorPlate(1),x+419+opening*78,100,WALL-1,180,6,18);
      c.restore();
      mural(c,v,wallPlate(),x,BAY,WALL,ROOF,0,19);
      bench(c,v,x,83);bench(c,v,x,557);
    }
    // Ceiling coving curves into the wall, with long fitted light diffusers parallel to the track.
    strip(c,v,[[-2500,WALL,ROOF],[2900,WALL,ROOF],[2900,245,ROOF],[-2500,245,ROOF]],gradient(c,0,0,0,125,[[0,"#b1a994"],[.36,"#dbd0b9"],[.72,"#eee0c6"],[1,"#a4a392"]]));
    for(const z of [-32,-19,2,61,106]) {
      wire(c,v,[-1700,z,ROOF-.5],[2100,z,ROOF-.5],z===2?"#908b77":"#9e9987",z===2?4:.78);
      wire(c,v,[-1700,z+.8,ROOF-.5],[2100,z+.8,ROOF-.5],z===2?"#fff2d1":"#e4d9bf",z===2?2.5:.65);
    }
    for(const x of bays){
      for(const xx of [x+42,x+257,x+481,x+702]) {
        strip(c,v,[[xx,-20,209],[xx+132,-20,209],[xx+132,-4,209],[xx,-4,209]],"#82988c");
        strip(c,v,[[xx+2,-18,208.6],[xx+130,-18,208.6],[xx+130,-6,208.6],[xx+2,-6,208.6]],"#f4efd5");
      }
    }
    if(keep){shellKey=key;output.drawImage(shellImage,0,0);}
  }


  function steel() {
    return texture("polished steel",30,128,c=>{
      box(c,0,0,30,128,gradient(c,0,0,30,0,[[0,"#51483e"],[.08,"#b0a58d"],[.18,"#eee3c9"],[.27,"#716758"],[.36,"#b1b2a9"],[.47,"#fff2d7"],[.59,"#bcaaa3"],[.69,"#777080"],[.81,"#525359"],[.91,"#a08e79"],[1,"#514c43"]]));
      const sample=window.ClaySetMaterials?.chrome;
      if(sample){c.globalAlpha=.71;c.drawImage(sample,0,0,30,128);c.globalAlpha=1;}
      for(let i=0;i<45;i++){
        const x=noise(i+347)*30,y=noise(i+934)*128;
        line(c,x,y,x+.25,y+noise(i+1)*4,i%3?"#fff8e12b":"#3c373a29",.32);
      }
    },1);
  }
  function metal(c,x1,y1,x2,y2,width,endWidth=width) {
    const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);
    if(l<.1)return;
    const nx=-dy/l,ny=dx/l;
    const edge=(f,side)=>{
      const radius=(width+(endWidth-width)*f)*.5*side;
      return {x:x1+dx*f+nx*radius,y:y1+dy*f+ny*radius};
    };
    const corners=[edge(0,-1),edge(1,-1),edge(1,1),edge(0,1)];
    polygon(c,corners,"#777162");
    c.save();c.clip();
    const im=steel(),n=Math.max(1,Math.min(7,Math.ceil(Math.abs(endWidth-width)/2)));
    for(let i=0;i<n;i++){
      const f=i/n, g=(i+1)/n, p=edge(f,-1), q=edge(g,-1);
      const across=Math.max(width+(endWidth-width)*f,width+(endWidth-width)*g)+.4;
      const sh=im.height/n;
      c.save();c.transform(nx*across/im.width,ny*across/im.width,(q.x-p.x)/sh,(q.y-p.y)/sh,p.x,p.y);
      c.drawImage(im,0,i*sh,im.width,sh,0,0,im.width,sh+.25);c.restore();
    }
    c.restore();
  }
  function rail(c,v,a,b,width) {
    const ends=clippedLine(v,a,b);if(!ends)return;
    const [p,q]=ends;
    metal(c,p.x,p.y,q.x,q.y,width*p.k,width*q.k);
  }
  function enamelLoop(variant) {
    return texture("green grip"+variant,26,34,c=>{
      // Shade a round enamel tube along its bent centerline in object space.
      const path=[[13,8.4],[11.8,10.3],[6.2,21.6],[5.3,23.5],[5.35,24.7],[6.0,25.6],[7.4,26.15],
        [18.6,26.3],[20,25.9],[20.8,25],[20.95,23.8],[20.45,22.5],[14.55,10.6],[13,8.4]];
      const raster=document.createElement("canvas"),ratio=4;
      raster.width=26*ratio;raster.height=34*ratio;
      const rc=raster.getContext("2d"), bitmap=rc.createImageData(raster.width,raster.height);
      const chips=Array.from({length:32},(_,i)=>{
        const j=Math.floor(noise(i+variant*51)*12),p=path[j],q=path[j+1],u=noise(i+843);
        return [p[0]+(q[0]-p[0])*u+(noise(i+49)*2-1)*1.45,p[1]+(q[1]-p[1])*u+(noise(i+69)*2-1)*1.4,.10+noise(i+21)*.28];
      });
      for(let y=6*ratio;y<30*ratio;y++)for(let x=2*ratio;x<24*ratio;x++){
        const xx=(x+.5)/ratio,yy=(y+.5)/ratio;
        let distance=Infinity,nx=0,ny=0;
        for(let j=1;j<path.length;j++){
          const a=path[j-1],b=path[j],dx=b[0]-a[0],dy=b[1]-a[1];
          const u=clamp(((xx-a[0])*dx+(yy-a[1])*dy)/(dx*dx+dy*dy),0,1);
          const ex=xx-(a[0]+u*dx),ey=yy-(a[1]+u*dy),dd=ex*ex+ey*ey;
          if(dd<distance){distance=dd;nx=ex;ny=ey;}
        }
        const grain=noise(x*41+y*319+variant)-.5;
        const r=1.96+.31*clamp((yy-20)/5,0,1)+Math.sin(yy*.84+variant)*.065+grain*.09;
        const d=Math.sqrt(distance),alpha=clamp((r-d)*ratio+.5,0,1);
        if(!alpha)continue;
        nx/=r;ny/=r;
        const nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
        const diffuse=.52+.64*Math.max(0,-.51*nx-.62*ny+.58*nz);
        const spec=Math.pow(Math.max(0,-.30*nx-.37*ny+.878*nz),16)*38;
        let color=[63,148+variant*2,102];
        if(chips.some(([cx,cy,cr])=>Math.abs(xx-cx)<cr&&Math.abs(yy-cy)<cr*.64))color=[141,128,94];
        const idx=(y*raster.width+x)*4;
        color.forEach((v,i)=>{bitmap.data[idx+i]=v*diffuse+spec+grain*8;});
        bitmap.data[idx+3]=Math.round(alpha*255);
      }
      rc.putImageData(bitmap,0,0);c.drawImage(raster,0,0,26,34);
      bevel(c,10.65,.25,4.7,9.4,1.4,[[0,"#514333"],[.15,"#c29359"],[.42,"#8d6940"],[.65,"#b29e77"],[1,"#55594c"]],"#554c3b",.4);
      box(c,11.35,.9,.75,6.9,"#d7c59a");
      for(let y=1.6;y<6.9;y+=1.1)line(c,10.85,y,15.15,y+.3,"#634d3899",.43);
      bevel(c,10.5,7,5.1,4.6,1.05,[[0,"#8eae8e"],[.28,"#67997b"],[.7,"#5d7f65"],[1,"#375742"]]);
      screw(c,13.05,8.9,.81);
    },3.5);
  }
  function straps(c,v,t) {
    for(let x=-820;x<=1690;x+=120) {
      if(project(v,x,4,180).x< -50||project(v,x,4,180).x>W+50) continue;
      rail(c,v,[x,5,191],[x,-8,ROOF-1],2.0);
    }
    rail(c,v,[-1100,5,191],[1900,5,191],3.1);
    rail(c,v,[-850,142,194],[1500,142,194],3.6);
    for (let x=-770;x<1650;x+=57){
      const p=project(v,x,5,191);
      if(p.x< -30||p.x>W+30)continue;
      c.save(); c.translate(p.x,p.y); c.scale(p.k,p.k);
      c.rotate(.013*Math.sin(x*.17)+.023*Math.sin(t*1.65+x*.026));
      c.drawImage(enamelLoop(Math.abs(x)%3),-13,-1.55,26,34);c.restore();
    }
  }
  const extraRiders = [
    // Riders beyond the ends of the playable bay, continuing into adjacent cars.
    [-259,-5,1,"front"],[-203,5,8,"profile"],[-137,-14,2,"front"],[-91,4,6,"back"],
    [-29,7,7,"profile"],[24,-11,0,"front"],[47,3,12,"profile"],
    [789,-9,6,"front"],[821,8,1,"profile"],[858,1,8,"back"],[897,-9,5,"front"],
    [929,11,10,"profile"],[963,-14,3,"front"],[1002,18,9,"back"],[1070,-10,12,"profile"],
    // People gathered on the far door threshold, behind the navigable aisle.
    [291,-16,4,"profile"],[314,26,6,"back"],[340,-3,8,"profile"],[369,-15,5,"front"],
    [407,22,3,"back"],[439,-14,10,"profile"],[465,1,9,"front"],[496,21,0,"back"],[535,-14,7,"profile"],
    // Close shoulders belong to passengers by the opposite bench, beyond the walkable floor.
    [-141,210,8,"back"],[282,211,5,"back"],[421,211,1,"back"],[782,205,4,"back"],[1020,204,11,"back"],
  ];
  function castHeight(id) {return 157+((Number(id)*7+4)%15);}
  function people(v,state) {
    const actors=[];
    function add(id,x,z,opts) {
      const p=project(v,x,z,0), h=p.k*castHeight(id);
      if(p.x+h*.29<0||p.x-h*.29>W||p.y<0||p.y-h>H) return;
      actors.push({id,x:p.x,y:p.y,height:h,d:p.d,worldX:x,worldZ:z,doorSide:x<420?1:-1,view:"front",action:"idle",actionTime:0,...opts});
    }
    for(const [x,z,id,view] of extraRiders) add((id+state.day-1)%13,x,z,{view,backpack:x===282});
    for (let index=0;index<state.seats.length;index++) {
      const seat=state.seats[index];
      if(index===state.seatedIndex&&v.seated)continue;
      add(seat.person,seat.x,0,{index,seated:true,action:seat.action,actionTime:seat.actionTime});
    }
    for(const rider of state.riders) {
      const z=(rider.y-182)*1.46;
      const departing=rider.kind==="leaving";
      add(rider.person,rider.x-z*.36,z,{
        view:departing?"profile":rider.kind==="rival"?"profile":rider.x<460?"back":"profile",
        doorSide:departing?(rider.x<420?1:-1):rider.x<420?-1:1,
        walking:departing || rider.kind==="rival" && state.doorsOpen && rider.y<251 && rider.y>206,
      });
    }
    return actors.sort((a,b)=>b.d-a.d);
  }
  function poles(v) {
    const list=[];
    for(const x of [-31,72,286,550,772,885]) {
      const p=project(v,x,15,0), q=project(v,x,15,ROOF-2);
      if(p.x>=-12&&p.x<=W+12) list.push({p,q,d:p.d,radius:1.72*p.k});
    }
    return list;
  }
  function standingPole(c,pole) {
    const {p,q,radius}=pole;
    metal(c,p.x,p.y,q.x,q.y,radius*2);
    oval(c,p.x,p.y+.35*p.k,3.20*p.k,.86*p.k,"#555c51");
    oval(c,p.x,p.y,3.05*p.k,.64*p.k,"#b0a88e");
    line(c,p.x-radius,p.y-7*p.k,p.x+radius,p.y-7*p.k,"#807b68",.56*p.k);
  }
  function heldLoop(c,v,a){
    if(a.view!=="back" || a.walking || a.id%3===2) return;
    const k=a.height/castHeight(a.id);
    const x=a.x+a.doorSide*a.height*.103, y=a.y-a.height*1.027;
    if(x< -20||x>W+20||y< -18||y>H)return;
    const z=a.worldZ>85?142:5;
    const top=project(v,a.worldX+a.doorSide*17,z,z===142?194:191);
    const length=Math.hypot(x-top.x,y-top.y), angle=Math.atan2(top.x-x,y-top.y);
    if(length<4*k)return;
    c.save();c.translate(top.x,top.y);c.rotate(angle);
    const scale=Math.min(k,length/26), lead=length-26*scale;
    if(lead>0)metal(c,0,0,0,lead,2.65*k);
    c.drawImage(enamelLoop(a.id%3),-13*scale,lead,26*scale,34*scale);
    c.restore();
  }
  function packFabric(c,path,base,pattern="canvas",scale=.16) {
    c.fillStyle=base;c.fill(path);
    c.save();c.clip(path);
    rubbedSurface(c,pattern,-38,-191,78,96,scale,.93);
    c.restore();
  }
  function seam(c,path,under,highlight,width,dash) {
    c.lineCap="round";c.lineJoin="round";c.lineWidth=width;c.strokeStyle=under;c.stroke(path);
    c.save();
    c.translate(-.16,-.18);c.lineWidth=width*.31;c.strokeStyle=highlight;
    if(dash)c.setLineDash(dash);
    c.stroke(path);c.restore();
  }
  function rucksack() {
    return texture("canvas rucksack",76,86,c=>{
      c.translate(38,191);
      const body=new Path2D("M-22 -173 C-18 -180 -6 -184 4 -182 C17 -182 23 -174 26 -159 Q31 -144 28 -127 Q28 -118 19 -116 Q-4 -111 -23 -120 C-28 -123 -29 -133 -28 -145 Q-28 -161 -22 -173Z");
      const pocket=new Path2D("M-23 -145 Q-6 -150 10 -148 Q19 -148 22 -145 Q25 -138 23 -128 Q22 -123 15 -122 Q-2 -120 -18 -125 Q-25 -128 -25 -135Z");
      const side=new Path2D("M17 -178 C24 -170 27 -154 28 -143 Q32 -121 20 -117 L12 -116 Q21 -124 20 -136 Q23 -161 17 -178Z");
      // The shoulder webbing curves against the coat before it enters the gussets.
      for(const side of [-1,1]){
        const strap=new Path2D("M"+(side*13)+" -174 Q"+(side*19)+" -188 "+(side*22)+" -180 Q"+(side*29)+" -171 "+(side*25)+" -153");
        seam(c,strap,"#393833","#b39a75",4.5,[.7,.85]);
        c.lineWidth=2.65;c.strokeStyle="#665b4c";c.stroke(strap);
        c.lineWidth=.46;c.strokeStyle="#9b8a6e";c.setLineDash([.5,.74]);c.stroke(strap);c.setLineDash([]);
      }
      // Felt-lined grab handle and the narrow leather reinforcement at the crown.
      const handle=new Path2D("M-9 -179 C-7 -190 7 -190 9 -178");
      seam(c,handle,"#3a332c","#b69c73",2.4,[.74,.7]);
      packFabric(c,body,gradient(c,-28,-172,22,-119,[[0,"#77827c"],[.21,"#65706b"],[.48,"#505b58"],[.73,"#414b4a"],[1,"#293334"]]));
      c.save();c.clip(body);
      const light=c.createRadialGradient(-10,-160,1,-10,-160,34);
      light.addColorStop(0,"#d4cbb42d");light.addColorStop(.7,"#e4dacb00");light.addColorStop(1,"#1620215c");
      box(c,-30,-185,62,80,light);c.restore();
      packFabric(c,side,gradient(c,16,-160,31,-159,[[0,"#293331"],[.54,"#4b5652"],[1,"#2a302f"]]));
      const mainZip=new Path2D("M-24 -157 C-22 -173 -16 -180 -5 -180 Q12 -184 18 -169 Q23 -158 22 -146");
      seam(c,mainZip,"#353630","#96836b",1.5);
      c.save();c.translate(.19,-.12);c.lineWidth=.47;c.setLineDash([.51,.48]);c.strokeStyle="#beac88";c.stroke(mainZip);c.restore();
      c.save();c.translate(0,.65);c.fillStyle="#1a232170";c.fill(pocket);c.restore();
      packFabric(c,pocket,gradient(c,-21,-149,12,-119,[[0,"#79847b"],[.23,"#616c64"],[.57,"#535f59"],[1,"#3c4945"]]));
      const pocketHem=new Path2D("M-23 -141 Q-25 -126 -16 -125 Q1 -120 17 -124 Q23 -125 23 -133");
      seam(c,pocketHem,"#405049","#b3a58b",.92,[1.2,1.05]);
      const zip=new Path2D("M-23 -143.7 Q-4 -146.5 14 -145.8 Q19 -145.8 21 -145");
      seam(c,zip,"#343b37","#cab58d",1.7,[.51,.57]);
      const tag=new Path2D("M-10 -140 Q-5 -141 1 -140 L1 -136.4 Q-4 -136 -10 -136.2Z");
      packFabric(c,tag,gradient(c,-8,-141,-4,-136,[[0,"#b99a6a"],[.4,"#9c7a52"],[1,"#755b43"]]),"wool",.09);
      seam(c,tag,"#715d46","#c3ac80",.42,[.55,.55]);
      const pull=new Path2D("M16 -145.8 Q18 -147 18.7 -145.1 L18.2 -143.4 Q17 -142.6 16.45 -143.4Z");
      c.fillStyle="#a79578";c.fill(pull);seam(c,pull,"#5f5647","#d5c19e",.46);
      const leather=new Path2D("M18 -144 Q19 -144 18.8 -143 L17.4 -138 Q17 -137.2 16.2 -138 L16.8 -143Z");
      c.fillStyle=gradient(c,16,-143,18.7,-138,[[0,"#c69e6e"],[.57,"#927352"],[1,"#664f3b"]]);c.fill(leather);
    },5);
  }
  function commuter(c,a,time) {
    window.Commuters.draw(c,{...a,time});
    if(a.backpack) {
      c.save();c.translate(a.x,a.y);c.scale(a.height/236,a.height/236);
      c.drawImage(rucksack(),-38,-191,76,86);c.restore();
    }
  }
  const handScale=.76, handRight=289;
  function playerHand(c,t) {
    const hand=window.ClaySetMaterials?.hand;
    if(!hand)return;
    c.save();c.translate(handRight,H+1+Math.sin(t*1.8)*.8);c.scale(-handScale,handScale);
    c.drawImage(hand,0,-hand.height);c.restore();
  }
  let gripMask;
  function behindGrip(x,y) {
    const hand=window.ClaySetMaterials?.hand;
    if(!hand)return false;
    const u=Math.floor((handRight-x)/handScale), vv=Math.floor(hand.height+(y-H-1)/handScale);
    if(u<0||vv<0||u>=hand.width||vv>=hand.height)return false;
    if(!gripMask){
      const im=document.createElement("canvas");im.width=hand.width;im.height=hand.height;
      const c=im.getContext("2d",{willReadFrequently:true});c.drawImage(hand,0,0);
      gripMask=c.getImageData(0,0,im.width,im.height).data;
    }
    return gripMask[(vv*hand.width+u)*4+3]>64;
  }
  function contactShadow(c,x,y,rx,ry,strength) {
    const shadow=texture("soft contact",100,30,g=>{
      g.translate(50,15);g.scale(50,15);
      const shade=g.createRadialGradient(0,0,0,0,0,1);
      shade.addColorStop(0,"#262a23c4");shade.addColorStop(.4,"#2f30278a");shade.addColorStop(.77,"#36322b36");shade.addColorStop(1,"#39362b00");
      box(g,-1,-1,2,2,shade);
    },1);
    c.save();c.globalAlpha=strength;c.drawImage(shadow,x-rx,y-ry,rx*2,ry*2);c.restore();
  }
  let materialCount=0;
  function refreshMaterials() {
    const count=Object.keys(window.ClaySetMaterials||{}).length;
    if(count!==materialCount){memo.clear();materialCount=count;}
  }

  function draw(canvas,state,time=0) {
    const c=canvas.getContext("2d"), v=camera(state);
    c.save();c.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);c.imageSmoothingEnabled=true;
    refreshMaterials();
    carriage(c,v,state);
    straps(c,v,time);
    const layers=[...people(v,state),...poles(v)].sort((a,b)=>b.d-a.d);
    for(const a of layers){
      if(a.id==null||a.y>H+45)continue;
      contactShadow(c,a.x+a.height*.028,a.y+1,a.height*(a.seated?.168:.138),a.height*.028,.63);
      contactShadow(c,a.x,a.y+.5,a.height*.085,a.height*.011,.65);
    }
    for(const a of layers){
      if(a.p) { standingPole(c,a);continue; }
      if(a.id==null)continue;
      heldLoop(c,v,a);
      commuter(c,a,time);
    }
    if(!v.seated)playerHand(c,time);
    c.restore();
  }

  const masks=new Map();
  let headMasksReady=false;
  function bodyPixel(a,x,y) {
    const u=(x-a.x)/a.height, v=(a.y-y)/a.height;
    if(Math.abs(u)>.34||v<-.025||v>1.10) return false;
    const mw=84,mh=140,unit=122,ox=mw/2,oy=134;
    const beat=a.action==="rise"?Math.min(4,Math.floor(a.actionTime*4)):Math.min(1,Math.floor(a.actionTime*2));
    const ready=!!window.ClayHeads?.ready;
    if(ready!==headMasksReady){masks.clear();headMasksReady=ready;}
    const key=[a.id,a.view,a.seated?1:0,a.doorSide,a.action,beat,a.backpack?1:0,ready].join("/");
    if(!masks.has(key)){
      const im=document.createElement("canvas");
      im.width=mw;im.height=mh;const ctx=im.getContext("2d",{willReadFrequently:true});
      commuter(ctx,{...a,x:ox,y:oy,height:unit,actionTime:a.action==="rise"?beat/4:beat?.95:.12},0);
      const data=ctx.getImageData(0,0,mw,mh).data, mask=new Uint8Array(mw*mh);
      for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3];
      masks.set(key,mask);
    }
    const px=Math.round(ox+u*unit),py=Math.round(oy-v*unit);
    return px>=0&&px<mw&&py>=0&&py<mh&&masks.get(key)[py*mw+px]>32;
  }
  function vacantHit(a,x,y) {
    return Math.abs(x-a.x)<a.height*.16 && y>a.y-a.height*.48 && y<a.y+a.height*.01;
  }
  function hit(layers,x,y,seated) {
    if(!seated&&behindGrip(x,y))return -2;
    for (let i=layers.length-1;i>=0;i--) {
      const a=layers[i];
      if(a.p){
        if(Math.abs(x-a.p.x)<a.radius+1 && y>=a.q.y && y<=a.p.y) return -2;
      } else if(a.id==null ? vacantHit(a,x,y) : bodyPixel(a,x,y)) return a.index??-2;
    }
    return -1;
  }
  function visibleLayers(v,s) {return [...people(v,s),...poles(v)].sort((a,b)=>b.d-a.d);}
  function pick(canvas,state,u,vv) {
    const empty={index:-1,goal:null};
    if(!Number.isFinite(u)||!Number.isFinite(vv)||u<0||u>1||vv<0||vv>1)return empty;
    const v=camera(state), x=u*W, y=vv*H, index=hit(visibleLayers(v,state),x,y,v.seated);
    if(index>=0) return {index,goal:null};
    if(index===-2) return empty;
    const foot=groundInverse(v,x,y);
    if(!foot||foot.y<193 || foot.y>353 || foot.x< -7||foot.x>850)return empty;
    return {index:-1,goal:{x:clamp(foot.x,32,808),y:clamp(foot.y,208,290)}};
  }
  function seatFrame(state,index) {
    const seat=state.seats[index];if(!seat)return null;
    const foot=project(camera(state),seat.x,0);
    return {x:foot.x/W,y:foot.y/H,height:castHeight(seat.person)*foot.k/H};
  }
  function seatPoint(state,index) {
    const v=camera(state), layers=visibleLayers(v,state), a=layers.find(o=>o.index===index);
    if(!a)return null;
    const ys=a.id==null?[.34,.23,.4,.15]:[.60,.48,.37,.26,.16,.07,.66,.51,.31,.57,.42,.21];
    for(const yy of ys)for(const xx of [0,-.065,.065,-.11,.11,-.15,.15,-.18,.18]){
      const x=a.x+xx*a.height,y=a.y-yy*a.height;
      if(x>4&&x<W-4&&y>4&&y<H-4&&hit(layers,x,y,v.seated)===index) return {x:x/W,y:y/H};
    }
    return null;
  }
  function floorPoint(state,x,y) {
    const p=ground(camera(state),x,y);return {x:p.x/W,y:p.y/H};
  }
  function observe(canvas,id,seat,time=0) {
    const c=canvas.getContext("2d"), w=canvas.width,h=canvas.height;
    c.save();c.setTransform(1,0,0,1,0,0);c.imageSmoothingEnabled=true;
    refreshMaterials();
    const progress=seat?.action==="rise"?clamp(seat.actionTime/1.05,0,1):0;
    const eased=progress*progress*(3-2*progress);
    const height=h*(1.22-.32*eased), foot=h*.945, contact=foot-h*1.22*.24;
    const backdrop=texture("observation "+w+"x"+h,w,h,g=>{
      box(g,0,0,w,h,gradient(g,0,0,w,h,[[0,"#b4a58c"],[.39,"#e2d5bf"],[.70,"#c2b9a5"],[1,"#938976"]]));
      rubbedSurface(g,"enamel",0,0,w,h,h/165,.55);
      g.save();g.beginPath();g.roundRect(-w*.08,-h*.17,w*1.16,h*.46,h*.052);g.clip();
      g.drawImage(city(false),0,0,400,145,-w*.02,-h*.10,w*1.13,h*.39);
      box(g,0,h*.22,w,h*.008,"#eee1ca");box(g,0,h*.228,w,h*.008,"#82786b");g.restore();
      box(g,0,h*.272,w,h*.032,gradient(g,0,h*.272,0,h*.304,[[0,"#514b43"],[.43,"#6d6559"],[.76,"#a29780"],[1,"#e7d8bd"]]));
      metal(g,0,h*.345,w,h*.345,h*.023);
      for(let i=0;i<4;i++){
        const xx=(i*.38-.08)*w,ww=w*.38-1.8;
        g.drawImage(cushion("back",i%3),xx,h*.352,ww,contact-h*.352);
        g.drawImage(cushion("top",i%3),xx,contact-h*.014,ww,h*.055);
        g.drawImage(cushion("front",i%3),xx,contact+h*.041,ww,h*.034);
      }
      box(g,0,contact+h*.075,w,h*.096,gradient(g,0,contact+h*.075,0,contact+h*.171,[[0,"#51574d"],[.3,"#8d9280"],[1,"#72776a"]]));
      for(let i=0;i<3;i++){
        box(g,0,contact+h*(.102+i*.019),w,h*.006,"#485049");
        box(g,0,contact+h*(.109+i*.019),w,h*.0025,"#abae97");
      }
      const floorY=contact+h*.171;
      box(g,0,floorY,w,h-floorY,gradient(g,0,floorY,w*.2,h,[[0,"#8d8b7c"],[.75,"#b2aa94"],[1,"#b8ad96"]]));
      g.drawImage(floorMaterial(),0,floorY,w,h-floorY);
    },1);
    c.drawImage(backdrop,0,0);
    if(id!=null){
      contactShadow(c,w*.51,foot+1,height*.165,height*.028,.68);
      contactShadow(c,w*.50,foot+1,height*.094,height*.012,.63);
      window.Commuters.draw(c,{id,x:w*.5,y:foot,height,seated:true,action:seat?.action||"idle",
        actionTime:seat?.actionTime||0,doorSide:(seat?.x??0)<420?1:-1,view:"front",time});
    }
    c.restore();
  }
  window.SubwayArt={draw,observe,pick,seatPoint,seatFrame,floorPoint,
    outfit:id=>window.Commuters.outfit(id),describe:(id,seat)=>window.Commuters.describe(id,seat)};
})();

