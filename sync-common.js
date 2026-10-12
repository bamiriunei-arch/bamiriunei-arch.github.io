// 楽屋シリーズ：共通部品を全ツールにそろえて写す
// 楽屋（gakuya/index.html）の中の「楽屋シリーズ 共通部品（見た目）」と「楽屋シリーズ 共通部品（しくみ）」の
// ここから〜ここまでを、ほかの全ツールの index.html の同じ所に写します。
// 使い方（リポジトリのいちばん上で）： node sync-common.js
// ・ほかのツールの「〇〇だけの見た目」「〇〇本体」は変えません
// ・「共通部品の見た目を元に戻す」の印があるツール（バミリ・ドリルボードなど、前からの見た目のまま使うツール）には、
//   共通部品（見た目）のうち gky- の部品の外にかかる決まりを元に戻す（revert）CSSを、新しい共通部品から作り直して入れます
// ・写したあとは、自動テスト（node test-all.js）で全ツールが動くか確かめてください
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const MARKS = ['見た目', 'しくみ'].map(k => [`/* ==== 楽屋シリーズ 共通部品（${k}） ここから ==== */`, `/* ==== 楽屋シリーズ 共通部品（${k}） ここまで ==== */`]);
const range = (s, [a, b]) => { const i = s.indexOf(a), j = s.indexOf(b); return i < 0 || j < i || s.indexOf(a, i + 1) >= 0 ? null : [i, j + b.length]; };

const src = fs.readFileSync(path.join(HERE, 'gakuya', 'index.html'), 'utf8');
const blocks = MARKS.map(m => { const r = range(src, m); if (!r) { console.error('楽屋（gakuya/index.html）に共通部品の印が見つかりません：' + m[0]); process.exit(1); } return src.slice(r[0], r[1]); });

/* 共通部品（見た目）の決まりを、gky- の部品の外では元に戻す（revert）CSSにする。
   同じ選び方（同じ強さ）で共通部品のあと・ツールの見た目の前に置くので、ツールの見た目に書いたものがそのまま使われる */
const UNDO = ['/* ==== 楽屋シリーズ 共通部品の見た目を元に戻す ここから ==== */', '/* ==== 楽屋シリーズ 共通部品の見た目を元に戻す ここまで ==== */'];
function undoCSS(block) {
  const css = block.replace(/\/\*[\s\S]*?\*\//g, '');
  const IN = 'body>:not([class*=gky-],#gky-print-root)', SCOPE = `:where(${IN},${IN} *)`;
  const SKIP = /gky|:root|\[hidden\]|\[data-staff\]|\[data-member\]|^html$/;
  const scoped = sel => sel === 'body' ? sel : /::[\w-]+$/.test(sel) ? sel.replace(/(::[\w-]+)$/, SCOPE + '$1') : sel + SCOPE;
  const props = body => [...new Set(body.split(';').map(d => d.split(':')[0].trim()).filter(p => p && !p.startsWith('--')))];
  function rules(text) {
    const out = []; let i = 0;
    while (i < text.length) {
      const j = text.indexOf('{', i); if (j < 0) break;
      const head = text.slice(i, j).trim();
      if (head.startsWith('@')) {
        let depth = 1, k = j + 1;
        while (depth) { if (text[k] === '{') depth++; else if (text[k] === '}') depth--; k++; }
        const inner = rules(text.slice(j + 1, k - 1));
        if (inner.length && head.startsWith('@media')) out.push(head + '{\n' + inner.map(r => '  ' + r).join('\n') + '\n}');
        i = k; continue;
      }
      const k = text.indexOf('}', j);
      const sels = head.split(',').map(x => x.trim()).filter(x => x && !SKIP.test(x)), ps = props(text.slice(j + 1, k));
      if (sels.length && ps.length) out.push(sels.map(scoped).join(',') + '{' + ps.map(p => p + ':revert').join(';') + '}');
      i = k + 1;
    }
    return out;
  }
  return UNDO[0] + '\n/* ここは node sync-common.js が作ります（手で直さない）。共通部品（見た目）のうち gky- で始まる部品の外にかかる決まり（box-sizing・入力欄・.btn・.chip など）を、\n   このツールの画面では元に戻す。共通部品の画面（〇〇について・確認など）は、共通部品の見た目のまま */\n' + rules(css).join('\n') + '\n' + UNDO[1];
}
const undo = undoCSS(blocks[0]);

const tools = fs.readdirSync(HERE).filter(d => d !== 'gakuya' && fs.existsSync(path.join(HERE, d, 'index.html'))).sort();
let changed = 0;
for (const t of tools) {
  const f = path.join(HERE, t, 'index.html');
  let s = fs.readFileSync(f, 'utf8');
  if (!s.includes(MARKS[0][0])) continue;   // 楽屋シリーズでないページ（いちばん上の index.html など）
  const before = s;
  MARKS.forEach((m, k) => { const r = range(s, m); if (!r) { console.error(`${t}：共通部品の印が見つかりません（${m[0]}）`); process.exitCode = 1; return; } s = s.slice(0, r[0]) + blocks[k] + s.slice(r[1]); });
  const u = range(s, UNDO); if (u) s = s.slice(0, u[0]) + undo + s.slice(u[1]);
  if (s !== before) { fs.writeFileSync(f, s); changed++; console.log(`${t}/index.html を新しくしました`); }
  else console.log(`${t}/index.html は同じです`);
}
console.log(`\n${changed}個のツールに写しました（共通部品 v${(src.match(/const VERSION = '(\d+)'/) || [])[1] || '?'}）`);
