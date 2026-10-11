// 仕込み図 v4：同じ場所のステマネの演奏会から、きっかけ表を作る（ファイルにしなくても）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');
const { putSM } = require('./stagemane-fixture');

test('「ステマネから作る」：この端末のステマネの演奏会を選んで、きっかけ表を作る', async ({ page }) => {
  const errors = await openApp(page);
  await putSM(page);
  await page.click('[data-tab="cues"]');
  await expect(page.locator('#btnCueStagemane')).toHaveText('ステマネから作る');
  await page.click('#btnCueStagemane');
  const sh = page.locator('.gky-sheet');
  await expect(sh.locator('[data-sm]')).toHaveCount(2);
  await sh.locator('[data-sm]', { hasText: '春の演奏会' }).click();
  await expect(page.locator('.gky-sheet')).toContainText('「春の演奏会」の流れから');
  await page.click('.gky-sheet footer .btn.primary');
  const cues = await page.evaluate(() => __app.E().cues.map(c => c.at));
  expect(cues).toEqual(['開場 13:30', '影アナ（本ベル） 14:00', '曲：ジュビラント序曲', '司会（舞台下手）', '曲：宝島']);
  await noErrors(errors);
});

test('ステマネに演奏会がないときは、そのままファイルを選ぶ', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="cues"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnCueStagemane');
  await chooser;
  await expect(page.locator('.gky-sheet')).toHaveCount(0);
  await noErrors(errors);
});
