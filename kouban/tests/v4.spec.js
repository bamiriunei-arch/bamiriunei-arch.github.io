// コウバン v4：同じ場所のステマネの演奏会から曲を読み込む（ファイルにしなくても）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');
const { putSM } = require('./stagemane-fixture');

test('「ステマネから」：この端末のステマネの演奏会を一覧から選んで、曲を読み込む。つないだ本番の演奏会が上に出る', async ({ page }) => {
  const errors = await openApp(page);
  await putSM(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト' }, concerts: [{ id: 'k1', title: '春の演奏会', date: '2027-03-20' }] })));
  await page.click('[data-tab="pieces"]');
  await expect(page.locator('#btnImportStagemane')).toHaveText('ステマネから');
  await page.click('#btnImportStagemane');
  const sh = page.locator('.gky-sheet');
  await expect(sh).toContainText('ステマネの演奏会を選ぶ');
  await expect(sh.locator('[data-sm]')).toHaveCount(2);
  await expect(sh.locator('[data-sm]').first()).toContainText('春の演奏会');
  await expect(sh.locator('[data-sm]').first()).toContainText('楽屋の本番：春の演奏会');
  await expect(sh.locator('[data-sm]').first()).toContainText('2曲');
  await expect(sh.locator('[data-sm]').nth(1)).toContainText('例');
  await sh.locator('[data-sm]').first().click();
  await expect(page.locator('.gky-sheet')).toContainText('ジュビラント序曲');
  await page.click('.gky-sheet footer .btn.primary');
  const titles = await page.evaluate(() => __app.P().pieces.map(x => x.title));
  expect(titles).toContain('ジュビラント序曲');
  await noErrors(errors);
});

test('「ステマネから」→「ファイルから選ぶ」で、書き出したファイルも選べる。やめると何もしない', async ({ page }) => {
  const errors = await openApp(page);
  await putSM(page);
  await page.click('[data-tab="pieces"]');
  const before = await page.evaluate(() => __app.P().pieces.length);
  await page.click('#btnImportStagemane');
  await page.click('.gky-sheet footer >> text=やめる');
  await expect(page.locator('.gky-sheet')).toHaveCount(0);
  await page.click('#btnImportStagemane');
  const file = { app: 'stagemane', format: 1, concert: { info: { title: 'ファイルの演奏会', date: '2027-05-05' }, program: [{ id: 'z', type: 'piece', title: 'ファイルの曲' }] } };
  const chooser = page.waitForEvent('filechooser');
  await page.click('.gky-sheet footer >> text=ファイルから選ぶ');
  await (await chooser).setFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.gky-sheet')).toContainText('ファイルの曲');
  await page.click('.gky-sheet footer .btn.primary');
  const after = await page.evaluate(() => __app.P().pieces.map(x => x.title));
  expect(after.length).toBe(before + 1);
  expect(after).toContain('ファイルの曲');
  await noErrors(errors);
});

test('「ファイルを開く」でステマネのファイルを選んだときも、そのまま曲の読み込みになる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="out"]');
  const file = { app: 'stagemane', format: 1, concert: { info: { title: 'ファイルの演奏会', date: '2027-05-05' }, program: [{ id: 'z', type: 'piece', title: 'ファイルの曲' }] } };
  const chooser = page.waitForEvent('filechooser');
  await page.click('#openJson');
  await (await chooser).setFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.gky-sheet')).toContainText('ファイルの曲');
  await expect(page.locator('[data-panel="pieces"]')).toBeVisible();
  await noErrors(errors);
});
