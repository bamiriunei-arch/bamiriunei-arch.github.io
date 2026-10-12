// スマホの幅（390px）で、横にはみ出さない
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で、どのタブも横にはみ出さない', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('bamiri.guided', '1'));
  const errors = await openApp(page);
  await expect(page.locator('#homeLink')).toBeVisible();
  for (const t of ['add', 'sel', 'layer', 'stage', 'save']) {
    await page.click(`[data-tab="${t}"]`);
    await noSideScroll(page);
  }
  await noErrors(errors);
});
