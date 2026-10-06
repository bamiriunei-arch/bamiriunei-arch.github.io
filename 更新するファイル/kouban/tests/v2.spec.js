// コウバン v2：報告の不具合が出ないこと・新しくした所
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 70人・16曲の演奏会（楽屋の団体の名前は空） */
async function bigProject(page) {
  await page.evaluate(() => {
    const fams = ['Fl', 'Ob', 'Cl', 'Cl', 'Cl', 'A.Sax', 'T.Sax', 'B.Sax', 'Tp', 'Tp', 'Hn', 'Tb', 'Euph', 'Tuba', 'Perc', 'Perc'];
    const members = []; for (let i = 0; i < 70; i++) members.push({ id: 'm' + i, name: '奏者' + String(i + 1).padStart(2, '0'), grade: '高' + (1 + i % 3), part: fams[i % fams.length], status: 'active', active: true });
    const pieces = [], assign = {};
    for (let k = 0; k < 16; k++) { const slots = members.map((m, i) => ({ id: 's' + k + '_' + i, label: m.part + (1 + i % 3), role: '' })); pieces.push({ id: 'p' + k, title: '曲' + (k + 1), composer: '', slots }); assign['p' + k] = {}; slots.forEach((s, i) => assign['p' + k][s.id] = 'm' + i); }
    const p = { id: 'big', title: '定期演奏会', date: '2026-12-20', kind: 'concert', members, absent: [], pieces, assign };
    localStorage.setItem('kouban.v1', JSON.stringify({ v: 1, current: 'big', order: ['big'], projects: { big: p } }));
    localStorage.removeItem('gakuya.org');
  });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
}
/* 印刷のどのページも、最後の行の下の端が本文の下の端をこえていない */
async function noCutRows(page) {
  const r = await page.locator('.gky-pv .gky-page').evaluateAll(ps => ps.map(p => { const b = p.querySelector('.pg-body').getBoundingClientRect(); const rows = p.querySelectorAll('tbody tr'); const last = rows[rows.length - 1]; return last ? Math.round((last.getBoundingClientRect().bottom - b.bottom) * 10) / 10 : -1; }));
  r.forEach((x, i) => expect(x, `${i + 1}ページ目の最後の行が切れています（${x}px はみ出し）`).toBeLessThanOrEqual(0));
  return r.length;
}

test('印刷：70人・16曲の香盤表で、どのページも最後の行が切れない（団体の名前が空でも）。A3では少ないページになる', async ({ page }) => {
  const errors = await openApp(page);
  await bigProject(page);
  await page.click('[data-tab="out"]');
  await page.click('#prMatrix');
  await expect(page.locator('.gky-pv .gky-page').first()).toBeVisible();
  const a4 = await noCutRows(page);
  expect(a4).toBeGreaterThan(2);
  await page.locator('.gky-pv [data-act="size"]').selectOption('A3');
  const a3 = await noCutRows(page);
  expect(a3).toBeLessThan(a4);
  await page.click('.gky-pv [data-act="close"]');
  await page.click('#prPieces');
  await noCutRows(page);
  await noErrors(errors);
});

test('2つのタブ：ほかのタブで保存されたら新しい内容になり、黙って上書きしない', async ({ page, context }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { const s = { v: 1, current: 'x', order: ['x'], projects: { x: { id: 'x', title: '演奏会X', members: [], pieces: [], assign: {} } } }; localStorage.setItem('kouban.v1', JSON.stringify(s)); });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  const b = await context.newPage();
  await b.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await b.goto('/index.html?test'); await b.waitForFunction(() => window.__app && window.__app.ready);
  // A で曲を足す → B は読み直す
  await page.click('[data-tab="pieces"]'); await page.click('#btnAddPiece');
  await page.waitForTimeout(500);
  await expect.poll(() => b.evaluate(() => __app.P().pieces.length)).toBe(1);
  // B で曲を足す → A に出る（A の曲は消えない）
  await b.click('[data-tab="pieces"]'); await b.click('#btnAddPiece');
  await b.waitForTimeout(500);
  await expect.poll(() => page.evaluate(() => __app.P().pieces.length)).toBe(2);
  // 同時に直したとき：A が直している途中に B が先に保存したら、A は黙って上書きせず、どちらを残すか聞く
  await b.evaluate(() => { document.querySelector('#btnAddPiece').click(); });          // B：先に保存される
  await page.evaluate(() => { document.querySelector('#btnAddPiece').click(); });       // A：あとから保存しようとする
  await expect(page.locator('.gky-sheet', { hasText: 'ほかのタブで先に保存されました' })).toBeVisible();
  await page.click('.gky-sheet footer .btn.primary');   // A の内容で上書き
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kouban.v1')).projects.x.pieces.length)).toBe(3);
  await noErrors(errors);
});

test('なくても可のパート・指揮者・部・出場人数の上限・同じ日のほかの演奏会', async ({ page }) => {
  const errors = await openApp(page);
  // 例の演奏会：2曲目のチャイム（空き）を「なくても可」にすると、直すところが減る
  const bad0 = await page.evaluate(() => __app.analyze(__app.P()).issues.filter(x => x.lv === 'bad').length);
  await page.evaluate(() => { const p = __app.P(); p.pieces[1].slots.find(s => s.label === 'Chime').opt = true; __app.renderAll(); });
  expect(await page.evaluate(() => __app.analyze(__app.P()).issues.filter(x => x.lv === 'bad').length)).toBe(bad0 - 1);
  // 指揮者と部
  await page.click('[data-tab="pieces"]');
  await page.locator('#pcCond').fill('学生指揮 山田'); await page.locator('#pcCond').dispatchEvent('change');
  await page.locator('#pcPart').fill('第1部'); await page.locator('#pcPart').dispatchEvent('change');
  await page.click('[data-tab="assign"]');
  await expect(page.locator('.pcard').first()).toContainText('指揮 学生指揮 山田');
  // 上限：30人にすると、32人が出ているので知らせる
  await page.evaluate(() => { const p = __app.P(); p.limit = 30; __app.renderAll(); });
  await page.click('[data-tab="check"]');
  await expect(page.locator('#issueList')).toContainText('上限の30人を');
  await expect(page.locator('#checkSums')).toContainText('/ 30');
  // 同じ日のほかの演奏会（B編成）に同じ人がいる
  await page.evaluate(() => { const S = __app.S, p = __app.P(); const q = JSON.parse(JSON.stringify(p)); q.id = 'b'; q.title = 'B編成'; q.limit = null; S.projects.b = q; S.order.push('b'); __app.renderAll(); });
  await expect(page.locator('#issueList')).toContainText('同じ日の「B編成」にも出る人が');
  await noErrors(errors);
});

test('バミリの「保存した配置」が40件のときは、消える配置を知らせてから足す', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => {
    const saves = []; for (let i = 0; i < 40; i++) saves.push({ id: 'i' + i, name: '配置' + (i + 1), t: Date.now() - i * 1000, data: { items: [] } });
    localStorage.setItem('bamiri.saves', JSON.stringify(saves));
    localStorage.setItem('bamiri.current', JSON.stringify({ title: '舞台', W: 1400, D: 900, items: [{ t: 'chair', label: 'Fl1', x: 100, y: 100 }] }));
  });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('[data-tab="out"]');
  await page.click('#bmLocal');
  await page.click('#bmPush');
  const sh = page.locator('.gky-sheet', { hasText: 'いっぱいです' });
  await expect(sh).toContainText('配置40');
  await sh.locator('footer .btn.primary').click();
  const names = await page.evaluate(() => JSON.parse(localStorage.getItem('bamiri.saves')).map(x => x.name));
  expect(names.length).toBe(40);
  expect(names).not.toContain('配置40');
  expect(names[0]).toContain('星条旗');
  await noErrors(errors);
});

test('見るだけのリンク：名前を選ぶと自分の出番が出る。開いた端末には保存しない', async ({ page }) => {
  const errors = await openApp(page);
  const url = await page.evaluate(async () => GKY.shareUrl('kouban', __app.sharePayload(__app.P())));
  expect(url).toContain('#v=');
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto('/index.html?test' + url.slice(url.indexOf('#')));
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-viewer')).toContainText('見るだけ');
  await expect(page.locator('.gky-tabs')).toBeHidden();
  await page.locator('#vwWho').selectOption({ label: '青木 美咲（Fl）' });
  await expect(page.locator('#vwMine .r').first()).toContainText('Pic');
  await expect(page.locator('#gkyView table.mx tbody tr')).toHaveCount(32);
  expect(await page.evaluate(() => localStorage.getItem('kouban.v1'))).toBeNull();
  await noErrors(errors);
});

test('部員のCSVは、足す前に確かめる表を出す（読めない楽器は名前にくっつけない）', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="members"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnCsvMember');
  await (await chooser).setFiles({ name: 'm.csv', mimeType: 'text/csv', buffer: Buffer.from('名前,学年,パート\n新人 一郎,中1,パーカス\n新人 二郎,中1,カホン\n', 'utf8') });
  const pv = page.locator('.gky-sheet', { hasText: '足す前に確かめる' });
  await expect(pv.locator('.unk')).toContainText('カホン');
  await pv.locator('footer .btn.primary').click();
  const ms = await page.evaluate(() => __app.P().members.filter(m => m.name.startsWith('新人')).map(m => [m.name, m.part]));
  expect(ms).toEqual([['新人 一郎', 'Perc'], ['新人 二郎', '']]);
  await noErrors(errors);
});

test('一般の団体では、画面の「部員」「休部」「顧問」を「団員」「休団」「団長」にそろえる（入力欄の中身はそのまま）', async ({ page }) => {
  await page.addInitScript(() => { if (location.protocol === 'about:') return; localStorage.setItem('gakuya.org', JSON.stringify({ org: { type: 'ippan', name: '〇〇市民吹奏楽団' }, members: [{ name: 'A', part: 'Fl' }] })); });
  const errors = await openApp(page);
  for (const t of await page.locator('#tabs [data-tab]').evaluateAll(xs => xs.map(x => x.dataset.tab))) {
    await page.click(`[data-tab="${t}"]`);
    const txt = await page.evaluate(() => document.body.innerText);
    expect(txt, t).not.toMatch(/部員|休部|退部|顧問/);
  }
  // 更新の記録は書いたときの言葉のまま
  await page.click('#brand');
  await expect(page.locator('.gky-sheet details[data-keep-words]')).toHaveCount(1);
  await noErrors(errors);
});
