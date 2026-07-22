// ヘッドレステスト用の共通スタブ（DOM/canvas/localStorage）。
// game.js/tutorial.js はブラウザの canvas 前提のコードなので、Node だけで動かすために
// document/window/localStorage の最小限のスタブを用意し、vm でソースをそのまま実行する。
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// game.js の中で使われる canvas の描画コマンドはすべて無視してよい（見た目の検証はブラウザで手動確認する）。
// createLinearGradient だけは戻り値（.addColorStop を持つオブジェクト）が必要になるコードがあるため個別対応。
function makeCtxProxy() {
  return new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "createLinearGradient" || prop === "createRadialGradient") {
        return () => ({ addColorStop: () => {} });
      }
      if (typeof prop === "string") return () => {};
      return undefined;
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}

function makeLocalStorageStub() {
  let store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
}

// game.js のトップレベル const/function は、テストコードと同じ vm.runInThisContext 呼び出しの
// 中でしかアクセスできない（トップレベル const は global のプロパティにならないため）。
// そのため、末尾に __test_exports への代入コードを連結してから1つのスクリプトとして実行する。
const EXPORT_NAMES = [
  "game", "CONFIG", "keys",
  "update", "draw", "loop",
  "startNewGame", "nextStage", "clearTimers",
  "startTutorial", "skipTutorial", "advanceTutorialInfoStep", "updateTutorialStep",
  "findNearestBrick", "circleRectHit", "reflectBallOffRect",
  "formatTime", "formatStageList",
  "loadRanking", "saveRanking", "recordGameOverRanking",
  "RANKING_STORAGE_KEY",
];

function loadGame() {
  global.window = global;
  global.requestAnimationFrame = () => {};
  global.addEventListener = () => {};
  const ctxProxy = makeCtxProxy();
  const canvasStub = { width: 480, height: 640, getContext: () => ctxProxy };
  global.document = { getElementById: (id) => (id === "game" ? canvasStub : null) };
  global.localStorage = makeLocalStorageStub();

  const root = path.join(__dirname, "..");
  const gameSrc = fs.readFileSync(path.join(root, "game.js"), "utf8");
  const tutorialSrc = fs.readFileSync(path.join(root, "tutorial.js"), "utf8");
  // 存在しない名前を export しようとすると ReferenceError になるので、
  // 実際にソース中で宣言されている名前だけを拾う（tutorial.js 側の関数などファイルによって有無があるため）。
  const combinedSrc = gameSrc + "\n" + tutorialSrc;
  const availableNames = EXPORT_NAMES.filter((name) => {
    const re = new RegExp("(function\\s+" + name + "\\s*\\(|(?:const|let|var)\\s+" + name + "\\s*=)");
    return re.test(combinedSrc);
  });
  const exportLine =
    "\nglobal.__test_exports = { " + availableNames.join(", ") + " };\n";

  vm.runInThisContext(combinedSrc + exportLine, { filename: "concat.js" });
  return global.__test_exports;
}

module.exports = { loadGame, makeLocalStorageStub, makeCtxProxy };
