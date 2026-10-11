// 出欠：楽屋の「本番」とつなぐ（楽屋の本番から開く・作る・設定でつなぐ）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 楽屋の本番2つ（c1：定期演奏会、c2：コンクール） */
const ORG = { org: { name: 'テスト高校', type: 'koko' }, members: [], concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2027-03-20', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '吹奏楽コンクール 地区大会', date: '2027-07-25', start: '', venue: '文化センター', kind: 'contest' }] };
async function openConcert(page, id) {
  await page.goto('/index.html?test#concert=' + id);
  await page.waitForFunction(() => window.__app && window.__app.ready);
}
const seedOrg = (page, org = ORG) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), org);

test('楽屋の本番から開くと、本番の予定を作るか聞き（例は消す）、本番の名前・日付・会場・時間で作る。2回目はそれを開く', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page);
  await openConcert(page, 'c1');
  const ask = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await ask.getByRole('button', { name: '出欠を作る' }).click();
  const nf = page.locator('.gky-sheet', { hasText: '予定を足す' });
  await expect(nf.locator('[data-gky-concert]')).toHaveValue('c1');
  await expect(nf.locator('#eT')).toHaveValue('第13回 定期演奏会');
  await expect(nf.locator('#eP')).toHaveValue('市民会館');
  await expect(nf.locator('#eS')).toHaveValue('14:00');
  await expect(nf.locator('#eK')).toHaveValue('show');
  await nf.getByRole('button', { name: '足す', exact: true }).click();
  const r = await page.evaluate(() => { const e = __app.S.events.find(e => e.concert === 'c1'); return [__app.S.sample, !!e, e && e.date, e && e.kind, e && e.title]; });
  expect(r).toEqual([false, true, '2027-03-20', 'show', '第13回 定期演奏会']);
  await page.evaluate(() => { location.hash = '#concert=c1'; });
  await expect(page.locator('#gkyToast')).toContainText('出欠を開きました');
  await noErrors(errors);
});

test('ふつうの予定でも、楽屋の本番を選ぶと「本番」になってつながる。仮引退の人は、設定で名簿に入れられる', async ({ page }) => {
  const errors = await openApp(page);
  await seedOrg(page, Object.assign({}, ORG, { members: [{ id: 'a', name: '赤井', part: 'Tp', grade: '高2', status: 'active' }, { id: 'b', name: '石田', part: 'Hn', grade: '高3', status: 'semi' }, { id: 'c', name: '上野', part: 'Fl', grade: '高1', status: 'leave' }] }));
  await page.evaluate(() => localStorage.setItem('shukketsu.v1', JSON.stringify({ v: 1, events: [], att: {}, extra: [], settings: {} })));
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  expect(await page.evaluate(() => __app.roster().map(m => m.name))).toEqual(['赤井']);
  await page.click('[data-tab="io"]');
  await page.check('#setSemi');
  expect(await page.evaluate(() => __app.roster().map(m => m.name).sort())).toEqual(['石田', '赤井'].sort());
  await noErrors(errors);
});
