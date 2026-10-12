// 起動・はじめての画面・編集の基本
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');

test('はじめて開くと「ようこそ」が出て、白紙から始められる', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/index.html');
  await expect(page.locator('#askTitle')).toHaveText('ドリルボードへようこそ');
  await page.click('[data-askv="blank"]');
  await expect(page.locator('#askModal')).toBeHidden();
  await expect(page.locator('#showTitle')).toHaveValue('新しいショー');
  // 2回目は出ない
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.locator('#askModal')).toBeHidden();
  await noErrors(errors);
});

test('前の版から来た人には「新しくなりました」が出る', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-askv="blank"]');
  await page.waitForTimeout(700);   // 自動保存（少し遅れて保存される）を待つ
  await page.evaluate(() => localStorage.removeItem('drillboard.v1.seen'));
  await page.reload();
  await expect(page.locator('#askTitle')).toHaveText('ドリルボードが新しくなりました');
});

test('起動してサンプルが描ける・エラーが出ない', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => ({ n:__db.S.performers.length, sets:__db.S.sets.length, ver:__db.APP_VERSION }));
  expect(r.n).toBeGreaterThan(5);
  expect(r.sets).toBeGreaterThan(2);
  expect(r.ver).toBeTruthy();
  await expect(page.locator('#hud')).toContainText('Set 1');
  await noErrors(errors);
});

test('隊員を足して形を作り、セットを足して再生できる（元に戻すも）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { const D = __db; D.S = D.normalize(D.emptyShow('square')); D.afterLoad(true); D.setMode('edit'); D.openTab('perf'); });
  await page.selectOption('#addSec', 'Tp');
  await page.fill('#addNum', '6');
  await page.click('[data-act="addPerf"]');
  expect(await page.evaluate(() => __db.S.performers.length)).toBe(6);
  await page.evaluate(() => { __db.ui.sel = new Set(__db.S.performers.map(p => p.id)); __db.renderSide(); });
  await page.click('[data-tool="hline"]');
  const ys = await page.evaluate(() => Object.values(__db.S.sets[0].pos).map(q => q[1]));
  expect(new Set(ys).size).toBe(1);   // 横一列
  await page.evaluate(() => __db.openTab('sets'));
  await page.click('[data-act="addSet"]');
  expect(await page.evaluate(() => __db.S.sets.length)).toBe(2);
  await page.click('[data-tool="arc"]');
  await page.click('#bPlay');
  await page.waitForTimeout(700);
  await page.click('#bPlay');
  expect(await page.evaluate(() => __db.ui.t)).toBeGreaterThan(0);
  await page.evaluate(() => __db.undo());
  await noErrors(errors);
});

test('3分で1セット：ガイドが最後まで進む', async ({ page }) => {
  await page.goto('/index.html');
  await page.click('[data-askv="coach"]');
  await expect(page.locator('#coach h4')).toHaveText('隊員を入れる');
  await page.click('.tabs [data-tab="perf"]');
  await page.selectOption('#addSec', 'Tp'); await page.fill('#addNum', '4'); await page.click('[data-act="addPerf"]');
  await page.keyboard.press('Control+a');
  await expect(page.locator('#coach h4')).toHaveText('形を作る');
  await page.click('[data-tool="hline"]');
  await expect(page.locator('#coach h4')).toHaveText('次のセットを作る');
  await page.click('[data-act="addSet"]');
  await expect(page.locator('#coach h4')).toHaveText('形を変える');
  await page.keyboard.press('Control+a');
  await page.click('[data-tool="arc"]');
  await expect(page.locator('#coach h4')).toHaveText('再生する');
  await page.click('#bPlay');
  await expect(page.locator('#coach h4')).toHaveText('できあがり');
  await page.click('[data-act="coachNext"]');
  await expect(page.locator('#coach')).toBeHidden();
});

test('メモ：セットのメモと隊員ごとのメモを入れられる', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => { __db.setMode('edit'); __db.goSet(2); __db.openTab('sets'); });
  await page.fill('#setNote', 'ベルアップ');
  await page.locator('#setNote').blur();
  expect(await page.evaluate(() => __db.S.sets[2].note)).toBe('ベルアップ');
  await page.evaluate(() => { __db.ui.focus = __db.S.performers[0].id; __db.openTab('dot'); });
  await page.fill('#pnNote', '前の人の後ろを通る');
  await page.locator('#pnNote').blur();
  expect(await page.evaluate(() => __db.S.sets[2].pn[__db.S.performers[0].id])).toBe('前の人の後ろを通る');
  await expect(page.locator('#pane')).toContainText('前の人の後ろを通る');
  await noErrors(errors);
});
