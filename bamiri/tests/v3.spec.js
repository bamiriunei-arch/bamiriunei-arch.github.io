// バミリ v3：楽屋の部員を席に入れる（プルダウン・まとめて）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

async function seed(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('bamiri.guided', '1');
    const P = (id, label, x, y, name = '') => ({ id, t: 'player', x, y, w: 46, h: 46, r: 0, sec: 'br', label, name });
    localStorage.setItem('bamiri.current', JSON.stringify({ title: 'テスト', W: 1400, D: 900, items: [P('t1', 'Tp', 500, 300), P('t2', 'Tp', 300, 300), P('t3', 'Tp', 700, 300, '外部さん'), P('b1', 'Tb', 600, 200)] }));
    localStorage.setItem('gakuya.org', JSON.stringify({ org: { type: 'chu' }, members: [
      { id: 'a', name: '赤井', part: 'Tp', grade: '中3', status: 'active' }, { id: 'b', name: '石田', part: 'Tp', grade: '中1', status: 'active' },
      { id: 'c', name: '上野', part: 'Tp', grade: '中2', status: 'active' }, { id: 'd', name: '江口', part: 'Hn', grade: '中2', status: 'active', subs: ['Tp'] },
      { id: 'e', name: '大野', part: 'Tb', grade: '中1', status: 'active' } ] }));
  });
}
const names = page => page.evaluate(() => Object.fromEntries(__app.doc.items.map(i => [i.id, i.name])));

test('「楽屋の部員を席に入れる」：空いた席に同じパートの部員を左の席から（上の学年から）。入っている名前は変えない', async ({ page }) => {
  await seed(page);
  const errors = await openApp(page);
  await page.click('[data-tab="sel"]');
  await expect(page.locator('#gkyFillNote')).toContainText('3人を入れられます');
  await expect(page.locator('#gkyFillNote')).toContainText('席が足りない部員：石田');
  await page.click('#gkyFill');
  expect(await names(page)).toEqual({ t1: '上野', t2: '赤井', t3: '外部さん', b1: '大野' });
  // 元に戻す
  await page.click('#undo');
  expect(await names(page)).toEqual({ t1: '', t2: '', t3: '外部さん', b1: '' });
  await noErrors(errors);
});

test('選んだ席で、楽屋の部員をプルダウンから選べる（同じパート→持ち替え→ほか。ほかの席の人に印）', async ({ page }) => {
  await seed(page);
  const errors = await openApp(page);
  await page.evaluate(() => __app.select('t1'));
  await page.click('[data-tab="sel"]');
  const pick = page.locator('#fPick');
  await expect(pick.locator('optgroup[label="同じパート"] option')).toHaveText(['赤井（中3）', '上野（中2）', '石田（中1）']);
  await expect(pick.locator('optgroup[label="持ち替えできる"] option')).toHaveText(['江口（中2）']);
  await pick.selectOption('石田');
  expect((await names(page)).t1).toBe('石田');
  await expect(page.locator('#fName')).toHaveValue('石田');
  await noErrors(errors);
});
