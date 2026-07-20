// tests/ 以下の test_*.js を順番に実行する簡易ランナー。
// 各テストファイルは自分の中で assert してプロセスを終了する（0=成功 / 1=失敗）ので、
// ここでは「全部実行して、1つでも失敗したら非ゼロで終了する」だけを担当する。
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const dir = __dirname;
const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith("test_") && f.endsWith(".js"))
  .sort();

if (files.length === 0) {
  console.log("テストファイルが見つかりませんでした（tests/test_*.js）");
  process.exit(1);
}

let failed = [];
for (const file of files) {
  console.log("\n=== " + file + " ===");
  try {
    execFileSync(process.execPath, [path.join(dir, file)], { stdio: "inherit" });
  } catch (e) {
    failed.push(file);
  }
}

console.log("\n" + "=".repeat(40));
if (failed.length === 0) {
  console.log(`全 ${files.length} ファイル成功`);
  process.exit(0);
} else {
  console.log(`${failed.length}/${files.length} ファイルが失敗: ${failed.join(", ")}`);
  process.exit(1);
}
