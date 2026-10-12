// バミリの基本の動き（楽屋シリーズに入れたところ）
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

// はじめての使い方の案内は出さないで開く
const quiet = page => page.addInitScript(() => { try { if (!localStorage.getItem('bamiri.guided')) localStorage.setItem('bamiri.guided', '1'); } catch (e) {} });

test('はじめては吹奏楽のプリセット。配置はこの端末に保存され、開き直しても残る', async ({ page }) => {
  await quiet(page);
  const errors = await openApp(page);
  const n = await page.evaluate(() => __app.doc.items.length);
  expect(n).toBeGreaterThan(20);
  await page.fill('#title', 'テストの演奏会');
  await page.locator('#title').blur();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('bamiri.current')).title)).toBe('テストの演奏会');
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('#title')).toHaveValue('テストの演奏会');
  expect(await page.evaluate(() => __app.doc.items.length)).toBe(n);
  await noErrors(errors);
});

test('前のバミリで保存した配置（bamiri.current・bamiri.saves）をそのまま開ける', async ({ page }) => {
  await quiet(page);
  await page.addInitScript(() => {
    if (localStorage.getItem('bamiri.current')) return;
    const items = [{ id: 'a1', t: 'player', x: 700, y: 500, w: 46, h: 46, r: 0, sec: 'ww', label: 'Fl', name: '山田' }];
    localStorage.setItem('bamiri.current', JSON.stringify({ title: '前の配置', W: 1400, D: 900, items }));
    localStorage.setItem('bamiri.saves', JSON.stringify([{ id: 's1', name: '保存した配置', t: 1, data: { title: '保存した配置', W: 1200, D: 800, items: [] }, bg: null }]));
  });
  const errors = await openApp(page);
  await expect(page.locator('#title')).toHaveValue('前の配置');
  const it = await page.evaluate(() => __app.doc.items[0]);
  expect(it.name).toBe('山田');
  expect(it.layer).toBeTruthy();   // レイヤーのない古い形も読める
  await page.click('[data-tab="save"]');
  await expect(page.locator('#pane-save')).toContainText('保存した配置');
  await noErrors(errors);
});

test('Googleのログインはなく、外へ記録を送らない', async ({ page }) => {
  await quiet(page);
  const outside = [];
  page.on('request', r => { const u = new URL(r.url()); if (!/^(127\.0\.0\.1|fonts\.(googleapis|gstatic)\.com)$/.test(u.hostname) && u.protocol !== 'data:' && u.protocol !== 'blob:') outside.push(r.url()); });
  const errors = await openApp(page);
  await page.waitForTimeout(500);
  expect(outside).toEqual([]);
  expect(await page.locator('#gate, #acct').count()).toBe(0);
  const html = await page.content();
  for (const bad of ['accounts.google.com', 'script.google.com', 'privacy.html']) expect(html, bad).not.toContain(bad);
  await noErrors(errors);
});

test('楽屋への戻り道と、このツールについて（更新内容）', async ({ page }) => {
  await quiet(page);
  const errors = await openApp(page);
  await expect(page.locator('#homeLink')).toHaveAttribute('href', '../gakuya/');
  await expect(page.locator('#homeLink')).toHaveAttribute('target', 'gky-gakuya');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await page.click('#brand');
  const sh = page.locator('.gky-sheet');
  await expect(sh).toContainText('バミリについて');
  await expect(sh).toContainText('v2');
  await expect(sh).toContainText('ログイン');
  await noErrors(errors);
});

test('奏者名の候補に、楽屋の部員（演奏する人だけ）が出る', async ({ page }) => {
  await quiet(page);
  await page.addInitScript(() => localStorage.setItem('gakuya.org', JSON.stringify({ app: 'gakuya', org: { name: 'テスト中学校 吹奏楽部', type: 'chu' }, members: [
    { id: 'm1', name: '山田 花子', part: 'Fl', grade: '中2', status: 'active' },
    { id: 'm2', name: '佐藤 一郎', part: 'Tp', grade: '中3', status: 'gone' },
  ] })));
  const errors = await openApp(page);
  const opts = await page.$$eval('#gkyNames option', os => os.map(o => o.value));
  expect(opts).toEqual(['山田 花子']);
  // 奏者を選ぶと、奏者名の欄が候補を使う
  await page.evaluate(() => { const p = __app.doc.items.find(i => i.t === 'player'); __app.select(p.id); });
  await page.click('[data-tab="sel"]');
  await expect(page.locator('#fName')).toHaveAttribute('list', 'gkyNames');
  await page.fill('#fName', '山田 花子');
  await expect.poll(() => page.evaluate(() => __app.doc.items.some(i => i.name === '山田 花子'))).toBe(true);
  await noErrors(errors);
});
