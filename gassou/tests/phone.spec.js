// スマホの幅（390px）で、どの画面も横にはみ出さない
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で全部の画面が横にはみ出さない', async ({ page }) => {
  const errors = await openApp(page);
  for (const t of ['note', 'rec', 'bars', 'out']) {
    await page.click(`[data-tab="${t}"]`);
    await expect(page.locator(`[data-panel="${t}"]`)).toBeVisible();
    await noSideScroll(page);
  }
  await noErrors(errors);
});

test('スマホの幅：ノートの欄は書いた分だけのびる', async ({ page }) => {
  const errors = await openApp(page);
  const h0 = await page.locator('#memo').evaluate(e => e.offsetHeight);
  await page.locator('#memo').evaluate(e => { e.focus(); e.setSelectionRange(e.value.length, e.value.length); });
  for (let i = 0; i < 25; i++) await page.locator('#memo').press('Enter');
  const h1 = await page.locator('#memo').evaluate(e => ({ h: e.offsetHeight, sh: e.scrollHeight }));
  expect(h1.h).toBeGreaterThan(h0);
  expect(h1.h).toBeGreaterThanOrEqual(h1.sh);
  await noSideScroll(page);
  await noErrors(errors);
});
