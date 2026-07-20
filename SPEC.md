# ブロック崩し 仕様書

`index.html` / `game.js` / `tutorial.js` の3ファイルで完結するブロック崩しゲームの仕様。実装を正として作成。

## 基本情報

- 画面: `<canvas>` 480×640、暗い背景に白系のブロック・パドル・ボール
- 状態（`game.state`）: `ready`（開始待ち）→ `playing`（プレイ中）→ `clear`（ステージクリア）/ `gameover` / `tutorial`（練習モード）
  - `playing` 中・`tutorial` 中に `paused` フラグでポーズ可能（`state` 自体は変わらない）
- ゲームループ: `requestAnimationFrame` で `update()` → `draw()` を毎フレーム繰り返す（約60fps前提）
- 音: Web Audio API のビープ音のみ（音声ファイル不要）。初回キー操作で有効化
- 背景（Issue #5）: `STARS`（`starfieldCount` 個、既定70。モジュール読み込み時に1回だけランダム生成される固定配置。ゲームの状態には影響しない純粋な飾り）を `drawStarfield()` が毎フレーム描画。各星は `Date.now()` ベースの `sin` 計算で明滅（`baseAlpha` × 0.5〜1.0 の範囲で振動）し、`draw()` の一番最初（`ctx.clearRect()` の直後）に呼ぶことで常に最背面に表示される。全ステージ共通で1種類のみ（ステージごとの変化なし）。`ctx.globalAlpha` は描画後に必ず1へ戻し、以降の描画に影響しないようにする

## ファイル構成

| ファイル | 役割 |
| --- | --- |
| `index.html` | HTML・CSSの骨組みのみ。`<script src="game.js">` → `<script src="tutorial.js">` の順に読み込む |
| `game.js` | ゲーム本体（設定・状態・入力・物理演算・描画・音） |
| `tutorial.js` | チュートリアルモード。`game.js` の関数・変数（同じグローバルスコープ）を利用する上乗せレイヤー |

## 操作

| キー | 効果 |
| --- | --- |
| ← → | パドルを左右移動（速さ `paddleSpeed`） |
| ↑ ↓ | パドルを前後（上下）移動（速さ `paddleVertSpeed`） |
| スペース | `ready` → 新規ゲーム開始（デバッグ表示中は選択ステージから、通常はステージ1）、`gameover` → ステージ1から再開、`clear` → 次ステージへ、`tutorial` の info ステップ → 次のステップへ |
| T | `ready` 中のみチュートリアル開始 |
| D | `ready` 中のみデバッグ用ステージ選択表示のオン/オフ |
| ↑ ↓（`ready` かつデバッグ表示中） | 開始ステージ `debugStartStage` を ±1（1〜`debugMaxStage` でクランプ） |
| Escape | `tutorial` 中のみ中断してスタート画面へ戻る |
| P | `playing`／`tutorial` 中のみポーズ⇄再開を切り替え |
| Shift（押しっぱなし） | 溜め撃ちのチャージ。離すと即座に0へ戻る |

## パドル

- 初期位置: 画面下部中央、`y = H - 40`（この位置が「後ろの限界」でもある）
- 前後移動の範囲: 前方（上）は `H * paddleForwardRatio`（既定2/3＝画面下側1/3まで）、後方（下）は `H - 40` まで
- 幅は `wide`/`narrow` アイテムの効果時間中だけ基準幅の1.6倍／0.6倍に変化（中心位置を保ったまま）
- 移動速度（左右・前後とも）は `fastPaddle`/`slowPaddle` アイテムの効果時間中だけ基準速度（`paddleSpeed`/`paddleVertSpeed`）の1.6倍／0.6倍に変化
- 色:
  - 通常: 白系 `#e6e9f0`
  - チャージが発動ライン（`chargeThreshold`）以上: ピンク `#ff8fa3`
  - パワーヒット直後（`powerBoost` タイマー中）: 赤 `#e63946`
- チャージが発動ライン以上の間、見た目だけ小刻みに震える（`paddleShakeAmp` の振れ幅、ポーズ中は止まる）
- ボールを弾くと、見た目の沈み込み（`paddleRecoil`）と、実際の後退（ノックバック）の両方が発生（後述）

## ボール

- 半径 `ballRadius`（既定8）。`big` アイテムの効果中は `bigBallScale` 倍（既定1.6倍）に拡大、当たり判定も連動
- 基本速度は `min(ballSpeed(既定4.2) + (ステージ数-1) × speedUpPerStage(既定0.35), ballSpeedCap(既定6.65))`。ステージが上がるほど速くなるが、`ballSpeedCap` で頭打ちになる（既定値ではステージ8で到達し、`brickMaxRows` の頭打ちタイミングと揃えている：Issue #19）。旧 `speedUpPerStage` の既定0.6はステージ5以降の難易度が急上昇しすぎるため緩和した。アイテムによる一時的な加速（`fast`/`star`/`powerBoost`）は `mult` 側で別途かかるため、この上限の対象外
- 移動量には毎フレーム倍率 `mult` がかかる（`dx`/`dy` 自体は変えない）:
  - `slow` 効果中: ×0.6　／　`fast` 効果中: ×1.5　／　`star` 効果中: ×1.5　／　`powerBoost` 中: × `powerBoostMult`（既定1.6）
  - 複数条件が重なる場合は掛け算で合成
- 壁（左右・上）で反射、パドルで反射
- パドル反射: 当たった位置に応じて反射角が変わる（中心なら垂直、端に行くほど最大60度まで曲がる）。反射後の速さは直前の速さを維持
- **ホーミング（`homing` タイマー中）**: 移動量の計算より前に、`findNearestBrick()`（生存かつ `indestructible` でないブロックのうち最も近いもの。**ボスステージ中は `game.boss` も対象に含める**（Issue #28のフォローアップ。`game.bricks` が空のボスステージでホーミングが無効化されないようにするため）。対象が無ければ何もしない）へ向けて進行方向を補正する。現在角度と目標角度の差を `±homingTurnRate`（既定0.05ラジアン/フレーム）でクランプして少しずつ回転させ、速度の大きさ（`Math.hypot(dx,dy)`）は変えない。壁・パドル・ブロックへの反射は既存のまま（反射後、次のフレームからまた誘導が再開する）
- **ホーミング終了時の軌道補正（Issue #18）**: `homing` タイマーが1→0になった瞬間（減算前の値を `wasHoming` として記録し、減算後に0ならその1フレームだけ発火）、ボールの向きをパドルの現在位置（`pad.x + pad.w/2, pad.y`）へ向けて1回だけ補正する（速さは変えない）。ホーミング中は目標ブロックの位置によっては軌道がほぼ真横になり得るため、効果終了後にそのまま真横の軌道で取り残されたり、パドルから見て捕りにくい位置に飛んでいってしまうのを防ぐための補正
- **スター（`star` タイマー中）**: 画面下端 (`ball.y - ball.r > H`) に達しても `playing` 中のミス処理を行わず、下の壁と同じ要領で跳ね返す（`ball.y = H - ball.r; ball.dy *= -1;`）。ボールの塗り色も金色 `#ffd60a` に変わる（通常は白）

## ブロック

- 行×列で配置。列数は固定 `brickCols`（既定8）、行数は `min(brickRows + (ステージ数-1), brickMaxRows)`（ステージが上がるごとに1行増えるが、`brickMaxRows`（既定11）で頭打ちになる。既定値では旧brickRows=4からステージ8で上限に到達し、以降のステージは行数が変わらない。上限が無いと遠いステージでブロックがパドルの可動域まで埋め尽くしてしまうため：Issue #15）
- 行ごとに `BRICK_COLORS` から色を割り当て（5色を順に繰り返し）
- 壊れると: スコア+10、破片パーティクル発生、破壊音、確率 `itemDropChance`（既定30%）でアイテム落下
- 通常時は1フレームにつき1個だけ破壊し、当たった辺に応じて反射（詳細は「貫通・パワーヒット」参照）
- ブロック・障害物での反射は共通ヘルパー `reflectBallOffRect(ball, rect)` が担う。1フレーム前の位置から当たった辺を判定して `dx`/`dy` を反転し、**さらにボールを矩形の外側（半径＋0.5px）へ押し出す**。消えずに残る相手（壊れないブロック・フラフラ障害物）でボールがめり込んだまま張り付く・ガタガタするのを防ぐための位置補正
  - **安全弁（バグ修正）**: 押し出した結果が画面外（`ball.r` 未満、または `W - ball.r` 超）にならないよう、最後に `ball.x`/`ball.y` をクランプする（下方向はミス判定に使うのでクランプしない）。壁とこの矩形の隙間がボールの直径より狭い場合に、壁の反射とこの関数の押し出しが互いを打ち消し合って反射がループし続ける不具合（Issue #9）に対する保険。根本原因は壊れないブロックの配置制限（上記）で塞いでいるが、フラフラ障害物など他の「消えない」オブジェクトが将来同様の状況を作っても壊れないための二重の備え。
- **壊れないブロック（`indestructible`）**: `game.stage >= indestructibleStartStage`（既定3）のステージから、`buildBricks()` が通常ブロックの中からランダムに `min(floor((stage - indestructibleStartStage) / indestructibleStagesPerStep) + 1, indestructibleMaxCount)` 個を選んで `indestructible: true` にする（既定では `indestructibleStagesPerStep=2`＝2ステージごとに1個増え、`indestructibleMaxCount=10` に達すると頭打ち。ステージ3で1個、ステージ21あたりで上限到達。貫通・速いボールでも歯ごたえを保つため、Issue #21 で4個から引き上げた）。見た目は初期状態では通常ブロックと同じ色（紛れている）。ボールが当たると `revealed: true` になり色が灰色 `#4a4f5c` に変わるが、**`alive` は常に `true` のまま＝消えない**。スコア加算・アイテムドロップは発生せず、`soundClang` を鳴らして壁と同じ要領で反射する。**貫通中・パワーヒット中でも無視されず必ず反射する**（ブロック当たり判定ループの先頭で分岐し、貫通/パワーヒット用の `continue` 処理より先に処理される）。ステージクリア判定は `!b.alive || b.indestructible` を条件にしており、壊れないブロックの存在はクリアを妨げない。
  - **配置制限（バグ修正）**: 選出候補から**両端の列（壁に隣接する列）を除外**し、かつ**選出済みの壊れないブロックと上下左右斜めに隣接するマスも除外**する。`brickGap`（既定6px）はボールの直径（半径×2、既定16px）より狭く、壁や別の壊れないブロックとの隙間にボールがはまると反射が打ち消し合って抜け出せなくなる不具合があったため（Issue #9）。候補が尽きる場合に備え、選出ループは試行回数の上限（候補数×5）を設けている。

## フラフラ障害物（`game.obstacle`）

- `game.state === "playing"` かつ `game.stage >= floatingObstacleStartStage`（既定5）のときだけ出現・移動する（`tutorial` 中は対象外）
- 存在しないとき: `game.obstacleSpawnTimer` を毎フレーム1減らし、0以下になったら1個生成する。生成位置は画面の左右どちらかの端、`y` は `H * 0.45` 付近（`baseY`）、サイズは 70×22px
- 存在する間: `dx`（`floatingObstacleSpeed`、既定1.8）で左右移動し、画面端で反転。`bobPhase` を毎フレーム進めて `y = baseY + sin(bobPhase) * floatingObstacleBobAmp` で上下にも揺れる（「フラフラ」感）。`life`（`floatingObstacleLifeSeconds * 60`、既定7秒ぶんのフレーム）を毎フレーム減らし、0以下で消滅して `game.obstacleSpawnTimer` を `randomObstacleGap()`（`floatingObstacleMinGap`〜`floatingObstacleMaxGap` 秒のランダム値）で再セットする
- ボールとの当たり判定は `reflectBallOffRect()`（当たった辺に応じて反転＋外側へ押し出し）。**壊れず、`life` が尽きるまで何度当たっても消えない**。専用の `soundClang` を鳴らす
- `startNewGame()` / `nextStage()` で `game.obstacle = null` にリセットし、`obstacleSpawnTimer` を新しい乱数で再セットする（ステージ間・新規ゲームで持ち越さない）
- 描画色は紫 `#6c3fc5`

## ボスステージ（`game.boss`、Issue #28）

- `isBossStage(stage)` は `stage % bossStageInterval === 0`（既定5。ステージ5, 10, 15…）で判定する。
- `buildBricks()` はボスステージのとき通常のブロック配置ロジックを実行せず、`game.bricks = []` にした上で `createBoss()` を1体だけ生成して `game.boss` にセットする（通常ステージでは `game.boss = null`）。
- `createBoss()`: サイズ180×50px、画面上部中央（`y=110`固定、`bobPhase`で上下に揺れる）に生成。HPは `bossNumber = stage / bossStageInterval`（1体目, 2体目…）から `min(bossBaseHp + (bossNumber-1) * bossHpPerDefeat, bossHpMax)`（既定: 15, +5ずつ, 上限40）で決める。
- 移動: `dx` は `createBoss()` で `min(bossSpeed + (bossNumber-1) * bossSpeedPerDefeat, bossSpeedCapValue)`（既定: 2.2 + 0.5ずつ, 上限4.5）で決める＝**回が進むほど左右移動が速くなる**。画面端で反転するほか、`dirTimer`（`bossDirChangeMinSeconds`〜`bossDirChangeMaxSeconds` 秒のランダム）が切れるたびに向きをランダムに切り替える（`Math.random()<0.5` で符号を決める＝同じ向きが続くこともあり読みにくい。速さの絶対値は不変）。上下は `bobPhase` によるゆるい揺れ（`y = baseY + sin(bobPhase) * bossBobAmp`, 既定14px）に加え、`diveTimer`（`bossDiveIntervalMin〜MaxSeconds` 秒）が切れると**下へ突っ込む**: `diving=true` の間 `diveT` を `1/(bossDiveDurationSeconds*60)` ずつ進め、`diveOffset = sin(diveT*π) * bossDiveDepth`（既定150px）で 0→最大→0 の山を描いて下降・帰還する。突っ込みが終わると次の `diveTimer` を再セット。最終的な `y = baseY + bob + diveOffset`。単調な壁往復だとボールと横移動が同期して同じ場所で当たり続けてしまうため、この不規則化を入れている（Issue #28のフォローアップ）。
- 被弾: `circleRectHit(ball, boss)` で命中したとき、**`boss.hitCooldown === 0`（無敵時間が切れている）かつ `!boss.diving`（突っ込み中でない）ときだけ**ダメージ処理を行う（突っ込み中は攻撃モーションなので無敵。`drawBoss()` でボスの輪郭に沿った青いシールドを出してテレグラフする）: `game.powerHits > 0`（パワーヒット中）なら `hp -= bossPowerHitDamage`（既定3）・`game.powerHits--`、そうでなければ `hp--`（通常1ダメージ）。あわせて `hitCooldown = bossHitCooldownSeconds * 60`（既定0.8秒）・`flash=10`（描画を10フレーム白くする演出用カウンタ）・`spawnParticles()`・`soundClang()`・アイテムドロップ抽選（`itemDropChance`）。**反射（`reflectBallOffRect()`）はクールダウン中でも毎回行う**（壊れないブロックと同じく貫通・パワーヒット中でもすり抜けない）。この無敵時間は、ボスと上の壁の隙間（ボス `y≈110`, 上壁 `y=0`）にボールが挟まって高速往復し、HPが一気に削られてしまう問題への対策（Issue #28のフォローアップ）。パワーヒットは「多く貫通できる」のではなく「1発の威力が上がる」形でボス戦に活きる。
- 撃破（`hp <= 0`）: `game.score += bossDefeatBonus`（既定500）、撃破エフェクト・`soundBossDefeat()`、`game.boss = null`、`game.bossObstacles = []`（後述の障害物を片付ける）、`game.stageTimes.push(game.stageTime)`（通常のステージクリアと同じ記録）、`game.state = "clear"` に遷移（以降はスペースキーで `nextStage()` へ、既存の流れと同じ）。
- **ボス戦の障害物（`game.bossObstacles`）**: 通常ステージの `game.obstacle`（単数・時間で消える）とは別の、ボス戦専用の**複数持てる常設障害物**。`buildBricks()` のボスステージ分岐で `createBossObstacles(count)` により生成する。`count = min(bossNumber - 1, bossObstacleMaxCount)`（既定上限3）＝ステージ5で0個、10で1個、15で2個…と回が進むほど増える。各要素はフラフラ障害物と同じ形（70×22px、色 `#6c3fc5`）だが**寿命を持たずボスを倒すまで漂い続ける**（初期位置・向き・`baseY`・位相を要素ごとにずらして重なりにくくする）。`update()` で左右移動＋上下の揺れをし、`circleRectHit` でボールに当たれば `reflectBallOffRect()`＋`soundClang()`。`buildBricks()` が唯一の生成元なので `startNewGame()`/`nextStage()` は自動的に正しくリセットされる（通常ステージ分岐で `[]` にする）。
- ボスステージ中は通常のフラフラ障害物（`game.obstacle`）は出現させない（`game.stage >= floatingObstacleStartStage` の判定に `&& !game.boss` を追加）。ボス戦の障害物は上記の別系統。
- **注意点**: 通常の「ステージクリア判定」（`game.bricks.every(...)`）は、ボスステージでは `game.bricks` が空配列のため `every()` が常に `true` を返してしまう（空配列の仕様）。誤発火を防ぐため、この判定に `&& !game.boss` を追加している。
- 画面表示（`drawBoss()`）: 「怖さ」重視のデザイン。
  - **シルエット**: 上辺・下辺ともに不揃いなギザギザのトゲを生やした多角形（トゲの長さは固定配列。毎フレーム乱数だとチラつくため）。角丸矩形は使わない。
  - **本体色**: ほぼ黒のグラデーション（`#1a060e`→`#2b0a16`→下端だけ血の色 `#7a0d20`）。被弾フラッシュ中は白系。
  - **オーラ**: `ctx.shadowBlur` による赤いグロー（`#ff0022`）を `sin(Date.now()/250)` でゆっくり脈動させる。
  - **亀裂**: 体の左右にマグマ状に光る割れ目を線で描く。透明度が `1 - hp/maxHp`（ダメージ率）に連動し、削るほど赤く光る。
  - **目**: 血の色（`#ff2a1a`）に発光（`shadowBlur`）する三角形の吊り目。外側が高く中央へ鋭く落ちる形で、`game.ball` のx座標へ向けて最大±3px動く。
  - **口**: 暗い裂け目（2本の二次曲線で囲んだ三日月形）＋上あごから下向きに生える不揃いな白い牙6本。
  - **シールド**: `boss.diving` の間だけ、ボスの輪郭（`traceBossOutline()`。本体の塗りと共用のギザギザのパス）をボス中心基準に約1.14倍に拡大してなぞり、青い線（`#78d2ff`、`shadowBlur`で発光・脈動）で描く＝体を包むバリアに見せる無敵中テレグラフ。楕円ではなくボスのシルエットに沿った形。
  - 当たり判定は従来どおり `boss.x/y/w/h` の矩形のまま（トゲ・オーラ・シールドは見た目だけ）。ボスの少し上にHPバー（`hp / maxHp` の割合で塗る）を表示する。
- **ブロックの放出**: `boss.blockSpawnTimer`（`createBoss()` で `bossBlockIntervalSeconds * 60`、既定4秒ぶんのフレームに初期化）を毎フレーム1減らし、0以下になったら `bossBlockIntervalSeconds * 60` で再セットし、`game.bricks` 内の生存ブロック数が `bossBlockMaxOnField`（既定6）未満なら `spawnBossBlocks()` を呼ぶ。`spawnBossBlocks()` は `bossBlockCount`（既定2）個のブロック（50×20px、色 `#ff6b6b`、`indestructible: false`）をボスの少し下（`boss.y + boss.h + 20〜60`）のランダムなx位置に `game.bricks` へ追加するだけの単純な関数。放出後のブロックは通常の「ブロックとの当たり判定」ループでそのまま処理されるため、スコア加算・コンボ・アイテムドロップ・破壊音などは既存ロジックを何も変更せずにそのまま適用される。
- **ホーミングとの連携**: `findNearestBrick()` は `game.bricks` を見た後、`game.boss` が存在すればそれも候補に含める（ボスステージ中は `game.bricks` が最初は空のため、ボスが無ければホーミングアイテムの対象が無くなってしまう）。ボスが放出したブロックが場にある場合は、通常どおり距離比較でどちらか近い方が選ばれる。

## スコア・残機・ステージ

- スコア: ブロック破壊で基本+10（コンボ加算あり、後述）、`bonus` アイテムで+100
- コンボ（Issue #33）: `game.combo`（パドルから離れてから戻るまでの間に連続で壊した非`indestructible`ブロック数）。ブロックを壊すたびに `game.combo++` してから `game.score += 10 + (game.combo - 1) * CONFIG.comboBonusPerHit`（既定5）を加算する（1個目+10、2個目+15、3個目+20…）。`indestructible` ブロックはカウント対象外（早期`break`で弾かれる）。貫通中・パワーヒット中に同一フレームで複数ブロックを壊す既存ループとも両立し、壊した順にコンボが伸びる。パドルにボールが当たった瞬間（`game._paddleBounces++` と同じ箇所）と、ミス時・`startNewGame()`・`nextStage()` で `game.combo = 0` にリセットされる。画面表示は `game.combo >= 2` の間だけ「COMBO x◯」をパドルの少し上（溜め撃ちゲージのさらに上）に表示する。段階が上がるほど大きく・派手な色にする3段階演出: `combo < 5` は控えめ（`16px`・グレー`#9aa4bb`）、`5〜9` は目立つ（`bold 22px`・黄`#ffd166`）、`10以上` は最も目立つ（`bold 30px`・赤`#ff6b6b`）
- 残機: 初期値 `startLives`（既定3）。ボールを画面下に落とすと-1、`life` アイテムで+1。0でゲームオーバー
- 残機ボーナス（Issue #26）: `playing` 中、`update()` の毎フレーム末尾付近で `game.score >= game._lifeBonusNextScore` を `while` で判定（1フレームで複数ラインを一気に超えても取りこぼさない）。超えるたびに残機+1・`_lifeBonusNextScore` に `lifeBonusScore`（既定2000。コンボ導入によるスコアインフレを踏まえ旧1000から引き上げ）を加算・`soundLifeUp()` を再生。`tutorial` 中はこの判定を行わない。`startNewGame()` で `_lifeBonusNextScore` を `lifeBonusScore` にリセット、`nextStage()` ではリセットしない（1プレイを通してスコアが積み上がる前提のため）
- 残機が増えた時の音（`soundLifeUp()`）: `life` アイテム取得時・スコアボーナス到達時の両方で共通して鳴る専用の効果音（`beep` を3音連続で鳴らす、他の効果音より長めのファンファーレ）。他の「良いアイテム」共通の `soundGood()` とは別に、残機増加だけ気づきやすくするため専用化した（`applyItem()` 内で `type === "life"` のときだけ分岐）
- ミス時（`playing` 中のみ）: 残機減少、ミス音、落下中アイテム・全タイマー・チャージ・パワーヒット残数・パドル反動をリセットし、パドルとボールを初期位置に戻す（残機が残っていれば続行）。残機が0になった瞬間は `recordGameOverRanking()` を1回呼ぶ（Issue #16）。**`tutorial` 中は残機を減らさず、ボールをパドル上に戻すだけ**
- ステージクリア: `playing` 中に生存ブロック（`indestructible` を除く）が0個になった瞬間に、その時点の `game.stageTime` を `game.stageTimes` に記録してから `clear` 状態へ（`tutorial` 中はブロックが全滅してもこの判定は行わない）。次ステージ開始時（`nextStage()`）にパドル・ブロックを再配置し、ボールをリセット。**落下中アイテムと破片パーティクルは持ち越さずクリアする**。また、時間制のアイテム効果（貫通・大玉・スター等、`clearTimers()`）・チャージ・パワーヒット残数・パドル反動も、ミス時・新規ゲーム時と同様にリセットされる（Issue #34。以前は `nextStage()` だけこのリセットが抜けており、効果が次ステージへ持ち越されてしまうバグがあった）
- ステージ経過時間（`game.stageTime`、フレーム数）: `playing` 中のみ加算（ポーズ・`tutorial`・`gameover`・`clear` 中は増えない）。`startNewGame()` と `nextStage()` の両方で0にリセット。画面上部中央に `formatTime()` で「分:秒」形式（例 `1:23`）に変換して表示

## ローカルランキング（Issue #16）

- `game.stageTimes`（配列）: そのプレイでクリアした各ステージの `stageTime`（フレーム数）を、クリアした順に記録する。`startNewGame()` でリセット、`nextStage()` ではリセットしない（1プレイを通して積み上がる）
- 保存先: `localStorage`（キー `RANKING_STORAGE_KEY = "breakout_ranking_v1"`）。`file://` 環境など `localStorage` が使えない場合に備え、`loadRanking()`/`saveRanking()` は例外を `try/catch` で吸収し、失敗時は空配列・no-opにフォールバックする（ゲーム自体は壊れない）
- 保存形式: `[{ score, stageTimes }, ...]` というシンプルなJSON配列（将来プラットフォームが変わっても移植しやすいように）
- `recordGameOverRanking()`: ゲームオーバー遷移（残機0）の瞬間に1回呼ぶ。既存ランキングを読み込み → 今回のプレイを追加 → **スコア降順**に並べ替え → 上位 `CONFIG.rankingMaxEntries`（既定5）件だけ残して保存 → 結果を `game._rankingCache` にキャッシュ（`draw()` が毎フレーム `localStorage` を読みに行かなくて済むように）
- `formatStageList(times, max)`: `formatTime()` を使い `"0:23 / 0:41 / 0:55"` のような短い文字列を作るヘルパー。0件なら `"(クリアなし)"`、`max` 件を超える場合は打ち切って `…` を付ける
- 画面表示（`drawGameOverStats()`、`gameover` 状態でのみ描画）: 今回のスコア・面数・ステージ別タイム、続けて「ベストN（このブラウザ内）」の見出しと `game._rankingCache` の各順位（スコア・面数＋ステージ別タイム）を表示。記録が無ければ「まだ記録がありません」の1行のみ

## デバッグ用ステージ選択

- `startNewGame(startStage = 1)` は開始ステージを引数で受け取る（既定1）。`game.stage = startStage` にして通常どおり `buildBricks()`（ステージ相当の行数・壊れないブロック混入）で開始する
- スタート画面（`ready`）で `D` キーを押すと `game.debugMode` をトグル。オン中はスタート画面に `drawDebugPanel()` で「開始ステージ N」を表示し、`↑↓` で `game.debugStartStage` を 1〜`debugMaxStage`（既定20）の範囲で増減する
- スペースキーは `ready` のとき `startNewGame(game.debugMode ? game.debugStartStage : 1)` を呼ぶ。`gameover` からの再開は常に `startNewGame(1)`
- `game.debugMode` / `game.debugStartStage` はスタート画面専用の状態で、`startNewGame()` ではリセットしない（次に `ready` に戻っても選択を保持）。プレイ中・チュートリアル中は `D`/`↑↓` のデバッグ操作は無視される

## アイテム

ブロック破壊時、確率 `itemDropChance` で1個、ブロック中心から24×24pxの色付き角丸＋1文字ラベルとして落下（速度 `itemFallSpeed`）。パドルに触れると効果発動、画面下端を超えると消滅。

### 種類（`ITEM_TYPES`）

| ラベル | 種類キー | 効果 | 良/悪 |
| --- | --- | --- | --- |
| W | `wide` | パドル幅1.6倍（`effectSeconds`秒） | 良 |
| S | `slow` | ボール速度×0.6（`effectSeconds`秒） | 良 |
| ♥ | `life` | 残機+1（即時） | 良 |
| $ | `bonus` | スコア+100（即時） | 良 |
| N | `narrow` | パドル幅0.6倍（`effectSeconds`秒） | 悪 |
| F | `fast` | ボール速度×1.5（`effectSeconds`秒） | 悪 |
| P | `pierce` | ブロックを貫通（`pierceSeconds`秒） | 良 |
| B | `big` | ボール拡大 ×`bigBallScale`（`effectSeconds`秒） | 良 |
| ↑ | `fastPaddle` | パドルの左右・前後移動速度 ×1.6（`effectSeconds`秒） | 良 |
| ↓ | `slowPaddle` | パドルの左右・前後移動速度 ×0.6（`effectSeconds`秒） | 悪 |
| ★ | `star` | 無敵（ミスにならず下端で跳ね返る）＋ボール速度×1.5（`starSeconds`秒） | 良 |
| ◎ | `homing` | ボールが最も近い生存ブロックへ毎フレーム少しずつ向きを補正（`homingSeconds`秒） | 良 |

- `wide`⇄`narrow`、`slow`⇄`fast`、`fastPaddle`⇄`slowPaddle` は反対効果同士で取得時に打ち消し合う
- 取得音: 良いアイテムは `soundGood`、悪いアイテムは `soundBad`
- `fastPaddle`/`slowPaddle` は既存の `fast`/`slow`（ボール速度用）と紛らわしいため別キー名にしている

### 出現率（重み付き抽選、`ITEM_WEIGHTS`）

`life` のみ重み1、`star` は重み3（無敵という強力な効果のため主要アイテムよりやや控えめ）、他は全て重み6。

## 貫通（pierce）

- 効果中（`timers.pierce > 0`）はブロックに当たっても跳ね返らず、ボールの向きはそのまま
- 1フレーム内で複数ブロックに触れていれば連続で破壊できる（通常は1フレーム1個までの制限を貫通中は解除）
- 壁・パドルへの反射には影響しない（ブロックのみ貫通）

## 溜め撃ち（パワーヒット）

- Shift押下中のみチャージが増加（`1 / (chargeFullSeconds * 60)` ずつ、上限1.0）。**クールダウン中は増加しない**。Shiftを離すと即座に0へ戻る
- パドルに当たった瞬間、まず**前回のパワーヒットが不発（ブロックに一度も当たらないまま戻ってきた）のまま残っていれば `powerHits` を0にリセットする**（Issue #25）。持ち越しを防ぎ、狙って撃つ一発勝負にするための処理。この直後に新規発動の判定が続くため、同じ弾みでチャージが発動ライン以上なら正しく上書きされる
- チャージが `chargeThreshold`（既定0.6）以上の状態でボールがパドルに当たると発動:
  - `powerHits = powerBrickCount`（既定2）… この回数ぶん、ブロックを貫通と同じ要領で反射せず連続破壊（1個壊すごとに残数-1、0になったら通常反射に戻る）
  - `powerBoost` タイマー開始（`powerBoostSeconds`秒、既定0.4秒）… その間ボール移動量が `powerBoostMult`（既定1.6）倍
  - `powerCooldown` タイマー開始（`powerCooldownSeconds`秒、既定10秒）… 発動から解除されるまで次のパワーヒットは溜められない
  - パドル中央からパワーヒット用パーティクル（赤）を発生、専用効果音 `soundPower`
- チャージは発動の有無にかかわらず、パドルに当たった時点で必ず0にリセットされる

## パドルの反動・ノックバック

ボールがパドルに当たるたびに、直前のボール速度（`mult` 込みの実効速度）を基準速度 `ballSpeed` と比較した比率 `speedRatio` を計算し、以下を決める:

- `game.paddleRecoil = min(base × speedRatio, paddleRecoilMax)`
  - 通常ヒット: `base = paddleRecoilBase`（既定10）
  - パワーヒット発動時: `base = paddleRecoilPower`（既定22、上の式で上書き）
  - 上限 `paddleRecoilMax`（既定32）でクランプ
- `paddleRecoil` は毎フレーム `× paddleRecoilDecay`（既定0.85）で減衰し、0.5未満で0になる
- **見た目**: パドル描画位置に `+ paddleRecoil`（下方向オフセット）を加える。ヒットの瞬間に沈み込み、減衰とともに元の位置へ戻って見える
- **実際の後退（ノックバック）**: ヒットの瞬間、`pad.y = min(pad.y + paddleRecoil × paddleKnockbackMult, backLimit)` でパドルの実位置自体も後方へ移動。`paddleKnockbackMult`（既定1.0）を0にすれば無効化できる。既に後方の限界（`H - 40`）にいる場合は変化しない（現状維持）

まとめると、速いボールやパワーヒットほど「沈み込みが大きく」「実際にも大きく後退する」。

## ポーズ

- `P` キーで `playing`／`tutorial` 中のみ `game.paused` をトグル
- ポーズ中は `update()` の冒頭で即 `return` するため、ボール・パドル入力・パーティクル・全タイマー（アイテム効果・クールダウン含む）が完全に停止
- 画面中央に「一時停止中 / Pキーで再開」を表示（`tutorial` 中でも同じ表示）
- パドルの震え演出（チャージ中）もポーズ中は止まる
- ポーズ解除（再開）のたびに `game._resumes` を+1する。**ポーズ中は `update()` 自体が動かないため、この検知は `update()` の外＝キー入力ハンドラ側で行っている**（チュートリアルのポーズ手順が、このカウンタの増分を見て完了判定する）

## チュートリアルモード（`tutorial.js`）

- `T` キー（`ready` 中のみ）で開始。`game.state = "tutorial"` にして、パドル・ボールを初期化する。**この時点ではブロックを配置しない**（`game.bricks = []`）
- ボール・パドルの物理演算、当たり判定、アイテムの仕組みは `game.js` の `update()`/`draw()` をそのまま共有する（`game.state !== "playing" && game.state !== "tutorial"` のときだけ処理を止める、という共通ガードで実現。二重実装はしていない）
- ミス時の残機減少とステージクリア判定は `playing` 専用に切り分けてあるため、`tutorial` 中は安全に何度でも失敗できる
- 進行管理: `TUTORIAL_STEPS` 配列（`tutorial.js`）にステップを定義。各ステップは次のいずれか:
  - `info: true` のステップ … 説明文のみ。スペースキー（`advanceTutorialInfoStep()`）で次へ
  - `check(state)` を持つステップ（action） … 毎フレーム `updateTutorialStep()` が呼び、`true` を返した瞬間に自動で次のステップへ。`enter(state)` があればステップ開始時に1回だけ実行（基準値の記録や、アイテムの強制スポーンなど）。`tick(state)` があれば `check` の直前に毎フレーム実行（「環境を保つ」ための処理。取り損ねたアイテムの再スポーンなどに使う）
- ステップ構成（全10、インデックス0〜9）:
  1. イントロ（info）
  2. パドル左右移動（← →を両方使うと完了）
  3. パドル前後移動（↑ ↓を両方使うと完了）
  4. ボールの打ち返し（`game._paddleBounces` が増えると完了）
  5. ブロック破壊（**この手順に入る瞬間に必ず `buildTutorialBricks()` を呼び、3個のブロックを新しく用意してから基準値を記録する**。それまでの手順で偶然ブロックが壊れていても、常にフルの状態からやり直しになるため、「基準値が既に0で二度と完了できない」詰みを起こさない。1個減ると完了）
  6. アイテム取得（ステップ開始時に `bonus` アイテムを1個確定で降らせる。**`tick` で「まだ取れておらず `game.items` が空」の状態を毎フレーム監視し、取り損ねて画面外に落ちたら即座にもう1個補充する**ため、詰まない。`game._itemsCaught` が増えると完了）
  7. 溜め（`game.charge >= chargeThreshold` に到達すると完了）
  8. パワーヒット（`game._powerHitsTriggered` が増えると完了）
  9. ポーズ（`game._resumes` が増えると完了＝ポーズしてから再開する一連の操作）
  10. 終了（info）… スペースキーで `startNewGame()` を呼び、本編のステージ1が始まる
- `Escape` キーでいつでも `skipTutorial()`（`game.state = "ready"` に戻すだけ）が呼ばれ、中断できる
- 進捗検知用に `game.js` 側へ追加した軽量カウンタ（チュートリアル専用ではなく、増えるだけの汎用カウンタ）: `_paddleBounces` / `_itemsCaught` / `_powerHitsTriggered` / `_resumes`

## 主な調整パラメータ（`CONFIG`）

`game.js` 冒頭の `CONFIG` オブジェクトに集約。詳細な一覧・説明は `README.md` の「自分で改造してみよう」を参照。
