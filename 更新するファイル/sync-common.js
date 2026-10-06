// 楽屋シリーズ：共通部品を全ツールにそろえて写す
// 楽屋（gakuya/index.html）の中の「楽屋シリーズ 共通部品（見た目）」と「楽屋シリーズ 共通部品（しくみ）」の
// ここから〜ここまでを、ほかの全ツールの index.html の同じ所に写します。
// 使い方（リポジトリのいちばん上で）： node sync-common.js
// ・ほかのツールの「〇〇だけの見た目」「〇〇本体」は変えません
// ・写したあとは、自動テスト（node test-all.js）で全ツールが動くか確かめてください
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const MARKS = ['見た目', 'しくみ'].map(k => [`/* ==== 楽屋シリーズ 共通部品（${k}） ここから ==== */`, `/* ==== 楽屋シリーズ 共通部品（${k}） ここまで ==== */`]);
const range = (s, [a, b]) => { const i = s.indexOf(a), j = s.indexOf(b); return i < 0 || j < i || s.indexOf(a, i + 1) >= 0 ? null : [i, j + b.length]; };

const src = fs.readFileSync(path.join(HERE, 'gakuya', 'index.html'), 'utf8');
const blocks = MARKS.map(m => { const r = range(src, m); if (!r) { console.error('楽屋（gakuya/index.html）に共通部品の印が見つかりません：' + m[0]); process.exit(1); } return src.slice(r[0], r[1]); });

const tools = fs.readdirSync(HERE).filter(d => d !== 'gakuya' && fs.existsSync(path.join(HERE, d, 'index.html'))).sort();
let changed = 0;
for (const t of tools) {
  const f = path.join(HERE, t, 'index.html');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MARKS[0][0])) continue;   // 楽屋シリーズでないページ（いちばん上の index.html など）
  const before = s;
  MARKS.forEach((m, k) => { const r = range(s, m); if (!r) { console.error(`${t}：共通部品の印が見つかりません（${m[0]}）`); process.exitCode = 1; return; } s = s.slice(0, r[0]) + blocks[k] + s.slice(r[1]); });
  if (s !== before) { fs.writeFileSync(f, s); changed++; console.log(`${t}/index.html を新しくしました`); }
  else console.log(`${t}/index.html は同じです`);
}
console.log(`\n${changed}個のツールに写しました（共通部品 v${(src.match(/const VERSION = '(\d+)'/) || [])[1] || '?'}）`);
