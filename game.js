  // =====================================================================
  //  ブロック崩し（初心者向け・全部入り・1ファイル完結）
  //
  //  読み方のおすすめ:
  //   1) 「調整できる設定」…数字を変えると難しさや見た目が変わります
  //   2) 「ゲームの状態(game)」…今どうなっているかを全部ここに入れます
  //   3) 「入力(キーボード)」→「更新(update)」→「描画(draw)」→「ループ」
  //  という順で読むと流れがつかめます。
  // =====================================================================

  // キャンバスと、絵を描くための「筆(ctx)」を取得
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;   // 横幅 480
  const H = canvas.height;  // 高さ 640

  // ------------------------------------------------------------------
  //  調整できる設定（ここの数字を変えると難易度・見た目が変わります）
  // ------------------------------------------------------------------
  const CONFIG = {
    paddleWidth: 90,     // パドルの横幅
    paddleHeight: 14,    // パドルの高さ
    paddleSpeed: 7,      // パドルの動く速さ（左右）
    paddleVertSpeed: 5,  // パドルの動く速さ（前後＝上下）
    paddleForwardRatio: 2 / 3, // パドルが前に出られる上限（画面の高さに対する割合。下側1/3まで）
    ballRadius: 8,       // ボールの大きさ（半径）
    ballSpeed: 4.2,      // ボールの基本スピード（ステージが上がると少し速くなる）
    speedUpPerStage: 0.6,// 1ステージごとに増えるスピード
    brickRows: 4,        // ブロックの行数（ステージ1のときの基準）
    brickCols: 8,        // ブロックの列数
    brickHeight: 22,     // ブロック1つの高さ
    brickGap: 6,         // ブロック同士のすき間
    brickTop: 70,        // ブロック全体の上の余白
    startLives: 3,       // 最初の残機

    // --- アイテム関連 ---
    itemDropChance: 0.30,// ブロックを壊したとき、アイテムが落ちる確率（0〜1）
    itemFallSpeed: 2.5,  // アイテムが落ちる速さ
    effectSeconds: 8,    // 時間制アイテム（拡大/縮小/スロー/加速）の効果時間（秒）
    pierceSeconds: 5,    // 貫通アイテムの効果時間（秒）
    bigBallScale: 1.6,   // 大玉アイテムで何倍の大きさになるか

    // --- 溜め撃ち（パワーヒット）関連 ---
    chargeFullSeconds: 1.2, // Shiftを押しっぱなしにしてから満タンになるまでの秒数
    chargeThreshold: 0.6,   // この割合以上溜まっていればパワーヒットが発動
    powerBrickCount: 2,     // パワーヒットで反射せず連続で壊せるブロック数
    powerBoostSeconds: 0.4, // パワーヒット直後、ボールが速くなる時間（秒）
    powerBoostMult: 1.6,    // その間のボール速度の倍率
    powerCooldownSeconds: 10, // パワーヒット発動後、再び発動できるようになるまでの時間（秒）

    // --- パドルの反動（ボールを弾いたとき後ろに下がる演出）関連 ---
    paddleRecoilBase: 10,   // 通常ヒットの基本反動（ピクセル）
    paddleRecoilPower: 22,  // パワーヒットの基本反動（ピクセル）
    paddleRecoilMax: 32,    // 反動の上限（速いボールでも暴れすぎないように）
    paddleRecoilDecay: 0.85,// 毎フレームの減衰率（大きいほど長く尾を引く）
    paddleKnockbackMult: 1.0,// ボールを弾いたとき実際に後退する量（反動 × この倍率。0で実後退なし）
    paddleShakeAmp: 1.5,    // チャージ完了中にパドルが震える振れ幅（ピクセル）

    // --- 邪魔な障害物（ステージが進むと登場。どちらも壊れない） ---
    indestructibleStartStage: 3,    // このステージ数から「壊れないブロック」が普通のブロックに紛れ始める
    indestructibleMaxCount: 4,      // 1ステージあたりの壊れないブロックの上限数
    floatingObstacleStartStage: 5,  // このステージ数から「フラフラ障害物」が出現し始める
    floatingObstacleSpeed: 1.8,     // 左右に動く速さ
    floatingObstacleLifeSeconds: 7, // 1回の出現で存在し続ける時間（秒）
    floatingObstacleMinGap: 4,      // 消えてから次に出るまでの最短間隔（秒）
    floatingObstacleMaxGap: 9,      // 同、最長間隔（秒）
    floatingObstacleBobAmp: 8,      // 上下にフラフラ揺れる振れ幅（ピクセル）

    // --- デバッグ用 ---
    debugMaxStage: 20,      // デバッグ用ステージ選択で選べる最大ステージ
  };

  // ブロックの色（行ごとに変えると見た目が楽しい）
  const BRICK_COLORS = ["#ff6b6b", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff"];

  // アイテムの種類（色・表示する文字・良い/悪い）
  //  good=true は取ると嬉しい、false は取ると困るアイテム
  const ITEM_TYPES = {
    wide:   { color: "#06d6a0", label: "W", good: true },  // パドル拡大
    slow:   { color: "#4cc9f0", label: "S", good: true },  // ボール減速
    life:   { color: "#ff8fab", label: "♥", good: true },  // 残機+1
    bonus:  { color: "#ffd166", label: "$", good: true },  // ボーナス点
    narrow: { color: "#b5179e", label: "N", good: false }, // パドル縮小（悪い）
    fast:   { color: "#e63946", label: "F", good: false }, // ボール加速（悪い）
    pierce: { color: "#ffb703", label: "P", good: true },  // 貫通（良い）
    big:    { color: "#ff70a6", label: "B", good: true },  // 大玉（良い）
  };
  // 抽選に使う種類の一覧
  const ITEM_KEYS = Object.keys(ITEM_TYPES);

  // アイテムの出やすさ（重み付き抽選）。数字が大きいほど出やすい。
  // life（♥ 残機+1）だけ他の約1/6にしてレア化している。
  const ITEM_WEIGHTS = { wide: 6, slow: 6, life: 1, bonus: 6, narrow: 6, fast: 6, pierce: 6, big: 6 };

  // ------------------------------------------------------------------
  //  ゲームの状態（いま何が起きているかを、ここに全部まとめて持つ）
  // ------------------------------------------------------------------
  const game = {
    state: "ready",  // "ready"(開始待ち) / "playing"(プレイ中) / "gameover" / "clear" / "tutorial"(練習モード)
    score: 0,
    lives: CONFIG.startLives,
    stage: 1,
    stageTime: 0,    // 今のステージの経過フレーム数（表示は formatTime() で M:SS に変換）
    paddle: { x: 0, y: 0, w: 0, h: 0 },
    ball: { x: 0, y: 0, dx: 0, dy: 0, r: CONFIG.ballRadius },
    bricks: [],      // ブロックの配列（1つ = {x, y, w, h, color, alive}）
    particles: [],   // 破壊エフェクトの小さな粒
    items: [],       // 落下中のアイテム（1つ = {x, y, w, h, type}）
    // 時間制の効果の「残りフレーム数」。0 より大きい間だけ効果が出る（60 = 約1秒）
    timers: { wide: 0, narrow: 0, slow: 0, fast: 0, pierce: 0, big: 0, powerBoost: 0, powerCooldown: 0 },
    charge: 0,       // 溜め撃ちのゲージ（0〜1）
    powerHits: 0,    // パワーヒットで残り何個、反射せず壊せるか
    paddleRecoil: 0, // パドルがボールを弾いたときの反動（見た目だけの下げ幅）
    paused: false,   // ポーズ中かどうか
    obstacle: null,        // フラフラ動く障害物（1個だけ存在。null なら非表示）
    obstacleSpawnTimer: 0, // 次に出現するまでの残りフレーム数
    debugMode: false,      // スタート画面でデバッグ用ステージ選択を表示しているか
    debugStartStage: 1,    // デバッグ選択中の開始ステージ
    // 以下はチュートリアルモード（tutorial.js）が「プレイヤーが何をしたか」を検知するための
    // 軽量なカウンタ。増えるだけで、他の用途では使わない。
    _paddleBounces: 0,      // パドルでボールを弾いた回数
    _itemsCaught: 0,        // アイテムを取った回数
    _powerHitsTriggered: 0, // パワーヒットが発動した回数
    _resumes: 0,             // ポーズから再開した回数（ポーズ中は update() 自体が止まるので、判定はここで行う）
  };

  // キーが今押されているかを覚えておく箱
  const keys = { left: false, right: false, up: false, down: false, charge: false };

  // ==================================================================
  //  音（Web Audio API）… 音声ファイルなしで短いビープを鳴らす
  // ==================================================================
  let audioCtx = null;
  function ensureAudio() {
    // ブラウザの制限で、最初のユーザー操作のときに音を有効化する
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  }
  // freq=高さ, dur=長さ(秒), type=波の種類
  function beep(freq, dur = 0.06, type = "square", vol = 0.06) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(audioCtx.destination);
    const t = audioCtx.currentTime;
    osc.start(t);
    // 少しずつ音量を下げて自然に消す
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.stop(t + dur);
  }
  const soundBounce  = () => beep(440, 0.05, "square");  // 反射音
  const soundBreak   = () => beep(660, 0.06, "triangle");// 破壊音
  const soundMiss    = () => beep(160, 0.25, "sawtooth");// ミス音
  const soundClear   = () => { beep(523,0.1); setTimeout(()=>beep(784,0.15),110); };
  const soundGood    = () => { beep(880,0.08,"triangle"); setTimeout(()=>beep(1174,0.1,"triangle"),80); }; // 良いアイテム
  const soundBad     = () => beep(120, 0.2, "sawtooth");  // 悪いアイテム（低い音）
  const soundPower   = () => { beep(300,0.05,"sawtooth"); setTimeout(()=>beep(600,0.1,"sawtooth"),50); }; // パワーヒット発動
  const soundClang   = () => beep(200, 0.08, "square", 0.08); // 壊れない障害物にぶつかったときの硬い音

  // ==================================================================
  //  セットアップ（配置し直す）系の関数
  // ==================================================================

  // パドルを中央下に置く
  function resetPaddle() {
    game.paddle.w = CONFIG.paddleWidth;
    game.paddle.h = CONFIG.paddleHeight;
    game.paddle.x = (W - game.paddle.w) / 2;
    game.paddle.y = H - 40;
  }

  // ボールをパドルの上に戻し、上向きに撃ち出す準備
  function resetBall() {
    const speed = CONFIG.ballSpeed + (game.stage - 1) * CONFIG.speedUpPerStage;
    game.ball.x = game.paddle.x + game.paddle.w / 2;
    game.ball.y = game.paddle.y - game.ball.r - 1;
    // 少し斜め上に飛ばす（左右はランダム）
    const dir = Math.random() < 0.5 ? -1 : 1;
    game.ball.dx = dir * speed * 0.6;
    game.ball.dy = -speed;
  }

  // ブロックを並べる。ステージが上がると行が増えて難しくなる
  function buildBricks() {
    game.bricks = [];
    const rows = CONFIG.brickRows + (game.stage - 1); // ステージごとに1行増える
    const cols = CONFIG.brickCols;
    const gap = CONFIG.brickGap;
    const totalGap = gap * (cols + 1);
    const bw = (W - totalGap) / cols;           // ブロック1個の幅を自動計算
    const bh = CONFIG.brickHeight;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        game.bricks.push({
          x: gap + c * (bw + gap),
          y: CONFIG.brickTop + r * (bh + gap),
          w: bw,
          h: bh,
          color: BRICK_COLORS[r % BRICK_COLORS.length],
          alive: true,
          indestructible: false, // true だと見た目は普通のブロックのまま、当たっても壊れない
          revealed: false,       // 一度当たって「壊れないブロックだ」と判明したか
        });
      }
    }
    // ステージが十分進んだら、見た目は普通のブロックに紛れ込ませた「壊れないブロック」を混ぜる
    if (game.stage >= CONFIG.indestructibleStartStage) {
      const count = Math.min(
        game.stage - CONFIG.indestructibleStartStage + 1,
        CONFIG.indestructibleMaxCount,
        game.bricks.length
      );
      const chosen = [];
      while (chosen.length < count) {
        const i = Math.floor(Math.random() * game.bricks.length);
        if (!chosen.includes(i)) chosen.push(i);
      }
      for (const i of chosen) game.bricks[i].indestructible = true;
    }
  }

  // フラフラ障害物が次に出現するまでの待ち時間を、範囲内でランダムに決める（フレーム数）
  function randomObstacleGap() {
    const minFrames = CONFIG.floatingObstacleMinGap * 60;
    const maxFrames = CONFIG.floatingObstacleMaxGap * 60;
    return minFrames + Math.random() * (maxFrames - minFrames);
  }

  // 新しいゲームを始める（startStage を指定するとそのステージから。デバッグ用ステージ選択で使う）
  function startNewGame(startStage = 1) {
    game.score = 0;
    game.lives = CONFIG.startLives;
    game.stage = startStage;
    game.stageTime = 0;
    resetPaddle();
    buildBricks();
    resetBall();
    game.particles = [];
    game.items = [];
    clearTimers();
    game.charge = 0;
    game.powerHits = 0;
    game.paddleRecoil = 0;
    game.paused = false;
    game.obstacle = null;
    game.obstacleSpawnTimer = randomObstacleGap();
    game.state = "playing";
  }

  // 時間制の効果を全部リセットする（ミス時・新ゲーム時に使う）
  function clearTimers() {
    game.timers.wide = 0;
    game.timers.narrow = 0;
    game.timers.slow = 0;
    game.timers.fast = 0;
    game.timers.pierce = 0;
    game.timers.big = 0;
    game.timers.powerBoost = 0;
    game.timers.powerCooldown = 0;
  }

  // 次のステージへ
  function nextStage() {
    game.stage++;
    game.stageTime = 0;
    resetPaddle();
    buildBricks();
    resetBall();
    game.items = [];      // 前のステージで落下中だったアイテムを持ち越さない
    game.particles = [];  // 破片エフェクトの残骸も片付ける
    game.obstacle = null;
    game.obstacleSpawnTimer = randomObstacleGap();
    game.state = "playing";
  }

  // ==================================================================
  //  入力（キーボード）
  // ==================================================================
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft")  keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key === "ArrowUp")    keys.up = true;
    if (e.key === "ArrowDown")  keys.down = true;
    if (e.key === "Shift")      keys.charge = true;

    // デバッグ用ステージ選択（スタート画面かつデバッグ表示中のみ）: ↑↓ で開始ステージを増減
    if (game.state === "ready" && game.debugMode) {
      if (e.key === "ArrowUp")   game.debugStartStage = Math.min(CONFIG.debugMaxStage, game.debugStartStage + 1);
      if (e.key === "ArrowDown") game.debugStartStage = Math.max(1, game.debugStartStage - 1);
    }

    // スペースキー: 状態に応じて「開始」または「リスタート」
    if (e.code === "Space") {
      e.preventDefault();
      ensureAudio(); // 最初の操作で音を有効化
      if (game.state === "ready") {
        // デバッグ表示中なら選んだステージから、そうでなければステージ1から
        startNewGame(game.debugMode ? game.debugStartStage : 1);
      } else if (game.state === "gameover") {
        startNewGame(1);
      } else if (game.state === "clear") {
        nextStage();
      } else if (game.state === "tutorial") {
        advanceTutorialInfoStep(); // 説明だけのステップはスペースで次へ（tutorial.js で定義）
      }
    }
    // Dキー: スタート画面でデバッグ用ステージ選択の表示をオン/オフ
    if (e.key === "d" || e.key === "D") {
      if (game.state === "ready") game.debugMode = !game.debugMode;
    }
    // Pキー: プレイ中・チュートリアル中だけポーズ⇄再開を切り替え
    if (e.key === "p" || e.key === "P") {
      if (game.state === "playing" || game.state === "tutorial") {
        game.paused = !game.paused;
        // ポーズ中は update() 自体が動かないため、再開の検知はここで行う
        if (!game.paused) game._resumes++;
      }
    }
    // Tキー: スタート画面からチュートリアルを開始
    if (e.key === "t" || e.key === "T") {
      if (game.state === "ready") startTutorial(); // tutorial.js で定義
    }
    // Escapeキー: チュートリアル中はいつでもスキップしてスタート画面へ
    if (e.key === "Escape") {
      if (game.state === "tutorial") skipTutorial(); // tutorial.js で定義
    }
    // 矢印キーでもページがスクロールしないように
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowLeft")  keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
    if (e.key === "ArrowUp")    keys.up = false;
    if (e.key === "ArrowDown")  keys.down = false;
    if (e.key === "Shift")      keys.charge = false;
  });

  // ==================================================================
  //  破壊エフェクト（小さな粒を飛ばす）
  // ==================================================================
  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      game.particles.push({
        x, y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 1,       // 1 → 0 になったら消える
        color,
      });
    }
  }

  // ==================================================================
  //  アイテム：抽選で落とす／取ったときの効果を当てる
  // ==================================================================
  // 重みに応じてアイテムの種類を1つ選ぶ（重みの数だけ配列に詰めてランダムに1個取る）
  function pickItemType() {
    const pool = [];
    for (const key of ITEM_KEYS) {
      for (let i = 0; i < ITEM_WEIGHTS[key]; i++) pool.push(key);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ブロックを壊した場所からアイテムを1個落とす（確率は呼び出し側で判定）
  function spawnItem(x, y) {
    const type = pickItemType();
    game.items.push({ x: x - 12, y: y - 12, w: 24, h: 24, type });
  }

  // アイテムを取ったときの効果。type に応じて処理を分ける
  function applyItem(type) {
    const frames = CONFIG.effectSeconds * 60; // 秒 → フレーム数（約60fps）
    switch (type) {
      case "wide":   game.timers.wide = frames;  game.timers.narrow = 0; break; // 反対効果は打ち消す
      case "narrow": game.timers.narrow = frames; game.timers.wide = 0;  break;
      case "slow":   game.timers.slow = frames;  game.timers.fast = 0;   break;
      case "fast":   game.timers.fast = frames;  game.timers.slow = 0;   break;
      case "pierce": game.timers.pierce = CONFIG.pierceSeconds * 60;    break;
      case "big":    game.timers.big = frames;                          break;
      case "life":   game.lives++;             break;
      case "bonus":  game.score += 100;        break;
    }
    // 良い/悪いで効果音を変える
    if (ITEM_TYPES[type].good) soundGood(); else soundBad();
  }

  // ==================================================================
  //  当たり判定：円(ボール)と矩形(ブロック/パドル)が重なっているか
  // ==================================================================
  function circleRectHit(ball, rect) {
    // 矩形の中で、ボール中心に一番近い点を求める
    const nx = Math.max(rect.x, Math.min(ball.x, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(ball.y, rect.y + rect.h));
    const dx = ball.x - nx;
    const dy = ball.y - ny;
    return dx * dx + dy * dy <= ball.r * ball.r;
  }

  // ボールを矩形(rect)で跳ね返し、めり込んだぶんを外側へ押し出す。
  // 「消えずに残る」相手（壊れないブロック・フラフラ障害物）で使う。押し出さないと
  // 次のフレームでもめり込んだままになり、張り付き・ガタガタが起きるため。
  // ※ どの辺から当たったかは、1フレーム前の位置(prev)が矩形の外だったかで判断する。
  function reflectBallOffRect(ball, rect) {
    const m = ball.r + 0.5; // 半径ぶん＋わずかな余白で、接したまま再衝突しないよう完全に離す
    const prevX = ball.x - ball.dx;
    const prevY = ball.y - ball.dy;
    const wasOutsideX = prevX < rect.x || prevX > rect.x + rect.w;
    const wasOutsideY = prevY < rect.y || prevY > rect.y + rect.h;
    // 左右の面に当たったら x 方向に、上下の面なら y 方向に反転＆押し出す
    if (wasOutsideX && !wasOutsideY) {
      ball.dx *= -1;
      ball.x = prevX < rect.x ? rect.x - m : rect.x + rect.w + m;
    } else if (wasOutsideY && !wasOutsideX) {
      ball.dy *= -1;
      ball.y = prevY < rect.y ? rect.y - m : rect.y + rect.h + m;
    } else {
      // 角に当たった等：両方反転して両軸で押し出す
      ball.dx *= -1;
      ball.dy *= -1;
      ball.x = prevX < rect.x ? rect.x - m : rect.x + rect.w + m;
      ball.y = prevY < rect.y ? rect.y - m : rect.y + rect.h + m;
    }
  }

  // ==================================================================
  //  更新（毎フレーム、動きを1コマ進める）
  // ==================================================================
  function update() {
    // ポーズ中は何も進めない（パーティクルもタイマーもボールも完全に止まる）
    if (game.paused) return;

    // エフェクトの粒はいつでも動かして良い
    for (const p of game.particles) {
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.08;   // ゆるく重力
      p.life -= 0.04;
    }
    game.particles = game.particles.filter((p) => p.life > 0);

    // 効果時間のカウントダウン（毎フレーム1ずつ減らす）
    for (const k in game.timers) {
      if (game.timers[k] > 0) game.timers[k]--;
    }

    // プレイ中でもチュートリアル中でもなければ、ここで動きは止める
    // （チュートリアル中もパドル・ボールの物理演算は共通で動かす。実装を二重化しないため）
    if (game.state !== "playing" && game.state !== "tutorial") return;

    // ステージ経過時間は「本編プレイ中」だけ加算する（チュートリアル中は数えない）
    if (game.state === "playing") game.stageTime++;

    const pad = game.paddle;
    const ball = game.ball;

    // --- パドルの幅を効果に応じて決める（wide=拡大 / narrow=縮小）---
    const cx = pad.x + pad.w / 2;          // 今の中心を覚えておく
    let pw = CONFIG.paddleWidth;
    if (game.timers.wide > 0)   pw *= 1.6;
    if (game.timers.narrow > 0) pw *= 0.6;
    pad.w = pw;
    pad.x = cx - pw / 2;                    // 中心を保ったまま新しい幅を反映

    // --- ボールの大きさを効果に応じて決める（big=大玉）---
    ball.r = CONFIG.ballRadius * (game.timers.big > 0 ? CONFIG.bigBallScale : 1);

    // --- 溜め撃ちのゲージ（Shiftを押している間だけ溜まる。離すとすぐ0に戻る）---
    // クールダウン中（powerCooldown > 0）はShiftを押しても溜まらない
    if (keys.charge && game.timers.powerCooldown === 0) {
      game.charge = Math.min(1, game.charge + 1 / (CONFIG.chargeFullSeconds * 60));
    } else {
      game.charge = 0;
    }

    // --- パドルの反動を減衰させる（ボールを弾いた直後、スッと元の位置に戻る）---
    game.paddleRecoil *= CONFIG.paddleRecoilDecay;
    if (game.paddleRecoil < 0.5) game.paddleRecoil = 0;

    // --- パドルを動かす（左右） ---
    if (keys.left)  pad.x -= CONFIG.paddleSpeed;
    if (keys.right) pad.x += CONFIG.paddleSpeed;
    // 画面の外に出ないよう止める
    if (pad.x < 0) pad.x = 0;
    if (pad.x + pad.w > W) pad.x = W - pad.w;

    // --- パドルを動かす（前後＝上下） ---
    if (keys.up)   pad.y -= CONFIG.paddleVertSpeed;
    if (keys.down) pad.y += CONFIG.paddleVertSpeed;
    // 前（上）は画面の下側1/3まで、後ろ（下）は初期位置まで
    const forwardLimit = H * CONFIG.paddleForwardRatio;
    const backLimit = H - 40;
    if (pad.y < forwardLimit) pad.y = forwardLimit;
    if (pad.y > backLimit) pad.y = backLimit;

    // --- ボールを動かす ---
    // 効果に応じて移動量に倍率をかける（slow=遅く / fast=速く）。
    // dx/dy 自体は変えないので、反射やパドルの角度計算はそのまま使える。
    let mult = 1;
    if (game.timers.slow > 0) mult *= 0.6;
    if (game.timers.fast > 0) mult *= 1.5;
    if (game.timers.powerBoost > 0) mult *= CONFIG.powerBoostMult; // パワーヒット直後は一瞬だけ加速
    ball.x += ball.dx * mult;
    ball.y += ball.dy * mult;

    // 左右の壁で反射
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.dx *= -1; soundBounce(); }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.dx *= -1; soundBounce(); }
    // 上の壁で反射
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.dy *= -1; soundBounce(); }

    // --- フラフラ障害物（ステージが十分進むと出現。壊れない） ---
    if (game.state === "playing" && game.stage >= CONFIG.floatingObstacleStartStage) {
      if (game.obstacle) {
        const ob = game.obstacle;
        // 左右に動き、画面端で跳ね返る
        ob.x += ob.dx;
        if (ob.x < 0) { ob.x = 0; ob.dx *= -1; }
        if (ob.x + ob.w > W) { ob.x = W - ob.w; ob.dx *= -1; }
        // ゆっくり上下にも揺れて「フラフラ」した感じを出す
        ob.bobPhase += 0.05;
        ob.y = ob.baseY + Math.sin(ob.bobPhase) * CONFIG.floatingObstacleBobAmp;
        ob.life--;
        if (ob.life <= 0) {
          game.obstacle = null;
          game.obstacleSpawnTimer = randomObstacleGap();
        } else if (circleRectHit(ball, ob)) {
          // 壊れない壁として跳ね返す（めり込み押し出しも込み）
          reflectBallOffRect(ball, ob);
          soundClang();
        }
      } else {
        game.obstacleSpawnTimer--;
        if (game.obstacleSpawnTimer <= 0) {
          const w = 70, h = 22;
          const dir = Math.random() < 0.5 ? -1 : 1;
          const baseY = H * 0.45;
          game.obstacle = {
            x: dir < 0 ? W - w : 0,
            y: baseY,
            baseY,
            w, h,
            dx: dir * CONFIG.floatingObstacleSpeed,
            bobPhase: 0,
            life: CONFIG.floatingObstacleLifeSeconds * 60,
          };
        }
      }
    }

    // --- パドルとの当たり判定 ---
    if (ball.dy > 0 && circleRectHit(ball, pad)) {
      ball.y = pad.y - ball.r; // めり込み防止
      // 当たった位置で跳ね返る角度を変える（端ほど大きく曲がる）
      const hit = (ball.x - (pad.x + pad.w / 2)) / (pad.w / 2); // -1〜1
      const speed = Math.hypot(ball.dx, ball.dy);
      const angle = hit * (Math.PI / 3); // 最大60度
      ball.dx = speed * Math.sin(angle);
      ball.dy = -Math.abs(speed * Math.cos(angle));
      soundBounce();
      game._paddleBounces++; // チュートリアルなどが「弾けたか」を検知するためのカウンタ

      // 反動はボールの実効速度（slow/fast/パワーブーストの倍率も加味）に応じて大きくする
      const impactSpeed = speed * mult;
      const speedRatio = impactSpeed / CONFIG.ballSpeed;
      game.paddleRecoil = Math.min(CONFIG.paddleRecoilBase * speedRatio, CONFIG.paddleRecoilMax);

      // 力が十分溜まっていて、クールダウン中でなければパワーヒット発動
      if (game.charge >= CONFIG.chargeThreshold && game.timers.powerCooldown === 0) {
        game.powerHits = CONFIG.powerBrickCount;
        game.timers.powerBoost = CONFIG.powerBoostSeconds * 60;       // 一瞬だけボールが速くなる
        game.timers.powerCooldown = CONFIG.powerCooldownSeconds * 60; // しばらく再発動できない
        game.paddleRecoil = Math.min(CONFIG.paddleRecoilPower * speedRatio, CONFIG.paddleRecoilMax); // パワーヒットは反動も大きい
        spawnParticles(pad.x + pad.w / 2, pad.y, "#e63946");    // パドルから赤い粒を飛ばす
        soundPower();
        game._powerHitsTriggered++; // チュートリアルなどが「発動したか」を検知するためのカウンタ
      }
      game.charge = 0;

      // パドルを実際に後ろへ下げる（ノックバック）。後ろの限界を超えないようにする＝限界なら現状維持
      pad.y = Math.min(pad.y + game.paddleRecoil * CONFIG.paddleKnockbackMult, backLimit);
    }

    // --- ブロックとの当たり判定 ---
    for (const b of game.bricks) {
      if (!b.alive) continue;
      if (circleRectHit(ball, b)) {
        // 壊れないブロック：見た目は普通のブロックと同じだったが、当たると正体を現す（灰色）。
        // 消えることはなく、貫通・パワーヒット中でも無視されず必ず跳ね返す。
        if (b.indestructible) {
          b.revealed = true;
          soundClang();
          reflectBallOffRect(ball, b); // 消えない相手なので押し出しも込みで反射
          break;
        }
        b.alive = false;
        game.score += 10;
        spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color);
        soundBreak();
        // ときどきアイテムを落とす（確率は CONFIG.itemDropChance）
        if (Math.random() < CONFIG.itemDropChance) {
          spawnItem(b.x + b.w / 2, b.y + b.h / 2);
        }
        // 貫通中・パワーヒット中はブロックをすり抜けるので、跳ね返らず・止まらず次のブロックも判定する
        if (game.timers.pierce > 0 || game.powerHits > 0) {
          if (game.powerHits > 0) game.powerHits--; // パワーヒットは回数を消費していく
          continue;
        }

        // 当たった辺に応じて跳ね返す（ブロックは消えるが、押し出し込みでも挙動は自然）
        reflectBallOffRect(ball, b);
        break; // 1フレームで壊すのは1個まで（挙動が安定する）
      }
    }

    // --- 落下中のアイテムを動かす／パドルで取る ---
    for (const it of game.items) {
      it.y += CONFIG.itemFallSpeed;      // 下へ落とす
      // パドルと重なったら取得（矩形どうしの重なり判定）
      const caught =
        it.x < pad.x + pad.w && it.x + it.w > pad.x &&
        it.y < pad.y + pad.h && it.y + it.h > pad.y;
      if (caught) {
        applyItem(it.type);
        it.taken = true;                 // 取ったので消す印
        game._itemsCaught++;             // チュートリアルなどが「取れたか」を検知するためのカウンタ
      }
    }
    // 「取った」または「画面下に落ちた」アイテムを消す
    game.items = game.items.filter((it) => !it.taken && it.y < H);

    // --- ボールを下に落とした（ミス） ---
    if (ball.y - ball.r > H) {
      if (game.state === "playing") {
        game.lives--;
        soundMiss();
        game.items = [];   // 落下中のアイテムは片付ける
        clearTimers();     // 効果もリセット
        game.charge = 0;
        game.powerHits = 0;
        game.paddleRecoil = 0;
        if (game.lives <= 0) {
          game.state = "gameover";
        } else {
          resetPaddle();
          resetBall();
        }
      } else if (game.state === "tutorial") {
        // 練習中はボールを落としても失敗にならない。パドル上に戻すだけ
        resetBall();
      }
    }

    // --- ステージクリア判定（壊れないブロックを除き、残っているブロックが無い。本編プレイ中だけ判定する） ---
    if (game.state === "playing" && game.bricks.every((b) => !b.alive || b.indestructible)) {
      game.state = "clear";
      soundClear();
    }

    // チュートリアル中は、現在のステップが完了したか毎フレームチェックする（tutorial.js で定義）
    if (game.state === "tutorial") updateTutorialStep();
  }

  // フレーム数を "分:秒"（例 "1:23"）の文字列に変換する
  function formatTime(frames) {
    const totalSec = Math.floor(frames / 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  // ==================================================================
  //  描画（毎フレーム、今の状態を絵にする）
  // ==================================================================
  function drawRoundRect(x, y, w, h, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function drawCenterText(lines, sub) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 34px system-ui, sans-serif";
    ctx.fillText(lines, W / 2, H / 2 - 10);
    if (sub) {
      ctx.fillStyle = "#9aa4bb";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText(sub, W / 2, H / 2 + 26);
    }
    ctx.textAlign = "start";
  }

  // 操作説明を複数行で表示（ポーズ画面のヘルプとして使う）
  // 1行が長いとキャンバス幅(480px)からはみ出すため、短めに分けてある
  function drawInstructions() {
    const lines = [
      "← → : パドル左右移動　↑ ↓ : パドル前後移動",
      "P : ポーズ",
      "Shift 押しっぱなしで力を溜める",
      "→ パドルで弾くとブロックを2つ壊せる",
      "（発動後10秒はクールダウン）",
      "ブロックを全部消すと次のステージへ",
      "ボールを落とすと残機が減ります",
    ];
    ctx.textAlign = "center";
    ctx.fillStyle = "#9aa4bb";
    ctx.font = "13px system-ui, sans-serif";
    let ly = H / 2 + 60;
    for (const line of lines) {
      ctx.fillText(line, W / 2, ly);
      ly += 18;
    }
    ctx.textAlign = "start";
  }

  // スタート画面用の短いヒント（詳しい操作一覧はポーズ画面で見られる）
  function drawReadyHint() {
    ctx.textAlign = "center";
    ctx.fillStyle = "#9aa4bb";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText("初めてなら T キーでチュートリアル", W / 2, H / 2 + 60);
    ctx.textAlign = "start";
  }

  // デバッグ用ステージ選択パネル（スタート画面でDを押すと表示。案内は画面に出さない開発者向け機能）
  function drawDebugPanel() {
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd166";
    ctx.font = "bold 15px system-ui, sans-serif";
    ctx.fillText("デバッグモード", W / 2, H / 2 + 56);
    ctx.fillStyle = "#e6e9f0";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText("◀ 開始ステージ " + game.debugStartStage + " ▶", W / 2, H / 2 + 86);
    ctx.fillStyle = "#9aa4bb";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("↑↓ で変更　スペースで開始　D で戻る", W / 2, H / 2 + 110);
    ctx.textAlign = "start";
  }

  function draw() {
    // 画面をいったんクリア
    ctx.clearRect(0, 0, W, H);

    // ブロック（壊れないブロックは、正体を現す＝revealed になると灰色になる）
    for (const b of game.bricks) {
      if (!b.alive) continue;
      const color = (b.indestructible && b.revealed) ? "#4a4f5c" : b.color;
      drawRoundRect(b.x, b.y, b.w, b.h, 4, color);
    }

    // フラフラ障害物（壊れない。存在感のある色で表示）
    if (game.obstacle) {
      drawRoundRect(game.obstacle.x, game.obstacle.y, game.obstacle.w, game.obstacle.h, 6, "#6c3fc5");
    }

    // エフェクトの粒
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // 落下中のアイテム（色付きの四角＋1文字ラベル）
    for (const it of game.items) {
      const info = ITEM_TYPES[it.type];
      drawRoundRect(it.x, it.y, it.w, it.h, 6, info.color);
      ctx.fillStyle = "#10131a";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(info.label, it.x + it.w / 2, it.y + it.h / 2 + 1);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "start";
    }

    // パドル（力が溜まってきたら赤みを帯び、パワーヒット直後はくっきり赤になる）
    // ボールを弾いた直後は paddleRecoil の分だけ見た目上少し後ろ（下）にずれる
    let paddleColor = "#e6e9f0";
    if (game.timers.powerBoost > 0) paddleColor = "#e63946";
    else if (game.charge >= CONFIG.chargeThreshold) paddleColor = "#ff8fa3";
    // チャージが発動ライン以上たまっている間は、発射準備OKの合図としてブルブル震わせる（見た目だけ）
    let shakeX = 0, shakeY = 0;
    if ((game.state === "playing" || game.state === "tutorial") && !game.paused && game.charge >= CONFIG.chargeThreshold) {
      shakeX = (Math.random() * 2 - 1) * CONFIG.paddleShakeAmp;
      shakeY = (Math.random() * 2 - 1) * CONFIG.paddleShakeAmp;
    }
    drawRoundRect(game.paddle.x + shakeX, game.paddle.y + game.paddleRecoil + shakeY, game.paddle.w, game.paddle.h, 7, paddleColor);

    // ボール
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(game.ball.x, game.ball.y, game.ball.r, 0, Math.PI * 2);
    ctx.fill();

    // 上部の情報表示（スコア・残機・ステージ）
    ctx.fillStyle = "#c9d2e6";
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("SCORE " + game.score, 12, 26);
    ctx.textAlign = "center";
    ctx.fillText("STAGE " + game.stage + "  " + formatTime(game.stageTime), W / 2, 26);
    ctx.textAlign = "right";
    ctx.fillText("LIFE " + "♥".repeat(Math.max(0, game.lives)), W - 12, 26);
    ctx.textAlign = "left";

    // 発動中の時間効果を小さく表示（残り秒つき）
    const active = [];
    if (game.timers.wide > 0)   active.push(["拡大", "#06d6a0", game.timers.wide]);
    if (game.timers.narrow > 0) active.push(["縮小", "#b5179e", game.timers.narrow]);
    if (game.timers.slow > 0)   active.push(["スロー", "#4cc9f0", game.timers.slow]);
    if (game.timers.fast > 0)   active.push(["加速", "#e63946", game.timers.fast]);
    if (game.timers.pierce > 0) active.push(["貫通", "#ffb703", game.timers.pierce]);
    if (game.timers.big > 0)    active.push(["大玉", "#ff70a6", game.timers.big]);
    ctx.font = "13px system-ui, sans-serif";
    let ex = 12;
    for (const [name, color, frames] of active) {
      const text = name + " " + Math.ceil(frames / 60) + "s";
      ctx.fillStyle = color;
      ctx.fillText(text, ex, 46);
      ex += ctx.measureText(text).width + 14;
    }
    // パワーヒットは回数制なので秒数ではなく残り回数で表示
    if (game.powerHits > 0) {
      const text = "パワー ×" + game.powerHits;
      ctx.fillStyle = "#ffb703";
      ctx.fillText(text, ex, 46);
    }

    // 溜め撃ちのゲージ（パドルの少し上に表示）
    const gaugeW = 80, gaugeH = 6;
    const gx = W / 2 - gaugeW / 2, gy = game.paddle.y - 14;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(gx, gy, gaugeW, gaugeH);
    ctx.fillStyle = "#4cc9f0";
    ctx.fillRect(gx, gy, gaugeW * game.charge, gaugeH);

    // パワーヒットがクールダウン中なら、ゲージの横に残り秒数を表示
    if (game.timers.powerCooldown > 0) {
      ctx.fillStyle = "#8a93a6";
      ctx.font = "12px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("あと" + Math.ceil(game.timers.powerCooldown / 60) + "s", gx + gaugeW + 6, gy + gaugeH);
    }

    // 状態に応じた案内メッセージ
    if (game.state === "ready") {
      drawCenterText("ブロック崩し", "スペースキーで本編スタート");
      if (game.debugMode) drawDebugPanel();
      else drawReadyHint();
    } else if (game.state === "gameover") {
      drawCenterText("ゲームオーバー", "スペースキーでもう一度");
    } else if (game.state === "clear") {
      drawCenterText("ステージクリア！", "スペースキーで次のステージ");
    } else if (game.paused) {
      drawCenterText("一時停止中", "Pキーで再開");
      drawInstructions(); // ポーズ画面はヘルプ画面も兼ねる
    } else if (game.state === "tutorial") {
      drawTutorialOverlay(); // 現在のステップの説明（tutorial.js で定義）
    }
  }

  // ==================================================================
  //  ゲームループ（更新 → 描画 を毎フレーム繰り返す）
  // ==================================================================
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop); // 次のフレームでまた自分を呼ぶ
  }

  // 起動時の初期配置（開始待ち画面を表示）
  resetPaddle();
  buildBricks();
  resetBall();
  loop();
  