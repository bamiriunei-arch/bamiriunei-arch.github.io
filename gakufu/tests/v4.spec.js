// 楽譜ライブラリ v4：同じ場所のステマネの演奏会から選ぶ（ファイルにしなくても）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');
const { putSM } = require('./stagemane-fixture');

test('曲目一覧の「ステマネから選ぶ」：この端末のステマネの演奏会から曲目一覧を作る。ステマネでつないだ楽屋の本番もつなぐ', async ({ page }) => {
  const errors = await openApp(page);
  await putSM(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト' }, concerts: [{ id: 'k1', title: '春の演奏会', date: '2027-03-20' }] })));
  await page.click('[data-tab="setlist"]');
  await expect(page.locator('#slFromStagemane')).toHaveText('ステマネから選ぶ');
  await page.click('#slFromStagemane');
  await expect(page.locator('.gky-sheet')).toContainText('ステマネの演奏会から曲を選ぶ');
  await page.locator('.gky-sheet [data-sm]', { hasText: '春の演奏会' }).click();
  const l = await page.evaluate(() => { const s = __app.S, l = s.setlists.find(x => x.id === s.slCur); return { title: l.title, date: l.date, venue: l.venue, concert: l.concert, n: l.ids.map(id => s.songs.find(x => x.id === id).title) }; });
  expect([l.title, l.date, l.venue, l.concert]).toEqual(['春の演奏会', '2027-03-20', 'テスト会館', 'k1']);
  expect(l.n).toContain('宝島');
  await noErrors(errors);
});

test('取り込みの「ステマネから選ぶ」：この端末のステマネの演奏会から、演奏の記録を足す', async ({ page }) => {
  const errors = await openApp(page);
  await putSM(page);
  await page.click('[data-tab="io"]');
  await page.click('#btnStagemane');
  await page.locator('.gky-sheet [data-sm]', { hasText: '春の演奏会' }).click();
  await expect(page.locator('.gky-sheet')).toContainText('「春の演奏会」');
  await page.click('.gky-sheet footer .btn.primary');
  const h = await page.evaluate(() => __app.S.songs.find(s => s.title === '宝島').history.map(x => x.date));
  expect(h).toContain('2027-03-20');
  await noErrors(errors);
});
