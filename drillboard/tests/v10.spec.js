// v10 で増えた機能：ベルフロント・セットを選べるメモ・位置をずらす案・歩幅のばらつき・パートまとめ・リンク一覧・コンテのQR・大会ルール・サイトに置いたショー
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');

test('ベルフロント：選んだ人を客席向きにして、ドットシートに出る', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db, S = D.S; D.setMode('edit'); D.goSet(2); const id = S.performers[0].id;
    D.ui.sel = new Set([id, S.performers[1].id]); D.ui.dirRange = 'set'; D.bellFront(true); const s = S.sets[2];
    return { mv:s.mv && s.mv[id], face:s.face && s.face[id], bf:D.isBellFront(2, id), row:D.dotRows(id)[2].move }; });
  expect(r.mv).toBe('a'); expect(r.face).toBe(270); expect(r.bf).toBe(true);
  expect(r.row).toContain('ベルフロント');
  await expect(page.locator('#bBell')).toBeVisible();
  await noErrors(errors);
});

test('セットのメモ：別のセットを選んで書ける', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => { __db.setMode('edit'); __db.goSet(1); __db.openTab('sets'); });
  await page.selectOption('#noteSetSel', '3');
  await page.fill('#setNote', 'セット4のメモ');
  await page.locator('#setNote').blur();
  const r = await page.evaluate(() => [__db.S.sets[3].note, __db.S.sets[1].note, __db.ui.cur]);
  expect(r).toEqual(['セット4のメモ', 'ここで楽器を構える', 1]);
});

test('着いた位置が近すぎる：半歩ずらす案が出て、直すと離れる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db, S = D.S, i = 3, P = S.sets[i].pos, a = S.performers[2].id, b = S.performers[3].id;
    D.goSet(i); D.pushHist(); P[a] = [...P[b]]; P[a][0] += 0.1; D.changed(true);
    const before = D.arrivalClose(i, a, b), opts = D.pairOptions(i, a, b), pos = opts.find(o => o.kind === 'pos');
    return { before, kinds:opts.map(o => o.kind), step:pos && Math.hypot(pos.dx, pos.dy) }; });
  expect(r.before).toBe(true);
  expect(r.kinds).toContain('pos');
  expect(r.step).toBeGreaterThan(0);
  await page.evaluate(() => { __db.setMode('edit'); __db.openTab('sets'); });
  await page.click('[data-act="collFind"]');
  await expect(page.locator('[data-act="posApply"]').first()).toBeVisible();
  await page.locator('[data-act="posApply"]').first().click();
  expect(await page.evaluate(() => __db.arrivalClose(3, __db.S.performers[2].id, __db.S.performers[3].id))).toBe(false);
});

test('歩幅のばらつき：同じセットで大股と小股が混ざると知らせる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db, S = D.S, i = 2, prev = S.sets[i - 1].pos, P = S.sets[i].pos; D.pushHist();
    S.performers.forEach((p, k) => { const q = prev[p.id]; P[p.id] = [q[0] + (k < S.performers.length / 2 ? 8 : 1.6), q[1]]; });
    S.sets[i].counts = 16; D.changed(true); const a = D.strideSpread(i); return { mixed:a && a.mixed, big:a && a.nBig, small:a && a.nSmall }; });
  expect(r.mixed).toBe(true);
  expect(r.big).toBeGreaterThanOrEqual(3);
  expect(r.small).toBeGreaterThanOrEqual(3);
});

test('パートまとめのドットシートと、コンテのQR', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(async () => { const D = __db; D.ui.focus = D.S.performers[0].id;
    const a = await D.doPrint('part', { who:'sec', fmt:'ctr', noPrint:true }); const cols = document.querySelectorAll('#printArea .pt-tbl thead th').length;
    const b = await D.doPrint('conte', { range:'cur', qr:true, noPrint:true }); const qr = document.querySelectorAll('#printArea .cp-qr svg').length;
    return { n:a.n, cols, qr }; });
  expect(r.n).toBeGreaterThan(0);
  expect(r.cols).toBeGreaterThan(2);
  expect(r.qr).toBeGreaterThan(0);
});

test('全員の自分用リンクを名前付きで一覧にする', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => { __db.linkList(); });
  await expect(page.locator('#askModal')).toBeVisible();
  const text = await page.locator('#askBody').innerText();
  const labels = await page.evaluate(() => __db.S.performers.slice(0, 3).map(p => p.label));
  for (const l of labels) expect(text).toContain(l);
  expect(text).toContain('me=');
});

test('リンク一覧の配り方：①ショーのリンクを開いたあと、②名前のリンク（?me=）だけで自分のドットシートが開く', async ({ page, browser }) => {
  await openApp(page);
  await loadFixture(page);
  const code = await page.evaluate(() => __db.makeCode(__db.S));
  const ctx = await browser.newContext(), p2 = await ctx.newPage();
  const errors = await openApp(p2, '?test#d=' + code);
  if (await p2.locator('#askModal').isVisible()) await p2.click('[data-askv="open"]');
  await p2.waitForTimeout(600);
  await p2.goto('/index.html?test&me=Tp1');
  await p2.waitForFunction(() => window.__db && window.__db.S);
  await expect.poll(() => p2.evaluate(() => [__db.S.title, __db.ui.me, __db.ui.tab])).toEqual(['テスト用ショー', 'Tp1', 'dot']);
  await noErrors(errors);
  await ctx.close();
});

test('大会ルール：全日本マーチングコンテストとJMBAの項目を選んで使える', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db; D.applyPreset('ajba'); const a = { limit:D.S.rules.limit, pit:D.S.rules.on.pit, edge:D.floorState([16, 0]), out:D.floorState([21, 0]) };
    D.applyPreset('jmba_hs'); const b = { limit:D.S.rules.limit, grp:D.S.rules.grp.length, people:D.peopleCount() };
    D.S.rules.on.time = false; D.changed(true); const c = D.ruleCheck(); return { a, b, keys:Object.keys(D.RULE_PRESETS), c:!!c }; });
  expect(r.a.limit).toBe(360);
  expect(r.a.edge).toBe(1);
  expect(r.a.out).toBe(2);
  expect(r.b.limit).toBe(570);
  expect(r.keys).toEqual(expect.arrayContaining(['ajba', 'jmba_es', 'jmba_jh', 'jmba_hs', 'jmba_gen', 'stage']));
  await page.evaluate(() => __db.openTab('conf'));
  await expect(page.locator('[data-ron="time"]')).toBeVisible();
});

test('サイトに置いたショーを ?show= で開く（&me= でその人）', async ({ page, browser }) => {
  await openApp(page);
  await loadFixture(page);
  const code = await page.evaluate(async () => { __db.S.src = 'tests/fixtures/show-tmp.txt'; return __db.makeCode(__db.S); });
  fs.writeFileSync(path.join(__dirname, 'fixtures', 'show-tmp.txt'), code);
  const ctx = await browser.newContext(), p2 = await ctx.newPage();
  const errors = await openApp(p2, '?test&show=tests/fixtures/show-tmp.txt&me=Tp1');
  await expect.poll(() => p2.evaluate(() => __db.S.title)).toBe('テスト用ショー');
  const r = await p2.evaluate(() => ({ me:__db.ui.me, tab:__db.ui.tab, src:__db.S.src }));
  expect(r).toEqual({ me:'Tp1', tab:'dot', src:'tests/fixtures/show-tmp.txt' });
  await noErrors(errors);
  await ctx.close();
});
