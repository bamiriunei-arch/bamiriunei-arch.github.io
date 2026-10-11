// 搬入出：楽屋の「本番」とつなぐ（楽屋の本番から開く・作る・設定でつなぐ）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 楽屋の本番2つ（c1：定期演奏会、c2：コンクール） */
const ORG = { org: { name: 'テスト高校', type: 'koko' }, members: [], concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2027-03-20', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '吹奏楽コンクール 地区大会', date: '2027-07-25', start: '', venue: '文化センター', kind: 'contest' }] };
async function openConcert(page, id) {
  await page.goto('/index.html?test#concert=' + id);
  await page.waitForFunction(() => window.__app && window.__app.ready);
}
const seedOrg = (page, org = ORG) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), org);

test('楽屋の本番から開くと、積み込みリストを作るか聞き、本番の名前・日付・会場で作る。2回目はそれを開く', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await openConcert(page, 'c1');
  const ask = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await expect(ask).toContainText('第13回 定期演奏会');
  await ask.getByRole('button', { name: '積み込みリストを作る' }).click();
  const nf = page.locator('.gky-sheet', { hasText: '新しい本番' });
  await expect(nf.locator('[data-gky-concert]')).toHaveValue('c1');
  await expect(nf.locator('#nT')).toHaveValue('第13回 定期演奏会');
  await expect(nf.locator('#nD')).toHaveValue('2027-03-20');
  await expect(nf.locator('#nTo')).toHaveValue('市民会館');
  await nf.getByRole('button', { name: '作る', exact: true }).click();
  expect(await page.evaluate(() => { const t = __app.T(); return [t.title, t.date, t.to, t.concert]; })).toEqual(['第13回 定期演奏会', '2027-03-20', '市民会館', 'c1']);
  // ほかの本番にしてから、もう一度 c1 から開く
  await page.evaluate(() => { __app.S.current = __app.S.order[__app.S.order.length - 1]; location.hash = '#concert=c1'; });
  await expect(page.locator('#gkyToast')).toContainText('積み込みリストを開きました');
  expect(await page.evaluate(() => __app.T().concert)).toBe('c1');
  await noErrors(errors);
});

test('本番の設定で、楽屋の本番を選ぶと名前・日付・行き先が入り、つながる', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('#btnTrip');
  const sh = page.locator('.gky-sheet', { hasText: '本番の設定' });
  await sh.locator('[data-gky-concert]').selectOption('c2');
  await expect(sh.locator('#tT')).toHaveValue('吹奏楽コンクール 地区大会');
  await expect(sh.locator('#tTo')).toHaveValue('文化センター');
  await sh.getByRole('button', { name: '決める' }).click();
  expect(await page.evaluate(() => { const t = __app.T(); return [t.concert, t.title, t.date, t.to]; })).toEqual(['c2', '吹奏楽コンクール 地区大会', '2027-07-25', '文化センター']);
  await noErrors(errors);
});
