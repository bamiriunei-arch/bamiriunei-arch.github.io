// 楽器台帳 v2：今年度の使う人・ほかの団体との貸し借り・資産台帳
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('ほかの団体へ貸し出す：「（団体）」と記録され、一覧に団体の印がつく', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#instList .inst', { hasText: 'TSx-01' }).click();
  await page.click('[data-q="lend"]');
  await page.locator('[name="qKind"][value="org"]').check();
  await expect(page.locator('#qWhoL')).toHaveText('団体の名前');
  await page.locator('#qWho').fill('〇〇高校吹奏楽部');
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('#detail')).toContainText('〇〇高校吹奏楽部（団体）に貸し出し中');
  await page.click('[data-tab="lend"]');
  await expect(page.locator('#lendTable tr', { hasText: 'TSx-01' })).toContainText('団体');
  await expect(page.locator('#lendSums')).toContainText('うち ほかの団体へ 1');
  // 借りている楽器（持ち主＝借用）の一覧
  await expect(page.locator('#borrowTable')).toContainText('Tu-01');
  await page.locator('#lendTable tr', { hasText: 'TSx-01' }).locator('[data-ret]').click();
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => { const i = __app.S.items.find(x => x.no === 'TSx-01'); return { lent: i.lentTo, kind: i.lentKind, log: i.log.slice(0, 2).map(l => l.text) }; });
  expect(r.lent).toBe(''); expect(r.kind).toBe('');
  expect(r.log[0]).toContain('〇〇高校吹奏楽部（団体）から');
  await noErrors(errors);
});

test('今年度の使う人：記録・一覧・返却チェック表・新年度にまとめて消す。楽屋にも入る', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { __app.S.sample = false; __app.renderAll(); });
  await page.locator('#instList .inst', { hasText: 'Fl-01' }).click();
  await page.locator('#detail [data-k="user"]').fill('山田 花子');
  await page.locator('#detail [data-k="user"]').press('Tab');
  await expect(page.locator('#instList .inst', { hasText: 'Fl-01' })).toContainText('使う人：山田 花子');
  const log = await page.evaluate(() => __app.S.items.find(x => x.no === 'Fl-01').log[0]);
  expect(log.type).toBe('user'); expect(log.text).toBe('山田 花子さんが使う');
  await page.click('[data-tab="lend"]');
  await expect(page.locator('#userTable')).toContainText('山田 花子');
  await page.click('#retPrint');
  const pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('返却チェック表');
  await expect(pg).toContainText('山田 花子');
  await expect(pg).toContainText('杉本 心春（いま家に持ち帰り）');
  await page.keyboard.press('Escape');
  // 楽屋に反映すると、使う人も入る
  await page.click('[data-tab="io"]'); await page.click('#btnSync');
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).instruments.find(i => i.no === 'Fl-01'));
  expect(o.user).toBe('山田 花子');
  await page.click('[data-tab="lend"]');
  await page.click('#userClear'); await page.click('#userClear');
  expect(await page.evaluate(() => __app.S.items.filter(i => i.user).length)).toBe(0);
  await noErrors(errors);
});

test('資産台帳：入手・価格・寄贈者と、持ち主ごとの合計。個人の楽器は分けて出す', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#instList .inst', { hasText: 'Hn-01' }).click();
  await page.locator('#detail [data-k="acq"]').selectOption('gift');
  await page.locator('#detail [data-k="price"]').fill('350,000円');
  await page.locator('#detail [data-k="price"]').press('Tab');
  await page.locator('#detail [data-k="donor"]').fill('〇〇後援会');
  await page.locator('#detail [data-k="donor"]').press('Tab');
  const i = await page.evaluate(() => { const x = __app.S.items.find(y => y.no === 'Hn-01'); return [x.acq, x.price, x.donor]; });
  expect(i).toEqual(['gift', 350000, '〇〇後援会']);
  await page.click('[data-tab="print"]');
  await page.click('#prAsset');
  const all = await page.locator('.gky-pv .gky-page').allInnerTexts();
  const txt = all.join('\n');
  expect(txt).toContain('学校の楽器');
  expect(txt).toContain('350,000円');
  expect(txt).toContain('〇〇後援会');
  expect(txt).toContain('個人の楽器　1台（団体の資産ではありません）');
  expect(txt).toMatch(/団体\s+\d+台\s+168,000円/);
  await noErrors(errors);
});

test('CSV：使う人・購入価格・入手・寄贈者を読み書きできる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="io"]');
  const csv = '番号,楽器,パート,持ち主,購入年,使う人,購入価格,入手,寄贈者\nEu-05,ユーフォニアム,Euph,団体,2019,佐藤 一郎,"250,000",寄贈,OB会\n';
  const chooser = page.waitForEvent('filechooser');
  await page.click('#csvIn');
  await (await chooser).setFiles({ name: 'g.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => { const i = __app.S.items.find(x => x.no === 'Eu-05'); return [i.year, i.user, i.price, i.acq, i.donor]; });
  expect(r).toEqual(['2019', '佐藤 一郎', 250000, 'gift', 'OB会']);
  await noErrors(errors);
});
