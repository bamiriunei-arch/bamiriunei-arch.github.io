// 仕込み図：楽屋の「本番」とつなぐ（楽屋の本番から開く・作る・設定でつなぐ）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 楽屋の本番2つ（c1：定期演奏会、c2：コンクール） */
const ORG = { org: { name: 'テスト高校', type: 'koko' }, members: [], concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2027-03-20', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '吹奏楽コンクール 地区大会', date: '2027-07-25', start: '', venue: '文化センター', kind: 'contest' }] };
async function openConcert(page, id) {
  await page.goto('/index.html?test#concert=' + id);
  await page.waitForFunction(() => window.__app && window.__app.ready);
}
const seedOrg = (page, org = ORG) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), org);

test('楽屋の本番から開くと、資料を作るか聞き、本番の名前・日付・会場で作る。2回目はそれを開く', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await openConcert(page, 'c1');
  const ask = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await expect(ask).toContainText('第13回 定期演奏会');
  await ask.getByRole('button', { name: '音響・照明の資料を作る' }).click();
  const nf = page.locator('.gky-sheet', { hasText: '新しい本番' });
  await expect(nf.locator('[data-gky-concert]')).toHaveValue('c1');
  await expect(nf.locator('#nTitle')).toHaveValue('第13回 定期演奏会');
  await expect(nf.locator('#nDate')).toHaveValue('2027-03-20');
  await expect(nf.locator('#nVenue')).toHaveValue('市民会館');
  await nf.getByRole('button', { name: '作る', exact: true }).click();
  expect(await page.evaluate(() => { const e = __app.E(); return [e.title, e.date, e.venue, e.concert]; })).toEqual(['第13回 定期演奏会', '2027-03-20', '市民会館', 'c1']);
  await page.evaluate(() => { __app.S.current = __app.S.order[__app.S.order.length - 1]; location.hash = '#concert=c1'; });
  await expect(page.locator('#gkyToast')).toContainText('音響・照明の資料を開きました');
  expect(await page.evaluate(() => __app.E().concert)).toBe('c1');
  await noErrors(errors);
});

test('本番の設定で楽屋の本番を選ぶと、例の本番は名前・日付・会場が入れかわり、つながる', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('#btnEv');
  const sh = page.locator('.gky-sheet', { hasText: '本番の設定' });
  await sh.locator('[data-gky-concert]').selectOption('c2');
  await sh.getByRole('button', { name: '決める' }).click();
  expect(await page.evaluate(() => { const e = __app.E(); return [e.concert, e.title, e.date, e.venue, e.sample]; })).toEqual(['c2', '吹奏楽コンクール 地区大会', '2027-07-25', '文化センター', false]);
  await noErrors(errors);
});
