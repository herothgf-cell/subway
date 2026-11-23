(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  let canvas = $("scene");
  let world;
  try {
    world = window.SubwayWorld3D?.create(canvas);
  } catch (error) {
    console.error("3D 객차를 열 수 없습니다.", error);
  }
  if (world) {
    window.SubwayArt = world;
    canvas.classList.add("free-look");
  } else {
    // A canvas that already acquired WebGL cannot also create a 2D context.
    const replacement = canvas.cloneNode(false);
    canvas.replaceWith(replacement);
    canvas = replacement;
    canvas.setAttribute("aria-label","2호선 객차. WASD로 이동하고 승객을 클릭해 하차를 예상합니다.");
  }
  const game = window.SubwayGame.create(world ? {startPosition:{x:350,y:264}, obstacleAt:world.obstacleAt} : undefined);
  const dialog = $("dialog");
  const keys = new Set();
  const moves = new Set(["KeyW","KeyA","KeyS","KeyD","ArrowLeft","ArrowRight","ArrowUp","ArrowDown"]);
  const east = ["대림","신도림","문래","영등포구청"];
  const icons = id => '<svg aria-hidden="true"><use href="#i-' + id + '"/></svg>';
  let paused = false;
  let goal = null;
  let lastPhase = "";
  let routeKey = "";
  let viewIndex = 0;
  let dialogType = "";
  let audioEnabled = false;
  let audioContext;
  let lastFrame;
  let lastPaint = -Infinity;
  let lastHud = -Infinity;
  let animationTime = 0;
  let gesture = null;
  let lastLockExit = -Infinity;
  let feedbackTimer;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  $("view-mode").textContent = world ? "3D · 02호차" : "기본 시점 · 3D 미지원";
  $("view-lock").hidden = !world || !canvas.requestPointerLock || !window.matchMedia("(any-pointer: fine)").matches;
  $("look-control").hidden = !world;
  try { audioEnabled = localStorage.getItem("subway-sound") === "on"; } catch {}

  function setText(id, value) {
    const el = $(id);
    const string = String(value);
    if (el.textContent !== string) el.textContent = string;
  }

  function changeIcon(button, id) {
    const use = button.querySelector("use");
    if (use.getAttribute("href") !== "#i-" + id) use.setAttribute("href", "#i-" + id);
  }

  function chime(notes) {
    if (!audioEnabled || !audioContext || audioContext.state !== "running") return;
    notes.forEach((frequency, i) => {
      const start = audioContext.currentTime + i * .12;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.08, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .24);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + .25);
    });
  }

  function unlockAudio() {
    if (!audioEnabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audioContext ??= new Audio();
      if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    } catch {}
  }

  function updateSound() {
    const button = $("sound");
    button.setAttribute("aria-pressed", String(audioEnabled));
    const label = audioEnabled ? "소리 켜짐" : "소리 꺼짐";
    button.querySelector("span").textContent = label;
    changeIcon(button, audioEnabled ? "volume" : "muted");
  }

  function active() {
    return ["ride","stop","seated"].includes(game.getState().phase);
  }

  function cancelGesture() {
    const id = gesture?.id;
    gesture = null;
    canvas.classList.remove("turning");
    if (id != null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  function clearInput() {
    keys.clear();
    goal = null;
    cancelGesture();
  }

  function releaseLook() {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  }

  function occupant(s, index) {
    return s.seatedIndex === index ? "player" : s.seats[index].person;
  }

  function showSeat(index) {
    const s = game.getState();
    viewIndex = (index + s.seats.length) % s.seats.length;
    updateObservation(s);
  }

  function updateObservation(s) {
    const seat = s.seats[viewIndex];
    const id = occupant(s,viewIndex);
    const canSee = window.SubwayArt.seatPoint(s,viewIndex) != null || s.seatedIndex === viewIndex;
    const inRide = s.phase === "ride" && s.stopIndex < 2;
    setText("view-number", seat.label);
    const title = id == null ? "빈 좌석" : id === "player" ? "내가 앉은 자리" : window.SubwayArt.outfit(id);
    setText("observation-title", canSee ? title : "지금 위치에서는 볼 수 없어요");
    $("view-blocked").hidden = canSee;
    $("observation-view").style.visibility = canSee ? "visible" : "hidden";
    setText("observation-text", s.phase === "ready" ? "화살표를 누르거나 좌석에 마우스를 올려 살펴보세요." : "");
    $("observation-text").hidden = s.phase !== "ready";
    $("prediction-controls").hidden = !inRide;
    setText("selection-number", s.selectedIndex == null ? "아직 고르지 않았어요" : "내 예상 · " + s.seats[s.selectedIndex].label);
    $("predict-view").disabled = !inRide || !canSee || paused || id == null || s.selectedIndex === viewIndex;
    setText("predict-view", s.selectedIndex === viewIndex ? "예상 중" : "이 승객 예상");
    const description = canSee ? window.SubwayArt.describe(id,seat) : "지금 위치에서는 볼 수 없는 좌석";
    const label = seat.label + ". " + description;
    if ($("observation-view").getAttribute("aria-label") !== label) $("observation-view").setAttribute("aria-label", label);
  }

  function interact(index) {
    const s = game.getState();
    const previous = s.selectedIndex;
    game.interact(index, world && (i => !!world.seatPoint(s,i)));
    if (s.seatedIndex != null) showSeat(s.seatedIndex);
    else if (s.selectedIndex != null && s.selectedIndex !== previous) showSeat(s.selectedIndex);
  }
  function togglePause() {
    if (!active() || dialog.open) return;
    paused = !paused;
    clearInput();
    if (paused) releaseLook();
    $("pause-cover").hidden = !paused;
    $("pause").setAttribute("aria-label", paused ? "이어서 운행" : "일시정지");
    $("pause").title = paused ? "이어서 운행" : "일시정지";
    changeIcon($("pause"), paused ? "play" : "pause");
    if (paused) $("resume").focus(); else canvas.focus({preventScroll:true});
    renderHud(game.getState());
  }

  function routeDisplay(s) {
    const key = [s.leg, s.stopIndex, s.phase].join("-");
    if (key === routeKey) return;
    routeKey = key;
    const route = s.leg === "am" ? east : [...east].reverse();
    const list = $("route");
    list.replaceChildren();
    const current = s.phase === "ready" ? 0 : s.phase === "result" ? 3 : s.stopIndex + 1;
    route.forEach((name,i) => {
      const item = document.createElement("li");
      const marker = document.createElement("i");
      marker.className = "stop";
      if (i < current) item.className = "done";
      if (i === current) {
        item.className = s.phase === "ride" ? "next" : "current";
        item.setAttribute("aria-current", "step");
      }
      item.append(marker, document.createTextNode(name));
      list.append(item);
    });
  }

  function renderHud(s) {
    const leg = s.leg === "am" ? "출근" : "퇴근";
    const legTitle = leg + "길 자리 사수";
    if ($("title").firstChild.textContent !== legTitle) $("title").firstChild.textContent = legTitle;
    setText("ticket-day","DAY " + String(s.day).padStart(2,"0"));
    setText("ticket-leg", leg + "행");
    setText("route-meta", leg + " · 3개 정거장");
    setText("phase-name", paused ? "일시정지" : {
      ready:"탑승 대기", ride:s.station + " 방면 · " + s.secondsLeft + "초",
      stop:s.station + " 정차 · " + s.secondsLeft + "초",seated:"착석 성공",result:"운행 종료"
    }[s.phase]);
    $("pause").hidden = !active();
    const vacancy = s.seats.some(seat => seat.person === null);
    const preparingToExit = s.phase === "ride" && s.stopIndex === 2 && !vacancy;
    $("action").disabled = s.phase === "seated" || preparingToExit || paused;
    const rideAction = vacancy ? "착석 시도" : preparingToExit ? "하차 준비" : "자리 확인";
    const actionLabel = {ready:leg + " 시작",ride:rideAction,stop:"착석 시도",seated:"착석 중",result:"결과 보기"}[s.phase];
    const actionSpan = $("action").querySelector("span");
    if (actionSpan.textContent !== actionLabel) actionSpan.textContent = actionLabel;
    changeIcon($("action"), {ready:"play",ride:vacancy ? "turn" : "eye",stop:"turn",seated:"train",result:"arrow"}[s.phase]);
    setText("announcement-label", s.practice ? "같은 배치 연습" : "차내 안내");
    const readyTip = world ? "객차를 드래그해 둘러보세요. 출발 후에는 WASD로 이동할 수 있어요." : "방향키로 사람 사이를 움직이고, 빈자리 앞에서 E를 누르세요.";
    setText("notice", s.phase === "ready" ? readyTip : s.notice || s.status);
    const health = Math.ceil(s.stamina);
    setText("stamina", health);
    $("meter").setAttribute("aria-valuenow", health);
    $("meter").classList.toggle("low",health < 30);
    $("meter-fill").style.width = health + "%";
    setText("points", s.points);
    routeDisplay(s);
    updateObservation(s);
  }

  function showDialog(type) {
    dialogType = type;
    clearInput();
    releaseLook();
    const body = $("dialog-body");
    const s = game.getState();
    if (type === "help") {
      body.innerHTML = '<h2>이용 안내</h2><ol><li><b>승객의 몸짓을 살펴보세요.</b> 좌석에 마우스를 올리거나 관찰창의 화살표를 누르면 손과 발까지 크게 보여요. 짐을 챙긴 뒤 다시 기대앉는지, 발을 당기고 몸을 앞으로 옮기는지 지켜보세요.</li><li><b>내릴 사람 앞에 서세요.</b> 클릭이나 숫자 키 1~6으로 예상할 승객을 고르세요. WASD·방향키 또는 바닥 클릭으로 이동해요. 부딪히면 잠시 멈추고 체력이 줄어요.</li><li><b>자리가 비면 앉으세요.</b> 가까이에서 E·스페이스를 누르거나 빈자리를 클릭하세요. 먼저 앉을수록 포인트를 더 받아요.</li></ol><p>출근 후에는 퇴근길이 이어져요. 결과에서 같은 배치를 다시 연습하거나 모은 포인트로 패시브 스킬을 올릴 수 있어요.</p><div class="dialog-actions"><button class="primary" data-do="close">확인</button></div>';
      if (world) {
        const lookHelp = document.createElement("li");
        lookHelp.textContent = "객차를 드래그해 고개를 돌리세요. 마우스 고정을 켜면 마우스 움직임으로 둘러보고 화면 가운데의 승객을 클릭할 수 있어요. Esc로 고정을 풀고 Home 키로 처음 방향을 봅니다. 터치 화면에서는 밀어서 둘러보고 짧게 눌러 선택해요.";
        body.querySelector("ol").prepend(lookHelp);
      }
    } else if (type === "skills") {
      const allowed = s.phase === "ready" || s.phase === "result";
      body.innerHTML = '<h2>패시브 스킬</h2><p>보유 포인트 <b>' + s.points + ' P</b> · 다음 탑승에 적용돼요.</p>';
      [["focus","관찰력","하차 단서를 조금 더 일찍 읽어요."],["balance","균형 감각","부딪혔을 때 체력 소모와 멈추는 시간이 줄어요."]].forEach(([id,name,desc]) => {
        const cost = s.upgradeCosts[id];
        const disabled = !allowed || cost == null || s.points < cost;
        body.insertAdjacentHTML("beforeend", '<div class="skill-row"><div><strong>' + name + ' · Lv.' + s.upgrades[id] + '</strong><p>' + desc + '</p></div><button class="secondary" data-buy="' + id + '"' + (disabled ? " disabled" : "") + '>' + (cost == null ? "최고 레벨" : cost + " P 사용") + '</button></div>');
      });
      if (!allowed) body.insertAdjacentHTML("beforeend","<p>스킬은 운행을 마친 뒤에 올릴 수 있어요.</p>");
      body.insertAdjacentHTML("beforeend",'<div class="dialog-actions"><button class="primary" data-do="' + (s.phase === "result" ? "result" : "close") + '">' + (s.phase === "result" ? "결과로" : "확인") + '</button></div>');
    } else {
      const next = s.leg === "am" ? "퇴근길 탑승" : "다음 날 출근";
      body.innerHTML = '<h2></h2><p class="summary"></p><div class="result-grid"><div><small>하차 예상 적중</small><b>' + s.predictions + '회</b></div><div><small>남은 체력</small><b>' + Math.ceil(s.stamina) + '</b></div><div><small>획득 포인트</small><b>+' + s.awardedPoints + ' P</b></div></div><button class="secondary" data-do="skills">패시브 스킬</button><div class="dialog-actions"><button class="primary" data-do="continue">' + next + icons("arrow") + '</button><button class="secondary" data-do="retry">같은 배치 재도전</button></div>';
      body.querySelector("h2").textContent = s.resultTitle;
      body.querySelector(".summary").textContent = s.resultSummary;
    }
    dialog.setAttribute("aria-label",body.querySelector("h2").textContent);
    if (!dialog.open) dialog.showModal();
  }

  function focusGame() { canvas.focus({preventScroll:true}); }
  function action() {
    if (paused || dialog.open) return;
    unlockAudio();
    const {phase} = game.getState();
    if (phase === "result") { showDialog("result"); return; }
    if (phase === "ready") { game.start(); chime([392,523]); }
    else interact();
    focusGame();
    renderHud(game.getState());
  }

  $("action").addEventListener("click", action);
  $("previous-view").addEventListener("click", () => showSeat(viewIndex - 1));
  $("next-view").addEventListener("click", () => showSeat(viewIndex + 1));
  $("predict-view").addEventListener("click", () => {
    if (paused || dialog.open || !window.SubwayArt.seatPoint(game.getState(),viewIndex)) return;
    game.selectSeat(viewIndex);
    renderHud(game.getState());
    focusGame();
  });
  $("pause").addEventListener("click", togglePause);
  $("resume").addEventListener("click", togglePause);
  $("help").addEventListener("click", () => showDialog("help"));
  $("skills").addEventListener("click", () => showDialog("skills"));
  $("sound").addEventListener("click", () => {
    audioEnabled = !audioEnabled;
    unlockAudio();
    if (audioEnabled) audioContext?.resume().then(() => chime([466,587])).catch(() => {});
    try { localStorage.setItem("subway-sound",audioEnabled ? "on" : "off"); } catch {}
    updateSound();
  });
  $("close-dialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const skill = button.dataset.buy;
    if (skill && dialogType === "skills") {
      if (game.purchase(skill)) { renderHud(game.getState()); showDialog("skills"); }
      return;
    }
    const operation = button.dataset.do;
    if (["skills","result"].includes(operation)) return showDialog(operation);
    if (!operation) return;
    dialog.close();
    if (operation === "continue") game.continueRun();
    if (operation === "retry") game.restart();
    if (operation === "continue" || operation === "retry") { world?.resetLook(); viewIndex = 0; clearInput(); focusGame(); }
    renderHud(game.getState());
  });
  dialog.addEventListener("close", () => { dialogType = ""; lastFrame = undefined; });

  function locationInCarriage(event) {
    if (document.pointerLockElement === canvas) return window.SubwayArt.pick(canvas,game.getState(),.5,.5);
    const bounds = canvas.getBoundingClientRect();
    return window.SubwayArt.pick(canvas, game.getState(),
      (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
  }

  function tapCarriage(event) {
    const hit = locationInCarriage(event);
    const {index} = hit;
    const s = game.getState();
    focusGame();
    if (index >= 0) showSeat(index);
    if (!["ride","stop"].includes(s.phase)) return;
    if (index >= 0) {
      goal = null;
      interact(index);
      renderHud(game.getState());
    } else if (hit.goal) {
      goal = hit.goal;
    }
  }

  function turn(dx,dy,scale) {
    world.look(dx*scale,dy*scale);
    lastPaint = -Infinity;
  }

  function lockFailure() {
    const message = $("look-feedback");
    message.textContent = "이 창에서는 드래그로 둘러보세요.";
    message.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => { message.hidden = true; },3500);
  }

  $("view-lock").addEventListener("click",() => {
    if (paused || dialog.open) return;
    if (document.pointerLockElement === canvas) { releaseLook(); return; }
    focusGame();
    try { canvas.requestPointerLock()?.catch(lockFailure); } catch { lockFailure(); }
  });
  document.addEventListener("pointerlockerror",lockFailure);
  document.addEventListener("pointerlockchange",() => {
    const locked = document.pointerLockElement === canvas;
    if (!locked) lastLockExit = performance.now();
    cancelGesture();
    $("sight").hidden = !locked;
    $("view-lock").setAttribute("aria-pressed",String(locked));
    $("view-lock").textContent = locked ? "Esc · 고정 해제" : "마우스 고정";
  });
  document.addEventListener("mousemove",event => {
    if (world && document.pointerLockElement === canvas && !paused && !dialog.open)
      turn(event.movementX,event.movementY,.0028);
  });

  canvas.addEventListener("pointerdown",event => {
    if (!event.isPrimary || paused || dialog.open || (event.button !== 0 && !(world && event.button === 2))) return;
    focusGame();
    if (!world || document.pointerLockElement === canvas) {
      if (event.button === 0) tapCarriage(event);
      return;
    }
    gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,dragged:false,button:event.button};
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointermove",event => {
    if (paused || dialog.open || document.pointerLockElement === canvas) return;
    if (gesture?.id === event.pointerId) {
      const startDx = event.clientX - gesture.startX, startDy = event.clientY - gesture.startY;
      if (!gesture.dragged && Math.hypot(startDx,startDy) < (event.pointerType === "touch" ? 7 : 4)) return;
      turn(event.clientX-gesture.x,event.clientY-gesture.y,3.3/Math.max(350,canvas.clientWidth));
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      gesture.dragged = true;
      canvas.classList.add("turning");
    } else if (!gesture && event.pointerType !== "touch") {
      const {index} = locationInCarriage(event);
      if (index >= 0 && index !== viewIndex) showSeat(index);
    }
  });
  canvas.addEventListener("pointerup",event => {
    if (gesture?.id !== event.pointerId) return;
    const tap = !gesture.dragged && Math.hypot(event.clientX-gesture.startX,event.clientY-gesture.startY) < 7 && gesture.button === 0;
    cancelGesture();
    if (tap && !paused && !dialog.open) tapCarriage(event);
  });
  for (const type of ["pointercancel","lostpointercapture"])
    canvas.addEventListener(type,event => { if (gesture?.id === event.pointerId) cancelGesture(); });
  canvas.addEventListener("contextmenu",event => { if (world) event.preventDefault(); });

  document.addEventListener("keydown", event => {
    if (dialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === "Escape" && document.pointerLockElement === canvas) { releaseLook(); return; }
    if (event.code === "Escape" && active() && !event.repeat && performance.now()-lastLockExit > 200) { togglePause(); return; }
    if (paused) return;
    if (world && event.code === "Home" && document.activeElement === canvas) {
      event.preventDefault(); world.resetLook(); lastPaint = -Infinity; return;
    }
    const s = game.getState();
    if (s.phase !== "ride" && s.phase !== "stop") return;
    if (event.target.closest("button") && ["Enter","Space"].includes(event.code)) return;
    if (moves.has(event.code)) { event.preventDefault(); keys.add(event.code); goal = null; }
    else if (["KeyE","Space"].includes(event.code)) {
      event.preventDefault();
      if (!event.repeat) interact();
    } else if (/^(Digit|Numpad)[1-6]$/.test(event.code) && !event.repeat) {
      event.preventDefault();
      const index = Number(event.code.slice(-1)) - 1;
      showSeat(index);
      if (window.SubwayArt.seatPoint(s,index)) game.selectSeat(index);
    }
  });
  document.addEventListener("keyup", event => keys.delete(event.code));
  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", () => {
    lastFrame = undefined;
    if (document.hidden && active() && !dialog.open && !paused) togglePause();
  });

  function getInput(s, dt) {
    const down = (...codes) => codes.some(code => keys.has(code)) ? 1 : 0;
    if (!goal) {
      const strafe = down("KeyD","ArrowRight") - down("KeyA","ArrowLeft");
      const forward = down("KeyW","ArrowUp") - down("KeyS","ArrowDown");
      return world ? world.moveInput(strafe,forward) : {x:strafe,y:-forward};
    }
    const dx = goal.x - s.player.x, dy = goal.y - s.player.y;
    const distance = Math.hypot(dx,dy);
    if (distance <= Math.max(2,146 * dt)) { goal = null; return {x:0,y:0}; }
    return {x:dx / distance,y:dy / distance};
  }

  function frame(now) {
    const dt = lastFrame === undefined ? 0 : Math.min(.12,(now - lastFrame) / 1000);
    lastFrame = now;
    const prev = game.getState();
    if (!paused && !dialog.open && !document.hidden) {
      if (active()) {
        const hits = prev.collisions;
        game.tick(dt,getInput(prev,dt));
        if (game.getState().collisions > hits) goal = null;
      }
      if (!reducedMotion.matches || active()) animationTime += dt;
    }
    const s = game.getState();
    const phaseChanged = s.phase !== lastPhase;
    if (phaseChanged) {
      if (s.phase === "stop") chime([523,659]);
      if (s.phase === "seated") { chime([523,659,784]); clearInput(); }
      if (s.phase === "result") { clearInput(); showDialog("result"); }
      lastPhase = s.phase;
    }
    if (phaseChanged || now - lastPaint >= 1000 / 30) {
      window.SubwayArt.draw(canvas, s, animationTime);
      if ($("view-blocked").hidden) {
        window.SubwayArt.observe($("observation-view"), occupant(s,viewIndex), s.seats[viewIndex], animationTime);
      }
      lastPaint = now;
    }
    if (phaseChanged || now - lastHud >= 100) {
      if (world && document.pointerLockElement === canvas && !paused && !dialog.open) {
        const aimed = world.pick(canvas,s,.5,.5).index;
        if (aimed >= 0) viewIndex = aimed;
      }
      renderHud(s);
      lastHud = now;
    }
    requestAnimationFrame(frame);
  }
  updateSound();
  const initial = game.getState();
  const firstVisible = initial.seats.findIndex((_, i) => window.SubwayArt.seatPoint(initial,i));
  if (firstVisible >= 0) viewIndex = firstVisible;
  renderHud(game.getState());
  requestAnimationFrame(frame);
})();
