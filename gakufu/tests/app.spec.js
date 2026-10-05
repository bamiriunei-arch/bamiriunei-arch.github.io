// 楽譜ライブラリの基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('起動すると例の楽譜が出て、レンタルの期限切れと欠けがわかる', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('.sample-flag')).toBeVisible();
  await expect(page.locator('#songList .spine')).toHaveCount(8);
  await expect(page.locator('#libSums')).toContainText('期限切れ 1');
  await page.click('#filters [data-f="rent"]');
  await expect(page.locator('#songList .spine')).toHaveCount(2);
  await page.click('#filters [data-f="lack"]');
  await expect(page.locator('#songList .spine')).toHaveCount(2);
  await noErrors(errors);
});

test('曲を足して、名前と演奏時間を入れると保存される', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#btnAdd');
  const title = page.locator('#detail [data-k="title"]');
  await title.fill('テストの曲');
  await title.press('Tab');
  await page.locator('#detail [data-k="dur"]').fill("6'30\"");
  await page.locator('#detail [data-k="dur"]').press('Tab');
  await page.waitForTimeout(500);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('gakufu.v1')).songs.find(x => x.title === 'テストの曲'));
  expect(s.dur).toBe(390);
  await expect(page.locator('#songList')).toContainText('テストの曲');
  await noErrors(errors);
});

test('今の部員でできるか：持ち替えも数え、足りないパートを出す', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const song = { parts: ['Pic', 'Fl1', 'Fl2', 'Cl1', 'Cl1', 'S.D.', 'B.D.'] };
    const a = __app.canPlay(song, [{ main: 'Fl', subs: ['Pic'] }, { main: 'Fl', subs: [] }, { main: 'Fl', subs: [] }, { main: 'Cl', subs: [] }, { main: 'Cl', subs: [] }, { main: 'Perc', subs: [] }, { main: 'Perc', subs: [] }]);
    const b = __app.canPlay(song, [{ main: 'Fl', subs: [] }, { main: 'Fl', subs: ['Pic'] }, { main: 'Cl', subs: [] }, { main: 'Perc', subs: [] }]);
    return { a: a.miss, b: b.miss };
  });
  expect(r.a).toEqual([]);
  expect(r.b.sort()).toEqual(['B.D.', 'Cl1', 'Fl2'].sort());
  await page.click('[data-tab="can"]');
  await page.click('[data-src="manual"]');
  await expect(page.locator('#canSums')).toContainText('部員 32人');
  await page.locator('[data-c="Cl"]').fill('2');
  await page.locator('[data-c="Cl"]').press('Tab');
  await expect(page.locator('#canSums')).toContainText('部員 28人');
  await noErrors(errors);
});

test('演奏会の曲目一覧：選んだ順に並び、印刷できる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="setlist"]');
  await page.locator('#slPick label', { hasText: '星条旗よ永遠なれ' }).locator('input').check();
  await page.locator('#slPick label', { hasText: '宝島' }).locator('input').check();
  await expect(page.locator('#slOrder .item')).toHaveCount(2);
  await expect(page.locator('#slSum')).toContainText('2曲');
  await page.click('#slPrint');
  await expect(page.locator('.gky-pv .gky-page')).toHaveCount(1);
  await expect(page.locator('.gky-pv .gky-page')).toContainText('真島俊夫');
  await page.click('.gky-pv [data-act="close"]');
  await noErrors(errors);
});

test('CSVから取り込める（例は消えて、同じ曲名は足さない）', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="io"]');
  const csv = '﻿曲名,作曲,演奏時間,保管場所,手に入れ方,返却期限\r\nテスト序曲,山田,5:20,棚Z,レンタル,2027/1/5\r\nテスト序曲,山田,5:20,棚Z,,\r\n';
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnCsvIn');
  await (await chooser).setFiles({ name: 'list.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.waitForTimeout(300);
  const songs = await page.evaluate(() => __app.S.songs.map(s => [s.title, s.dur, s.source, s.rentDue]));
  expect(songs).toEqual([['テスト序曲', 320, 'rent', '2027-01-05']]);
  await noErrors(errors);
});

test('ステマネの演奏会から記録を足し、台帳にない曲も足せる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="io"]');
  const file = { app: 'stagemane', format: 1, concert: { info: { title: '春の演奏会', date: '2027-03-20' }, program: [{ id: 'a', type: 'piece', title: '宝島', dur: 280 }, { id: 'b', type: 'piece', title: '新しい曲A', composer: '作曲者A', dur: 200 }] } };
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnStagemane');
  await (await chooser).setFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => ({ t: __app.S.songs.find(s => s.title === '宝島').history[0], n: __app.S.songs.find(s => s.title === '新しい曲A') }));
  expect(r.t.date).toBe('2027-03-20');
  expect(r.n.dur).toBe(200);
  await noErrors(errors);
});

test('例を消して曲を入れると、楽屋に反映される', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#sbClear'); await page.click('#sbClear');
  await page.click('#btnAdd');
  await page.locator('#detail [data-k="title"]').fill('楽屋に送る曲');
  await page.locator('#detail [data-k="title"]').press('Tab');
  await page.waitForTimeout(700);
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')));
  expect(o.songs.map(s => s.title)).toEqual(['楽屋に送る曲']);
  await expect(page.locator('#syncBar')).toContainText('楽屋と同じ');
  await noErrors(errors);
});
