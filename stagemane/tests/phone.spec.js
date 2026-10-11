// スマホの幅（390px）で、どの画面も横にはみ出さない
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で全部の画面が横にはみ出さない（入力・仕上がり・本番モード）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト' }, concerts: [{ id: 'c1', title: 'とても長い名前の本番（第20回 定期演奏会 〜春の訪れ〜）', date: '2027-03-21', kind: 'concert' }] })));
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  for (const t of ['info', 'program', 'tt', 'check']) {
    await page.click(`[data-etab="${t}"]`);
    await noSideScroll(page);
  }
  await page.click('[data-etab="info"]');
  await expect(page.locator('#editBody [data-gky-concert]')).toBeVisible();
  await page.click('.switcher [data-view="preview"]');
  for (const t of ['script', 'run', 'tt']) {
    await page.click(`[data-ptab="${t}"]`);
    await noSideScroll(page);
  }
  await expect(page.locator('#homeLink')).toBeVisible();
  await page.click('#btnLive');
  await expect(page.locator('#live')).toBeVisible();
  await noSideScroll(page);
  await noErrors(errors);
});
