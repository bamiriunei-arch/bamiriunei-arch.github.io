// 会計：楽屋の「本番」とつなぐ（楽屋の本番から開く・作る・設定でつなぐ）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 楽屋の本番2つ（c1：定期演奏会、c2：コンクール） */
const ORG = { org: { name: 'テスト高校', type: 'koko' }, members: [], concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2027-03-20', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '吹奏楽コンクール 地区大会', date: '2027-07-25', start: '', venue: '文化センター', kind: 'contest' }] };
async function openConcert(page, id) {
  await page.goto('/index.html?test#concert=' + id);
  await page.waitForFunction(() => window.__app && window.__app.ready);
}
const seedOrg = (page, org = ORG) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), org);

test('楽屋の本番から開くと、予算を作るか聞き（例は消す）、本番の名前・日付で作る。予算の画面でつなぎ直せる', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await openConcert(page, 'c1');
  const ask = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await ask.getByRole('button', { name: '予算を作る' }).click();
  const nf = page.locator('.gky-sheet', { hasText: '予算を作る' }).last();
  await expect(nf.locator('[data-gky-concert]')).toHaveValue('c1');
  await expect(nf.locator('#bN')).toHaveValue('第13回 定期演奏会');
  await expect(nf.locator('#bD')).toHaveValue('2027-03-20');
  await nf.getByRole('button', { name: '作る', exact: true }).click();
  const r = await page.evaluate(() => [__app.S.sample, __app.S.budgets.map(b => [b.name, b.date, b.concert])]);
  expect(r).toEqual([false, [['第13回 定期演奏会', '2027-03-20', 'c1']]]);
  await expect(page.locator('#bgConcert [data-gky-concert]')).toHaveValue('c1');
  // 予算の画面で、ほかの本番につなぎ直す
  await page.locator('#bgConcert [data-gky-concert]').selectOption('c2');
  await expect(page.locator('#gkyToast')).toContainText('楽屋の本番「吹奏楽コンクール 地区大会」とつなぎました');
  expect(await page.evaluate(() => __app.S.budgets[0].concert)).toBe('c2');
  // c2 から開くと、その予算を開く
  await page.click('[data-tab="book"]');
  await page.evaluate(() => { location.hash = '#concert=c2'; });
  await expect(page.locator('#gkyToast')).toContainText('予算を開きました');
  await expect(page.locator('[data-panel="budget"]')).toBeVisible();
  await noErrors(errors);
});

test('楽器台帳の修理・点検の費用を、帳簿に入れる（入れないものは、もう出ない）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => {
    localStorage.setItem('kaikei.v1', JSON.stringify({ v: 1, start: 4, ledger: [], fees: [], budgets: [] }));
    localStorage.setItem('gakki.v1', JSON.stringify({ v: 1, items: [{ id: 'i1', no: 'Tp-01', name: 'トランペット', log: [{ id: 'l1', date: '2026-09-10', type: 'repair', text: 'ピストンの修理', cost: 8800 }, { id: 'l2', date: '2026-09-20', type: 'check', text: '点検', cost: 3300 }, { id: 'l3', date: '2026-09-21', type: 'note', text: 'メモ', cost: 0 }] }] }));
  });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('[data-tab="book"]');
  await expect(page.locator('#gakkiBox')).toContainText('2件');
  await page.click('#gkSee');
  const sh = page.locator('.gky-sheet', { hasText: '楽器台帳の費用を帳簿に入れる' });
  await sh.locator('tr', { hasText: '点検' }).locator('[data-skip]').check();
  await sh.getByRole('button', { name: '帳簿に入れる' }).click();
  await expect(page.locator('#gkyToast')).toContainText('1件を帳簿に入れました（1件は入れないことにしました）');
  const r = await page.evaluate(() => __app.S.ledger.map(e => [e.date, e.kind, e.amount, e.cat]));
  expect(r).toEqual([['2026-09-10', 'out', 8800, '楽器の修理・購入']]);
  await expect(page.locator('#gakkiBox')).toBeEmpty();
  await noErrors(errors);
});
