/* First-person cameras, actors and interactions share the same metre-scale carriage. */
(() => {
  "use strict";

  const METRES_X = .014;
  const METRES_Z = .022;
  const START_YAW = -50 * Math.PI / 180;
  const START_PITCH = 11 * Math.PI / 180;
  const MAX_PITCH = 76 * Math.PI / 180;
  const worldX = x => (x - 420) * METRES_X;
  const worldZ = y => (y - 182) * METRES_Z;
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));

  // Beyond the playable bay, groups fill the adjacent vestibules. The four neighbours
  // inside the bay also participate in walking, collision and occlusion tests.
  const crowd = [
    [-8.48,.47,5,.36],[-8.03,1.27,1,2.75],[-7.51,.77,11,1.21],[-7.06,2.02,4,-2.4],
    [-6.63,1.34,9,-1.74],[-6.11,1.96,7,2.72],[-5.97,.69,3,.32],
    [6.05,1.88,8,1.93],[6.26,.65,4,-1.60],[6.92,1.32,11,-.68],
    [7.42,2.02,2,-1.32],[7.80,.84,5,2.54],[8.35,1.37,9,-1.74],
  ];
  const aisleRiders = [
    [-2.78,1.60,0,-1.05], [-1.03,.73,7,2.94],
    [1.53,1.23,1,.72], [3.54,1.03,6,-2.72],
  ];

  function create(canvas) {
    const T = window.THREE;
    if (!T || !window.SubwayCar3D || !window.SubwayPuppets3D) return null;
    let renderer;
    try {
      const settings = {antialias:true,alpha:false,depth:true,stencil:false,powerPreference:"high-performance"};
      const context = canvas.getContext("webgl2",settings);
      if (!context) return null;
      renderer = new T.WebGLRenderer({canvas,context,...settings});
    } catch { return null; }
    const originalAspect = canvas.width / canvas.height;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;
    const scene = new T.Scene();
    scene.background = new T.Color(0xd5d5c7);
    scene.fog = new T.Fog(0xc9c8bb, 10, 25);
    const skylight = new T.HemisphereLight(0xe7effb, 0xb2a698, 1.62);
    const key = new T.DirectionalLight(0xffe5c2, 2.02);
    key.position.set(-4,6,3.8);
    const windowLight = new T.DirectionalLight(0xe0ebf6, .90);
    windowLight.position.set(3.5,2.8,-3.1);
    scene.add(skylight,key,windowLight);
    const car = window.SubwayCar3D.build(T,scene) || {};
    scene.updateMatrixWorld();
    const posts = (car.blockers || []).map(post => new T.Vector3().setFromMatrixPosition(post.matrixWorld));
    scene.traverse(object => object.layers.enable(1));

    const camera = new T.PerspectiveCamera(58, originalAspect, .045, 38);
    camera.rotation.order = "YXZ";
    const inspectionCamera = new T.PerspectiveCamera(36, 1, .045, 20);
    inspectionCamera.layers.set(1);
    const raycaster = new T.Raycaster();
    const pointer = new T.Vector2();
    const projected = new T.Vector3();
    const floorIntersection = new T.Vector3();
    const hitCandidates = [];
    const floor = new T.Plane(new T.Vector3(0,1,0), 0);
    const seatGeometry = new T.BoxGeometry(.68,.14,.53);
    const hitMaterial = new T.MeshBasicMaterial();
    const seatBoxes = [];
    const cast = new Map();
    const portraitCast = new Map();
    const available = new Map();
    const actors = new T.Group();
    scene.add(actors);

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 64;
    const brush = shadowCanvas.getContext("2d");
    const shade = brush.createRadialGradient(32,32,0,32,32,32);
    shade.addColorStop(0,"rgba(31,27,23,.65)");
    shade.addColorStop(.42,"rgba(40,37,27,.36)");
    shade.addColorStop(1,"rgba(45,42,33,0)");
    brush.fillStyle = shade;
    brush.fillRect(0,0,64,64);
    const shadow = new T.CanvasTexture(shadowCanvas);
    shadow.colorSpace = T.SRGBColorSpace;
    const shadowPlane = new T.PlaneGeometry(1,1);
    shadowPlane.rotateX(-Math.PI/2);
    const contact = new T.InstancedMesh(shadowPlane,
      new T.MeshBasicMaterial({map:shadow,transparent:true,depthWrite:false}),128);
    contact.count = 0;
    contact.frustumCulled = false;
    const stamp = new T.Object3D();
    scene.add(contact);

    let yaw = START_YAW, pitch = START_PITCH, seated = false;
    let lastState, lastTime = 0, portrait, lastPortraitFrame = "";
    let activeActors = [], lastCastTick = -1, resizeWidth = 0;
    const seatVisibility = new Map();
    const leaveGroup = new Set();
    let portraitStamp = 0, needsPortrait = false;
    let shadowCount = 0;

    function resize() {
      const pixelRatio = Math.min(1.5,window.devicePixelRatio || 1);
      const width = clamp(Math.round((canvas.clientWidth || canvas.width) * pixelRatio),440,1440);
      if (resizeWidth === width) return;
      resizeWidth = width;
      renderer.setSize(width, Math.round(width/originalAspect), false);
      camera.aspect = canvas.width / canvas.height;
      camera.updateProjectionMatrix();
    }

    function resetLook() {
      yaw = seated ? Math.PI*.80 : START_YAW;
      pitch = seated ? .02 : START_PITCH;
      seatVisibility.clear();
    }

    function look(dx,dy) {
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      yaw = (yaw + dx) % (2*Math.PI);
      pitch = clamp(pitch + dy,-MAX_PITCH,MAX_PITCH);
      seatVisibility.clear();
      if (lastState) placeCamera(lastState);
    }

    function placeCamera(state) {
      const sitting = state.seatedIndex != null;
      if (sitting !== seated || (lastState && lastState !== state)) {
        seated = sitting;
        resetLook();
      }
      camera.position.set(worldX(state.player.x),sitting ? 1.10 : 1.55,
        worldZ(state.player.y) + (sitting ? .11 : 0));
      camera.rotation.set(-pitch,-yaw,0,"YXZ");
      camera.updateMatrixWorld();
    }

    function moveInput(strafe,forward) {
      const magnitude = Math.max(1,Math.hypot(strafe,forward));
      const side = strafe/magnitude, ahead = forward/magnitude;
      return {x: side*Math.cos(yaw) + ahead*Math.sin(yaw),
        y: (side*Math.sin(yaw) - ahead*Math.cos(yaw))*METRES_X/METRES_Z};
    }

    function benchLimit(x) {
      return Math.abs(x+3.332)<1.80 || Math.abs(x-3.304)<1.80 ? 1.83 : Infinity;
    }

    function obstacleAt(x,y) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return "fixture";
      const wx = worldX(x), wz = worldZ(y);
      if (wz>benchLimit(wx)) return "fixture";
      for (const p of posts) if (Math.hypot(wx-p.x,wz-p.z)<.16) return "fixture";
      for (let i=0;i<aisleRiders.length;i++) {
        if (lastState?.leg==="pm" && i%2===1) continue;
        const [ax,az] = aisleRiders[i];
        if (Math.hypot(wx-ax,wz-az)<.33) return "passenger";
      }
      return null;
    }

    const canStandAt = (x,y) => obstacleAt(x,y) === null;

    function contactPatch(x,z,y,width,depth,angle) {
      stamp.position.set(x,y,z);
      stamp.scale.set(width,1,depth);
      stamp.rotation.y = angle;
      stamp.updateMatrix();
      contact.setMatrixAt(shadowCount++,stamp.matrix);
    }

    function acquire(id) {
      const spare = available.get(id)?.pop();
      const rig = spare || window.SubwayPuppets3D.create(T,id);
      rig.root.visible = true;
      actors.add(rig.root);
      return rig;
    }

    function release(entry) {
      actors.remove(entry.rig.root);
      if (!available.has(entry.id)) available.set(entry.id,[]);
      available.get(entry.id).push(entry.rig);
    }

    function actor(key,id,x,z,angle,pose,seatIndex,frame) {
      if (id == null) return;
      leaveGroup.delete(key);
      let entry = cast.get(key);
      if (!entry || entry.id !== id) {
        if (entry) release(entry);
        const rig = acquire(id);
        const capsules = (rig.hitVolumes || []).map(part => ({
          bone:part.bone, from:new T.Vector3().fromArray(part.from), to:new T.Vector3().fromArray(part.to),
          start:new T.Vector3(), end:new T.Vector3(), localRadius:part.radius, radius:part.radius,
        }));
        entry = {id,rig,capsules,center:new T.Vector3(), seatIndex};
        cast.set(key,entry);
      }
      const root = entry.rig.root;
      root.position.set(x,-.014,z);
      root.rotation.y = angle;
      entry.seatIndex = seatIndex;
      const poseKey = [pose.seated,pose.action,pose.walking,pose.standingGrip,pose.doorSide,
        Math.floor((pose.actionTime || 0)*12),frame].join("/");
      if (entry.lastPose !== poseKey) {
        entry.rig.update(pose,lastTime);
        entry.lastPose = poseKey;
      }
      root.updateWorldMatrix(true,true);
      for (const cap of entry.capsules) {
        cap.start.copy(cap.from).applyMatrix4(cap.bone.matrixWorld);
        cap.end.copy(cap.to).applyMatrix4(cap.bone.matrixWorld);
        cap.radius = cap.localRadius * cap.bone.matrixWorld.getMaxScaleOnAxis();
      }
      entry.center.set(x,pose.seated ? .77 : .95,z+.05);
      entry.bound = pose.seated ? 1.10 : 1.19;
      activeActors.push(entry);
      contactPatch(x,z+(pose.seated ? Math.cos(angle)*.18 : 0),.011,
        pose.seated ? .80 : .73,pose.seated ? .77 : .59,angle);
      for (const cap of entry.capsules) {
        if (cap.bone.name==="footL" || cap.bone.name==="footR") {
          contactPatch((cap.start.x+cap.end.x)*.5,(cap.start.z+cap.end.z)*.5,.013,.24,.36,angle);
        }
      }
    }

    function populate(state,time) {
      activeActors = [];
      leaveGroup.clear();
      for (const key of cast.keys()) leaveGroup.add(key);
      const frame = Math.floor(time*12);
      shadowCount = 0;
      state.seats.forEach((seat,index) => {
        const x = worldX(seat.x);
        const proxy = seatBoxes[index] || (seatBoxes[index] = new T.Mesh(seatGeometry,hitMaterial));
        proxy.position.set(x,.437,-.014);
        proxy.updateMatrixWorld();
        proxy.userData.seatIndex = index;
        if (index === state.seatedIndex) return;
        actor("bench"+index,seat.person,x,0,0,{seated:true,action:seat.action,actionTime:seat.actionTime,
          doorSide:x<0 ? 1 : -1,view:"front"},index,frame);
      });
      state.riders.forEach((rider,i) => {
        const x = worldX(rider.x), z = worldZ(rider.y);
        let angle = rider.person*2.16+.2;
        const walking = rider.kind==="leaving" || (rider.kind==="rival" && state.doorsOpen);
        if (rider.kind==="leaving") angle = Math.atan2(-x,.4-z);
        else if (rider.kind==="rival" && state.doorsOpen) {
          const destination = state.seats.find(seat => seat.person == null);
          if (destination) angle = Math.atan2(worldX(destination.x)-x,-z);
        }
        actor(rider,rider.person,x,z,angle,{seated:false,walking,standingGrip:!walking && i%3===0,
          action:"idle",actionTime:0,doorSide:i%2 ? -1 : 1,view:"front"},-1,frame);
      });
      crowd.forEach(([x,z,id,angle],i) => {
        if (state.leg==="pm" && i%3===0) return;
        actor("crowd"+i,(id+state.day-1)%13,x,z,angle,{seated:false,standingGrip:i%3===1,
          action:"idle",actionTime:0,doorSide:i%2 ? -1 : 1,view:"front"},-1,frame);
      });
      aisleRiders.forEach(([x,z,id,angle],i) => {
        if (state.leg==="pm" && i%2===1) return;
        actor("aisle"+i,(id+state.day-1)%13,x,z,angle,{seated:false,standingGrip:i%2===1,
          action:"idle",actionTime:0,doorSide:i%2 ? 1 : -1,view:"front"},-1,frame);
      });
      const oppositeBench = [-4.25,-3.32,-2.41,2.38,3.30,4.24];
      oppositeBench.forEach((x,i) => {
        if (state.leg==="pm" && i%3===1) return;
        actor("opposite"+i,(i*3+state.day+2)%13,x,2.27,Math.PI,{seated:true,action:"idle",
          actionTime:0,doorSide:i%2 ? -1 : 1,view:"front"},-1,frame);
      });
      for (const key of leaveGroup) {release(cast.get(key));cast.delete(key);}
      contact.count = shadowCount;
      contact.instanceMatrix.needsUpdate = true;
      lastCastTick = frame;
    }

    function update(state,time) {
      resize();
      placeCamera(state);
      const changed = lastState !== state;
      lastState = state;
      lastTime = time;
      populate(state,time);
      car.update?.(state,time);
      scene.updateMatrixWorld();
      if (changed) lastPortraitFrame = "";
      seatVisibility.clear();
    }

    function prepare(state) {
      if (lastState !== state || lastCastTick < 0) update(state,lastTime);
      else placeCamera(state);
    }

    function projectedPoint(point) {
      projected.copy(point).project(camera);
      if (projected.z <= -1 || projected.z >= 1) return null;
      return {x:(projected.x+1)*.5,y:(1-projected.y)*.5};
    }

    const offset = new T.Vector3(), axis = new T.Vector3();
    function sphereHit(origin,direction,center,radius) {
      offset.subVectors(origin,center);
      const b = offset.dot(direction), c = offset.lengthSq()-radius*radius;
      if (c <= 0) return 0;
      const h = b*b-c;
      return h<0 || b>=0 ? Infinity : -b-Math.sqrt(h);
    }

    function capsuleHit(origin,direction,cap,limit) {
      axis.subVectors(cap.end,cap.start);
      offset.subVectors(origin,cap.start);
      const length2 = axis.lengthSq(), along = axis.dot(direction), fromStart = axis.dot(offset);
      const a = length2-along*along, b = length2*direction.dot(offset)-fromStart*along;
      const c = length2*(offset.lengthSq()-cap.radius*cap.radius)-fromStart*fromStart;
      const h = b*b-a*c;
      if (h>=0 && a>1e-8) {
        const t = (-b-Math.sqrt(h))/a, at = fromStart+t*along;
        if (t>=0 && t<limit && at>=0 && at<=length2) return t;
      }
      return Math.min(sphereHit(origin,direction,cap.start,cap.radius),
        sphereHit(origin,direction,cap.end,cap.radius));
    }

    function hitAt(state,u,v) {
      pointer.set(u*2-1,1-v*2);
      raycaster.setFromCamera(pointer,camera);
      const ray = raycaster.ray;
      let closest = Infinity, index = -1, blocked = false;
      hitCandidates.length = 0;
      if (car.blockers?.length) raycaster.intersectObjects(car.blockers,false,hitCandidates);
      if (hitCandidates.length) {closest=hitCandidates[0].distance;blocked=true;}
      for (const entry of activeActors) {
        const bound = sphereHit(ray.origin,ray.direction,entry.center,entry.bound);
        if (bound >= closest) continue;
        let nearest = Infinity;
        if (entry.capsules.length) {
          for (const cap of entry.capsules) nearest = Math.min(nearest,capsuleHit(ray.origin,ray.direction,cap,closest));
        } else {
          hitCandidates.length = 0;
          raycaster.intersectObject(entry.rig.root,true,hitCandidates);
          if (hitCandidates.length) nearest = hitCandidates[0].distance;
        }
        if (nearest < closest) {closest=nearest;index=entry.seatIndex;blocked=true;}
      }
      state.seats.forEach((seat,i) => {
        if (seat.person!=null || i===state.seatedIndex) return;
        hitCandidates.length = 0;
        raycaster.intersectObject(seatBoxes[i],false,hitCandidates);
        if (hitCandidates.length && hitCandidates[0].distance<closest) {
          closest=hitCandidates[0].distance;index=i;blocked=true;
        }
      });
      return {index,blocked,distance:closest};
    }

    function pick(_canvas,state,u,v) {
      const empty = {index:-1,goal:null};
      if (!(u>=0 && u<=1 && v>=0 && v<=1)) return empty;
      prepare(state);
      const hit = hitAt(state,u,v);
      if (hit.index>=0) return {index:hit.index,goal:null};
      const point = raycaster.ray.intersectPlane(floor,floorIntersection);
      if (!point || (hit.blocked && hit.distance < camera.position.distanceTo(point))) return empty;
      const x = point.x/METRES_X+420, y = point.z/METRES_Z+182;
      if (x<24 || x>816 || y<196 || y>298) return empty;
      const goalX = clamp(x,32,808);
      const goalY = Math.min(clamp(y,208,290),benchLimit(worldX(goalX))/METRES_Z+182);
      return canStandAt(goalX,goalY) ? {index:-1,goal:{x:goalX,y:goalY}} : empty;
    }

    const sample = new T.Vector3();
    function seatPoint(state,index) {
      prepare(state);
      if (seatVisibility.has(index)) return seatVisibility.get(index);
      const seat = state.seats[index];
      if (!seat || index===state.seatedIndex) return null;
      const x = worldX(seat.x);
      const heights = seat.person==null ? [.49,.44] : [1.14,.94,.73,1.27,.54,.25];
      for (const y of heights) {
        const z = seat.person==null ? .07 : y<.6 ? .31 : .08;
        for (const dx of [0,-.095,.095]) {
          const point = projectedPoint(sample.set(x+dx,y,z));
          if (!point || point.x<.006 || point.x>.994 || point.y<.01 || point.y>.99) continue;
          if (hitAt(state,point.x,point.y).index === index) {
            seatVisibility.set(index,point);return point;
          }
        }
      }
      seatVisibility.set(index,null);return null;
    }

    function seatFrame(state,index) {
      prepare(state);
      if (!state.seats[index]) return null;
      const x = worldX(state.seats[index].x);
      const feet = projectedPoint(sample.set(x,0,.14));
      const top = projectedPoint(sample.set(x,1.68,.10));
      return feet && top ? {...feet,height:Math.abs(feet.y-top.y)} : null;
    }

    function floorPoint(state,x,y) {
      prepare(state);
      return projectedPoint(sample.set(worldX(x),0,worldZ(y)));
    }

    function paintPortrait() {
      if (!portrait) return;
      const {output,id,seat} = portrait;
      const tick = [portraitStamp,Math.floor(lastTime*12),seat?.action,
        Math.floor((seat?.actionTime||0)*12),seat?.x].join("/");
      if (tick===lastPortraitFrame) return;
      const c = output.getContext("2d");
      if (!c) return;
      lastPortraitFrame = tick;
      const x = worldX(seat?.x ?? 248);
      let rig;
      if (id != null) {
        rig = portraitCast.get(id);
        if (!rig) {
          rig = window.SubwayPuppets3D.create(T,id);
          rig.root.traverse(node => node.layers.set(1));
          scene.add(rig.root);
          portraitCast.set(id,rig);
        }
        rig.root.visible = true;
        rig.root.position.set(x,0,0);
        rig.update({seated:true,action:seat?.action || "idle",actionTime:seat?.actionTime || 0,
          doorSide:x<0 ? 1 : -1,view:"front"},lastTime);
      }
      const rise = seat?.action==="rise" ? Math.min(1,seat.actionTime) : 0;
      inspectionCamera.aspect = output.width / output.height;
      inspectionCamera.position.set(x+.30,1.03+rise*.13,2.34+rise*.35);
      inspectionCamera.lookAt(x,.72+rise*.15,.08);
      inspectionCamera.updateProjectionMatrix();
      const ratio = Math.min(1,canvas.width/output.width,canvas.height/output.height);
      const w = Math.round(output.width*ratio), h = Math.round(output.height*ratio);
      renderer.setViewport(0,0,w,h);
      renderer.setScissor(0,0,w,h);
      renderer.setScissorTest(true);
      renderer.render(scene,inspectionCamera);
      c.drawImage(canvas,0,canvas.height-h,w,h,0,0,output.width,output.height);
      renderer.setScissorTest(false);
      renderer.setViewport(0,0,canvas.width,canvas.height);
      if (rig) rig.root.visible = false;
    }

    function draw(_canvas,state,time=0) {
      update(state,time);
      if (needsPortrait) paintPortrait();
      needsPortrait = false;
      renderer.render(scene,camera);
    }

    function observe(output,id,seat,time=0) {
      needsPortrait = true;
      if (portrait?.output===output && portrait.id===id && portrait.seat===seat) return;
      portrait = {output,id,seat};
      portraitStamp++;
      lastTime = time;
      paintPortrait();
      renderer.render(scene,camera);
    }

    return {is3D:true,draw,observe,pick,seatPoint,seatFrame,floorPoint,look,moveInput,resetLook,canStandAt,obstacleAt,
      outfit:id=>window.Commuters.outfit(id),describe:(id,seat)=>window.Commuters.describe(id,seat)};
  }

  window.SubwayWorld3D = {create};
})();
