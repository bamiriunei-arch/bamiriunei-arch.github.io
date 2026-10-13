// 楽器台帳 v5：使う人を楽屋の名簿から選ぶ・部員ごとの楽器・楽屋の変更がすぐ出る
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const ITEMS = [
  { id: 'g1', no: 'Tp-01', name: 'トランペット', part: 'Tp', owner: 'school', state: 'good' },
  { id: 'g2', no: 'Hn-01', name: 'ホルン', part: 'Hn', owner: 'club', state: 'good', user: '外部 の人' },
  { id: 'g3', no: 'Tb-01', name: 'トロンボーン', part: 'Tb', owner: 'personal', ownerNote: '石田 花さんの楽器', state: 'good' },
];
const ORG = { org: { name: 'テスト中学校', type: 'chu' }, members: [{ id: 'a', name: '赤井 一郎', part: 'Tp', grade: '中2', status: 'active' }, { id: 'b', name: '石田 花', part: 'Tb', grade: '中3', status: 'active' }, { id: 'c', name: '上野 空', part: 'Tp', grade: '中1', status: 'active' }, { id: 'd', name: '江口 海', part: 'Hn', grade: '中1', status: 'active' }] };
async function seed(page) {
  await page.evaluate(({ ITEMS, ORG }) => { localStorage.setItem('gakki.v1', JSON.stringify({ v: 1, items: ITEMS, cons: [], settings: {} })); localStorage.setItem('gakuya.org', JSON.stringify(ORG)); }, { ITEMS, ORG });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
}

test('使う人：楽屋の名簿から選べる（同じパートが先）。名簿にいない名前も残る。ほかの人は名前を打てる', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.locator('.inst', { hasText: 'Tp-01' }).click();
  const pick = page.locator('#detail [data-upick]');
  await expect(pick.locator('optgroup[label="同じパート"] option')).toHaveText(['赤井 一郎（トランペット・中2）', '上野 空（トランペット・中1）']);
  await pick.selectOption('上野 空');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gakki.v1')).items.find(i => i.id === 'g1').user)).toBe('上野 空');
  // 名簿にいない名前
  await page.locator('.inst', { hasText: 'Hn-01' }).click();
  await expect(page.locator('#detail [data-upick]')).toHaveValue('外部 の人');
  // ほかの人
  await page.locator('#detail [data-upick]').selectOption('__other');
  const inp = page.locator('#detail .upick input');
  await expect(inp).toBeVisible();
  await inp.fill('新しい 先生'); await inp.press('Tab');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gakki.v1')).items.find(i => i.id === 'g2').user)).toBe('新しい 先生');
  await noErrors(errors);
});

test('部員ごとの楽器：使う楽器・自分の楽器・まだ決まっていない人。そこから楽器を決められる', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.click('[data-tab="lend"]');
  const t = page.locator('#memberTable');
  await expect(t.locator('tr', { hasText: '石田 花' })).toContainText('Tb-01 トロンボーン（自分の）');
  await expect(t.locator('tr', { hasText: '赤井 一郎' })).toContainText('まだ決まっていない');
  await t.locator('tr', { hasText: '赤井 一郎' }).locator('[data-pick]').click();
  const sh = page.locator('.gky-sheet', { hasText: '使う人をまとめて決める' });
  await sh.locator('tr', { hasText: 'Tp-01' }).locator('[data-upick]').selectOption('赤井 一郎');
  await sh.locator('footer .btn.primary').click();
  await expect(t.locator('tr', { hasText: '赤井 一郎' })).toContainText('Tp-01 トランペット');
  await noErrors(errors);
});

test('ほかのタブの楽屋で部員を足すと、開き直さなくても出る', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.click('[data-tab="lend"]');
  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('gakuya.org'));
    o.members.push({ id: 'e', name: '大野 新', part: 'Tp', grade: '中1', status: 'active' });
    const v = JSON.stringify(o); localStorage.setItem('gakuya.org', v);
    window.dispatchEvent(new StorageEvent('storage', { key: 'gakuya.org', newValue: v }));
  });
  await expect(page.locator('#memberTable')).toContainText('大野 新');
  await page.click('[data-tab="list"]');
  await page.locator('.inst', { hasText: 'Tp-01' }).click();
  await expect(page.locator('#detail [data-upick] option', { hasText: '大野 新' })).toHaveCount(1);
  await noErrors(errors);
});
