# ブロック崩し 仕様書

`index.html` / `game.js` / `tutorial.js` の3ファイルで完結するブロック崩しゲームの仕様。実装を正として作成。

## 基本情報

- 画面: `<canvas>` 480×640、暗い背景に白系のブロック・パドル・ボール
- 状態（`game.state`）: `ready`（開始待ち）→ `playing`（プレイ中）→ `clear`（ステージクリア）/ `gameover` / `tutorial`（練習モード）
  - `playing` 中・`tutorial` 中に `paused` フラグでポーズ可能（`state` 自体は変わらない）
- ゲームループ: `requestAnimationFrame` で `update()` → `draw()` を毎フレーム繰り返す（約60fps前提）
- 音: Web Audio API のビープ音のみ（音声ファイル不要）。初回キー操作で有効化

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
- **ホーミング（`homing` タイマー中）**: 移動量の計算より前に、`findNearestBrick()`（生存かつ `indestructible` でないブロックのうち最も近いもの。無ければ何もしない）へ向けて進行方向を補正する。現在角度と目標角度の差を `±homingTurnRate`（既定0.05ラジアン/フレーム）でクランプして少しずつ回転させ、速度の大きさ（`Math.hypot(dx,dy)`）は変えない。壁・パドル・ブロックへの反射は既存のまま（反射後、次のフレームからまた誘導が再開する）
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

## スコア・残機・ステージ

- スコア: ブロック破壊で+10、`bonus` アイテムで+100
- 残機: 初期値 `startLives`（既定3）。ボールを画面下に落とすと-1、`life` アイテムで+1。0でゲームオーバー
- ミス時（`playing` 中のみ）: 残機減少、ミス音、落下中アイテム・全タイマー・チャージ・パワーヒット残数・パドル反動をリセットし、パドルとボールを初期位置に戻す（残機が残っていれば続行）。**`tutorial` 中は残機を減らさず、ボールをパドル上に戻すだけ**
- ステージクリア: `playing` 中に生存ブロック（`indestructible` を除く）が0個になった瞬間に `clear` 状態へ（`tutorial` 中はブロックが全滅してもこの判定は行わない）。次ステージ開始時（`nextStage()`）にパドル・ブロックを再配置し、ボールをリセット。**落下中アイテムと破片パーティクルは持ち越さずクリアする**
- ステージ経過時間（`game.stageTime`、フレーム数）: `playing` 中のみ加算（ポーズ・`tutorial`・`gameover`・`clear` 中は増えない）。`startNewGame()` と `nextStage()` の両方で0にリセット。画面上部中央に `formatTime()` で「分:秒」形式（例 `1:23`）に変換して表示

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
