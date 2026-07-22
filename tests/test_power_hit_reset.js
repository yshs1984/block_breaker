// Issue #25: 不発のパワーヒットが戻ってきたら権利を無効化する（PR #29）
"use strict";
const { loadGame } = require("./harness");
const { game, CONFIG, update, startNewGame, keys } = loadGame();

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + msg);
  } else {
    console.log("ok: " + msg);
  }
}

function setupBounceScenario() {
  startNewGame(1);
  game.paused = false;
  game.bricks = [{ x: -100, y: -100, w: 20, h: 20, alive: true, indestructible: false }]; // ボールから遠く、当たらない
  game.paddle = { x: 200, y: 600, w: 90, h: 14 };
  // パドルのすぐ上、下向きに落下中のボール（次フレームでパドルに当たる）
  game.ball = { x: 245, y: 590, r: 8, dx: 0, dy: 5 };
}

// ------------------------------------------------------------------
// テスト1: 不発のパワーヒットがブロックに当たらず戻ってきたら無効化される
// ------------------------------------------------------------------
setupBounceScenario();
game.powerHits = 2; // 前回発動したが、ブロックに触れていない不発状態を再現
game.charge = 0;    // 今回のバウンドでは新規発動しない（チャージ不足）
game.timers.powerCooldown = 0;
update();
assert(game.powerHits === 0, "不発のパワーヒットはパドルに当たった瞬間に無効化される");

// ------------------------------------------------------------------
// テスト2: 同じ弾みでチャージが発動ライン以上なら、新規のパワーヒットとして上書きされる
// ------------------------------------------------------------------
setupBounceScenario();
game.powerHits = 2; // 前回の不発が残っている状態
game.charge = CONFIG.chargeThreshold; // 発動ライン到達
game.timers.powerCooldown = 0;
keys.charge = true; // Shiftを押し続けている状態を再現（押していないと update() 冒頭で charge が0に戻ってしまう）
update();
keys.charge = false;
assert(game.powerHits === CONFIG.powerBrickCount, "同じ弾みで新規発動する場合は powerBrickCount に上書きされる（" + game.powerHits + "）");

// ------------------------------------------------------------------
// テスト3: パワーヒット中にブロックへ当たって powerHits を正しく消費する（回帰確認）
// ------------------------------------------------------------------
startNewGame(1);
game.paused = false;
game.powerHits = 2;
game.bricks = [{ x: 100, y: 100, w: 30, h: 20, alive: true, indestructible: false }];
game.ball = { x: 110, y: 105, r: 8, dx: 0, dy: -1 }; // ブロックの中心付近に重ねて衝突させる
game.paddle = { x: 10000, y: 10000, w: 90, h: 14 }; // パドルには当たらない位置へどける
update();
assert(game.bricks[0].alive === false, "ブロックが壊れている（回帰確認）");
assert(game.powerHits === 1, "パワーヒット中はブロックに当たるたびに残り回数が減る（回帰確認、" + game.powerHits + "）");

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
