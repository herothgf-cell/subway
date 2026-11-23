/* Game coordinates are in the 840 × 320 reference carriage. */
(function (global) {
  "use strict";

  const ROUTE = ["대림", "신도림", "문래", "영등포구청"];
  const SEAT_X = [116, 182, 248, 590, 656, 722];
  const APPROACH = 12;
  const DWELL = 6;
  const STAND_UP = 1.05;
  const STORAGE_KEY = "subway-commute.v1";
  const COST = [20, 35, 50];
  // Seats, regular standing riders, two competitors, then the extra morning commuters.
  const FIRST_CAST = [1, 4, 2, 6, 3, 5, 0, 11, 12, 8, 9, 7, 10];
  const PASSENGERS = Array.from({length: 13}, (_, id) => id);

  const clamp = (number, min, max) => Math.max(min, Math.min(max, number));
  const cleanInt = (value, min, max) =>
    Number.isSafeInteger(value) ? clamp(value, min, max) : min;

  function randomFor(day, leg, stream) {
    let seed = (day * 73856093 + (leg === "pm" ? 19349663 : 0) + stream * 83492791) % 2147483646 + 1;
    return () => {
      seed = seed * 48271 % 2147483647;
      return seed / 2147483647;
    };
  }

  function shuffled(values, random) {
    const order = values.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  function loadProfile(fallback) {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      if (!value || value.version !== 1) return fallback;
      return {
        version: 1, day: cleanInt(value.day, 1, 1000000),
        leg: value.leg === "pm" ? "pm" : "am",
        startStamina: Number.isFinite(value.startStamina) ? clamp(value.startStamina, 0, 100) : 100,
        points: cleanInt(value.points, 0, Number.MAX_SAFE_INTEGER),
        upgrades: {
          focus: cleanInt(value.upgrades?.focus, 0, COST.length),
          balance: cleanInt(value.upgrades?.balance, 0, COST.length),
        },
      };
    } catch {
      return fallback;
    }
  }

  function create({ startPosition = {x:423, y:258}, obstacleAt } = {}) {
    let profile = loadProfile({
      version: 1, day: 1, leg: "am", startStamina: 100, points: 0,
      upgrades: {balance: 0, focus: 0},
    });
    let storageWritable = true;
    let state;
    let elapsed, crowdTime, noticeTime, collisionCooldown, staggerTime, released, rivalSeated;
    let leaving, rival, rivalTarget, seatedStop, seatedStartProgress, cast, seatOrder, actionPlans;

    function refreshProfile() {
      if (storageWritable) profile = loadProfile(profile);
    }

    function saveProfile() {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      } catch {
        // Retain the newer in-memory profile even when an older save is still readable.
        storageWritable = false;
      }
    }

    function syncWallet() {
      state.points = profile.points;
      state.upgrades = {...profile.upgrades};
      state.upgradeCosts = {
        balance: COST[profile.upgrades.balance] ?? null,
        focus: COST[profile.upgrades.focus] ?? null,
      };
    }

    function aheadStation(index) {
      return ROUTE[state.leg === "am" ? index + 1 : 2 - index];
    }

    function notify(message, seconds = 2.2) {
      state.notice = message;
      noticeTime = seconds;
    }

    function reset(day, leg, startStamina = profile.startStamina) {
      cast = day === 1 && leg === "am" ? FIRST_CAST : shuffled(PASSENGERS, randomFor(day, leg, 1));
      // Two distinct departures and an optional starting vacancy, chosen independently of the cast.
      seatOrder = day === 1 ? (leg === "am" ? [2, 4, 3] : [4, 1, 2])
        : shuffled(SEAT_X.map((_, i) => i), randomFor(day, leg, 2));
      state = {
        phase: "ready", day, leg, stopIndex: 0, station: "", secondsLeft: APPROACH,
        progress: 0, doorsOpen: false, stamina: startStamina, startStamina, status: "", notice: "",
        predictions: 0, collisions: 0, seatedIndex: null, seatedSegments: 0,
        selectedIndex: null, selectedPerson: null,
        practice: day !== profile.day || leg !== profile.leg,
        legPoints: 0, runPoints: 0, awardedPoints: 0, upgradeMax: COST.length,
        resultTitle: "", resultSummary: "", player: {...startPosition},
        seats: SEAT_X.map((x, index) => ({
          x, y: 182, label: (index + 1) + "번 좌석",
          person: cast[index], action: "idle", actionTime: 0, selected: false, departing: false,
        })),
        riders: [
          {x: 81, y: 270, person: cast[6], kind: "bystander"},
          {x: 379, y: 243, person: cast[7], kind: "bystander"},
          {x: 503, y: 266, person: cast[8], kind: "bystander"},
        ],
      };
      if (leg === "am") {
        state.riders.push({x: 267, y: 286, person: cast[11], kind: "bystander"},
          {x: 708, y: 278, person: cast[12], kind: "bystander"});
      }
      for (const rider of state.riders) {
        rider.homeX = rider.x;
        rider.homeY = rider.y;
      }
      if ((day + (leg === "pm" ? 1 : 0)) % 3 === 2) {
        state.seats[seatOrder[2]].person = null;
      }
      elapsed = crowdTime = noticeTime = collisionCooldown = staggerTime = 0;
      leaving = rival = null;
      seatedStop = null;
      state.station = aheadStation(0);
      syncWallet();
      prepareStop();
      state.status = "승객의 행동을 관찰하고 내릴 자리를 예상하세요.";
    }

    function targetIndex() {
      return seatOrder[state.stopIndex];
    }

    function prepareStop() {
      elapsed = 0;
      state.station = aheadStation(state.stopIndex);
      state.secondsLeft = APPROACH;
      state.selectedIndex = null;
      state.selectedPerson = null;
      state.doorsOpen = false;
      state.seats.forEach(seat => {
        seat.selected = seat.departing = false;
        seat.action = "idle";
        seat.actionTime = 0;
      });
      leaving = null;
      if (state.stopIndex === 2) {
        state.riders = state.riders.filter(rider => rider.kind !== "leaving");
        state.status = state.station + "역에서 내릴 준비를 하세요."
          + (state.seats.some(seat => seat.person === null) ? " 남은 빈자리에는 앉을 수 있어요." : "");
        return;
      }
      released = rivalSeated = false;
      state.riders = state.riders.filter(rider => rider.kind === "bystander");
      rivalTarget = state.seats[targetIndex()];
      const unhurried = state.stopIndex === 1 && (state.day + (state.leg === "pm" ? 1 : 0)) % 2 === 1;
      rival = {
        x: rivalTarget.x < 400 ? 595 : 260, y: 253, speed: unhurried ? 52 : 117,
        person: cast[9 + state.stopIndex], kind: "rival",
      };
      state.riders.push(rival);
      actionPlans = planActions();
      state.status = state.station + "역으로 이동 중 · 내릴 승객을 찾아보세요.";
    }

    function start() {
      if (state.phase !== "ready") return false;
      state.phase = "ride";
      state.status = state.seats.some(seat => seat.person === null) ? "벌써 빈자리가 있네요. 좌석 앞까지 가서 앉으세요."
        : "손에 든 물건과 앉은 자세를 살펴보고, 내릴 것 같은 승객을 고르세요.";
      return true;
    }

    function restart() {
      reset(state.day, state.leg, state.startStamina);
      return start();
    }

    function continueRun() {
      if (state.phase !== "result") return false;
      reset(profile.day, profile.leg);
      return start();
    }

    function selectSeat(index) {
      const seat = state.seats[index];
      if (!Number.isInteger(index) || !seat || state.phase !== "ride") return false;
      if (seat.person === null) {
        notify("이미 비어 있는 좌석이에요. 가까이에서 착석하세요.");
        return false;
      }
      if (state.stopIndex === 2) {
        notify("다음은 목적지예요. 내릴 준비를 하세요.");
        return false;
      }
      state.seats.forEach((item, number) => { item.selected = number === index; });
      state.selectedIndex = index;
      state.selectedPerson = seat.person;
      notify(seat.label + " 하차 예상 · 문이 열리기 전에 가까이 가세요.");
      return true;
    }

    function addScore(amount) {
      state.legPoints += amount;
      state.runPoints = state.legPoints;
    }

    function interact(index, isVisible) {
      if (state.phase !== "ride" && state.phase !== "stop") return false;
      if (index !== undefined && (!Number.isInteger(index) || !state.seats[index])) return false;
      const targeted = index !== undefined;
      const seekVacancy = !targeted && state.seats.some(seat => seat.person === null);
      let distance = Infinity;
      for (let i = 0; i < state.seats.length; i++) {
        if (targeted && i !== index) continue;
        const seat = state.seats[i];
        if (seekVacancy && seat.person !== null) continue;
        if (!targeted && !seekVacancy && isVisible && !isVisible(i)) continue;
        const gap = Math.hypot(state.player.x - seat.x, state.player.y - (seat.y + 24));
        if (gap < distance) {
          index = i;
          distance = gap;
        }
      }
      if (index === undefined) {
        notify("좌석이 보이는 쪽으로 고개를 돌려 보세요.");
        return false;
      }
      const seat = state.seats[index];
      if (state.phase === "ride" && targeted && seat.person !== null) return selectSeat(index);
      if (distance > 48) {
        notify("좌석 앞까지 조금 더 가까이 가세요.");
        return false;
      }
      if (seat.person !== null) {
        if (state.phase === "ride") return selectSeat(index);
        notify("아직 사람이 있는 자리예요. 자리가 비면 앉으세요.");
        return false;
      }
      state.seatedSegments = 3 - state.stopIndex - (state.phase === "stop" ? 1 : 0);
      state.phase = "seated";
      state.seatedIndex = index;
      seatedStop = state.stopIndex;
      seatedStartProgress = state.progress;
      state.player = {x: seat.x, y: seat.y};
      elapsed = 0;
      addScore(state.seatedSegments * 7);
      notify("착석 성공! " + state.seatedSegments + "개 구간 착석 보너스 +" + state.seatedSegments * 7 + "P");
      state.status = "자리에 앉았어요. 편하게 목적지까지 이동해요.";
      state.secondsLeft = 2;
      return true;
    }

    function finish(exhausted = false) {
      const seated = seatedStop !== null;
      const destination = aheadStation(2);
      state.phase = "result";
      state.station = destination;
      state.stopIndex = 2;
      state.progress = 1;
      state.doorsOpen = true;
      state.secondsLeft = 0;
      state.notice = "";
      addScore(exhausted ? 4 : 12);
      refreshProfile();
      if (profile.day === state.day && profile.leg === state.leg) {
        state.awardedPoints = state.legPoints;
        profile.points += state.awardedPoints;
        if (state.leg === "am") {
          profile.leg = "pm";
          profile.startStamina = clamp(state.stamina + 25, 65, 100);
        } else {
          profile.leg = "am";
          profile.day++;
          profile.startStamina = 100;
        }
        saveProfile();
      } else {
        state.practice = true;
      }
      syncWallet();
      state.resultTitle = (state.leg === "am" ? "출근" : "퇴근") + " 완료!";
      const outcome = seated ? "자리를 잡고 편안하게 도착했어요."
        : exhausted ? "체력이 다해 남은 구간은 서서 이동했어요." : "오늘은 서서 도착했어요.";
      state.resultSummary = outcome + (state.practice ? " 같은 편도 연습을 마쳤어요." : " 교통 포인트 +" + state.awardedPoints + "P");
      state.status = destination + "역 도착 · " + state.resultTitle;
    }

    function openDoors() {
      elapsed = 0;
      state.phase = "stop";
      state.doorsOpen = true;
      state.secondsLeft = DWELL;
      const index = targetIndex();
      state.seats[index].departing = true;
      state.seats[index].action = "rise";
      state.seats[index].actionTime = 0;
      if (state.selectedIndex === index) {
        state.predictions++;
        addScore(4);
      }
      state.status = state.station + "역 도착 · 승객이 일어나면 가까이에서 착석하세요.";
    }

    function releaseSeat() {
      const index = targetIndex();
      const seat = state.seats[index];
      leaving = {x: seat.x, y: seat.y, person: seat.person, kind: "leaving"};
      state.riders.push(leaving);
      seat.person = null;
      seat.departing = false;
      seat.action = "idle";
      seat.actionTime = 0;
      released = true;
      if (state.phase === "seated") return;
      if (state.selectedIndex !== null) {
        notify(state.selectedIndex === index ? "하차 예상 적중! +4P" : "예상한 승객은 계속 앉아 있어요.");
      }
      state.status = seat.label + "이 비었어요! 좌석 앞에서 E 키를 누르거나 좌석을 터치하세요.";
    }

    function moveTo(object, x, y, speed, dt) {
      const dx = x - object.x, dy = y - object.y;
      const gap = Math.hypot(dx, dy);
      if (gap <= speed * dt) {
        object.x = x; object.y = y;
        return true;
      }
      object.x += dx / gap * speed * dt;
      object.y += dy / gap * speed * dt;
      return false;
    }

    function moveDeparture(dt) {
      if (!leaving) return;
      if (moveTo(leaving, 423, 200, 126, dt)) {
        state.riders = state.riders.filter(rider => rider !== leaving);
        leaving = null;
      }
    }

    function moveRival(dt) {
      if (rivalSeated || rivalTarget.person !== null) return;
      if (moveTo(rival, rivalTarget.x, rivalTarget.y + 24, rival.speed, dt)) {
        rivalTarget.person = rival.person;
        rivalSeated = true;
        state.riders = state.riders.filter(rider => rider !== rival);
        state.status = state.stopIndex === 2 ? "다른 승객이 먼저 앉았어요. 곧 목적지에 도착해요."
          : "다른 승객이 먼저 앉았어요.";
      }
    }

    function movePlayer(dt, input) {
      const dx = Number.isFinite(input?.x) ? clamp(input.x, -1, 1) : 0;
      const dy = Number.isFinite(input?.y) ? clamp(input.y, -1, 1) : 0;
      const magnitude = Math.max(1, Math.hypot(dx, dy));
      const speed = 146 / magnitude;
      const player = state.player;
      if ((!dx && !dy) || staggerTime > 0) return;
      let bumped = false;
      function step(axis, next) {
        const x = axis === "x" ? next : player.x;
        const y = axis === "y" ? next : player.y;
        const obstacle = obstacleAt?.(x,y);
        if (obstacle) {
          if (obstacle === "passenger") bumped = true;
          return;
        }
        const blocked = state.riders.some(rider => {
          const gap = Math.hypot(x - rider.x, y - rider.y);
          return gap < 18 && gap < Math.hypot(player.x - rider.x, player.y - rider.y);
        });
        if (blocked) bumped = true;
        else player[axis] = next;
      }
      if (dx) step("x", clamp(player.x + dx * speed * dt, 32, 808));
      if (dy) step("y", clamp(player.y + dy * speed * dt, 208, 290));
      if (bumped && collisionCooldown <= 0) {
        const balance = state.upgrades.balance;
        collisionCooldown = 1.35;
        staggerTime = 0.3 - 0.06 * balance;
        state.collisions++;
        state.stamina = Math.max(0, state.stamina - (7 - 1.5 * balance));
        notify("“죄송합니다!” 승객을 살짝 돌아가세요.", 1.3);
      }
    }

    function planActions() {
      const random = randomFor(state.day, state.leg, 3 + state.stopIndex);
      const others = shuffled(state.seats.filter(seat => seat !== rivalTarget && seat.person !== null), random);
      const sameBench = seat => (seat.x < 420) === (rivalTarget.x < 420);
      const nearby = others.find(sameBench);
      const across = others.find(seat => !sameBench(seat));
      const time = (start, span) => start + random() * span;
      return [
        {seat: rivalTarget, beats: [
          [time(2.0, 1.3), "check"], [time(4.8, 1.4), "gather"], [time(8.4, 1), "ready"],
        ]},
        {seat: nearby, beats: [
          [time(1.3, 1.5), "check"], [time(3.6, 1), "gather"], [time(6, 1), "settle"], [9.3, "idle"],
        ]},
        {seat: across, beats: [
          [time(2.0, 2.3), "check"], [time(5.5, 0.8), "gather"], [time(8.4, 1), "settle"], [11.8, "idle"],
        ]},
      ];
    }

    function updateActions() {
      const advance = state.upgrades.focus * 0.6;
      for (const {seat, beats} of actionPlans) {
        let action = "idle", began = 0;
        for (const [time, next] of beats) {
          const start = Math.max(0.25, time - advance);
          if (elapsed < start) break;
          action = next;
          began = start;
        }
        seat.action = action;
        seat.actionTime = elapsed - began;
      }
    }

    function advanceRise(dt) {
      rivalTarget.actionTime += dt;
      if (rivalTarget.actionTime >= STAND_UP) releaseSeat();
    }

    function update(dt, input) {
      crowdTime += dt;
      for (const rider of state.riders) {
        if (rider.kind !== "bystander") continue;
        // Neighbours shift their footing with the train and make room at the doors.
        const phase = crowdTime * 0.85 + rider.person;
        const doorStep = state.doorsOpen ? 8 * Math.sign(rider.homeX - 420) : 0;
        const destX = rider.homeX + 5 * Math.sin(phase) + doorStep;
        const destY = rider.homeY + 3 * Math.sin(phase * 0.72);
        moveTo(rider, destX, destY, 18, dt);
      }
      elapsed += dt;
      noticeTime -= dt;
      collisionCooldown -= dt;
      staggerTime -= dt;
      if (noticeTime <= 0) state.notice = "";
      if (state.phase === "seated") {
        if (rivalTarget.departing) advanceRise(dt);
        moveDeparture(dt);
        state.stamina = Math.min(100, state.stamina + 3 * dt);
        state.secondsLeft = Math.max(0, Math.ceil(1.65 - elapsed));
        const seatedFraction = (state.stopIndex - seatedStop + elapsed / 1.65) / (3 - seatedStop);
        state.progress = Math.min(1, seatedStartProgress + seatedFraction * (1 - seatedStartProgress));
        if (elapsed >= 1.65) {
          if (state.stopIndex === 2) return finish();
          state.station = aheadStation(++state.stopIndex);
          state.doorsOpen = false;
          elapsed = 0;
        }
        return;
      }
      movePlayer(dt, input);
      state.stamina = Math.max(0, state.stamina - 1.3 * dt);
      if (state.stamina === 0) return finish(true);
      if (state.phase === "ride") {
        const finalApproach = state.stopIndex === 2;
        if (finalApproach) moveRival(dt);
        else updateActions();
        state.progress = Math.min(1, (state.stopIndex + elapsed / APPROACH * (finalApproach ? 1 : 0.85)) / 3);
        state.secondsLeft = Math.max(0, Math.ceil(APPROACH - elapsed));
        if (elapsed >= APPROACH) {
          if (finalApproach) return finish();
          openDoors();
        }
      } else {
        if (!released) advanceRise(dt);
        moveDeparture(dt);
        if (elapsed >= STAND_UP + 0.5) moveRival(dt);
        state.progress = (state.stopIndex + 0.85 + elapsed / DWELL * 0.15) / 3;
        state.secondsLeft = Math.max(0, Math.ceil(DWELL - elapsed));
        if (elapsed >= DWELL) {
          state.stopIndex++;
          state.phase = "ride";
          prepareStop();
        }
      }
    }

    function tick(seconds, input) {
      if (!Number.isFinite(seconds) || seconds <= 0) return;
      let remaining = Math.min(seconds, 60);
      while (remaining > 0 && state.phase !== "ready" && state.phase !== "result") {
        const step = Math.min(remaining, 1 / 30);
        update(step, input);
        remaining -= step;
      }
    }

    function purchase(id) {
      if (id !== "balance" && id !== "focus") return false;
      if (state.phase !== "ready" && state.phase !== "result") return false;
      refreshProfile();
      syncWallet();
      const cost = state.upgradeCosts[id];
      if (cost === null || cost > profile.points) return false;
      profile.points -= cost;
      profile.upgrades[id]++;
      syncWallet();
      saveProfile();
      return true;
    }

    reset(profile.day, profile.leg);
    return {getState: () => state, start, selectSeat, interact, tick, restart, continueRun, purchase};
  }

  global.SubwayGame = {create};
})(window);
