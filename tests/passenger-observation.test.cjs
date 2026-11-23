const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const vm = require("node:vm");

const code = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");

function board(day, options) {
  const save = JSON.stringify({version: 1, day, leg: "am"});
  const window = {localStorage: {getItem: () => save}};
  vm.runInNewContext(code, {window});
  return window.SubwayGame.create(options);
}

function watchFirstStop(game) {
  const seats = game.getState().seats;
  const people = Array.from(seats, seat => seat.person);
  const actions = people.map(() => []);
  const step = 0.1;
  for (let n = 0; n < 300 && game.getState().phase === "ride"; n++) {
    seats.forEach((seat, i) => {
      if (seat.action !== actions[i].at(-1)) actions[i].push(seat.action);
    });
    game.tick(step, {});
  }
  assert.equal(game.getState().phase, "stop");
  const departing = seats.findIndex(seat => seat.departing);
  assert.ok(departing >= 0);
  return {people, actions, departing};
}

test("departure and ordinary fidgeting can start alike and resolve into different poses", () => {
  const game = board(1);
  game.start();
  const trip = watchFirstStop(game);
  const preparesToLeave = trip.actions[trip.departing];
  assert.ok(preparesToLeave.includes("gather"));
  assert.ok(preparesToLeave.includes("ready"));
  assert.equal(game.getState().seats[trip.departing].action, "rise");
  const neighbours = trip.actions.slice(trip.departing < 3 ? 0 : 3, trip.departing < 3 ? 3 : 6);
  assert.ok(neighbours.some(sequence => sequence.includes("gather") && sequence.includes("settle")),
    "A nearby seated rider should fidget with their belongings and stay seated.");

  game.restart();
  assert.deepEqual(watchFirstStop(game), trip);
});

test("the same passenger can leave or stay at the first stop on different mornings", () => {
  const leaving = new Set();
  const staying = new Set();
  for (let day = 1; day <= 12; day++) {
    const game = board(day);
    game.start();
    const {people, departing} = watchFirstStop(game);
    leaving.add(people[departing]);
    people.forEach((person, i) => { if (person != null && i !== departing) staying.add(person); });
  }
  assert.ok(leaving.size >= 3);
  assert.ok([...leaving].some(person => staying.has(person)));
});

test("a player beside a vacancy can sit even when looking away from its cushion", () => {
  const seats = board(2).getState().seats;
  const vacancy = seats.findIndex(seat => seat.person === null);
  assert.ok(vacancy >= 0);
  const seat = seats[vacancy];
  const game = board(2, {startPosition: {x: seat.x, y: seat.y + 26}});
  game.start();
  assert.ok(game.interact(undefined, () => false));
  assert.equal(game.getState().seatedIndex, vacancy);
});

test("walking against a fixture still allows motion along it without a passenger collision", () => {
  const game = board(1, {startPosition: {x: 350, y: 264}, obstacleAt: x => x > 350 ? "fixture" : null});
  game.start();
  game.tick(.08, {x: 1, y: -1});
  const state = game.getState();
  assert.equal(state.player.x, 350);
  assert.ok(state.player.y < 264);
  assert.equal(state.collisions, 0);
});

test("bumping a stationary aisle passenger costs stamina and triggers the collision cooldown", () => {
  const game = board(1, {startPosition: {x: 350, y: 264}, obstacleAt: x => x < 350 ? "passenger" : null});
  game.start();
  game.tick(.08, {x: -1});
  game.tick(.08, {x: -1});
  const state = game.getState();
  assert.equal(state.player.x, 350);
  assert.equal(state.collisions, 1);
  assert.ok(state.stamina <= 93);
});
