/* A rigid skin binds the sculpt and its painted surfaces to the same miniature armature. */
(() => {
  'use strict';
  const cast = [
    ['suit', 'part', '#465568', '#323b49', '#302923'],
    ['tote', 'bob', '#a85660', '#393b48', '#4f302b'],
    ['field', 'silver', '#77805b', '#454d53', '#9c9991'],
    ['hood', 'waves', '#3d4965', '#394455', '#292822'],
    ['scarf', 'bun', '#b27943', '#47404a', '#3e302b'],
    ['suit', 'crop', '#4f4a49', '#3b3737', '#302c29'],
    ['tote', 'long', '#819ba5', '#514d5d', '#3d302b'],
    ['scarf', 'waves', '#8b626d', '#494051', '#4e3831'],
    ['field', 'part', '#845e41', '#42444c', '#3c3029'],
    ['tote', 'cap', '#586a4c', '#54505a', '#352c24'],
    ['suit', 'silver', '#706d69', '#47444a', '#bbb0a1'],
    ['tote', 'long', '#ad654e', '#414a5b', '#422f29'],
    ['hood', 'crop', '#637a8f', '#404755', '#302927'],
    ['player', 'part', '#cf8a46', '#4b5864', '#49382d']
  ];
  const skin = ['#d9a075','#dda17c','#ca936a','#d4a079','#dea284','#ce9973','#e1b08e',
    '#d79a76','#c98c62','#dca47c','#d8a885','#d8a07d','#d29c74','#d59a71'];
  const proportions = [1.02,.97,.98,1.035,.985,1.036,.966,.995,1.014,.986,.973,.978,1.008,1.0];
  const TWOPI = 2*Math.PI;
  const clamp = (x,lo=0,hi=1) => Math.max(lo,Math.min(hi,x));
  const mix = (a,b,t) => a+(b-a)*t;
  const ease = n => {const t=clamp(n);return t*t*(3-2*t);};
  const engines = new WeakMap();
  // Origin of each piece in the neutral standing armature, measured in metres.
  const rig = [
    ['base',null,[0,0,0]],['hip','base',[0,.86,0]],['chest','hip',[0,.01,0]],
    ['head','chest',[0,.481,.008]],['prop','chest',[0,0,0]],['case','base',[0,0,0]]
  ];
  for (const side of ['L','R']) {
    for (const joint of ['upperArm','forearm','hand']) rig.push([joint+side,'chest',[0,0,0]]);
    for (const joint of ['thigh','calf','foot']) rig.push([joint+side,'base',[0,0,0]]);
  }

  function surfaceMap(T) {
    const tile=112, canvas=document.createElement('canvas');
    canvas.width=tile*3; canvas.height=tile*2;
    const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(canvas.width,canvas.height);
    let seed=74;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let row=0;row<2;row++)for(let col=0;col<3;col++) {
      const kind=row*3+col;
      for(let y=0;y<tile;y++)for(let x=0;x<tile;x++) {
        const noise=random()-.5, bx=x%8, by=y%10;
        const knitV=Math.abs(bx-3.5)-Math.abs(by-4.5)*.48;
        const cloth=(Math.sin(x*Math.PI*.85)*.65+Math.cos(y*Math.PI*.9))*.5;
        const swirls=Math.sin((x+.14*y)*.51+Math.sin(y*.115)*2.1);
        const luma=[
          239+cloth*7+noise*20,247+swirls*1.2+noise*10,
          229+Math.exp(-knitV*knitV*.6)*13+noise*19,
          237+Math.sin((x+y)*1.27)*5+noise*18,
          240+Math.sin(x*.31+Math.sin(y*.18))*2.5+noise*16,
          248+noise*4
        ][kind];
        const offset=4*((row*tile+y)*canvas.width+col*tile+x);
        pixels.data[offset]=pixels.data[offset+1]=pixels.data[offset+2]=Math.round(luma);
        pixels.data[offset+3]=255;
      }
    }
    ctx.putImageData(pixels,0,0);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.anisotropy=2;
    return map;
  }

  function resources(T) {
    if(engines.has(T)) return engines.get(T);
    const map=surfaceMap(T);
    const kit={
      ball:new T.SphereGeometry(1,12,9), dot:new T.SphereGeometry(1,8,6),
      box:new T.BoxGeometry(1,1,1), templates:new Map(),
      material:new T.MeshStandardMaterial({map,vertexColors:true,roughness:.89,metalness:0})
    };
    const source=window.ClayHeads?.atlasImage;
    if(source&&window.ClayHeads.atlasRects){
      const photo=new T.Texture(source);photo.colorSpace=T.SRGBColorSpace;photo.anisotropy=4;
      kit.photoMaterial=new T.MeshStandardMaterial({map:photo,vertexColors:true,roughness:.94,
        transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
      kit.photoMaterial.visible=false;
      const decoded=()=>{photo.needsUpdate=true;kit.photoMaterial.visible=true;};
      if(source.complete&&source.naturalWidth)decoded();else source.addEventListener('load',decoded,{once:true});
    }
    engines.set(T,kit);
    return kit;
  }

  function compiler(T,kit) {
    const positions=[], normals=[], uvs=[], colors=[], joints=[], weights=[], indices=[],photoIndices=[];
    const p=new T.Vector3(),n=new T.Vector3(),q=new T.Quaternion(),m=new T.Matrix4(),nm=new T.Matrix3();
    const color=new T.Color(), rotation=new T.Euler(), size=new T.Vector3(), origin=new T.Vector3();
    const jointIds=new Map(), origins=new Map();
    for(const [i,[name,parent,at]] of rig.entries()){
      const base=parent?origins.get(parent):[0,0,0];
      origins.set(name,at.map((v,k)=>v+base[k]));jointIds.set(name,i);
    }
    function shape(bone,geometry,tint,kind,at=[0,0,0],scale=[1,1,1],angles=[0,0,0]) {
      const b=origins.get(bone), skinId=jointIds.get(bone);
      origin.set(b[0]+at[0],b[1]+at[1],b[2]+at[2]); q.setFromEuler(rotation.set(...angles));
      m.compose(origin,q,size.set(...scale));nm.getNormalMatrix(m);color.set(tint);
      const {position,normal,uv}=geometry.attributes, first=positions.length/3;
      for(let i=0;i<position.count;i++){
        p.fromBufferAttribute(position,i).applyMatrix4(m);positions.push(p.x,p.y,p.z);
        n.fromBufferAttribute(normal,i).applyMatrix3(nm).normalize();normals.push(n.x,n.y,n.z);
        const u=uv?uv.getX(i):0, v=uv?uv.getY(i):0;
        if(kind===6)uvs.push(u,v);
        else uvs.push(((kind%3)+.012+u*.976)/3,1-(Math.floor(kind/3)+.988-v*.976)/2);
        colors.push(color.r,color.g,color.b,geometry.attributes.coverage?.getX(i)??1);
        joints.push(skinId,0,0,0);weights.push(1,0,0,0);
      }
      const ix=geometry.getIndex();
      const destination=kind===6?photoIndices:indices;
      for(let i=0;i<(ix?ix.count:position.count);i++)destination.push(first+(ix?ix.getX(i):i));
    }
    function ball(b,c,k,at,s,angles,small=false){shape(b,small?kit.dot:kit.ball,c,k,at,s,angles);}
    function box(b,c,k,at,s,angles){shape(b,kit.box,c,k,at,s,angles);}
    function tube(b,c,k,pts,radius,ends=1,sides=5) {
      const pts3=pts.map(a=>new T.Vector3(...a)),curve=new T.CatmullRomCurve3(pts3);
      const steps=Math.max(3,(pts.length-1)*2);
      const geom=new T.TubeGeometry(curve,steps,radius,sides,false);
      if(ends!==1){
        const pos=geom.attributes.position,center=new T.Vector3(),v=new T.Vector3();
        for(let j=0;j<=steps;j++){
          curve.getPointAt(j/steps,center);
          const ring=mix(ends,1,Math.pow(Math.sin(Math.PI*j/steps),.5));
          for(let i=0;i<=sides;i++){
            const index=j*(sides+1)+i;v.fromBufferAttribute(pos,index).sub(center).multiplyScalar(ring).add(center);
            pos.setXYZ(index,v.x,v.y,v.z);
          }
        }
      }
      shape(b,geom,c,k);
    }
    // Independent elliptical rings allow cutaway collars, tailored shoulders, heels and chins.
    // Rows contain [height, half width, half depth, front-back offset].
    function rings(b,c,k,rows,at=[0,0,0],sides=20) {
      const g=new T.BufferGeometry(), v=[], uv=[], ix=[];
      for(let j=0;j<rows.length;j++){
        const [y,rx,rz,cz=0]=rows[j];
        for(let i=0;i<=sides;i++){
          const a=TWOPI*i/sides;
          v.push(Math.sin(a)*rx,y,Math.cos(a)*rz+cz);uv.push(i/sides,j/(rows.length-1));
          if(j&&i){const h=j*(sides+1)+i;ix.push(h-sides-2,h-sides-1,h,h-sides-2,h,h-1);}
        }
      }
      for(const j of [0,rows.length-1]){
        const [y,rx,rz,cz=0]=rows[j],center=v.length/3;
        v.push(0,y,cz);uv.push(.5,.5);
        for(let i=0;i<=sides;i++){
          const a=TWOPI*i/sides;v.push(Math.sin(a)*rx,y,Math.cos(a)*rz+cz);uv.push(.5+.49*Math.sin(a),.5+.49*Math.cos(a));
          if(i)ix.push(center,center+i+(j?0:1),center+i+(j?1:0));
        }
      }
      g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();shape(b,g,c,k,at);
    }
    function patch(b,c,k,pts){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pts.flat(),3));
      const ix=[];for(let i=1;i<pts.length-1;i++)ix.push(0,i,i+1);
      const reverse=ix.slice().reverse();g.setIndex(ix.concat(reverse));g.clearGroups();
      // Double faces share front normals; the tiny applications remain legible on folded clothing.
      const n=[];for(const pt of pts)n.push(0,0,1);
      g.setAttribute('normal',new T.Float32BufferAttribute(n,3));shape(b,g,c,k);
    }
    function finish() {
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
      g.setAttribute('color',new T.Float32BufferAttribute(colors,4));
      g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));
      g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(indices.concat(photoIndices));
      g.addGroup(0,indices.length,0);
      if(photoIndices.length)g.addGroup(indices.length,photoIndices.length,1);
      return g;
    }
    return {shape,ball,box,tube,rings,patch,finish};
  }

  function tone(T,c,lightness,saturation=0) {
    return '#'+new T.Color(c).offsetHSL(0,saturation,lightness).getHexString();
  }
  function actionStage(action,t){
    switch(action){
      case 'check':return ease(t/1.12);
      case 'gather':return 1+ease(t/1.5);
      case 'ready':return 2+ease(t/1.45);
      case 'rise':return 3+ease(t/1.05);
      case 'settle':return 2*(1-ease(t/2));
      default:return 0;
    }
  }
  function sample(poses,stage){
    const a=Math.min(Math.floor(stage),poses.length-1),b=Math.min(a+1,poses.length-1);
    return poses[a].map((v,k)=>mix(v,poses[b][k],stage-a));
  }

  function portraitPatch(T,d,id,row,bone,nx,ny,vertex){
    const rects=window.ClayHeads.atlasRects,r=rects[id][row],source=window.ClayHeads.atlasImage;
    const aw=source.naturalWidth||(rects[1][0][0]-rects[0][0][0])*rects.length;
    const ah=source.naturalHeight||(rects[0][1][1]-rects[0][0][1])*rects[0].length;
    const g=new T.BufferGeometry(),positions=[],uvs=[],coverage=[],ix=[];
    for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
      const v=vertex(i/nx,j/ny);
      positions.push(v[0],v[1],v[2]);
      uvs.push((r[0]+v[3]*r[2])/aw,1-(r[1]+v[4]*r[3])/ah);coverage.push(v[5]);
      if(i&&j){const p=j*(nx+1)+i;ix.push(p-nx-2,p-nx-1,p,p-nx-2,p,p-1);}
    }
    g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
    g.setAttribute('coverage',new T.Float32BufferAttribute(coverage,1));g.setIndex(ix);g.computeVertexNormals();
    d.shape(bone,g,'#ffffff',6);
  }
  function interpRows(rows,y) {
    let i=0;while(i<rows.length-2&&y>rows[i+1][0])i++;
    const f=clamp((y-rows[i][0])/(rows[i+1][0]-rows[i][0]));
    return rows[i].slice(1).map((v,k)=>mix(v,rows[i+1][k+1],f));
  }
  const portraitLandmarks=[
    [.510,.552,.819,.390],[.530,.556,.822,.34],[.509,.553,.817,.391],
    [.512,.552,.813,.372],[.505,.623,.838,.383],[.506,.531,.800,.403],
    [.533,.524,.810,.355],[.496,.540,.810,.342],[.497,.578,.829,.395],
    [.501,.589,.832,.387],[.503,.569,.831,.390],[.506,.553,.823,.356],[.501,.552,.821,.383]
  ];
  function paintFace(T,d,id,rows){
    const [center,eye,mouth,half]=portraitLandmarks[id];
    const mapRows=[[.003,.959,.55],[.030,.909,.76],[.062,mouth,.94],
      [.105,mix(eye,mouth,.52),1],[.148,eye,1],[.175,eye-.12,1],[.217,eye-.23,.96],[.274,eye-.39,.75]];
    portraitPatch(T,d,id,0,'head',36,29,(u,v)=>{
      const y=mix(.003,.274,v),theta=(u-.5)*Math.PI*.91;
      const [rx,rz,cz]=interpRows(rows,y),[photoY,wide]=interpRows(mapRows,y);
      const x=Math.sin(theta)*(rx+.0025),front=Math.cos(theta);
      // Relief comes from the sculpt itself. The photographed clay supplies eyelid,
      // lip and felt-tip details at the same landmarks from each angle.
      const bump=(cx,cy,wx,wy)=>Math.exp(-Math.pow((x-cx)/wx,2)-Math.pow((y-cy)/wy,2));
      const relief=.033*bump(0,.103,.029,.019)+.023*bump(0,.132,.018,.041)
        +.007*(bump(.064,.103,.042,.023)+bump(-.064,.103,.042,.023))+.004*bump(0,.059,.041,.014);
      const z=(rz+.005+relief)*front+cz;
      const fade=ease((1-Math.abs(2*u-1))/.19)*ease(v/.065)*ease((1-v)/.095);
      return [x,y,z,center+Math.sin(theta)*half*wide,photoY,fade];
    });
  }
  function sculptHead(T,d,id,painted) {
    const [family,style,,,hair]=cast[id], flesh=skin[id], old=style==='silver';
    const blush=tone(T,flesh,-.037,.025),lip=tone(T,flesh,-.155,.08), highlights=tone(T,hair,.065,-.03);
    const bone='head', w=id%3===0?1.025:id%4===0?.953:1;
    const brows=old?'#68594e':tone(T,hair,.022);
    const rows=[[-.016,.018,.030,.011],[.003,.063,.081,.009],[.027,.093,.098,.008],
      [.066,.112*w,.11,.004],[.116,.127*w,.117,.002],[.172,.132*w,.12,0],[.218,.121*w,.112,-.003],
      [.254,.102*w,.099,-.004],[.283,.066,.074,-.006],[.30,.008,.017,-.009]];
    d.rings(bone,flesh,1,rows);
    if(painted)paintFace(T,d,id,rows);
    for(const s of [-1,1]){
      d.ball(bone,flesh,1,[s*.125*w,.118,.003],[.026,.041,.023],[0,0,-s*.12]);
      d.ball(bone,blush,1,[s*.139*w,.119,.015],[.011,.024,.011],nullRotation,true);
      if([1,4,6,7,11].includes(id))d.ball(bone,'#c7995d',4,[s*.133*w,.087,.017],[.007,.010,.006],nullRotation,true);
      if(painted)continue;
      d.ball(bone,flesh,1,[s*.068,.099,.094],[.047,.024,.020],[0,s*.40,s*.14]);
      const ex=s*.052, ez=.109, ey=.148+(id%3-1)*.002;
      d.ball(bone,'#e9d8ba',1,[ex,ey,ez],[.024,.0115,.009],[0,s*.25,s*.045]);
      d.ball(bone,old?'#4a3727':'#32251e',5,[ex-s*.001,ey-.0005,ez+.008],[.009,.0097,.0045],nullRotation,true);
      d.ball(bone,'#f2e2c1',5,[ex-.003,ey+.0035,ez+.012],[.0025,.0024,.0012],nullRotation,true);
      d.tube(bone,brows,2,[[ex-.026,ey+.019,ez+.001],[ex-.011,ey+.024+(s===1?.004:0),ez+.009],
        [ex+.009,ey+.025,ez+.008],[ex+.026,ey+.019-s*.002,ez-.003]],old?.0045:.0053,.4);
      d.tube(bone,'#6f4a35',1,[[ex-.022,ey+.001,ez+.003],[ex,ey+.008,ez+.009],[ex+.024,ey+.001,ez+.001]],.0023,.35);
      if(old){
        d.tube(bone,blush,1,[[ex-.021,ey-.016,ez-.001],[ex,ey-.021,ez+.005],[ex+.023,ey-.017,ez]],.0019,.22);
        d.tube(bone,blush,1,[[s*.061,.100,.113],[s*.066,.087,.108],[s*.074,.078,.099]],.0022,.3);
      }
    }
    if(!painted){d.ball(bone,flesh,1,[0,.123,.118],[.018,.036,.024],[-.18,0,0]);
    d.ball(bone,tone(T,flesh,-.018,.02),1,[0,.103,.137],[.025,.018,.022],nullRotation);
    d.tube(bone,lip,1,[[-.032,.066,.106],[-.017,.061,.115],[.001,.060,.116],[.019,.062,.114],[.033,.067,.104]],.0028,.38);
    d.ball(bone,blush,1,[0,.055,.106],[.019,.004,.006],nullRotation,true);}
    if(family==='field' || id===10){
      for(const s of [-1,1]){
        const pts=[];
        for(let j=0;j<=10;j++){const a=TWOPI*j/10;pts.push([s*.053+.036*Math.cos(a),.147+.029*Math.sin(a),.128+.005*Math.sin(a)]);}
        if(!painted)d.tube(bone,old?'#695136':'#44352a',4,pts,.0043,1,5);
        d.tube(bone,'#5b4432',4,[[s*.088,.153,.127],[s*.114,.153,.099],[s*.129,.141,.011]],.0035);
      }
      if(!painted)d.tube(bone,'#74543c',4,[[-.017,.149,.130],[0,.155,.139],[.017,.149,.130]],.0038);
    }

    const long=style==='bob'||style==='long', waves=style==='waves'||old;
    function edge(theta){
      const front=Math.cos(theta), side=Math.abs(Math.sin(theta));
      return 1.13+.87*(1-front)/2+.23*side+(long?.64*Math.pow(side,2.6)+.44*(1-front)/2:0)
        +.065*Math.sin(3*theta+id);
    }
    function strand(theta,f,lift=0){
      const sweep=(style==='part'||style==='silver'||style==='waves')?1.26:style==='bun'?.88:.53;
      const theta2=theta+sweep*(1-f)+.16*Math.sin(f*Math.PI)*Math.sin(theta+id);
      const phi=f*edge(theta), side=Math.abs(Math.sin(theta2)),wave=waves?.003*Math.sin(7*theta2+10*f):0;
      let y=.149+(.182+lift+wave)*Math.cos(phi);
      if(style==='long'&&f>.65)y-=.091*side*ease((f-.65)/.35)+.039*(1-Math.cos(theta2))*.5*ease((f-.65)/.35);
      return [Math.sin(theta2)*(.155*w+lift+wave)*Math.sin(phi)-.006*(1-f),
        y, Math.cos(theta2)*(.153+lift+wave)*Math.sin(phi)-.003];
    }
    const g=new T.BufferGeometry(), vv=[],uv=[],ix=[],nt=24,nf=8;
    for(let j=0;j<=nf;j++)for(let i=0;i<=nt;i++){
      vv.push(...strand(TWOPI*i/nt,j/nf));uv.push(i/nt,j/nf);
      if(j&&i){const p=j*(nt+1)+i;ix.push(p-nt-2,p-1,p,p-nt-2,p,p-nt-1);}
    }
    g.setAttribute('position',new T.Float32BufferAttribute(vv,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();d.shape(bone,g,hair,2);
    for(let i=0;i<(style==='cap'?15:24);i++){
      const theta=TWOPI*i/(style==='cap'?15:24), pts=[];
      for(let j=0;j<=5;j++){
        const f=.09+.91*j/5,at=strand(theta+.023*Math.sin(i*3.1+j),f,.002);
        pts.push(at);
      }
      const c=i%4===0?tone(T,hair,.033):i%3===0?tone(T,hair,-.015):tone(T,hair,.012);
      d.tube(bone,c,2,pts,waves?.010:long?.007:.0065,.29);
      if(i%3===0&&style!=='cap'){
        const neighbour=pts.map(([x,y,z])=>[x+.0033,y+.0018,z+.0018]);
        d.tube(bone,tone(T,c,.035),2,neighbour,.0016,.25,4);
      }
    }
    if(style==='bun'){
      d.ball(bone,hair,2,[-.024,.291,-.080],[.063,.060,.059],nullRotation);
      for(let i=0;i<7;i++){
        const theta=i*.88,pts=[];
        for(let j=0;j<=4;j++){const a=.25+j*.63;pts.push([-.024+Math.sin(theta+a*.25)*Math.sin(a)*.061,.291+Math.cos(a)*.059,-.08+Math.cos(theta+a*.25)*Math.sin(a)*.056]);}
        d.tube(bone,i%2?hair:highlights,2,pts,.005,.4);
      }
    }
    if(style==='cap'){
      d.rings(bone,'#788661',0,[[.182,.133,.127],[.200,.14,.132],[.237,.137,.121],[.273,.112,.105],[.300,.073,.074],[.312,.015,.019]], [0,0,-.004]);
      d.ball(bone,'#65734e',0,[0,.192,.110],[.121,.014,.083],[-.16,0,0]);
      d.ball(bone,'#9b9d76',0,[0,.311,0],[.010,.007,.010],nullRotation,true);
    }
  }
  const nullRotation=[0,0,0];

  function paintJacket(T,d,id,rows) {
    const hem=rows[0][0],top=rows.at(-1)[0];
    const garmentRows=[[hem,.967,.407],[hem+.042,.896,.406],[.13,.636,.403],
      [.24,.40,.405],[.335,.206,.408],[.36,.139,.385],[.384,.091,.259],[.411,.040,.135]];
    for(const rear of [false,true]){
      portraitPatch(T,d,id,rear?4:3,'chest',24,19,(u,v)=>{
        const y=mix(hem+.002,top-.006,v),theta=(u-.5)*Math.PI*.91+(rear?Math.PI:0);
        const [rx,rz,cz=0]=interpRows(rows,y),[photoY,half]=interpRows(garmentRows,y);
        const x=Math.sin(theta)*(rx+.003), z=(rz+.005)*Math.cos(theta)+cz;
        const across=rear?-Math.sin(theta):Math.sin(theta);
        const fade=ease((1-Math.abs(2*u-1))/.15)*ease(v/.06)*ease((1-v)/.075);
        return [x,y,z,.5+across*half,photoY,fade];
      });
    }
  }
  function tailor(T,d,id,painted){
    const [family,,,pants]=cast[id],coat=cast[id][2], flesh=skin[id], c='chest';
    const dark=tone(T,coat,-.085), light=tone(T,coat,.091,-.02);
    const knitted=family==='hood'||family==='tote', longCoat=family==='scarf', fabric=knitted?2:0;
    const shirt='#dfd7c5', hardware='#92795a', hem=longCoat?-.12:-.028;
    d.rings('hip',pants,3,[[-.083,.10,.071],[-.063,.15,.09],[.009,.157,.098],[.074,.143,.086]]);
    const rows=[[hem,.157,.098,0],[hem+.018,.166,.103,0],[.125,.149,.098,0],
      [.241,.172,.112],[.333,.193,.119,-.006],[.362,.182,.111,-.003],[.383,.145,.093],
      [.412,.071,.063],[.418,.055,.050]].map(([y,rx,rz,cz=0])=>[y,rx,rz,cz]);
    d.rings(c,coat,fabric,rows);if(painted)paintJacket(T,d,id,rows);
    d.rings(c,flesh,1,[[.398,.056,.052],[.412,.058,.054],[.482,.054,.052],[.512,.052,.048]]);
    if(family==='suit'){
      d.patch(c,shirt,0,[[-.084,.401,.049],[.080,.401,.049],[.018,.209,.117],[-.016,.209,.118]]);
      d.patch(c,'#8a4c43',0,[[-.014,.377,.075],[.014,.377,.075],[.008,.351,.089],[.025,.265,.108],[0,.236,.118],[-.016,.267,.112],[-.008,.351,.09]]);
      for(const s of [-1,1]){
        d.patch(c,light,0,[[s*.068,.401,.068],[s*.140,.364,.088],[s*.099,.343,.102],[s*.119,.322,.113],[s*.025,.203,.117]]);
        d.tube(c,dark,0,[[s*.124,.122,.094],[s*.084,.115,.103],[s*.056,.117,.11]],.0035,.65);
      }
    } else if(family==='field'||longCoat||family==='player'){
      d.tube(c,dark,0,[[0,.399,.062],[.002,.322,.119],[.001,.17,.111],[.001,hem+.014,.106]],.004);
      for(const s of [-1,1]){
        d.patch(c,light,0,[[s*.059,.409,.047],[s*.100,.380,.065],[s*.088,.328,.111],[s*.013,.381,.084]]);
        if(family==='field'){
          d.patch(c,tone(T,coat,-.025),0,[[s*.141,.275,.097],[s*.056,.279,.113],[s*.055,.201,.110],[s*.099,.190,.108],[s*.136,.204,.098]]);
          d.patch(c,light,0,[[s*.14,.277,.100],[s*.055,.283,.117],[s*.057,.258,.118],[s*.098,.245,.114],[s*.138,.254,.105]]);
          d.ball(c,hardware,4,[s*.097,.257,.117],[.005,.005,.003],nullRotation,true);
        }
      }
    } else if(family==='hood'){
      d.ball(c,dark,0,[0,.34,-.087],[.124,.117,.06],[-.3,0,0]);
      d.tube(c,light,2,[[-.078,.39,.045],[-.044,.367,.093],[0,.348,.11],[.046,.369,.09],[.076,.391,.047]],.0097);
      d.patch(c,tone(T,coat,.032),2,[[-.10,.128,.096],[-.067,.17,.103],[.069,.169,.105],[.10,.123,.094],[.098,.072,.09],[-.099,.072,.093]]);
      for(const s of [-1,1]){
        d.tube(c,'#d1bda1',2,[[s*.041,.37,.095],[s*.040,.315,.121],[s*.045,.276,.12]],.0036);
        d.ball(c,'#cfb999',0,[s*.045,.272,.12],[.0054,.007,.004],nullRotation,true);
      }
    } else {
      const cardigan=id===6;
      d.tube(c,light,2,[[-.074,.398,.056],[-.049,.380,.08],[0,cardigan?.303:.366,cardigan?.117:.083],
        [.050,.381,.08],[.074,.398,.056]],.0105);
      if(cardigan)d.tube(c,light,2,[[0,.307,.116],[0,.20,.112],[0,.065,.098],[0,.0,.104]],.006);
      d.rings(c,dark,2,[[hem-.002,.157,.095],[hem+.005,.161,.101],[hem+.024,.166,.104]]);
    }
    if(['suit','field','scarf'].includes(family)||id===6){
      const n=family==='suit'?2:4;
      for(let i=0;i<n;i++){
        const y=(family==='suit'?.19:.292)-i*.076;
        d.ball(c,family==='field'?hardware:dark,4,[family==='suit'?.014:.006,y,y>.25?.115:.109],[.007,.007,.0045],nullRotation,true);
      }
    }
    for(const s of [-1,1]){
      const side=s<0?'L':'R', a='upperArm'+side, f='forearm'+side, hand='hand'+side;
      // Rounded, set-in sleeve with a narrower wrist and a separate knitted cuff.
      d.rings(a,coat,fabric,[[-.275,.045,.045],[-.253,.056,.055],[-.191,.053,.059],
        [-.105,.062,.066],[-.044,.071,.068],[0,.064,.062],[.023,.045,.046],[.032,.014,.018]], [0,0,0],14);
      d.rings(f,coat,fabric,[[-.242,.037,.039],[-.221,.043,.045],[-.146,.047,.049],[-.055,.053,.054],[.012,.052,.053],[.031,.034,.037]], [0,0,0],14);
      d.ball(f,coat,fabric,[0,-.003,0],[.053,.052,.054],nullRotation);
      d.rings(f,knitted?dark:light,fabric,[[-.243,.038,.039],[-.237,.043,.044],[-.213,.044,.044]], [0,0,0],12);
      d.ball(hand,flesh,1,[0,-.035,.002],[.035,.047,.026],[0,0,-s*.13]);
      for(let j=0;j<4;j++){
        const x=(j-1.5)*.014;
        d.ball(hand,flesh,1,[x,-.067+.003*Math.abs(j-1.35),.008],[.0088,.020-.002*Math.abs(j-1.3),.013],[.13,0,.075*s],true);
      }
      d.ball(hand,flesh,1,[-s*.030,-.028,.014],[.013,.029,.015],[-.31,0,-s*.35],true);
      const up='thigh'+side,low='calf'+side,shoe='foot'+side;
      d.rings(up,pants,3,[[-.420,.058,.066],[-.383,.070,.075],[-.205,.078,.088],[-.036,.087,.095],[.022,.072,.074]], [0,0,0],14);
      d.rings(low,pants,3,[[-.39,.050,.051],[-.367,.059,.06],[-.172,.062,.065],[-.067,.066,.069],
        [.008,.070,.071],[.026,.045,.048]], [0,0,0],14);
      d.ball(low,pants,3,[0,-.003,0],[.069,.074,.071],nullRotation);
      const leather=['suit','field','scarf'].includes(family), upper=leather?(id%2?'#5a4238':'#5b483b'):(id===3?'#867c6a':'#d5c7a7');
      d.rings(shoe,leather?'#403630':'#b2a58e',4,[[-.06,.045,.095,.035],[-.055,.061,.116,.046],[-.044,.062,.115,.046]], [0,0,0],16);
      d.rings(shoe,upper,leather?4:0,[[-.044,.059,.113,.044],[-.022,.058,.105,.041],[.002,.055,.094,.029],[.025,.050,.072,.010],[.04,.044,.052,-.005]], [0,0,0],16);
      for(let j=0;j<3;j++) d.tube(shoe,leather?tone(T,upper,.091):'#eee0c1',0,[[-.028,.031-j*.006,.032+j*.016],[0,.035-j*.006,.04+j*.016],[.028,.027-j*.006,.045+j*.016]],.0024);
    }
    if(id===6||id===7){
      d.rings('hip',tone(T,pants,.025),3,[[-.121,.172,.135,.045],[-.112,.178,.14,.044],[-.018,.162,.113,.012],[.035,.143,.098]], [0,0,0],20);
    }
    if(family==='scarf'){
      const scarf=id===4?'#bd887b':'#b79a80';
      d.rings(c,scarf,2,[[.365,.077,.073],[.383,.091,.084],[.410,.087,.076],[.436,.066,.064]]);
      d.tube(c,tone(T,scarf,.073),2,[[-.071,.392,.046],[-.036,.382,.073],[.021,.383,.079],[.063,.392,.061]],.005);
    }
    return {coat,dark,light,pants,family};
  }

  function possessions(T,d,id,family) {
    const b='prop', bag=id===9?'#bca47d':'#d7b78b', trim='#9a7a56';
    if(family==='field'){
      d.box(b,'#493e38',4,[0,0,0],[.065,.119,.011]);
      d.box(b,'#94b6ae',5,[0,.003,.006],[.055,.099,.003]);
      d.box(b,'#bdd4ca',5,[0,.028,.008],[.041,.012,.0017]);
      d.box(b,'#d3d0ba',5,[.006,.009,.008],[.032,.007,.0017]);
      d.ball(b,'#292c2c',5,[.020,.045,-.006],[.006,.006,.002],nullRotation,true);
    } else if(family==='tote'||family==='player'){
      d.rings(b,bag,0,[[-.104,.078,.040],[-.097,.108,.052],[-.078,.117,.057],[.063,.108,.056],[.089,.108,.047]], [0,0,0],22);
      d.ball(b,'#695848',4,[0,.087,.002],[.107,.009,.044],nullRotation);
      for(const z of [-.037,.041]){
        d.tube(b,bag,0,[[-.066,.081,z],[-.062,.148,z*.84],[-.039,.192,z*.73],[0,.202,z*.69],[.040,.189,z*.72],[.064,.146,z*.88],[.065,.08,z]],.0077);
      }
      for(const side of [-1,1])d.tube(b,trim,0,[[side*.096,.066,.029],[side*.104,-.022,.029],[side*.098,-.085,.031]],.0017);
      d.tube(b,tone(T,bag,.061),0,[[-.094,.079,.032],[-.04,.080,.047],[.041,.079,.048],[.096,.077,.028]],.0033);
      d.ball(b,'#7e8a65',0,[-.012,-.002,.056],[.017,.027,.0025],[0,0,.56]);
      d.ball(b,'#989d78',0,[.009,-.012,.057],[.010,.018,.0029],[0,0,-.61],true);
    } else if(family==='hood'){
      const pad=id===3?'#b18c69':'#b9ad93';
      const pts=[];
      for(let j=0;j<=10;j++){
        const a=j*Math.PI/10;pts.push([-.148*Math.cos(a),.108+.204*Math.sin(a),-.021]);
      }
      d.tube(b,'#3c3a39',4,pts,.011,1,7);
      d.tube(b,'#8a7a65',4,pts.slice(2,-2),.013,1,7);
      for(const s of [-1,1]){
        d.ball(b,'#393734',4,[s*.143,.12,-.002],[.025,.05,.042],nullRotation);
        d.ball(b,pad,4,[s*.160,.12,-.002],[.017,.042,.034],nullRotation);
        d.ball(b,'#817260',4,[s*.173,.12,-.002],[.006,.024,.019],nullRotation,true);
      }
    } else if(family==='scarf'){
      const yarn=id===4?'#c79585':'#c9ad91';
      d.box(b,yarn,2,[0,-.125,0],[.064,.26,.012]);
      for(let j=0;j<7;j++) d.box(b,j%2?'#987566':'#d4b5a2',2,[0,-.035-j*.034,.007],[.064,.009,.003]);
      for(const x of [-.021,.014]) d.box(b,'#d3b2a2',2,[x,-.127,.009],[.004,.249,.002]);
      for(let j=0;j<7;j++) d.tube(b,yarn,2,[[j*.009-.027,-.250,0],[j*.009-.027,-.268+(j%3)*.003,.002]],.0026,.72);
    } else if(family==='suit'){
      const paper='#e5d9bd';
      for(const s of [-1,1]){
        const points=[[0,-.086,.009],[s*.127,-.080,.026],[s*.132,.088,.019],[0,.083,.002]];
        d.patch(b,paper,0,points);d.patch(b,paper,0,points.map(([x,y,z])=>[x,y,z-.0017]));
        for(let j=0;j<9;j++){
          if(j<3 && s<0)continue;
          const h=.052-j*.013;
          for(let col=0;col<2;col++){
            const x1=.012+col*.058,x2=x1+.046-(j+col)%3*.004;
            d.tube(b,'#898779',0,[[s*x1,h,.010+x1*.13],[s*x2,h+.002,.01+x2*.13]],.0012);
          }
        }
        d.box(b,'#748679',0,[s*.067,.071,.015],[.111,.009,.002],[0,-s*.128,0]);
      }
      d.box(b,'#9aa598',0,[-.067,.035,.019],[.088,.041,.002],[0,.13,0]);
      const leather='#73533f';
      d.rings('case',leather,4,[[-.09,.102,.033],[-.083,.131,.042],[.057,.133,.044],[.074,.122,.042],[.077,.102,.031]],[0,0,0],24);
      d.box('case','#936d51',4,[0,.031,.041],[.223,.077,.006]);
      d.box('case','#b39a70',4,[0,-.006,.048],[.021,.024,.007]);
      d.tube('case',leather,4,[[-.042,.070,0],[-.041,.106,0],[-.025,.119,0],[.025,.119,0],[.042,.107,0],[.043,.072,0]],.008);
    }
  }

  const gestures={
    field:[
      [[-.038,.095,.263],[-.042,.284,.218],[-.112,.165,.112],[-.139,.005,.232]],
      [[.050,.106,.269],[.075,.157,.205],[.027,.112,.16],[.122,-.011,.249]]
    ],
    tote:[
      [[-.063,.171,.269],[-.027,.148,.238],[.061,.277,.218],[.123,.310,.106]],
      [[.063,.171,.262],[.073,.216,.240],[.141,.325,.145],[.138,.344,.095]]
    ],
    suit:[
      [[-.098,.173,.239],[-.109,.293,.215],[-.142,.184,.138],[-.155,.186,.113]],
      [[.10,.173,.24],[.109,.293,.215],[.22,.020,.139],[.19,.047,.114]]
    ],
    hood:[
      [[-.105,.085,.249],[-.132,.552,.065],[-.132,.391,.092],[-.129,.001,.249]],
      [[.091,.091,.251],[.146,.551,.051],[.118,.388,.089],[.129,.002,.254]]
    ],
    scarf:[
      [[-.082,.132,.205],[-.047,.170,.159],[-.047,.306,.115],[-.135,-.01,.238]],
      [[.082,.134,.204],[.031,.180,.156],[.05,.366,.123],[.084,.331,.106]]
    ]
  };

  function avatar(T,kit,id,geo){
    const root=new T.Group(),mesh=new T.SkinnedMesh(geo,kit.photoMaterial?[kit.material,kit.photoMaterial]:kit.material);
    root.name='clay-commuter-'+id; mesh.name='puppet skin';
    const bones={},ordered=[];
    for(const [name,parent,at] of rig){
      const bone=new T.Bone();bone.name=name;bone.position.set(...at);
      (parent?bones[parent]:mesh).add(bone);bones[name]=bone;ordered.push(bone);
    }
    root.add(mesh);mesh.bind(new T.Skeleton(ordered));
    root.scale.setScalar(proportions[id]);
    // These bounds include the overhead arm and shoes extended in front of a seat.
    mesh.boundingSphere=new T.Sphere(new T.Vector3(0,.95,.12),1.18);
    mesh.boundingBox=new T.Box3(new T.Vector3(-.46,-.04,-.29),new T.Vector3(.46,2.03,.57));
    const hitVolumes=[];
    const addHit=(name,from,to,radius)=>hitVolumes.push({bone:bones[name],from,to,radius});
    addHit('head',[0,.044,0],[0,.230,0],.125);
    addHit('chest',[0,.011,0],[0,.308,0],.153);
    addHit('hip',[0,-.04,0],[0,.014,.004],.123);
    for(const side of ['L','R']){
      addHit('upperArm'+side,[0,0,0],[0,-.24,0],.058);
      addHit('forearm'+side,[0,0,0],[0,-.23,0],.047);
      addHit('thigh'+side,[0,0,0],[0,-.40,0],.078);
      addHit('calf'+side,[0,0,0],[0,-.375,0],.058);
      addHit('foot'+side,[0,-.023,-.02],[0,-.024,.116],.054);
    }
    const family=cast[id][0],workFamily=family==='player'?'tote':family;
    const vec=()=>new T.Vector3(),down=new T.Vector3(0,-1,0);
    const dir=vec(),anchor=vec(),hand=vec(),elbow=vec(),hint=vec(),delta=vec(),p0=vec(),p1=vec(),p2=vec();
    function link(b,from,to,length){
      dir.copy(to).sub(from);
      const size=dir.length();
      b.position.copy(from);b.quaternion.setFromUnitVectors(down,dir.multiplyScalar(1/Math.max(size,.00001)));
      b.scale.set(1,size/length,1);
    }
    function arms(s,goal,overhead){
      const edge=s<0?'L':'R',upper=overhead?.277:.256,lower=overhead?.255:.239;
      anchor.set(s*.159,.34,0);hand.fromArray(goal);
      delta.copy(hand).sub(anchor);
      const length=clamp(delta.length(),.10,upper+lower-.003);
      delta.normalize();hand.copy(anchor).addScaledVector(delta,length);
      const along=(upper*upper-lower*lower+length*length)/(2*length);
      // Bend toward the outside of the coat, keeping the forearm ahead of the chest.
      hint.set(s*(overhead?.78:1),overhead?.20:-.59,overhead?-.32:-.53);
      hint.addScaledVector(delta,-hint.dot(delta)).normalize();
      elbow.copy(anchor).addScaledVector(delta,along).addScaledVector(hint,Math.sqrt(Math.max(0,upper*upper-along*along)));
      link(bones['upperArm'+edge],anchor,elbow,.262);
      link(bones['forearm'+edge],elbow,hand,.237);
      const palm=bones['hand'+edge];palm.position.copy(hand);
      dir.copy(hand).sub(elbow).normalize();palm.quaternion.setFromUnitVectors(down,dir);
    }
    function legs(s,rise,ready,stride,hipY){
      const edge=s<0?'L':'R',pace=stride*s;
      const hipZ=mix(-.025,0,rise);
      p0.set(s*.089,hipY-.02,hipZ);
      p1.set(s*mix(.115,.089,rise),mix(.47,.47,rise)+Math.max(0,pace)*.058*rise,
        mix(.364-ready*.037,.033,rise)+pace*.13*rise);
      p2.set(s*mix(.121-ready*.023,.093,rise),.064+Math.max(0,pace)*.068*rise,
        mix(.365-ready*.124,-.014,rise)+pace*.223*rise);
      link(bones['thigh'+edge],p0,p1,.408);link(bones['calf'+edge],p1,p2,.385);
      const foot=bones['foot'+edge];foot.position.copy(p2);
      foot.rotation.set(-Math.max(0,pace)*.24,s*(.11-.06*ready),0);
    }
    function accessories(stage,rise,isSeated,walk,overhead){
      const prop=bones.prop,briefcase=bones.case;
      prop.rotation.set(0,0,0);prop.scale.setScalar(1);briefcase.scale.setScalar(1);
      if(workFamily==='field'){
        const wrist=bones.handL;
        dir.set(0,-.056,.01).applyQuaternion(wrist.quaternion);
        prop.position.copy(wrist.position).add(dir);
        prop.position.z+=.006;
        prop.rotation.set(mix(-.83,-.1,ease(stage)),.08,-.055);
        // The phone disappears below the jacket flap as the fingers let go.
        const shown=isSeated?1-ease((stage-1.48)/.54):1;
        prop.scale.setScalar(Math.max(.001,shown));
      } else if(workFamily==='tote'){
        const at=isSeated?sample([[0,.055,.280],[.003,.055,.269],[.132,.140,.161],[.168,.150,.072]],stage)
          :[overhead?-.181:.174,.11,.082];
        prop.position.fromArray(at);
        prop.rotation.set(-.055,isSeated?stage*.064:-.08,isSeated?-.12*ease(stage-1):.044);
      } else if(workFamily==='suit'){
        const at=isSeated?sample([[0,.170,.279],[0,.281,.242],[-.113,.174,.158],[-.137,.182,.118]],stage):[-.143,.149,.135];
        prop.position.fromArray(at);prop.scale.x=mix(1,.33,ease(stage-1));prop.rotation.set(-.27,.045,-.16*ease(stage-1));
        const grip=isSeated?ease(stage-1):1;
        const handR=bones.handR;
        dir.set(0,-.05,0).applyQuaternion(handR.quaternion);
        briefcase.position.copy(handR.position).add(dir);
        briefcase.position.applyQuaternion(bones.chest.quaternion).add(bones.chest.position)
          .applyQuaternion(bones.hip.quaternion).add(bones.hip.position);
        briefcase.position.y-=.118;
        briefcase.position.lerp(p0.set(.228,.115,.112),1-grip);
        briefcase.rotation.set(.03,.10,walk?.05:0);
      } else if(workFamily==='hood'){
        const lowered=isSeated?ease(stage-1):0;
        prop.position.copy(bones.head.position);
        prop.position.y-=.227*lowered;
        prop.position.z+=.057*lowered;
        prop.quaternion.copy(bones.head.quaternion);prop.rotateX(.66*lowered);
      } else if(workFamily==='scarf'){
        const gathered=isSeated?ease(stage-1):0;
        prop.position.set(-.019,.397,.084+.008*gathered);
        prop.rotation.set(-.35-.49*gathered,0,-.19+.96*gathered);
        prop.scale.y=1-.48*gathered;
      }
    }
    let lastKey='';
    function update(pose={},time=0){
      // Moving limbs hold for a stop-motion exposure while the first-person camera remains smooth.
      const frame=Math.floor((Number(time)||0)*12), t=frame/12;
      const beat=Math.floor((Number(pose.actionTime)||0)*12)/12;
      const seated=!!pose.seated, walking=!seated&&!!pose.walking, overhead=!seated&&!walking&&!!pose.standingGrip;
      const direction=pose.doorSide===-1?-1:1;
      const key=[frame,beat,seated,walking,overhead,direction,pose.action].join('/');
      if(key===lastKey)return;lastKey=key;
      const stage=seated?actionStage(pose.action,beat):0;
      const ready=ease(stage-2),rise=seated?ease(stage-3):1;
      const stride=walking?Math.sin(t*6.55+id*.87):0;
      const bodySway=Math.sin(t*1.69+id*1.43),hipY=mix(.493,.86,rise)+(walking?Math.abs(stride)*.018:0);
      bones.hip.position.set(0,hipY,-.021*(1-rise));
      bones.hip.rotation.set(0,direction*.18*ready*(1-rise),0);
      const bend=seated?sample([[.010],[.077],[.127],[.211],[.040]],stage)[0]:walking?.045:.0;
      bones.chest.rotation.set(bend+bodySway*.008,direction*.18*ready*(1-rise),seated?(id%3-1)*.020:bodySway*.016);
      bones.chest.position.set(0,.010+(1+bodySway)*.0028,0);
      const neutralYaw=(id%5-2)*.051, downward=seated?.091:.009;
      bones.head.rotation.set(downward+(seated?.115*(1-ease(stage-1.5)):0)+.015*bodySway,-neutralYaw+
        direction*.54*ready*(1-rise)+.018*Math.sin(t*.69+id),.024*((id%4)-1.5)-.08*ready*(1-rise));
      for(const s of [-1,1]){
        const side=s<0?0:1, grip=overhead&&s===(id%2?-1:1);
        let goal;
        if(seated)goal=sample(gestures[workFamily][side],Math.min(stage,3));
        else if(grip)goal=[s*.155,.921,.026];
        else if(walking)goal=[s*.182,-.115,.042+s*stride*.19];
        else if(workFamily==='field'&&s<0)goal=[-.053,.227,.198];
        else if(workFamily==='tote'&&s>0&&!overhead)goal=[.143,.287,.134];
        else if(workFamily==='suit'&&s<0)goal=[-.153,.156,.130];
        else if(workFamily==='scarf'&&id%2===0&&s>0)goal=[.033,.167,.137];
        else goal=[s*.185,-.105,.05+bodySway*.012];
        if(seated&&rise){
          goal[0]=mix(goal[0],s*.18,rise);goal[1]=mix(goal[1],-.075,rise);goal[2]=mix(goal[2],.098,rise);
        }
        arms(s,goal,grip);legs(s,rise,ready,stride,hipY);
      }
      accessories(Math.min(stage,3),rise,seated,walking,overhead);
    }
    update({seated:false},0);
    return {root,update,hitVolumes};
  }

  function create(T,personId){
    const id=personId==='player'?13:((Number(personId)||0)%13+13)%13,kit=resources(T);
    if(!kit.templates.has(id)){
      const d=compiler(T,kit);
      const painted=!!kit.photoMaterial&&id!==13;
      sculptHead(T,d,id,painted);
      const {family}=tailor(T,d,id,painted);
      possessions(T,d,id,family);
      kit.templates.set(id,d.finish());
    }
    return avatar(T,kit,id,kit.templates.get(id));
  }
  window.SubwayPuppets3D={create};
})();
