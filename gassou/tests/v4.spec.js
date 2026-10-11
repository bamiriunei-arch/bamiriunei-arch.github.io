// 合奏ノート v4：録音をこの端末に入れる・テンポマップの録音・その日の出欠・ノートの提出と受け取り・コメントを配る（リンク・zip）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 無音の WAV（1ch・8000Hz） */
const wav = sec => { const n = Math.round(8000 * sec), b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; };
const ready = page => page.waitForFunction(() => window.__app && window.__app.ready);
/* 例でない合奏ノート（1つ）を入れて開き直す */
async function seedNote(page, note = {}, extra = {}) {
  await page.evaluate(({ note, extra }) => {
    const n = Object.assign({ id: 'n1', title: '10/9 合奏', date: '2026-10-09', memo: '', file: null, bars: { marks: [], start: 1 }, comments: [] }, note);
    localStorage.setItem('gassou.v1', JSON.stringify({ v: 1, current: n.id, order: [n.id], notes: { [n.id]: n } }));
    Object.entries(extra).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, { note, extra });
  await page.reload(); await ready(page);
}
/* ファイル置き場に録音を入れる（テンポマップで録った形など） */
const putAudio = (page, sec, meta) => page.evaluate(async ({ b64, meta }) => (await GKY.media.put(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'audio/wav' }), meta)).id, { b64: wav(sec).toString('base64'), meta });
/* テンポマップ：8小節・4/4・♩=120（1小節2秒）の曲 */
const TM = { v: 1, current: 'm1', order: ['m1'], maps: { m1: { id: 'm1', title: '星条旗よ永遠なれ', start: 1, sections: [{ id: 'sA', name: 'A', bars: 8, meter: '4/4', unit: '4', bpm: 120, bpmEnd: null, extra: 0, rep: 1 }], plans: [{ id: 'p1', name: 'カットなし', cut: [] }], plan: 'p1' } } };

test('開いた録音はこの端末に入り、開き直すと選ばなくても開く。「入っている録音」から選べる', async ({ page }) => {
  const errors = await openApp(page);
  await seedNote(page);
  await page.click('[data-tab="rec"]');
  const fc = page.waitForEvent('filechooser');
  await page.click('#pickFile');
  await (await fc).setFiles({ name: '合奏1009.wav', mimeType: 'audio/wav', buffer: wav(3) });
  await expect(page.locator('#gkyToast')).toContainText('この端末に入れたので、次からは選ばなくても開きます');
  const f = await page.evaluate(() => __app.N().file);
  expect([f.name, f.media.length > 0]).toEqual(['合奏1009.wav', true]);
  expect(await page.evaluate(id => GKY.media.meta(id).then(m => [m.cat, m.from, m.note]), f.media)).toEqual(['audio', 'gassou', 'n1']);
  // 開き直す
  await page.reload(); await ready(page);
  await page.waitForFunction(() => __app.buf && Math.abs(__app.buf.duration - 3) < 0.1);
  // 2つめの合奏で「入っている録音」から選ぶ
  await page.evaluate(() => { const S = __app.S; S.notes.n2 = Object.assign({}, S.notes.n1, { id: 'n2', title: '別の合奏', file: null }); S.order.push('n2'); __app.renderAll(); });
  await page.selectOption('#nSel', 'n2');
  await page.click('[data-tab="rec"]');
  await page.click('#pickStore');
  const sh = page.locator('.gky-sheet', { hasText: '入っている録音' });
  await expect(sh.locator('[data-mid]')).toHaveCount(1);
  await sh.locator('[data-mid]').click();
  await page.waitForFunction(() => __app.N().id === 'n2' && __app.N().file && __app.N().file.media && __app.buf);
  await noErrors(errors);
});

test('テンポマップの録音（クリックつき）を「合奏ノートで開く」と、新しい合奏ができて小節の目印が自動でつく。速さ 50% も', async ({ page }) => {
  const errors = await openApp(page);
  await seedNote(page, {}, { 'tempomap.v1': TM });
  const id = await putAudio(page, 20, { cat: 'audio', name: '星条旗_2026-10-09_1600.wav', from: 'tempomap', map: 'm1', mapTitle: '星条旗よ永遠なれ', plan: 'p1', dur: 20, trim: { a: 1.2, b: 18 }, click: { from: 3, plan: 'p1', speed: 100, at: 1.5 }, at: new Date('2026-10-09T16:00:00').getTime() });
  await page.evaluate(id => { location.hash = '#media=' + id; }, id);
  await expect(page.locator('#gkyToast')).toContainText('テンポマップから6小節の目印をつけました');
  const n = await page.evaluate(() => __app.N());
  expect([n.title, n.date, n.file.media === n.file.media && !!n.file.media]).toEqual(['星条旗よ永遠なれ（10/9の録音）', '2026-10-09', true]);
  expect(n.bars.start).toBe(3);                          // 3小節目から鳴らした
  expect(n.bars.marks).toEqual([1.5, 3.5, 5.5, 7.5, 9.5, 11.5]);
  expect(await page.evaluate(() => [__app.barAt(__app.N(), 4), __app.S.order.length])).toEqual([4, 2]);
  // もう一度開くと、同じ合奏を開く（作らない）
  await page.evaluate(id => { location.hash = '#media=' + id; }, id);
  await expect(page.locator('#gkyToast')).toContainText('を開きました');
  expect(await page.evaluate(() => __app.S.order.length)).toBe(2);
  // 速さ 50% で鳴らした録音は、1小節4秒
  const id2 = await putAudio(page, 40, { cat: 'audio', name: 'slow.wav', from: 'tempomap', map: 'm1', plan: 'p1', dur: 40, click: { from: 1, plan: 'p1', speed: 50, at: 0.5 } });
  await page.evaluate(id => { location.hash = '#media=' + id; }, id2);
  await page.waitForFunction(() => __app.N().bars.marks.length === 8);
  expect(await page.evaluate(() => __app.N().bars.marks.slice(0, 3))).toEqual([0.5, 4.5, 8.5]);
  await noErrors(errors);
});

test('クリックなしのテンポマップの録音は、「テンポマップからつける」に曲・カット案・演奏の始まりを入れておく', async ({ page }) => {
  const errors = await openApp(page);
  await seedNote(page, {}, { 'tempomap.v1': TM });
  const id = await putAudio(page, 20, { cat: 'audio', name: 'take2.wav', from: 'tempomap', map: 'm1', mapTitle: '星条旗よ永遠なれ', plan: 'p1', dur: 20, trim: { a: 0.8, b: 18 }, click: null });
  await page.evaluate(id => { location.hash = '#media=' + id; }, id);
  await expect(page.locator('[data-panel="bars"]')).toBeVisible();
  await expect(page.locator('#tmPick')).toHaveValue('m1');
  await expect(page.locator('#tmPlan')).toHaveValue('p1');
  await expect(page.locator('#tmAt')).toHaveValue('0.80');
  await page.click('#tmGo');
  expect(await page.evaluate(() => __app.N().bars.marks.slice(0, 2))).toEqual([0.8, 2.8]);
  await noErrors(errors);
});

test('ノートに、その日の出欠（欠席・遅刻）を出し、ノートに書き込める', async ({ page }) => {
  const errors = await openApp(page);
  await seedNote(page, { date: '2026-10-09' }, {
    'gakuya.org': { org: { name: 'テスト中学', type: 'chu' }, members: [{ id: 'a', name: '赤井 一郎', part: 'Tp', status: 'active' }, { id: 'b', name: '石田 花', part: 'Fl', status: 'active' }, { id: 'c', name: '上野 空', part: 'Hn', status: 'active' }] },
    'shukketsu.v1': { v: 1, events: [{ id: 'e1', date: '2026-10-09', title: '合奏', kind: 'practice' }, { id: 'e2', date: '2026-10-10', title: '練習', kind: 'practice' }], att: { e1: { '赤井一郎': { s: 'a', r: '塾' }, '石田花': { s: 'l', r: '委員会' }, '上野空': { s: 'p', r: '' } }, e2: { '上野空': { s: 'a', r: '' } } }, extra: [], settings: {} },
  });
  const line = page.locator('#attLine');
  await expect(line).toContainText('この日の出欠（合奏）');
  await expect(line).toContainText('欠席 1人：赤井 一郎（Tp）');
  await expect(line).toContainText('遅刻 1人：石田 花（Fl）');
  await expect(line).not.toContainText('上野');
  await line.locator('#attIns').click();
  await expect(page.locator('#memo')).toHaveValue('【欠席・遅刻・早退】\n欠席：赤井 一郎（Tp）\n遅刻：石田 花（Fl）\n');
  // 出欠のない日は出さない
  await page.fill('#pDate', '2026-10-11'); await page.press('#pDate', 'Tab');
  await expect(line).toBeHidden();
  await noErrors(errors);
});

test('部員用の端末でノートを提出 → 顧問の端末でリンクを開くと「提出」に入る。まとめて貼る・読んだ・消す', async ({ page }) => {
  const errors = await openApp(page);
  const member = { org: { name: 'テスト中学', type: 'chu', role: 'member', member: { tools: ['gassou'], notes: true } }, members: [{ id: 'a', name: '赤井 一郎', part: 'Tp', status: 'active' }] };
  await seedNote(page, { memo: '【直すこと】\n頭の音をそろえる', comments: [{ id: 'c1', t: 4.5, text: '入りが早い', parts: ['Tp'], kind: 'fix' }] }, { 'gakuya.org': member, 'gakuya.ui': { myName: '赤井 一郎' } });
  await expect(page.locator('[data-tab="inbox"]')).toBeHidden();
  await expect(page.locator('#subBar')).toBeVisible();
  await page.click('#subGo');
  const sh = page.locator('.gky-sheet', { hasText: 'ノートを提出' });
  await expect(sh.locator('#sbName')).toHaveValue('赤井 一郎');
  await expect(sh.locator('#sbPart')).toHaveValue('Tp');
  await sh.getByRole('button', { name: 'リンクを作る' }).click();
  const url = await page.locator('.gky-sheet', { hasText: 'ノートを提出するリンク' }).locator('textarea').inputValue();
  expect(url).toMatch(/#n=[A-Za-z0-9_-]+$/);
  const code = url.split('#n=')[1];
  // 部員用の端末で開いても、入れない（見せるだけ）
  await page.goto('about:blank'); await page.goto('/index.html?test#n=' + code); await ready(page);
  await expect(page.locator('.gky-sheet', { hasText: '赤井 一郎さんのノート' })).toContainText('頭の音をそろえる');
  expect(await page.evaluate(() => __app.S.inbox.length)).toBe(0);
  // 顧問の端末にする
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); o.org.role = 'staff'; localStorage.setItem('gakuya.org', JSON.stringify(o)); });
  await page.goto('about:blank'); await page.goto('/index.html?test#n=' + code); await ready(page);
  await expect(page.locator('#gkyToast')).toContainText('赤井 一郎さんのノート（10/9 合奏）を受け取りました');
  await expect(page.locator('[data-panel="inbox"]')).toBeVisible();
  await expect(page.locator('#cntIn')).toHaveText('1');
  const card = page.locator('#inList .sub').first();
  await expect(card).toContainText('赤井 一郎');
  await expect(card.locator('.tape')).toHaveText('Tp');
  await expect(card).toContainText('頭の音をそろえる');
  await expect(card.locator('.scm')).toContainText('入りが早い');
  // 同じリンクをまとめて貼る（同じものは入れない）＋ 読めないもの
  await page.fill('#inPaste', `赤井です\n${url}\nこれも → https://example.com/gassou/#n=ZZZ`);
  await page.click('#inAdd');
  await expect(page.locator('#gkyToast')).toContainText('0件入れました・もう入っていたもの 1件・読めなかったもの 1件');
  // 読んだにする → 数が消える。消す → 元に戻す
  await card.locator('[data-sread]').click();
  await expect(page.locator('#cntIn')).toHaveText('');
  await page.locator('#inList .sub').first().locator('[data-sdel]').click(); await page.locator('#inList .sub').first().locator('[data-sdel]').click();
  await expect(page.locator('#inList .sub')).toHaveCount(0);
  await page.locator('#gkyToast button', { hasText: '元に戻す' }).click();
  await expect(page.locator('#inList .sub')).toHaveCount(1);
  // 楽屋の設定で提出を使わないときは、部員用の端末に出ない
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); o.org.role = 'member'; o.org.member.notes = false; localStorage.setItem('gakuya.org', JSON.stringify(o)); });
  await page.goto('about:blank'); await page.goto('/index.html?test'); await ready(page);
  await expect(page.locator('#subBar')).toBeHidden();
  await page.click('[data-tab="out"]');
  await expect(page.locator('#subSec')).toBeHidden();
  await noErrors(errors);
});

test('コメントを見るだけのリンク：自分のパートだけにでき、録音を選ぶとコメントの所から聞ける', async ({ page }) => {
  const errors = await openApp(page);
  await seedNote(page, { file: { name: '合奏.wav', size: 0, dur: 10 }, bars: { marks: [0, 2, 4, 6, 8], start: 1 }, comments: [{ id: 'c1', t: 4.5, text: '全体：入りをそろえる', parts: ['全体'], kind: 'fix' }, { id: 'c2', t: 6.2, text: 'トランペットの音程', parts: ['Tp'], kind: 'check' }, { id: 'c3', t: 8.1, text: 'フルートよかった', parts: ['Fl'], kind: 'good' }] });
  await page.click('[data-tab="out"]');
  await page.click('#shView');
  const url = await page.locator('.gky-sheet', { hasText: 'コメントを見るだけのリンク' }).locator('textarea').inputValue();
  await page.goto('about:blank'); await page.goto('/index.html?test#v=' + url.split('#v=')[1]); await ready(page);
  await expect(page.locator('#gkyView')).toContainText('10/9 合奏');
  await expect(page.locator('#vwList .cm')).toHaveCount(3);
  await expect(page.locator('#vwList .cm').first().locator('.at b')).toHaveText('3');   // 4.5秒は3小節目
  await page.click('[data-vp="Tp"]');
  await expect(page.locator('#vwList .cm')).toHaveCount(2);                                  // 全体＋Tp
  await expect(page.locator('#vwList')).not.toContainText('フルート');
  // 録音を選んでから、コメントを押すと、その2秒前から
  const fc = page.waitForEvent('filechooser');
  await page.click('#vwPick');
  await (await fc).setFiles({ name: '合奏.wav', mimeType: 'audio/wav', buffer: wav(10) });
  await expect(page.locator('#vwBox audio')).toHaveCount(1);
  await page.locator('#vwList .cm', { hasText: 'トランペット' }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector('#vwBox audio').currentTime)).toBeGreaterThan(4.1);
  await noErrors(errors);
});

test('録音とコメントをまとめた zip を作り、ほかの端末で読み込むと、録音・コメント・小節の目印が入る（ノートは入れない）', async ({ page }) => {
  const errors = await openApp(page);
  await seedNote(page, { memo: '顧問だけのメモ', bars: { marks: [0, 2, 4], start: 5 }, comments: [{ id: 'c1', t: 2.5, text: '入りが早い', parts: ['Tp'], kind: 'fix' }] });
  await page.click('[data-tab="rec"]');
  const fc = page.waitForEvent('filechooser');
  await page.click('#pickFile');
  await (await fc).setFiles({ name: '1009.wav', mimeType: 'audio/wav', buffer: wav(6) });
  await page.waitForFunction(() => __app.N().file && __app.N().file.media);
  await page.click('[data-tab="out"]');
  await page.click('#shZip');
  const sh = page.locator('.gky-sheet', { hasText: '録音とコメントをまとめて送る' });
  await expect(sh.locator('#zA')).toBeChecked();
  await expect(sh.locator('#zM')).not.toBeChecked();
  const dl = page.waitForEvent('download');
  await sh.getByRole('button', { name: 'まとめる' }).click();
  const d = await dl;
  const b64 = require('fs').readFileSync(await d.path()).toString('base64');
  // ほかの端末：何も入っていない合奏ノートとファイル置き場
  await page.evaluate(async () => { localStorage.removeItem('gassou.v1'); for (const m of await GKY.media.list()) await GKY.media.del(m.id); });
  await page.reload(); await ready(page);
  await page.evaluate(b64 => __app.importZip(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'application/zip' })), b64);
  await expect(page.locator('#gkyToast')).toContainText('を読み込みました（録音も入りました）');
  const n = await page.evaluate(() => { const n = __app.N(); return { t: n.title, memo: n.memo, c: n.comments.map(c => c.text), b: n.bars, f: n.file.name, ord: __app.S.order.length }; });
  expect(n).toEqual({ t: '10/9 合奏', memo: '', c: ['入りが早い'], b: { marks: [0, 2, 4], start: 5, nums: null }, f: '1009.wav', ord: 1 });
  await page.waitForFunction(() => __app.buf && Math.abs(__app.buf.duration - 6) < 0.1);
  await expect(page.locator('[data-panel="rec"]')).toBeVisible();
  await noErrors(errors);
});
