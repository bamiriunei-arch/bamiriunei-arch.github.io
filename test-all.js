// 楽屋シリーズ：全ツール（または指定したツール）の自動テストを順に動かす
// リポジトリのいちばん上で使います。ツールは、playwright.config.js があるフォルダです。
// 使い方: node test-all.js                … 全部
//         node test-all.js kouban gakufu  … 指定したものだけ
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const EXE = process.platform === 'win32' ? 'playwright.cmd' : 'playwright';
// ここの node_modules か、1つ上（開発用キットの中で dist/ として使うとき）の node_modules
const BIN = [path.join(HERE, 'node_modules', '.bin', EXE), path.join(HERE, '..', 'node_modules', '.bin', EXE)].find(f => fs.existsSync(f));
if (!BIN) {
  console.error('先に「npm install」と「npx playwright install chromium」をしてください。');
  process.exit(1);
}
const all = fs.readdirSync(HERE).filter(s => fs.existsSync(path.join(HERE, s, 'playwright.config.js'))).sort();
const only = process.argv.slice(2);
const unknown = only.filter(s => !all.includes(s));
if (unknown.length) console.error(`見つからないツール: ${unknown.join(', ')}（あるもの: ${all.join(', ')}）`);
const slugs = only.length ? all.filter(s => only.includes(s)) : all;
if (!slugs.length) process.exit(1);

const bad = [];
for (const s of slugs) {
  console.log(`\n=== ${s} ===`);
  // GitHub Actions（CI）では設定どおりの報告（一覧と、失敗を見るためのHTML）、手元では短い表示
  const r = spawnSync(BIN, process.env.CI ? ['test'] : ['test', '--reporter=line'], { cwd: path.join(HERE, s), stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) bad.push(s);
}
console.log(bad.length ? `\n失敗したツール: ${bad.join(', ')}` : `\n動かした${slugs.length}ツールはすべて合格`);
process.exit(bad.length || unknown.length ? 1 : 0);
