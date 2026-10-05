// 楽屋の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('ツールの一覧：12のツールが出て、同じ場所のフォルダにつながる', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('.tool')).toHaveCount(12);
  await expect(page.locator('.tool', { hasText: 'コウバン' })).toHaveAttribute('href', '../kouban/');
  await expect(page.locator('.tool', { hasText: 'バミリ' })).toHaveAttribute('href', '../bamiri/');
  await expect(page.locator('.tool', { hasText: 'ステマネ' })).toHaveAttribute('href', /claude\.ai\/artifact/);
  await noErrors(errors);
});

test('部員をまとめて足すと、楽屋のデータに入る（学年と楽器も読む）', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="members"]');
  await page.click('#mMany');
  await page.locator('#mmIn').fill('山田 花子 中2 クラリネット\n鈴木 太郎 中3 ラッパ\n佐藤 次郎');
  await page.click('.gky-sheet footer .btn.primary');
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.map(m => [m.name, m.grade, m.part]));
  expect(o).toEqual([['山田 花子', '中2', 'Cl'], ['鈴木 太郎', '中3', 'Tp'], ['佐藤 次郎', '', '']]);
  await expect(page.locator('#cntM')).toHaveText('3');
  await noErrors(errors);
});

test('進級：学年が上がり、中3は在籍していないになる（元に戻せる）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ app: 'gakuya', org: { name: 'テスト', year: 2026 }, members: [{ id: 'a', name: 'A', grade: '中1' }, { id: 'b', name: 'B', grade: '中3' }, { id: 'c', name: 'C', grade: '小6' }, { id: 'd', name: 'D', grade: '一般' }] })));
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('[data-tab="org"]');
  await expect(page.locator('#promote')).toContainText('卒業：B');
  await page.click('#doPromote'); await page.click('#doPromote');
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')));
  expect(o.members.map(m => [m.name, m.grade, m.active])).toEqual([['A', '中2', true], ['B', '中3', false], ['C', '中1', true], ['D', '一般', true]]);
  expect(o.org.year).toBe(2027);
  await noErrors(errors);
});

test('まとめてバックアップ：楽屋シリーズとバミリのデータが1つのファイルに入る', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { localStorage.setItem('kouban.v1', '{"v":1}'); localStorage.setItem('bamiri.current', '{"items":[]}'); localStorage.setItem('bamiri.auth', '1'); localStorage.setItem('other.app', 'x'); });
  await page.click('[data-tab="backup"]');
  await expect(page.locator('#bkList')).toContainText('kouban.v1');
  const dl = page.waitForEvent('download');
  await page.click('#bkSave');
  const file = await dl;
  const text = await (await file.createReadStream()).toArray().then(cs => Buffer.concat(cs).toString('utf8'));
  const j = JSON.parse(text);
  expect(j.app).toBe('gakuya-backup');
  expect(Object.keys(j.keys).sort()).toEqual(['bamiri.current', 'kouban.v1']);   // ログインの記録とほかのアプリは入れない
  await noErrors(errors);
});
