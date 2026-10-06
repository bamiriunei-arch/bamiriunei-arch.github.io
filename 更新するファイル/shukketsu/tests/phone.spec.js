// スマホの幅（390px）で、どの画面も横にはみ出さない
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で全部の画面が横にはみ出さない', async ({ page }) => {
  const errors = await openApp(page);
  for (const t of ['ev', 'rate', 'share', 'io']) {
    await page.click(`[data-tab="${t}"]`);
    await expect(page.locator(`[data-panel="${t}"]`)).toBeVisible();
    await noSideScroll(page);
  }
  // 予定を選ぶと出欠の画面だけになり、一覧へもどれる
  await page.click('[data-tab="ev"]');
  await page.locator('#evList .ev').first().click();
  await expect(page.locator('#att .arow').first()).toBeVisible();
  await noSideScroll(page);
  await page.click('#aBack');
  await expect(page.locator('#evList .ev').first()).toBeVisible();
  await noErrors(errors);
});
