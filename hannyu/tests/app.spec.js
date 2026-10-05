// 搬入出リストの基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('チェック：押すと付いて保存され、段階ごとに数える', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#phases [data-ph="load1"]')).toContainText('12 / 21');
  await page.locator('#ckLeft').check();
  await expect(page.locator('#ckList .crow')).toHaveCount(9);
  await page.locator('#ckList .crow').first().click();
  await expect(page.locator('#ckList .crow')).toHaveCount(8);
  await expect(page.locator('#phases [data-ph="load1"]')).toContainText('13 / 21');
  await page.waitForTimeout(300);
  const n = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hannyu.v1')); const t = s.trips[s.current]; return Object.values(t.checks).filter(c => c.load1).length; });
  expect(n).toBe(13);
  // 帰りの段階では「帰りも」を外したものは出ない
  await page.evaluate(() => { const t = __app.T(); t.items[0].back = false; __app.renderAll(); });
  await page.click('#phases [data-ph="load2"]');
  await expect(page.locator('#phases [data-ph="load2"]')).toContainText('0 / 20');
  await noErrors(errors);
});

test('積む順の決まり：大きいものが先、早く使うものが最後', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const t = __app.T();
    __app.autoOrder(t);
    const v = t.vehicles[1];
    return t.items.filter(i => i.vehicle === v.id).sort((a, b) => a.ord - b.ord).map(i => [i.cat, i.first]);
  });
  expect(r[r.length - 1][1]).toBe(true);
  expect(r[0][0]).toBe('perc');
  const firstIdx = r.findIndex(x => x[1]);
  expect(r.slice(firstIdx).every(x => x[1])).toBe(true);
  await noErrors(errors);
});

test('照合：行きで運んで帰りに積んでいないものが出る', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { const t = __app.T(); t.items.forEach(i => t.checks[i.id] = { load1: true, unload1: true }); t.checks[t.items[0].id].load2 = true; __app.renderAll(); });
  await page.click('[data-tab="out"]');
  await expect(page.locator('#cmp')).toContainText('積み忘れ？');
  await expect(page.locator('#cmp .issue.bad')).toHaveCount(20);
  await noErrors(errors);
});

test('よく運ぶものから足せる・バミリの配置図から足せる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="items"]');
  await page.click('#itPreset');
  await page.locator('.gky-sheet label', { hasText: 'ヴィブラフォン' }).locator('input').check();
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('#itTable')).toContainText('');
  let names = await page.evaluate(() => __app.T().items.map(i => i.name));
  expect(names).toContain('ヴィブラフォン');
  const bm = { title: '配置', W: 1000, D: 600, items: [{ t: 'player', label: 'Fl', x: 1, y: 1 }, { t: 'player', label: 'Cl1', x: 2, y: 1 }, { t: 'mallet', label: 'Xylo', x: 3, y: 1, w: 170, h: 70 }, { t: 'circle', label: 'Timp', x: 4, y: 1 }, { t: 'riser', label: '平台', x: 0, y: 0 }] };
  const chooser = page.waitForEvent('filechooser');
  await page.click('#itBamiri');
  await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bm)) });
  await expect(page.locator('.gky-sheet')).toContainText('シロフォン');
  await expect(page.locator('.gky-sheet')).not.toContainText('譜面台');   // すでにある品物は出さない
  await page.click('.gky-sheet footer .btn.primary');
  names = await page.evaluate(() => __app.T().items.map(i => i.name));
  expect(names).toContain('シロフォン');
  await noErrors(errors);
});

test('積み込み表：車ごとにページが分かれる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="out"]');
  await page.click('#prCars');
  await expect(page.locator('.gky-pv .gky-page')).toHaveCount(3);
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('トラック');
  await noErrors(errors);
});
