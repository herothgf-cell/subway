/* Hand-built Seoul Line 2 carriage. Coordinates and prop sizes are in metres. */
(() => {
  "use strict";

  function build(T, scene) {
    const root = new T.Group();
    root.name = "2호선 객차";
    scene.add(root);
    const blockers = [];
    const doors = [];
    const unitBox = new T.BoxGeometry(1, 1, 1);
    const unitCylinder = new T.CylinderGeometry(1, 1, 1, 12);
    const pane = new T.PlaneGeometry(1, 1);
    const materialBatches = new Map();
    const rounded = new Map();
    const dummy = new T.Object3D();
    const up = new T.Vector3(0, 1, 0);
    const rotation = new T.Quaternion();
    const normal = new T.Vector3();
    const point = new T.Vector3();
    const nmatrix = new T.Matrix3();
    const pigment = new T.Color();
    const seed = n => {
      const v = Math.sin(n * 73.1942 + 41.738) * 12057.735;
      return v - Math.floor(v);
    };
    const koreanFont = '"Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

    function canvasMap(w, h, paint, tile = false) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      paint(canvas.getContext("2d"), w, h);
      const map = new T.CanvasTexture(canvas);
      map.colorSpace = T.SRGBColorSpace;
      map.anisotropy = 4;
      if (tile) map.wrapS = map.wrapT = T.RepeatWrapping;
      return map;
    }
    function grain(kind) {
      return canvasMap(128, 128, (c, width, height) => {
        const pixels = c.createImageData(width, height);
        for (let i=0; i < width*height; i++) {
          const x = i % width, y = Math.floor(i / width);
          const weave = kind === "wool" ? 6*Math.sin(y*Math.PI/2) + 5*Math.cos((x+y/3)*Math.PI/1.6) : 0;
          const value = 228 + (seed(i*3)-.5)*(kind === "wool" ? 34 : 15) + weave;
          for (let k=0; k<3; k++) pixels.data[i*4+k] = value;
          pixels.data[i*4+3] = 255;
        }
        c.putImageData(pixels,0,0);
        if (kind === "floor") {
          for (let i=0; i<1600; i++) {
            const x=seed(i+13)*width, y=seed(i+334)*height;
            c.fillStyle=i%3===0 ? "rgba(255,255,250,.57)" : "rgba(89,85,78,.26)";
            c.fillRect(x,y,.4+seed(i+930)*1.5,.6+seed(i+128)*1.1);
          }
        } else if (kind === "wool") {
          for (let i=0; i<500; i++) {
            const x=seed(i+17)*width, y=seed(i+352)*height;
            c.strokeStyle=i%3===0 ? "rgba(72,68,66,.20)" : "rgba(255,255,249,.60)";
            c.lineWidth=.46;
            c.beginPath(); c.moveTo(x,y);c.lineTo(x+1.5+seed(i+207)*2,y+seed(i+1)*1.6);c.stroke();
          }
        }
      },true);
    }
    const enamel = new T.MeshStandardMaterial({vertexColors:true, roughness:.78, metalness:.03});
    const alloy = new T.MeshStandardMaterial({vertexColors:true, roughness:.3, metalness:.45});
    // Long carriage lamps and bands of glass are reflected by the cold-rolled rails.
    const reflectionFaces=Array.from({length:6},(_,face)=>{
      const sheet=document.createElement("canvas");
      sheet.width=sheet.height=64;
      const c=sheet.getContext("2d"),light=c.createLinearGradient(0,0,5,64);
      const overhead=face===2,underneath=face===3;
      light.addColorStop(0,overhead?"#e7ece5":underneath?"#8b877e":"#edece3");
      light.addColorStop(.22,overhead?"#f6f6e9":"#b8c6c4");
      light.addColorStop(.37,overhead?"#c2cbc8":"#e6eada");
      light.addColorStop(.53,underneath?"#777a74":"#819493");
      light.addColorStop(.76,underneath?"#a6a294":"#546863");
      light.addColorStop(1,underneath?"#9f9a88":"#b4afa0");
      c.fillStyle=light;c.fillRect(0,0,64,64);
      if(!underneath) {
        c.fillStyle="rgba(255,253,230,.9)";c.fillRect(0,overhead?12:8,64,5);
        c.fillStyle="rgba(255,255,244,.6)";c.fillRect(0,overhead?47:15,64,2);
      }
      return sheet;
    });
    const reflections=new T.CubeTexture(reflectionFaces);
    reflections.colorSpace=T.SRGBColorSpace;reflections.needsUpdate=true;
    const tubing=new T.MeshPhongMaterial({vertexColors:true,specular:0xd1dad4,shininess:94,
      envMap:reflections,combine:T.MixOperation,reflectivity:.52});
    const cloth = new T.MeshStandardMaterial({vertexColors:true,map:grain("wool"),roughness:.94});
    const rubber = new T.MeshStandardMaterial({vertexColors:true,roughness:.76,metalness:.04});
    const lino = new T.MeshStandardMaterial({vertexColors:true,map:grain("floor"),roughness:.77});
    lino.map.repeat.set(19,3);
    const luminous = new T.MeshBasicMaterial({vertexColors:true});
    const glass = new T.MeshStandardMaterial({vertexColors:true,roughness:.26,metalness:.24});
    const benchShadow=new T.MeshBasicMaterial({transparent:true,depthWrite:false,vertexColors:true,
      map:canvasMap(192,96,(c,w,h)=>{
        const image=c.createImageData(w,h);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const u=Math.abs((x+.5-w/2)/(w/2)),v=Math.abs((y+.5-h/2)/(h/2));
          const a=Math.max(0,1-Math.pow(u,6))*Math.max(0,1-v*v);
          const i=(y*w+x)*4;
          image.data[i]=42;image.data[i+1]=48;image.data[i+2]=39;image.data[i+3]=a*a*101;
        }
        c.putImageData(image,0,0);
      })});
    const sheen=new T.MeshBasicMaterial({transparent:true,depthWrite:false,vertexColors:true,
      map:canvasMap(256,128,(c,w,h)=>{
        const shine=c.createLinearGradient(0,0,w,h*.42);
        for(const [offset,opacity] of [[0,.03],[.16,.04],[.22,.25],[.27,.05],[.49,.02],[.55,.14],[.60,.04],[1,.07]])
          shine.addColorStop(offset,"rgba(250,245,217,"+opacity+")");
        c.fillStyle=shine;c.fillRect(0,0,w,h);
      })});
    function printed(map, illuminated = false) {
      return illuminated ? new T.MeshBasicMaterial({map,vertexColors:true})
        : new T.MeshStandardMaterial({map,vertexColors:true,roughness:.76});
    }

    // Flat panels, thrown-clay curves and tubular fittings share one static draw call per finish.
    function collect(geometry,material,color = 0xffffff) {
      dummy.updateMatrix();
      let data = materialBatches.get(material);
      if (!data) {
        data = {positions:[],normals:[],uvs:[],colors:[],indices:[]};
        materialBatches.set(material,data);
      }
      const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
      const start=data.positions.length/3;
      nmatrix.getNormalMatrix(dummy.matrix);
      pigment.set(color);
      for(let i=0;i<p.count;i++) {
        point.fromBufferAttribute(p,i).applyMatrix4(dummy.matrix);
        normal.fromBufferAttribute(n,i).applyMatrix3(nmatrix).normalize();
        data.positions.push(point.x,point.y,point.z);
        data.normals.push(normal.x,normal.y,normal.z);
        data.colors.push(pigment.r,pigment.g,pigment.b);
        data.uvs.push(uv?uv.getX(i):0,uv?uv.getY(i):0);
      }
      if(geometry.index) {
        for(let i=0;i<geometry.index.count;i++) data.indices.push(start+geometry.index.getX(i));
      } else {
        for(let i=0;i<p.count;i++) data.indices.push(start+i);
      }
    }
    function flush(parent) {
      for(const [material,d] of materialBatches) {
        const geometry = new T.BufferGeometry();
        geometry.setAttribute("position",new T.Float32BufferAttribute(d.positions,3));
        geometry.setAttribute("normal",new T.Float32BufferAttribute(d.normals,3));
        geometry.setAttribute("color",new T.Float32BufferAttribute(d.colors,3));
        geometry.setAttribute("uv",new T.Float32BufferAttribute(d.uvs,2));
        geometry.setIndex(d.indices);
        geometry.computeBoundingSphere();
        const part = new T.Mesh(geometry,material);
        part.receiveShadow = true;
        parent.add(part);
      }
      materialBatches.clear();
    }
    function place(x,y,z,sx,sy,sz,rx=0,ry=0,rz=0) {
      dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);
    }
    function box(x,y,z,w,h,d,color,material=enamel) {
      place(x,y,z,w,h,d);collect(unitBox,material,color);
    }
    function bevelGeometry(w,h,d,requested) {
      const r=Math.min(requested,w*.49,h*.49,d*.49);
      const key=[w,h,d,r].join(",");
      if(rounded.has(key))return rounded.get(key);
      const points=[],normals=[],uvs=[],indices=[];
      const halves=[w/2,h/2,d/2];
      const inner=halves.map(v=>v-r);
      const vertsFor = size => [-size,-size+r*.42,-size+r,size-r,size-r*.42,size];
      // Project edge and corner grids onto a sphere about each fillet centre.
      for(const [axis,u,v,sign,winding] of [[2,0,1,1,1],[2,0,1,-1,-1],[0,2,1,1,-1],[0,2,1,-1,1],[1,0,2,1,-1],[1,0,2,-1,1]]) {
        const us=vertsFor(halves[u]), vs=vertsFor(halves[v]), offset=points.length/3;
        for(const vv of vs)for(const uu of us) {
          const a=[0,0,0];a[axis]=sign*halves[axis]; a[u]=uu;a[v]=vv;
          const core=a.map((c,i)=>Math.min(inner[i],Math.max(-inner[i],c)));
          const diff=a.map((c,i)=>c-core[i]),len=Math.hypot(...diff)||1;
          const norm=diff.map(c=>c/len);
          points.push(...core.map((val,i)=>val+norm[i]*r));normals.push(...norm);
          uvs.push((uu/halves[u]+1)/2,(vv/halves[v]+1)/2);
        }
        for(let j=0;j<5;j++)for(let i=0;i<5;i++) {
          const a=offset+j*6+i,b=a+1,c=a+6,e=c+1;
          if(winding===1) indices.push(a,b,c,b,e,c);else indices.push(a,c,b,b,c,e);
        }
      }
      const g=new T.BufferGeometry();
      g.setAttribute("position",new T.Float32BufferAttribute(points,3));
      g.setAttribute("normal",new T.Float32BufferAttribute(normals,3));
      g.setAttribute("uv",new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);
      rounded.set(key,g);return g;
    }
    function roundBox(x,y,z,w,h,d,r,color,material=enamel,tilt=0) {
      place(x,y,z,1,1,1,tilt);collect(bevelGeometry(w,h,d,r),material,color);
    }
    function rod(x,y,z,X,Y,Z,r,color,material=tubing) {
      const delta=new T.Vector3(X-x,Y-y,Z-z), length=delta.length();
      if(!length)return;
      rotation.setFromUnitVectors(up,delta.normalize());
      dummy.position.set((x+X)/2,(y+Y)/2,(z+Z)/2);
      dummy.quaternion.copy(rotation);dummy.scale.set(r,length,r);
      collect(unitCylinder,material,color);
    }
    function decal(x,y,z,w,h,side,material) {
      place(x,y,z,w,h,1,0,side===1?0:Math.PI);collect(pane,material);
    }
    function windowView(x,y,z,w,h,side,material,worldCenter=x) {
      // Narrow door glass reveals a narrower slice of the same passing skyline.
      const geometry=pane.clone(),uv=geometry.attributes.uv;
      const span=w/4, start=(side*worldCenter+18)/4-span/2;
      for(let i=0;i<uv.count;i++)uv.setX(i,start+uv.getX(i)*span);
      place(x,y,z,w,h,1,0,side===1?0:Math.PI);collect(geometry,material);
      geometry.dispose();
    }
    const blockerMat=new T.MeshBasicMaterial({visible:false});
    function post(x,z) {
      const p=new T.Mesh(unitCylinder,blockerMat);
      p.scale.set(.025,2.27,.025);p.position.set(x,1.14,z);
      root.add(p);blockers.push(p);
      rod(x,.014,z,x,2.315,z,.022,"#c0c9c0");
      for(const [y,h,r] of [[.015,.024,.062],[.04,.024,.045],[2.29,.032,.053]]) {
        rod(x,y,z,x,y+h,z,r,"#869799");
      }
      for(const y of [.062,2.26])rod(x,y,z,x,y+.012,z,.025,"#526463");
    }

    const skyline=canvasMap(1024,192,(c,w,h)=>{
      const sky=c.createLinearGradient(0,0,0,h);
      sky.addColorStop(0,"#b2c9cc");sky.addColorStop(.53,"#f3d9b6");sky.addColorStop(1,"#c6c9af");
      c.fillStyle=sky;c.fillRect(0,0,w,h);
      for(let layer=0;layer<3;layer++) {
        let x=-10;
        for(let i=0;x<w;i++) {
          const id=i+layer*110;
          const bw=8+seed(id+70)*(layer?50:32),bh=10+seed(id+5)*(layer===0?45:layer===1?84:52);
          const y=143+layer*9-bh;
          c.fillStyle=[["#b4bdba","#b7bfba","#c2c6bd"],["#a7b5b0","#a7b1a8","#b9beb3"],["#839b95","#a0aba1","#a8b0a0"]][layer][i%3];
          c.fillRect(x,y,bw,bh+50);
          if(layer===1){
            c.fillStyle="rgba(234,226,195,.5)";
            for(let px=x+3;px<x+bw-2;px+=6)for(let yy=y+5;yy<y+bh;yy+=7)c.fillRect(px,yy,2,3);
          }
          x+=bw+seed(i+13)*3;
        }
      }
      c.fillStyle="#93a39a";c.fillRect(0,153,w,4);c.fillStyle="#71847c";c.fillRect(0,160,w,5);
      for(let i=0;i<w;i+=61){c.fillRect(i,145,3,30);}
    },true);
    const cityMat=printed(skyline,true);
    const platform=canvasMap(768,256,(c,w,h)=>{
      c.fillStyle="#c5cbc0";c.fillRect(0,0,w,h);
      c.strokeStyle="#abb2a8";c.lineWidth=1.4;
      for(let x=0;x<w;x+=64){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
      for(let y=0;y<h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
      c.fillStyle="#4e896d";c.fillRect(0,131,w,13);c.fillStyle="#e7e5d9";c.fillRect(0,145,w,5);
      c.fillStyle="#777e72";c.fillRect(0,203,w,53);c.fillStyle="#c4ad68";c.fillRect(0,207,w,4);
      c.fillStyle="#2a6255";c.fillRect(212,70,345,45);
      c.fillStyle="#f7f1d9";c.textAlign="center";c.textBaseline="middle";
      c.font="bold 26px "+koreanFont;c.fillText("②   서울 지하철",384,91);
    });
    platform.wrapS=T.RepeatWrapping;
    const platformMat=printed(platform,true);
    const ringMap=canvasMap(176,176,(c,w,h)=>{
      c.fillStyle="#e5e5cf";c.fillRect(0,0,w,h);
      c.fillStyle="#237649";c.beginPath();c.arc(88,88,64,0,Math.PI*2);c.fill();
      c.fillStyle="#fbf6df";c.textAlign="center";c.textBaseline="middle";c.font="bold 110px Arial";c.fillText("2",88,96);
    });
    const roundel=printed(ringMap);
    const diagram=printed(canvasMap(960,110,(c,w,h)=>{
      c.fillStyle="#eeece0";c.fillRect(0,0,w,h);
      c.fillStyle="#22784f";c.fillRect(0,0,172,h);
      c.fillStyle="#fff8e3";c.font="bold 31px "+koreanFont;c.fillText("②  2호선",19,55);
      c.font="13px Arial";c.fillText("SEOUL METRO",25,84);
      c.strokeStyle="#308557";c.lineWidth=6;c.beginPath();c.moveTo(187,48);c.lineTo(934,48);c.stroke();
      ["구로디지털단지","대림","신도림","문래","영등포구청","당산","합정"].forEach((s,i)=>{
        const x=232+i*110;c.fillStyle="#2b7252";c.beginPath();c.arc(x,48,9,0,Math.PI*2);c.fill();
        c.fillStyle="#f5f0dd";c.beginPath();c.arc(x,48,4.1,0,Math.PI*2);c.fill();
        c.fillStyle="#3b4940";c.textAlign="center";c.font="bold 17px "+koreanFont;c.fillText(s,x,84);
      });
    }));
    const travelPoster=printed(canvasMap(192,260,(c,w,h)=>{
      c.fillStyle="#e9e3cf";c.fillRect(0,0,w,h);c.fillStyle="#5f9d9b";c.fillRect(12,12,168,175);
      c.fillStyle="#eac889";c.beginPath();c.arc(134,55,19,0,Math.PI*2);c.fill();
      c.fillStyle="#638775";c.beginPath();c.moveTo(12,143);c.bezierCurveTo(42,125,65,67,99,93);c.bezierCurveTo(134,121,140,111,180,77);c.lineTo(180,187);c.lineTo(12,187);c.fill();
      c.fillStyle="#416c59";c.beginPath();c.moveTo(12,145);c.bezierCurveTo(59,100,111,169,180,124);c.lineTo(180,187);c.lineTo(12,187);c.fill();
      c.fillStyle="#2e5149";c.font="bold 23px "+koreanFont;c.fillText("서울 산책",16,220);
      c.font="11px Arial";c.fillText("SEOUL CITY WALKS",17,241);
    }));
    const displayMap=canvasMap(640,77,()=>{});
    const displayMat=printed(displayMap,true);
    function paintDisplay(state) {
      const c=displayMap.image.getContext("2d");
      c.fillStyle="#1e302b";c.fillRect(0,0,640,77);
      c.fillStyle="#73b881";c.fillRect(0,0,8,77);
      c.textAlign="left";c.textBaseline="middle";c.font="bold 31px "+koreanFont;c.fillStyle="#e5f4bf";
      c.fillText(state.station ? (state.doorsOpen?"이번 역  ":"다음 역  ")+state.station : "②   서울교통공사",26,40);
      c.font="bold 19px Arial";c.textAlign="right";c.fillStyle="#a5c399";c.fillText("SEOUL METRO",613,40);
      displayMap.needsUpdate=true;
    }
    paintDisplay({});
    const L=12.7, rear=-.58, near=2.75, midZ=(near+rear)/2, gap=near-rear;
    const green="#26805b", cream="#e8e4cd", metal="#b8c0b8", dark="#4b5957";
    box(0,-.045,midZ,2*L,.09,gap+.02,"#afa997",lino);
    for(let x=-11.4;x<L;x+=1.90)box(x,.001,midZ,.004,.002,gap,"#959587",rubber);
    for(const z of [-.12,2.31])box(0,.003,z,2*L,.003,.012,"#929489",rubber);
    box(0,2.41,midZ,2*L,.1,gap+.05,"#dadcc9");
    for(const z of [rear+.2,near-.2]){
      box(0,2.315,z,2*L,.10,.45,"#d1d4c3");
      box(0,2.257,z,2*L,.012,.35,"#9ca69b",alloy);
      box(0,2.25,z,2*L,.012,.275,"#e6e5d1");
    }
    for(const x of [-10.05,-6.7,-3.35,0,3.35,6.7,10.05]) {
      for(const z of [midZ-.61,midZ+.61]){
        roundBox(x,2.337,z,2.83,.065,.17,.023,"#9ba79c",alloy);
        roundBox(x,2.30,z,2.74,.027,.122,.013,"#fff1c7",luminous);
        for(const dx of [-1.34,1.34])box(x+dx,2.294,z,.023,.015,.135,"#abb0a0",alloy);
      }
      box(x+1.61,2.354,midZ,.012,.013,2.66,"#b1baac",alloy);
      for(let j=0;j<5;j++)box(x,2.351,midZ+(j-2)*.042,.76,.014,.011,"#919b8e");
    }
    // Twin rounded bench rows and their slotted heater grilles.
    const seatCenters=[-9.99,-3.332,3.304,9.99], doorXs=[-6.66,0,6.66], ends=[-L,L];
    function bench(cx,wall,side) {
      const z=off=>wall+side*off;
      const size=3.36;
      place(cx,.009,z(.45),size+.50,1.47,1,-Math.PI/2);collect(pane,benchShadow);
      roundBox(cx,.229,z(.416),size,.284,.535,.035,"#9ba8a3",alloy);
      roundBox(cx,.15,z(.421),size-.06,.17,.55,.024,"#91a099",alloy);
      box(cx,.117,z(.708),size-.07,.024,.01,"#647670",alloy);
      for(let k=-1;k<=1;k++) {
        const sx=cx+k*.925;
        for(let j=0;j<5;j++) box(sx,.191+j*.015,z(.694),.66,.005,.008,"#4c6661",rubber);
      }
      roundBox(cx,.348,z(.495),size+.036,.068,.625,.031,"#b3c0b7",alloy);
      roundBox(cx,.413,z(.477),size,.11,.64,.050,"#408371",cloth);
      roundBox(cx,.454,z(.745),size-.082,.013,.027,.006,"#669780",cloth);
      const cushionLength=(size-.07)/3;
      for(let i=0;i<3;i++) {
        const sx=cx+(i-1)*cushionLength;
        roundBox(sx,.691,z(.22),cushionLength-.015,.477,.134,.064,i===1?"#589a86":"#51947f",cloth,-side*.095);
        roundBox(sx,.904,z(.247),cushionLength-.124,.013,.018,.006,"#79a590",cloth);
      }
      for(const sign of [-1,1]) {
        const x=cx+sign*(size/2+.033);
        rod(x,.175,z(.56),x,.845,z(.56),.020,metal);
        rod(x,.849,z(.56),x,.981,z(.283),.020,metal);
        rod(x,.981,z(.283),x,.981,z(.075),.020,metal);
        rod(x,.447,z(.688),x,.50,z(.688),.025,"#6f8179");
      }
    }
    const handlePath=new T.CatmullRomCurve3([
      new T.Vector3(0,.07,0),new T.Vector3(-.032,.041,0),new T.Vector3(-.083,-.048,0),
      new T.Vector3(-.078,-.068,0),new T.Vector3(-.055,-.074,0),new T.Vector3(.057,-.074,0),
      new T.Vector3(.08,-.066,0),new T.Vector3(.082,-.049,0),new T.Vector3(.030,.043,0)
    ],true,"centripetal");
    const handle=new T.TubeGeometry(handlePath,28,.014,8,true);
    function fittings(wall,side) {
      const z=off=>wall+side*off;
      for(const h of [2.033,2.015])rod(-L+.15,h,z(h===2.033?.79:.38),L-.15,h,z(h===2.033?.79:.38),h===2.033?.019:.014,metal);
      for(let i=-17;i<=17;i++){
        const x=i*.70+.075, angle=seed(i+90)*.22-.11;
        const zx=z(.79);
        rod(x,2.028,zx,x,1.91,zx,.009,"#777c6b",rubber);
        rod(x-.024,2.033,zx,x+.024,2.033,zx,.024,"#919785");
        rod(x-.012,1.92,zx,x+.012,1.92,zx,.014,"#b0ad90");
        place(x,1.85,zx,1,1,1,.035*Math.sin(i),angle,Math.sin(i*.72)*.055);
        collect(handle,enamel,i%3?"#388654":"#469467");
      }
      for(const cx of seatCenters) {
        // Luggage racks, supported above head height at either end of a bench.
        for(const zOff of [.12,.24,.36,.49,.61])rod(cx-1.73,1.995,z(zOff),cx+1.73,1.995,z(zOff),zOff===.61?.017:.009,"#adb8af");
        for(const end of [-1,1]) {
          const x=cx+end*1.73;
          rod(x,2.218,z(.048),x,2.005,z(.61),.015,"#a5b0a9");
          rod(x,1.995,z(.051),x,1.995,z(.61),.015,"#a5b0a9");
        }
      }
      for(const x of [-10.35,-6.66,-3.33,0,3.33,6.66,10.35]) {
        rod(x,2.048,z(.79),x,2.345,z(.79),.012,"#a8b1a6");
      }
    }
    function framedWindow(cx,wall,side) {
      const z=off=>wall+side*off, w=3.27;
      // The recessed seals stay visible around the city view from oblique angles.
      roundBox(cx,1.48,z(.042),w+.09,.897,.08,.037,"#8e9990",alloy);
      roundBox(cx,1.48,z(.09),w,.855,.044,.021,"#3f504e",rubber);
      windowView(cx,1.482,z(.116),w-.088,.755,side,cityMat);
      decal(cx,1.482,z(.118),w-.09,.753,side,sheen);
      for(const offset of [-.041,.041])box(cx+offset,1.484,z(.12),.020,.771,.019,"#a9b4ac",alloy);
      box(cx,1.484,z(.113),.066,.77,.017,"#7f918b",rubber);
      box(cx,1.085,z(.12),w-.11,.022,.043,"#bdc4b7",alloy);
    }
    function sideWalls(wall,side) {
      const z=off=>wall+side*off, dw=1.62;
      const openings=doorXs.map(x=>[x-dw/2,x+dw/2]);
      let edge=-L;
      for(const [left,right] of [...openings,[L,L]]) {
        const w=left-edge, cx=(left+edge)/2;
        if(w>.001) {
          box(cx,1.185,wall,w,2.37,.06,cream);
          box(cx,.516,z(.036),w,1.015,.044,"#d4daca");
          box(cx,.069,z(.077),w,.122,.055,"#919c93",alloy);
          box(cx,.134,z(.073),w,.016,.05,"#aeb8ab",alloy);
          box(cx,2.09,z(.038),w,.045,.024,green);
          box(cx,2.125,z(.039),w,.007,.026,"#659c70");
        }
        edge=right;
      }
      for(const c of seatCenters) {
        framedWindow(c,wall,side);bench(c,wall,side);
        const px=c+(c>0?-1:1)*2.02;
        box(px,1.59,z(.047),.37,.50,.041,"#91a396",alloy);
        decal(px,1.59,z(.071),.346,.472,side,travelPoster);
        const badgeX=c+(c>0?1:-1)*2.06;
        decal(badgeX,1.55,z(.046),.34,.34,side,roundel);
        // Poles are outside the sitting bays, leaving the seated actors' hands visible.
        post(c-Math.sign(c)*1.66,z(.90));
        const information= Math.abs(c)<5 && side===1 ? displayMat : diagram;
        roundBox(c,2.133,z(.067),2.42,.21,.094,.029,"#72827b",alloy);
        decal(c,2.133,z(.118),2.343,.163,side,information);
      }
      for(const cx of doorXs) {
        box(cx,2.171,wall,dw+.01,.392,.073,"#d8dcca");
        roundBox(cx,2.035,z(.10),dw+.18,.072,.135,.025,"#9eaca3",alloy);
        roundBox(cx,2.19,z(.07),1.54,.175,.071,.034,"#a1aaa0",alloy);
        decal(cx,2.19,z(.109),1.496,.137,side,diagram);
        for(const sign of [-1,1]){
          const x=cx+sign*(dw/2+.02);
          box(x,1.0,z(.033),.068,2.01,.082,"#8c9a93",alloy);
          box(x-sign*.028,1.0,z(.08),.023,1.99,.036,dark,rubber);
          for(let k=0;k<4;k++)box(x+sign*.054,.43+k*.35,z(.071),.009,.009,.008,"#a7ae9f",alloy);
        }
        box(cx,.006,z(.02),dw,.014,.21,"#a3aa9d",alloy);
        for(let i=0;i<4;i++)box(cx,.014,z(.055+i*.023),dw,.004,.007,"#727f72",rubber);
        decal(cx,1.012,z(-.32),dw+.21,1.95,side,platformMat);
      }
      fittings(wall,side);
    }
    sideWalls(rear,1);sideWalls(near,-1);

    for(const edge of ends){
      const sign=Math.sign(edge);
      box(edge,1.18,midZ,.088,2.36,gap,cream);
      box(edge-sign*.054,.62,midZ,.039,1.24,gap-.05,"#d1d8c9");
      box(edge-sign*.077,2.06,midZ,.034,.044,gap-.05,green);
      for(let j=0;j<3;j++)box(edge-sign*(.089+j*.01),1.004,midZ,.036,2.006-j*.07,1.20-j*.082,["#707d78","#b0b9a9","#576560"][j],rubber);
      box(edge-sign*.136,.964,midZ,.045,1.9,1.018,"#c4ccc1",alloy);
      box(edge-sign*.17,1.32,midZ,.04,.78,.70,"#6c7b74",rubber);
      box(edge-sign*.195,1.32,midZ,.018,.70,.624,"#5a6d66",glass);
      box(edge-sign*.204,1.38,midZ,.016,.50,.33,"#788c7d",glass);
      rod(edge-sign*.193,.895,midZ+.41,edge-sign*.193,1.12,midZ+.41,.023,"#adb9b0");
      for(const dz of [-1.06,1.06]) {
        box(edge-sign*.083,1.06,midZ+dz,.05,.59,.32,"#b2bcae",alloy);
        box(edge-sign*.111,1.22,midZ+dz,.029,.125,.15,dz>0?"#ab6c53":"#7b9180");
        for(let i=0;i<5;i++)box(edge-sign*.113,.96-i*.027,midZ+dz,.017,.008,.209,"#7e8b7e",alloy);
      }
    }
    flush(root);
    // A door leaf is batched once, then reused. Its glass, frame, and grip travel together.
    function doorLeaf(side,sign) {
      const z=off=>side*off, width=.806, outer="#c3cabe";
      roundBox(0,.52,z(.018),width,1.035,.073,.028,outer,alloy);
      roundBox(0,1.867,z(.018),width,.277,.073,.027,outer,alloy);
      for(const edge of [-1,1])box(edge*(width/2-.055),1.39,z(.018),.11,.73,.071,outer,alloy);
      roundBox(0,1.394,z(.041),width-.143,.767,.065,.031,"#435752",rubber);
      windowView(0,1.397,z(.078),width-.22,.668,side,cityMat,sign*.403);
      box(0,1.035,z(.080),width-.21,.015,.014,"#a7b4aa",alloy);
      box(-sign*(width/2-.01),1.006,z(.075),.018,1.98,.022,"#4c5c56",rubber);
      box(0,.89,z(.065),width-.06,.042,.017,green);
      box(0,.062,z(.063),width-.071,.077,.024,"#a5afa2",alloy);
      const leaf=new T.Group();flush(leaf);return leaf;
    }
    for(const [wall,side] of [[rear,1],[near,-1]])for(const sign of [-1,1]){
      const template=doorLeaf(side,sign);
      for(const cx of doorXs) {
        const leaf=template.clone();
        const closedX=cx+sign*.403;
        leaf.position.set(closedX,0,wall-.002*side);
        root.add(leaf);doors.push({leaf,sign,side,closedX,closedZ:leaf.position.z});
      }
    }
    let lastTime=0,opening=0,displayKey="",street=0,stationView=false;
    function update(state,time) {
      const dt=Math.max(0,Math.min(.15,time-lastTime));lastTime=time;
      if(state.phase==="ride"||state.phase==="seated")street=(street+dt*.014)%1;
      skyline.offset.x=street;
      const stopped=!!state.doorsOpen;
      if(stationView!==stopped) {
        cityMat.map=stopped?platform:skyline;cityMat.needsUpdate=true;stationView=stopped;
      }
      const next=stopped?1:0;
      if(opening!==next) {
        opening+=Math.sign(next-opening)*Math.min(Math.abs(next-opening),dt*1.7);
        const travel=opening*opening*(3-2*opening);
        const activeSide=state.leg==="pm"?-1:1;
        for(const {leaf,sign,side,closedX,closedZ} of doors){
          const open=activeSide===side?travel:0;
          leaf.position.x=closedX+sign*open*.71;
          leaf.position.z=closedZ-side*open*.10;
        }
      }
      const key=[state.station,state.doorsOpen].join("-");
      if(key!==displayKey){paintDisplay(state);displayKey=key;}
    }
    return {update,blockers};
  }
  window.SubwayCar3D={build};
})();
