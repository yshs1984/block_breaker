// =====================================================================
//  チュートリアルモード（練習モード）
//
//  ここは game.js の後に読み込まれる、薄い「上乗せレイヤー」です。
//  ボールやパドルの物理演算・アイテムの仕組みは game.js のものをそのまま使い、
//  このファイルは「手順ごとに、何ができたら次に進むか」を判定するだけです。
//  game.js で定義した CONFIG / game / keys / ctx / W / H / resetPaddle() などを
//  そのまま呼び出せます（同じ <script> の並びの中の、共有された変数だからです）。
// =====================================================================

// チュートリアルの進み具合。step が今どのステップか、state はステップごとに使い捨てのメモ。
game.tutorial = { step: 0, state: {} };

// チュートリアル専用の、少なくて間隔の広いブロック配置
function buildTutorialBricks() {
  game.bricks = [];
  const colors = ["#06d6a0", "#4cc9f0", "#ffd166"];
  const bw = 100, bh = 22, gap = 20;
  const totalW = bw * 3 + gap * 2;
  const startX = (W - totalW) / 2;
  for (let i = 0; i < 3; i++) {
    game.bricks.push({
      x: startX + i * (bw + gap),
      y: 120,
      w: bw,
      h: bh,
      color: colors[i],
      alive: true,
    });
  }
}

// 「アイテムを取ろう」ステップ専用：運任せにせず、確定でボーナスアイテムを1個降らせる
function spawnTutorialItem() {
  game.items.push({ x: W / 2 - 12, y: 60, w: 24, h: 24, type: "bonus" });
}

// チュートリアルの手順一覧。
//  info: true          … 説明だけのステップ。スペースキーで次へ進む
//  check(state)         … 毎フレーム呼ばれ、true を返すと自動で次のステップへ
//  enter(state)         … このステップに入った瞬間に1回だけ呼ばれる（準備処理用）
const TUTORIAL_STEPS = [
  {
    info: true,
    text: ["ようこそ！ブロック崩しの練習をしよう", "スペースキーで次へ"],
  },
  {
    text: ["← → キーでパドルを左右に動かしてみよう"],
    check: (s) => {
      if (keys.left) s.left = true;
      if (keys.right) s.right = true;
      return s.left && s.right;
    },
  },
  {
    text: ["↑ ↓ キーでパドルを前後に動かしてみよう"],
    check: (s) => {
      if (keys.up) s.up = true;
      if (keys.down) s.down = true;
      return s.up && s.down;
    },
  },
  {
    text: ["ボールをパドルで打ち返してみよう"],
    enter: (s) => { s.base = game._paddleBounces; },
    check: (s) => game._paddleBounces > s.base,
  },
  {
    // このステップに入る瞬間、必ずブロックを新しく用意する（毎回フルの状態から始まる）。
    // そうしないと、前のステップまでの間に偶然ブロックが壊れていた場合、
    // 基準値が0になって「これ以上減らない＝二度と完了できない」詰みが起きるため。
    text: ["ブロックを壊してみよう"],
    enter: (s) => {
      buildTutorialBricks();
      s.base = game.bricks.filter((b) => b.alive).length;
    },
    check: (s) => game.bricks.filter((b) => b.alive).length < s.base,
  },
  {
    // 取り損ねて画面外に落ちると game.items が空になり、二度と補充されないと詰んでしまう。
    // tick で「まだ取れていないのにアイテムが無い」状態を毎フレーム監視し、あれば即座に補充する。
    text: ["落ちてくるアイテムをパドルで受け止めてみよう"],
    enter: (s) => { s.base = game._itemsCaught; spawnTutorialItem(); },
    tick: (s) => {
      if (game._itemsCaught === s.base && game.items.length === 0) {
        spawnTutorialItem();
      }
    },
    check: (s) => game._itemsCaught > s.base,
  },
  {
    text: ["Shiftキーを押しっぱなしにして力を溜めてみよう"],
    check: () => game.charge >= CONFIG.chargeThreshold,
  },
  {
    text: ["溜まった状態でボールをパドルに当てて", "パワーヒットを発動させてみよう"],
    enter: (s) => { s.base = game._powerHitsTriggered; },
    check: (s) => game._powerHitsTriggered > s.base,
  },
  {
    // ポーズ中は game.js の update() 自体が止まるため、ここでは「再開した回数」
    // （game._resumes、ポーズ解除の瞬間にキー入力側でカウントされる）を見て判定する
    text: ["Pキーでポーズして、もう一度Pキーで再開してみよう"],
    enter: (s) => { s.base = game._resumes; },
    check: (s) => game._resumes > s.base,
  },
  {
    info: true,
    text: ["お疲れさま！これで一通り体験できました", "スペースキーで本編スタート"],
  },
];

// チュートリアルを開始する（スタート画面でTキーを押すと呼ばれる）
function startTutorial() {
  game.state = "tutorial";
  resetPaddle();
  game.bricks = []; // ブロックは「壊してみよう」ステップに入るタイミングで初めて用意する
  resetBall();
  game.items = [];
  game.particles = [];
  clearTimers();
  game.charge = 0;
  game.powerHits = 0;
  game.paddleRecoil = 0;
  game.paused = false;
  game.tutorial.step = 0;
  enterTutorialStep();
}

// 現在のステップに入った瞬間の準備処理（state を作り直し、enter があれば呼ぶ）
function enterTutorialStep() {
  game.tutorial.state = {};
  const step = TUTORIAL_STEPS[game.tutorial.step];
  if (step.enter) step.enter(game.tutorial.state);
}

// 毎フレーム呼ばれる。action ステップなら check() を見て、満たしていれば次へ進む
function updateTutorialStep() {
  const step = TUTORIAL_STEPS[game.tutorial.step];
  if (step.info) return; // 説明だけのステップはスペースキー待ち（check しない）
  // tick は「環境を保つ」ための処理（例: 取り損ねたアイテムを補充する）。check の前に毎フレーム呼ぶ
  if (step.tick) step.tick(game.tutorial.state);
  if (step.check(game.tutorial.state)) {
    goToNextTutorialStep();
  }
}

// 次のステップへ。最後まで終わっていたら、そのまま本編（ステージ1）を開始する
function goToNextTutorialStep() {
  game.tutorial.step++;
  if (game.tutorial.step >= TUTORIAL_STEPS.length) {
    startNewGame();
    return;
  }
  enterTutorialStep();
}

// スペースキーが押されたときに呼ばれる。今が info ステップなら次へ進める
function advanceTutorialInfoStep() {
  const step = TUTORIAL_STEPS[game.tutorial.step];
  if (step.info) goToNextTutorialStep();
}

// Escapeキーでいつでもチュートリアルを中断し、スタート画面に戻る
function skipTutorial() {
  game.state = "ready";
}

// チュートリアル中の説明文を画面に表示する（draw() の最後に呼ばれる）
function drawTutorialOverlay() {
  const step = TUTORIAL_STEPS[game.tutorial.step];

  ctx.textAlign = "center";
  ctx.fillStyle = "#c9d2e6";
  ctx.font = "bold 15px system-ui, sans-serif";
  ctx.fillText("チュートリアル " + (game.tutorial.step + 1) + " / " + TUTORIAL_STEPS.length, W / 2, 80);

  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "#e6e9f0";
  let ly = 108;
  for (const line of step.text) {
    ctx.fillText(line, W / 2, ly);
    ly += 20;
  }

  if (step.info) {
    ctx.fillStyle = "#9aa4bb";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("スペースキーで次へ", W / 2, ly + 6);
  }

  ctx.fillStyle = "#6c7486";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText("Escapeキーでいつでもスキップ", W / 2, H - 12);

  ctx.textAlign = "start";
}
