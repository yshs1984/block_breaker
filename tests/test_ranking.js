// Issue #16: ゲーム終了後のステージ別クリアタイム表示＋ローカルランキング（PR #24）
"use strict";
const { loadGame, makeLocalStorageStub } = require("./harness");
const {
  game, CONFIG, update, draw, startNewGame, nextStage,
  formatStageList, loadRanking, recordGameOverRanking, RANKING_STORAGE_KEY,
} = loadGame();

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL: " + msg);
  } else {
    console.log("ok: " + msg);
  }
}

// ------------------------------------------------------------------
// テスト1: formatStageList
// ------------------------------------------------------------------
assert(formatStageList([], 6) === "(クリアなし)", "formatStageList: 0件は (クリアなし)");
const list1 = formatStageList([60, 120], 6);
assert(list1 === "0:01 / 0:02", "formatStageList: 複数件をスラッシュ区切りで表示 (" + list1 + ")");
const list2 = formatStageList([60, 120, 180, 240, 300, 360, 420], 6);
assert(list2.endsWith("…") && list2.split(" / ").length === 6, "formatStageList: max件を超えたら…で打ち切り (" + list2 + ")");

// ------------------------------------------------------------------
// テスト2: ステージクリアごとに stageTimes が積み上がる。startNewGame でリセット、nextStage では消えない
// ------------------------------------------------------------------
startNewGame(1);
game.stageTime = 123;
game.bricks = [{ alive: false, indestructible: false }];
update(); // update() 冒頭で stageTime が1増えてから、ステージクリア判定で push される
assert(game.stageTimes.length === 1 && game.stageTimes[0] === 124, "ステージクリアで stageTime が stageTimes に記録される");

nextStage();
assert(game.stageTimes.length === 1, "nextStage() では stageTimes がリセットされない");

startNewGame(1);
assert(game.stageTimes.length === 0, "startNewGame() で stageTimes がリセットされる");

// ------------------------------------------------------------------
// テスト3: ライフが0になった瞬間に recordGameOverRanking が呼ばれ、localStorage に保存される
// ------------------------------------------------------------------
global.localStorage = makeLocalStorageStub();
startNewGame(1);
game.lives = 1;
game.score = 999;
game.stageTimes = [60, 120];
game.paused = false;
game.ball = { x: 100, y: 700, r: 8, dx: 1, dy: 1 }; // 画面外(H=640超)に落として即ミスさせる
game.timers.star = 0;
update();
assert(game.lives === 0, "残機が0になっている");
assert(game.state === "gameover", "state が gameover に遷移している");
const savedRaw = global.localStorage.getItem(RANKING_STORAGE_KEY);
assert(savedRaw !== null, "localStorage にランキングが保存されている");
const saved = JSON.parse(savedRaw);
assert(saved.length === 1 && saved[0].score === 999, "保存された内容にスコアが含まれる");
assert(JSON.stringify(saved[0].stageTimes) === JSON.stringify([60, 120]), "保存された内容にステージ別タイムが含まれる");
assert(JSON.stringify(game._rankingCache) === JSON.stringify(saved), "_rankingCache が保存内容と一致する（draw()で使い回すため）");

// ------------------------------------------------------------------
// テスト4: 複数プレイをシミュレートし、スコア降順・上位rankingMaxEntries件に切り詰められる
// ------------------------------------------------------------------
global.localStorage = makeLocalStorageStub();
const scores = [100, 500, 300, 700, 200, 900, 400]; // 7件 > rankingMaxEntries(5)
for (const s of scores) {
  game.score = s;
  game.stageTimes = [60];
  recordGameOverRanking();
}
const finalList = loadRanking();
assert(finalList.length === CONFIG.rankingMaxEntries, "上位 rankingMaxEntries 件に切り詰められる（" + finalList.length + "件）");
const sortedDesc = finalList.every((e, i) => i === 0 || finalList[i - 1].score >= e.score);
assert(sortedDesc, "スコア降順に並んでいる");
assert(finalList[0].score === 900, "1位が最大スコアになっている");

// ------------------------------------------------------------------
// テスト5: localStorage が例外を投げてもクラッシュせず、空配列・no-opにフォールバックする
// ------------------------------------------------------------------
global.localStorage = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
};
let threw = false;
try {
  const l = loadRanking();
  assert(Array.isArray(l) && l.length === 0, "loadRanking: 例外時は空配列を返す");
  game.score = 123;
  game.stageTimes = [];
  recordGameOverRanking(); // 内部で saveRanking も呼ばれるが例外を投げないはず
} catch (e) {
  threw = true;
}
assert(!threw, "localStorage が例外を投げても recordGameOverRanking はクラッシュしない");

// ------------------------------------------------------------------
// テスト6: gameover 遷移後、draw()（drawGameOverStats 込み）がエラーなく実行できる（0件・複数件の両方）
// ------------------------------------------------------------------
global.localStorage = makeLocalStorageStub();
startNewGame(1);
game.state = "gameover";
game._rankingCache = [];
game.stageTimes = [];
let drawThrew = false;
try { draw(); } catch (e) { drawThrew = true; console.error(e); }
assert(!drawThrew, "draw(): ランキング0件でもエラーなく描画できる");

game._rankingCache = [
  { score: 500, stageTimes: [60, 120, 180] },
  { score: 300, stageTimes: [90] },
];
game.stageTimes = [60, 120];
drawThrew = false;
try { draw(); } catch (e) { drawThrew = true; console.error(e); }
assert(!drawThrew, "draw(): ランキング複数件でもエラーなく描画できる");

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
