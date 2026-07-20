// Issue #18: ホーミング終了時にボールの軌道をパドルへ補正する（PR #23）
"use strict";
const { loadGame } = require("./harness");
const { game, CONFIG, update } = loadGame();

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + msg);
  } else {
    console.log("ok: " + msg);
  }
}

function approxEq(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

// ------------------------------------------------------------------
// テスト1: ホーミング中は従来通り、目標ブロックへ向けて少しずつ曲がる（回帰確認）
// ------------------------------------------------------------------
game.state = "playing";
game.paused = false;
game.bricks = [
  { x: 300, y: 100, w: 50, h: 22, alive: true, indestructible: false },
];
game.ball = { x: 100, y: 300, r: 8, dx: 4, dy: 0 };
game.paddle = { x: 200, y: 600, w: 90, h: 14 };
game.timers.homing = 4 * 60;
const speedBefore = Math.hypot(game.ball.dx, game.ball.dy);
const angleBefore = Math.atan2(game.ball.dy, game.ball.dx);
update();
const angleAfter = Math.atan2(game.ball.dy, game.ball.dx);
const turn = angleAfter - angleBefore;
assert(Math.abs(turn) <= CONFIG.homingTurnRate + 1e-9, "ホーミング中は1フレームでの回転量が homingTurnRate 以内");
assert(approxEq(Math.hypot(game.ball.dx, game.ball.dy), speedBefore), "ホーミング中は速さが変わらない");
assert(game.timers.homing === 4 * 60 - 1, "ホーミング中はタイマーが1減る");

// ------------------------------------------------------------------
// テスト2: ホーミングがちょうど切れた瞬間、パドル方向へ軌道が補正される
// ------------------------------------------------------------------
game.state = "playing";
game.paused = false;
game.bricks = [
  { x: 300, y: 100, w: 50, h: 22, alive: true, indestructible: false },
];
game.ball = { x: 100, y: 300, r: 8, dx: 4.9, dy: 0.5 }; // ほぼ真横に近い軌道を再現
game.paddle = { x: 200, y: 600, w: 90, h: 14 };
game.timers.homing = 1; // このフレームの減算で 0 になる
const speed2 = Math.hypot(game.ball.dx, game.ball.dy);
update();
assert(game.timers.homing === 0, "タイマーが0になっている");
const expectedAngle = Math.atan2(
  game.paddle.y - game.ball.y,
  game.paddle.x + game.paddle.w / 2 - game.ball.x
);
const actualAngle = Math.atan2(game.ball.dy, game.ball.dx);
assert(approxEq(actualAngle, expectedAngle, 1e-6), "切れた瞬間、ボールの向きがパドル方向に一致する");
assert(approxEq(Math.hypot(game.ball.dx, game.ball.dy), speed2), "切れた瞬間も速さは変わらない");
assert(game.ball.dy > 0, "パドルは下にいるので、補正後の dy は下向き（正）になる");

// ------------------------------------------------------------------
// テスト3: 次のフレーム以降は再度補正が起きない（1回きり）
// ------------------------------------------------------------------
const dxAfterFirstFrame = game.ball.dx;
const dyAfterFirstFrame = game.ball.dy;
game.paddle.x = 10; // パドルを別方向へ動かす。もし補正が再発火していたら向きが変わってしまう
update();
assert(approxEq(Math.hypot(game.ball.dx, game.ball.dy), speed2, 1e-6), "1回きり：次のフレームでは速さも向きも動かない（通常物理のみ）");
assert(approxEq(game.ball.dx, dxAfterFirstFrame, 1e-6) && approxEq(game.ball.dy, dyAfterFirstFrame, 1e-6), "1回きり：dx/dyの値自体が変化していない（再補正が起きていない証拠）");

// ------------------------------------------------------------------
// テスト4: ホーミングが一度も発動していないプレイでは分岐が発火しない（回帰確認）
// ------------------------------------------------------------------
game.state = "playing";
game.paused = false;
game.bricks = [
  { x: 300, y: 100, w: 50, h: 22, alive: true, indestructible: false },
];
game.ball = { x: 100, y: 300, r: 8, dx: 4, dy: 2 };
game.paddle = { x: 200, y: 600, w: 90, h: 14 };
game.timers.homing = 0;
const dxBefore4 = game.ball.dx, dyBefore4 = game.ball.dy;
update();
assert(approxEq(game.ball.dx, dxBefore4, 1e-6) && approxEq(game.ball.dy, dyBefore4, 1e-6), "ホーミング未発動時はdx/dyが変化しない（パドル補正が誤発火しない）");

// ------------------------------------------------------------------
// テスト5: ポーズ中はタイマーごと凍結され、補正フレームも起きない
// ------------------------------------------------------------------
game.state = "playing";
game.paused = true;
game.bricks = [
  { x: 300, y: 100, w: 50, h: 22, alive: true, indestructible: false },
];
game.ball = { x: 100, y: 300, r: 8, dx: 4.9, dy: 0.5 };
game.paddle = { x: 200, y: 600, w: 90, h: 14 };
game.timers.homing = 1;
update();
assert(game.timers.homing === 1, "ポーズ中はタイマーが減らない");
assert(approxEq(game.ball.dx, 4.9) && approxEq(game.ball.dy, 0.5), "ポーズ中はボールの向きも変わらない");
game.paused = false;
update();
assert(game.timers.homing === 0, "ポーズ解除後、正しくタイマーが0になる");
const expectedAngle5 = Math.atan2(
  game.paddle.y - game.ball.y,
  game.paddle.x + game.paddle.w / 2 - game.ball.x
);
assert(approxEq(Math.atan2(game.ball.dy, game.ball.dx), expectedAngle5, 1e-6), "ポーズ解除後、正しく補正フレームを迎える");

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
