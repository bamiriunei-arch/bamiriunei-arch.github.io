// 楽屋シリーズに入れたところ：楽屋へのボタン・ホーム画面のアプリ・外へ送らない
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('楽屋へのボタンがあり、ホーム画面に追加すると楽屋のアプリになる', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#homeLink')).toBeVisible();
  await expect(page.locator('#homeLink')).toHaveAttribute('href', '../gakuya/');
  await expect(page.locator('#homeLink')).toHaveAttribute('target', 'gky-gakuya');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  const mf = await (await page.request.get('/manifest.webmanifest')).json();
  expect([mf.id, mf.scope, mf.name]).toEqual(['/gakuya/', '../', '楽屋']);
  expect(await page.evaluate(() => typeof GKY === 'object' && GKY.VERSION)).toBeTruthy();
  await noErrors(errors);
});

test('前の版で保存したショー（drillboard.v1）が、そのまま開ける', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { const D = window.__db, sh = D.sampleShow('square'); sh.title = '前の版のショー'; D.S = D.normalize(sh); D.afterLoad(true); });
  await expect.poll(() => page.evaluate(() => (localStorage.getItem('drillboard.v1') || '').includes('前の版のショー'))).toBe(true);
  await page.reload(); await page.waitForFunction(() => window.__db && window.__db.S);
  expect(await page.evaluate(() => window.__db.S.title)).toBe('前の版のショー');
  await noErrors(errors);
});

test('ふだんの起動で、外（Googleなど）へ何も送らない', async ({ page }) => {
  const outside = [];
  page.on('request', r => { const u = new URL(r.url()); if (/^https?:$/.test(u.protocol) && !/^(127\.0\.0\.1|fonts\.(googleapis|gstatic)\.com)$/.test(u.hostname)) outside.push(r.url()); });
  const errors = await openApp(page, '');
  await page.waitForTimeout(800);
  expect(outside).toEqual([]);
  await noErrors(errors);
});
