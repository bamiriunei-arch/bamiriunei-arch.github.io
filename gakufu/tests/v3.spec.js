// 楽譜ライブラリ v3：PDFの楽譜（パートの見分け・PDFのないパート・パートごとにまとめる・zipで移す）、楽屋の本番、部員用の端末
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const PDF = '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n';
const SONGS = [
  { id: 's1', title: '宝島', composer: '和泉宏隆', parts: ['Fl1', 'Fl2', 'Cl1', 'Cl1', 'Cl2', 'B.Cl', 'A.Sax1', 'A.Sax2', 'T.Sax', 'B.Sax', 'Tp1', 'Tp2', 'Tp3', 'Hn', 'Hn', 'Tb1', 'Tb2', 'B.Tb', 'Euph', 'Tuba', 'S.D.', 'Timp', 'Perc1', 'Perc2'] },
  { id: 's2', title: 'ふるさと', composer: '岡野貞一', parts: ['Fl1', 'Tp1', 'Tp2'] },
];
/* 例でない台帳（2曲）と、曲目一覧（2曲） */
async function seed(page, org = null) {
  await page.evaluate(({ SONGS, org }) => {
    localStorage.setItem('gakufu.v1', JSON.stringify({ v: 1, songs: SONGS, setlists: [{ id: 'l1', title: '定期演奏会', date: '2026-12-20', venue: '市民会館', ids: ['s1', 's2'] }], slCur: 'l1' }));
    if (org) localStorage.setItem('gakuya.org', JSON.stringify(org));
  }, { SONGS, org });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.evaluate(() => __app.pdfReady);
}
/* 曲にファイルを入れる（ファイルを選ぶ画面の代わり） */
const addFiles = (page, song, names) => page.evaluate(({ song, names, PDF }) => __app.addPdfs(song, names.map(n => { const f = new File([PDF + n], n, { type: /\.pdf$/i.test(n) ? 'application/pdf' : 'text/plain' }); return { name: n, size: f.size, type: f.type, file: f }; })), { song, names, PDF });
/* 保存するファイルの名前を記録する（テストのブラウザは、日本語のファイル名を「download」にしてしまうため） */
const spySave = page => page.evaluate(() => { const o = GKY.saveFile; window.__saved = []; GKY.saveFile = (n, d, m) => { window.__saved.push(n); return o(n, d, m); }; });
const lastSaved = page => page.evaluate(() => window.__saved[window.__saved.length - 1]);
/* 新しいタブで開いたアドレスを記録する（テストのブラウザは、PDFを開かずに保存してしまうため） */
const spyOpen = page => page.evaluate(() => { window.__opened = []; window.open = () => { const w = { location: {}, close() { w.closed = true; } }; window.__opened.push(w); return w; }; });
/* 保存されたzipの中のファイル名 */
async function zipNames(page, download) {
  const buf = require('fs').readFileSync(await download.path());
  return page.evaluate(async b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); return (await GKY.zipRead(new Blob([u]))).map(z => z.name); }, buf.toString('base64'));
}

test('ファイルの名前からパートを見分ける（英語・1st・Ⅱ・曲名入り・スコア）', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(SONGS => {
    const s = SONGS[0], g = n => __app.guessPart(n, s);
    return ['宝島_Tp1.pdf', '宝島 - Score.pdf', '宝島（スコア）.pdf', 'Conductor.pdf', 'Takarajima_1st Trumpet in Bb.pdf', 'Clarinet in Bb 2.pdf', 'Bass Clarinet.pdf', 'Alto Saxophone 2.pdf', 'Alto Sax 1.pdf', 'Baritone Sax.pdf', 'Horn in F 3.pdf', 'ホルン.pdf',
      'Percussion 2.pdf', 'Snare Drum.pdf', 'Timpani.pdf', 'Trumpet.pdf', 'トランペット3.pdf', '3rd Trombone.pdf', 'B.Tb.pdf', 'Fl.1.pdf', 'フルートⅡ.pdf', '第2クラリネット.pdf', 'Glockenspiel.pdf', 'メモ.pdf', '宝島_ver2_Tp2.pdf', 'Euphonium.pdf', 'Trumpet II.pdf', 'Horn I.pdf'].map(n => [n, g(n)]);
  }, SONGS);
  expect(Object.fromEntries(r)).toEqual({
    '宝島_Tp1.pdf': 'Tp1', '宝島 - Score.pdf': 'スコア', '宝島（スコア）.pdf': 'スコア', 'Conductor.pdf': 'スコア', 'Takarajima_1st Trumpet in Bb.pdf': 'Tp1', 'Clarinet in Bb 2.pdf': 'Cl2', 'Bass Clarinet.pdf': 'B.Cl', 'Alto Saxophone 2.pdf': 'A.Sax2', 'Alto Sax 1.pdf': 'A.Sax1', 'Baritone Sax.pdf': 'B.Sax', 'Horn in F 3.pdf': 'Hn', 'ホルン.pdf': 'Hn',
    'Percussion 2.pdf': 'Perc2', 'Snare Drum.pdf': 'S.D.', 'Timpani.pdf': 'Timp', 'Trumpet.pdf': 'Tp', 'トランペット3.pdf': 'Tp3', '3rd Trombone.pdf': 'Tb3', 'B.Tb.pdf': 'B.Tb', 'Fl.1.pdf': 'Fl1', 'フルートⅡ.pdf': 'Fl2', '第2クラリネット.pdf': 'Cl2', 'Glockenspiel.pdf': 'Glk', 'メモ.pdf': '', '宝島_ver2_Tp2.pdf': 'Tp2', 'Euphonium.pdf': 'Euph', 'Trumpet II.pdf': 'Tp2', 'Horn I.pdf': 'Hn',
  });
  // 楽器の記号だけのPDF（Tp）は、その楽器の全部のパートの分。Perc は打楽器の全部
  const c = await page.evaluate(() => [__app.covers('Tp', 'Tp2'), __app.covers('Tp', 'B.Tb'), __app.covers('Tp1', 'Tp2'), __app.covers('Perc', 'S.D.'), __app.covers('', 'Tp1')]);
  expect(c).toEqual([true, false, false, true, false]);
  await noErrors(errors);
});

test('曲にPDFを入れ、パートを直し、PDFのないパートがわかる。開く・消す・元に戻す', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.locator('#songList .spine', { hasText: 'ふるさと' }).click();
  const sec = page.locator('#pdfSec');
  await expect(sec).toContainText('ファイルの名前からパートを見分けます');
  // ファイルを選ぶ画面から入れる（PDFでないファイルは入れない）
  const fc = page.waitForEvent('filechooser');
  await sec.locator('#pdfAdd').click();
  await (await fc).setFiles([{ name: 'ふるさと_Score.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF) }, { name: 'ふるさと_Tp1.pdf', mimeType: 'application/pdf', buffer: Buffer.from(PDF + 'ふるさと_Tp1.pdf') }, { name: 'メモ.txt', mimeType: 'text/plain', buffer: Buffer.from('x') }]);
  await expect(page.locator('#gkyToast')).toContainText('PDFを2個入れました');
  await expect(page.locator('#gkyToast')).toContainText('PDF・画像でないファイル 1個');
  await expect(sec.locator('.pdf')).toHaveCount(2);
  await expect(sec.locator('.pdf').first().locator('select')).toHaveValue('スコア');
  await expect(sec.locator('#pdfMiss')).toContainText('PDFのないパート：');
  await expect(sec.locator('#pdfMiss .tape')).toHaveText(['Fl1', 'Tp2']);
  // 一覧に「PDF 2」の札、「PDFあり」で絞り込める
  await expect(page.locator('#songList .spine', { hasText: 'ふるさと' })).toContainText('PDF 2');
  await page.click('#filters [data-f="pdf"]');
  await expect(page.locator('#songList .spine')).toHaveCount(1);
  await page.click('#filters [data-f="pdf"]');
  // 同じファイルは2つ入れない。「Trumpet」は Tp の全部 → Tp2 もうまる
  await addFiles(page, 's2', ['ふるさと_Tp1.pdf']);
  await expect(page.locator('#gkyToast')).toContainText('同じファイル 1個は入れていません');
  await addFiles(page, 's2', ['Trumpet.pdf']);
  await expect(sec.locator('#pdfMiss .tape')).toHaveText(['Fl1']);
  // パートを直す（その他 → Fl1）と、全部そろう
  const row = sec.locator('.pdf', { hasText: 'Trumpet.pdf' });
  await expect(row.locator('select')).toHaveValue('Tp');
  await expect(row.locator('select option:checked')).toHaveText('Tp（全部）');
  await row.locator('select').selectOption('Fl1');
  await expect(sec.locator('#pdfMiss')).toContainText('PDFのないパート');
  await expect(sec.locator('#pdfMiss .tape')).toHaveText(['Tp2']);
  expect(await page.evaluate(() => __app.PDFS.find(m => m.name === 'Trumpet.pdf').part)).toBe('Fl1');
  // 新しいタブで開く（ファイルの中身のアドレス）
  await spyOpen(page);
  await sec.locator('.pdf', { hasText: 'ふるさと_Tp1.pdf' }).locator('[data-popen]').click();
  await expect.poll(() => page.evaluate(() => window.__opened.length && window.__opened[0].location.href)).toMatch(/^blob:/);
  expect(await page.evaluate(async () => { const r = await fetch(window.__opened[0].location.href); return [r.headers.get('content-type'), (await r.text()).slice(0, 8)]; })).toEqual(['application/pdf', '%PDF-1.4']);
  // 消す（2回押す）→ 元に戻す
  const del = sec.locator('.pdf', { hasText: 'ふるさと_Tp1.pdf' }).locator('[data-pdel]');
  await del.click(); await del.click();
  await expect(sec.locator('.pdf')).toHaveCount(2);
  await page.locator('#gkyToast button', { hasText: '元に戻す' }).click();
  await expect(sec.locator('.pdf')).toHaveCount(3);
  // 読み直しても残っている（この端末の中のファイル置き場）
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready); await page.evaluate(() => __app.pdfReady);
  await page.locator('#songList .spine', { hasText: 'ふるさと' }).click();
  await expect(page.locator('#pdfSec .pdf')).toHaveCount(3);
  await noErrors(errors);
});

test('曲目一覧：パートごとのPDFを表で見て、全部のパートをパートごとのフォルダのzipにする', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await addFiles(page, 's1', ['宝島_Score.pdf', '宝島_Tp1.pdf', '宝島_Tp2.pdf']);
  await addFiles(page, 's2', ['Trumpet.pdf']);
  await page.click('[data-tab="setlist"]');
  await page.click('#slPdf');
  const sh = page.locator('.gky-sheet', { hasText: 'パートごとのPDF' });
  const tr = k => sh.locator('tbody tr').filter({ has: page.locator('.tape', { hasText: new RegExp('^' + k.replace('.', '\\.') + '$') }) });
  await expect(tr('スコア').locator('td').nth(1)).toHaveText('1／2曲');
  await expect(tr('スコア')).toContainText('2. ふるさと');
  await expect(tr('Tp1').locator('td').nth(1)).toHaveText('2／2曲');
  await expect(tr('Tp2').locator('td').nth(1)).toHaveText('2／2曲');
  await expect(tr('Tp3').locator('td').nth(1)).toHaveText('0／2曲');
  await expect(tr('Tp3')).toContainText('1. 宝島');
  await expect(tr('Tp3').locator('[data-bsend]')).toHaveCount(0);
  // パートの送るファイルの名前（演奏する順・曲名・パート）
  const names = await page.evaluate(() => { const xs = __app.S.setlists[0].ids.map(id => __app.S.songs.find(s => s.id === id)); return __app.bundleFiles(__app.bundleRows(xs).find(r => r.k === 'Tp1')).map(f => f.name); });
  expect(names).toEqual(['01_宝島_Tp1.pdf', '02_ふるさと_Tp1.pdf']);
  // 全部のパートをzipで（パソコンではファイルに保存）
  await spySave(page);
  const dl = page.waitForEvent('download');
  await sh.locator('#bZip').click();
  const d = await dl;
  expect(await lastSaved(page)).toBe('定期演奏会_パート譜.zip');
  const zn = await zipNames(page, d);
  expect(zn.sort()).toEqual(['Tp1/01_宝島.pdf', 'Tp1/02_ふるさと.pdf', 'Tp2/01_宝島.pdf', 'Tp2/02_ふるさと.pdf', 'スコア/01_宝島.pdf', '曲目一覧.txt'].sort());
  // 曲目一覧.txt に、曲の順番とPDFのない曲を書く
  const txt = await page.evaluate(async b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const z = (await GKY.zipRead(new Blob([u]))).find(z => z.name === '曲目一覧.txt'); return (await z.blob()).text(); }, require('fs').readFileSync(await d.path()).toString('base64'));
  expect(txt).toContain('01. 宝島');
  expect(txt).toContain('Tp3：PDFのない曲 01');
  await noErrors(errors);
});

test('PDFをzipで保存して、ほかの端末（空の置き場）で読み込む。曲名のフォルダのzipは新しい曲として足せる', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await addFiles(page, 's1', ['宝島_Score.pdf', '宝島_Tp1.pdf']);
  await page.evaluate(() => __app.PDFS.find(m => m.name === '宝島_Tp1.pdf')).then(m => expect(m.part).toBe('Tp1'));
  await page.click('[data-tab="io"]');
  await expect(page.locator('#pdfUse')).toContainText('2個');
  await spySave(page);
  const dl = page.waitForEvent('download');
  await page.click('#pdfOut');
  const d = await dl;
  expect(await lastSaved(page)).toMatch(/^楽譜PDF_楽譜ライブラリ_\d{4}-\d{2}-\d{2}\.zip$/);
  const zn = await zipNames(page, d);
  expect(zn.sort()).toEqual(['gakufu-pdf.json', '宝島/宝島_Score.pdf', '宝島/宝島_Tp1.pdf']);
  // 置き場を空にして、パートを直してから読み込む（zipに書いたパートで入る）
  const b64 = require('fs').readFileSync(await d.path()).toString('base64');
  await page.evaluate(async () => { for (const m of __app.PDFS) await GKY.media.del(m.id); await __app.loadPdfs(); __app.renderAll(); });
  await expect(page.locator('#pdfUse')).toHaveText('まだありません');
  await page.evaluate(b64 => { window.__zip = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))]); __app.pdfImport(window.__zip); }, b64);
  const sh = page.locator('.gky-sheet', { hasText: 'PDFの楽譜を読み込む' });
  await expect(sh).toContainText('台帳の曲に入る 2個（1曲）');
  await sh.locator('button', { hasText: '読み込む' }).click();
  await expect(page.locator('#gkyToast')).toContainText('PDFを2個入れました');
  expect(await page.evaluate(() => __app.PDFS.map(m => [m.song, m.part]).sort())).toEqual([['s1', 'Tp1'], ['s1', 'スコア']]);
  // 同じzipをもう一度：同じファイルは入れない
  await page.evaluate(() => __app.pdfImport(window.__zip));
  await sh.locator('button', { hasText: '読み込む' }).click();
  await expect(page.locator('#gkyToast')).toContainText('同じファイル 2個は入れていません');
  // ほかのソフトで作ったzip（一覧なし）：フォルダの名前が台帳にない曲 → 新しい曲として足す
  await page.evaluate(async PDF => { const z = await GKY.zipMake([{ name: 'たなばた/たなばた_Hn1.pdf', data: PDF }, { name: 'たなばた/Score.pdf', data: PDF + 's' }, { name: 'ふるさと_Fl1.pdf', data: PDF }, { name: 'readme.txt', data: 'x' }]); __app.pdfImport(z); }, PDF);
  await expect(sh).toContainText('台帳の曲に入る 1個（1曲）');
  await expect(sh).toContainText('曲がわからない 2個');
  await expect(sh.locator('.imp-row select')).toHaveValue('+');
  await sh.locator('button', { hasText: '読み込む' }).click();
  await expect(page.locator('#gkyToast')).toContainText('PDFを3個入れました（新しい曲 1曲）');
  const r = await page.evaluate(() => { const t = __app.S.songs.find(s => s.title === 'たなばた'); return { t: !!t, parts: __app.PDFS.filter(m => t && m.song === t.id).map(m => m.part).sort(), fl: __app.PDFS.find(m => m.name === 'ふるさと_Fl1.pdf').song }; });
  expect(r).toEqual({ t: true, parts: ['Hn1', 'スコア'], fl: 's2' });
  // 曲を消すと、台帳にない曲のPDFとして「取り込み・書き出し」に出て、消せる
  await page.click('[data-tab="lib"]');
  await page.locator('#songList .spine', { hasText: 'たなばた' }).click();
  await page.click('#dDel'); await page.click('#dDel');
  await expect(page.locator('#gkyToast')).toContainText('PDF 2個は「取り込み・書き出し」から消せます');
  await page.click('[data-tab="io"]');
  await expect(page.locator('#pdfOrph')).toContainText('台帳にない曲のPDFが 2個');
  await page.click('#pdfOrphDel'); await page.click('#pdfOrphDel');
  await expect(page.locator('#pdfOrph')).toBeEmpty();
  expect(await page.evaluate(() => __app.PDFS.length)).toBe(3);   // 宝島 2個・ふるさと 1個
  await noErrors(errors);
});

test('曲目一覧を楽屋の本番とつなぐ。楽屋の本番から開くと、その曲目一覧を開くか作る', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page, { org: { name: 'テスト高校', type: 'koko' }, concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2026-12-21', venue: '大ホール' }, { id: 'c2', title: 'クリスマスコンサート', date: '2026-12-24', venue: '駅前広場' }] });
  await page.click('[data-tab="setlist"]');
  const sel = page.locator('#slCf select');
  await expect(sel).toHaveValue('');
  await sel.selectOption('c1');
  await expect(page.locator('#gkyToast')).toContainText('楽屋の本番「第13回 定期演奏会」とつなぎました');
  expect(await page.evaluate(() => __app.S.setlists[0].concert)).toBe('c1');
  await expect(page.locator('#slTitle')).toHaveValue('定期演奏会');   // 入っている名前はそのまま
  // 楽屋の本番から開く：つないだ曲目一覧を開く
  await page.click('[data-tab="lib"]');
  await page.evaluate(() => { location.hash = '#concert=c1'; });
  await expect(page.locator('#gkyToast')).toContainText('楽屋の本番「第13回 定期演奏会」の曲目一覧を開きました');
  await expect(page.locator('[data-panel="setlist"]')).toBeVisible();
  // まだない本番：作るか聞いて、本番の名前・日付・会場で作る
  await page.evaluate(() => { location.hash = '#concert=c2'; });
  const sh = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await expect(sh).toContainText('クリスマスコンサート');
  await sh.locator('button', { hasText: '曲目一覧を作る' }).click();
  await expect(page.locator('#slTitle')).toHaveValue('クリスマスコンサート');
  await expect(page.locator('#slDate')).toHaveValue('2026-12-24');
  await expect(page.locator('#slVenue')).toHaveValue('駅前広場');
  await expect(page.locator('#slCf select')).toHaveValue('c2');
  expect(await page.evaluate(() => __app.S.setlists.map(l => l.concert))).toEqual(['c2', 'c1']);
  // 「＋ 楽屋の本番の一覧に入れる」：この曲目一覧の名前と日付で楽屋の本番を作る
  await page.click('#slNew');
  await page.fill('#slTitle', '春の演奏会'); await page.press('#slTitle', 'Tab');
  await page.fill('#slDate', '2027-04-29'); await page.press('#slDate', 'Tab');
  await page.locator('#slCf select').selectOption('+');
  const r = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); const c = o.concerts.find(c => c.title === '春の演奏会'); return { c: c && c.date, link: __app.S.setlists[0].concert === (c && c.id) }; });
  expect(r).toEqual({ c: '2027-04-29', link: true });
  await noErrors(errors);
});

test('部員用の端末：楽屋への反映はしない（「楽屋とつなぐ」は出ない）。PDFは見られる', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page, { org: { name: 'テスト高校', type: 'koko', role: 'member', member: { tools: ['gakufu', 'gassou'] } }, members: [], concerts: [] });
  await expect(page.locator('.gky-gate')).toHaveCount(0);
  await addFiles(page, 's2', ['ふるさと_Tp1.pdf']);
  await page.locator('#songList .spine', { hasText: 'ふるさと' }).click();
  await expect(page.locator('#pdfSec .pdf')).toHaveCount(1);
  await page.click('[data-tab="io"]');
  await expect(page.locator('#btnSync')).toBeHidden();
  await expect(page.locator('#syncBar')).toBeEmpty();
  expect(await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); return o.songs ? o.songs.length : 0; })).toBe(0);
  await noErrors(errors);
});
