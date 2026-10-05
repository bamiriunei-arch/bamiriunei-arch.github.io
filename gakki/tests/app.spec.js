// 楽器台帳の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');
// 1×1の小さな画像（写真のテスト用）
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('起動すると例の楽器が出て、状態・貸し出し・消耗品の知らせがある', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#instList .inst')).toHaveCount(15);
  await expect(page.locator('#cntWarn')).toHaveText('3');
  await expect(page.locator('#cntLend')).toHaveText('2');
  await expect(page.locator('#cntCons')).toHaveText('2');
  await page.click('#filters [data-f="bad"]');
  await expect(page.locator('#instList .inst')).toHaveCount(3);
  await noErrors(errors);
});

test('貸し出して、返してもらうと記録が残る', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#instList .inst', { hasText: 'Pic-01' }).click();
  await page.click('[data-q="lend"]');
  await page.locator('#qWho').fill('テスト 太郎');
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('#detail')).toContainText('テスト 太郎さんに貸し出し中');
  await page.click('[data-q="return"]');
  await page.locator('#qSt').selectOption('adjust');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => { const i = __app.S.items.find(x => x.no === 'Pic-01'); return { lent: i.lentTo, state: i.state, log: i.log.map(l => l.type) }; });
  expect(r.lent).toBe('');
  expect(r.state).toBe('adjust');
  expect(r.log.slice(0, 2).sort()).toEqual(['lend', 'return']);
  await noErrors(errors);
});

test('写真を足すと、この端末に保存されて表示される', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#instList .inst', { hasText: 'Tu-01' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.click('#phAdd');
  await (await chooser).setFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#phList img')).toHaveCount(1);
  await expect.poll(async () => page.locator('#phList img').evaluate(i => i.src.startsWith('data:image'))).toBe(true);
  const id = await page.evaluate(() => __app.S.items.find(x => x.no === 'Tu-01').photos[0].id);
  const stored = await page.evaluate(id => __app.PH.get(id), id);
  expect(stored.startsWith('data:image/jpeg')).toBe(true);
  await noErrors(errors);
});

test('QRコード：中身に番号が入り、台帳のない端末では番号だけ出る', async ({ page }) => {
  const errors = await openApp(page);
  const t = await page.evaluate(() => __app.qrText(__app.S.items[0]));
  expect(t).toMatch(/^https:\/\/bamiriunei-arch\.github\.io\/gakki\/#i-[A-Za-z0-9_]+\.[A-Za-z0-9_-]+$/);
  const info = await page.evaluate(t => JSON.parse(__app.unb64(t.split('.').pop())), t);
  expect(info.n).toBe('Fl-01');
  // 台帳にない楽器のQRで開いたとき
  await page.goto('/index.html?test#i-gzzzzz.' + t.split('.').pop());
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('#qrInfo')).toContainText('Fl-01');
  await expect(page.locator('#qrInfo')).toContainText('この端末には');
  await noErrors(errors);
});

test('ラベルの印刷：3列に並び、QRが入る', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="print"]');
  await page.click('#lbPrint');
  await expect(page.locator('.gky-pv .lab')).toHaveCount(15);
  await expect(page.locator('.gky-pv .lab svg').first()).toBeVisible();
  await noErrors(errors);
});

test('CSVから取り込み、楽屋に反映できる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="io"]');
  const csv = '番号,楽器,パート,持ち主,状態\nHn-09,ホルン,ホルン,学校の備品,修理中\nHn-09,ホルン,Hn,,\n';
  const chooser = page.waitForEvent('filechooser');
  await page.click('#csvIn');
  await (await chooser).setFiles({ name: 'g.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => __app.S.items.map(i => [i.no, i.part, i.owner, i.state]));
  expect(r).toEqual([['Hn-09', 'Hn', 'school', 'repair']]);
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).instruments);
  expect(o.map(i => i.no)).toEqual(['Hn-09']);
  await noErrors(errors);
});
