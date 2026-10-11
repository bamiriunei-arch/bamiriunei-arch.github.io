// 本番逆算：楽屋の「本番」とつなぐ（楽屋の本番から開く・作る・設定でつなぐ）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 楽屋の本番2つ（c1：定期演奏会、c2：コンクール） */
const ORG = { org: { name: 'テスト高校', type: 'koko' }, members: [], concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2027-03-20', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '吹奏楽コンクール 地区大会', date: '2027-07-25', start: '', venue: '文化センター', kind: 'contest' }] };
async function openConcert(page, id) {
  await page.goto('/index.html?test#concert=' + id);
  await page.waitForFunction(() => window.__app && window.__app.ready);
}
const seedOrg = (page, org = ORG) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), org);

test('楽屋の本番から開くと、スケジュールを作るか聞き、本番の名前・日付で作る。2回目はそれを開く', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await openConcert(page, 'c1');
  const ask = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await expect(ask).toContainText('第13回 定期演奏会');
  await ask.getByRole('button', { name: '準備のスケジュールを作る' }).click();
  const nf = page.locator('.gky-sheet', { hasText: '新しい本番' });
  await expect(nf.locator('[data-gky-concert]')).toHaveValue('c1');
  await expect(nf.locator('#nT')).toHaveValue('第13回 定期演奏会');
  await expect(nf.locator('#nD')).toHaveValue('2027-03-20');
  await expect(nf.locator('#nK')).toHaveValue('concert');
  await nf.getByRole('button', { name: '作る', exact: true }).click();
  expect(await page.evaluate(() => { const p = __app.P(); return [p.title, p.date, p.concert, p.tasks.length > 0]; })).toEqual(['第13回 定期演奏会', '2027-03-20', 'c1', true]);
  await expect(page.locator('#hero .gky-cchip')).toContainText('楽屋の本番：第13回 定期演奏会');
  // コンクールの本番から作ると、ひな形はコンクール
  await page.evaluate(() => { location.hash = '#concert=c2'; });
  await page.locator('.gky-sheet', { hasText: 'まだありません' }).getByRole('button', { name: '準備のスケジュールを作る' }).click();
  await expect(page.locator('.gky-sheet', { hasText: '新しい本番' }).locator('#nK')).toHaveValue('contest');
  await page.locator('.gky-sheet', { hasText: '新しい本番' }).getByRole('button', { name: 'やめる' }).click();
  // もう一度 c1 から開くと、作ったスケジュールを開く
  await page.evaluate(() => { __app.S.current = __app.S.order[__app.S.order.length - 1]; location.hash = '#concert=c1'; });
  await expect(page.locator('#gkyToast')).toContainText('楽屋の本番「第13回 定期演奏会」の準備のスケジュールを開きました');
  expect(await page.evaluate(() => __app.P().concert)).toBe('c1');
  await noErrors(errors);
});

test('本番の設定で、楽屋の本番とつなぐ・やめる。「＋」で楽屋の本番の一覧に入れる', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('#btnPlan');
  const sh = page.locator('.gky-sheet', { hasText: '本番の設定' });
  await sh.locator('[data-gky-concert]').selectOption('c2');
  await expect(sh.locator('#sT')).toHaveValue('吹奏楽コンクール 地区大会');   // 選ぶと名前・日付が入る
  await expect(sh.locator('#sD')).toHaveValue('2027-07-25');
  await sh.getByRole('button', { name: '決める' }).click();
  expect(await page.evaluate(() => { const p = __app.P(); return [p.concert, p.title, p.sample]; })).toEqual(['c2', '吹奏楽コンクール 地区大会', false]);
  // ＋：今の名前と日付で楽屋の本番を作ってつなぐ
  await page.click('#btnPlan');
  await sh.locator('#sT').fill('新入生歓迎演奏'); await sh.locator('#sD').fill('2027-04-10');
  await sh.locator('[data-gky-concert]').selectOption('+');
  await sh.getByRole('button', { name: '決める' }).click();
  const r = await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); const c = o.concerts.find(c => c.title === '新入生歓迎演奏'); return [!!c, c && c.date, c && __app.P().concert === c.id]; });
  expect(r).toEqual([true, '2027-04-10', true]);
  await noErrors(errors);
});
