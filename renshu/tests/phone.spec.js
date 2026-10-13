// スマホの幅（390px）で、どの画面も横にはみ出さない
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で全部の画面が横にはみ出さない', async ({ page }) => {
  const errors = await openApp(page);
  for (const t of ['plan', 'draft', 'share', 'io']) {
    await page.click(`[data-tab="${t}"]`);
    await expect(page.locator(`[data-panel="${t}"]`)).toBeVisible();
    await noSideScroll(page);
  }
  // 練習の日を選ぶとその日だけになり、一覧へもどれる
  await page.click('[data-tab="plan"]');
  await page.locator('#evList button.ev').first().click();
  await expect(page.locator('#day .mi').first()).toBeVisible();
  await noSideScroll(page);
  await page.click('#dBack');
  await expect(page.locator('#evList button.ev').first()).toBeVisible();
  await noErrors(errors);
});
