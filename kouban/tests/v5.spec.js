// コウバン v5：これからの本番には楽屋の部員を自動で入れる。コウバンで足した人は楽屋にも
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const proj = (id, title, date, members) => ({ id, title, date, kind: 'concert', sample: false, members, pieces: [], assign: {}, absent: [] });
const ORG = { org: { name: 'テスト中学校', type: 'chu' }, members: [{ id: 'a', name: '赤井 一郎', part: 'Tp', grade: '中2', status: 'active' }, { id: 'b', name: '石田 花', part: 'Tb', grade: '中3', status: 'active' }, { id: 'g', name: '卒業 三', part: 'Cl', grade: '中3', status: 'gone' }] };
async function seed(page, current) {
  await page.evaluate(({ ORG, current }) => {
    localStorage.setItem('gakuya.org', JSON.stringify(ORG));
    const old = [{ id: 'a', name: '赤井 いちろう', part: 'Hn', grade: '中1', status: 'active' }];
    localStorage.setItem('kouban.v1', JSON.stringify({ v: 1, current, order: ['up', 'past'], projects: {
      up: { id: 'up', title: '定期演奏会', date: '2026-11-01', kind: 'concert', members: JSON.parse(JSON.stringify(old)), pieces: [], assign: {}, absent: [] },
      past: { id: 'past', title: '夏の本番', date: '2026-08-01', kind: 'concert', members: JSON.parse(JSON.stringify(old)), pieces: [], assign: {}, absent: [] } } }));
  }, { ORG, current });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
}
const names = page => page.evaluate(() => __app.P().members.map(m => [m.name, m.part]));

test('これからの本番は楽屋の部員に自動で合わせ、終わった本番はそのまま', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00'));
  const errors = await openApp(page);
  await seed(page, 'up');
  expect(await names(page)).toEqual([['赤井 一郎', 'Tp'], ['石田 花', 'Tb']]);
  await page.click('[data-tab="members"]');
  await expect(page.locator('#orgAutoNote')).toContainText('これからの本番なので');
  await page.selectOption('#projSel', 'past');
  expect(await names(page)).toEqual([['赤井 いちろう', 'Hn']]);
  await expect(page.locator('#orgAutoNote')).toContainText('終わった本番なので');
  // ほかのタブの楽屋で足すと、これからの本番にすぐ入る
  await page.selectOption('#projSel', 'up');
  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('gakuya.org'));
    o.members.push({ id: 'c', name: '上野 空', part: 'Fl', grade: '中1', status: 'active' });
    const v = JSON.stringify(o); localStorage.setItem('gakuya.org', v);
    window.dispatchEvent(new StorageEvent('storage', { key: 'gakuya.org', newValue: v }));
  });
  await expect.poll(() => names(page)).toEqual([['赤井 一郎', 'Tp'], ['石田 花', 'Tb'], ['上野 空', 'Fl']]);
  await noErrors(errors);
});

test('コウバンで足した・直した部員は楽屋の名簿にも入る', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00'));
  const errors = await openApp(page);
  await seed(page, 'up');
  await page.click('[data-tab="members"]');
  await page.click('#btnAddMember');
  await page.locator('#mName').fill('江口 海'); await page.locator('#mGrade').fill('中1'); await page.selectOption('#mPart', 'Hn');
  await page.click('.gky-sheet footer .btn.primary');
  const org = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.map(m => [m.name, m.part, m.grade]));
  expect(org).toContainEqual(['江口 海', 'Hn', '中1']);
  await page.locator('.mrow', { hasText: '赤井 一郎' }).locator('[data-edit]').click();
  await page.selectOption('#mPart', 'Cor');
  await page.click('.gky-sheet footer .btn.primary');
  const a = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.find(m => m.id === 'a').part);
  expect(a).toBe('Cor');
  await noErrors(errors);
});
