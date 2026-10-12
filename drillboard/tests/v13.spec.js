// v13：楽屋（同じ場所の楽屋シリーズ）の部員を隊員に・ファイル置き場の録音を音源に（ドリルボードの音源もファイル置き場へ）
const path = require('path');
const fs = require('fs');
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');
const WAV = path.join(__dirname, 'fixtures', 'click120.wav');

const ORG = { org: { name: 'テスト高校', type: 'koko' }, members: [
  { id: 'a', name: '赤井 一郎', part: 'Tp', status: 'active' }, { id: 'b', name: '石田 花', part: 'A.Sax', status: 'active' },
  { id: 'c', name: '上野 空', part: 'Hn', status: 'active' }, { id: 'd', name: '江口 海', part: 'Mar', status: 'extra' },
  { id: 'e', name: '大野 陸', part: 'Euph', status: 'semi' }, { id: 'f', name: '加藤 森', part: 'Ob', status: 'active' },
] };

test('楽屋の部員を、名簿の欄に入れてまとめて隊員にする（仮引退の人は入れない・いる人はのぞく・名字だけも）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), ORG);
  await page.evaluate(() => { const D = __db; D.S = D.normalize(D.emptyShow('square')); D.afterLoad(true); D.setMode('edit'); D.ui.rosterOpen = true; D.openTab('perf'); });
  await expect(page.locator('[data-act="fromGakuya"]').first()).toHaveText('楽屋の部員（5人）を入れる');
  await page.locator('[data-act="fromGakuya"]').first().click();
  await expect(page.locator('#rosterIn')).toHaveValue('赤井 一郎\tトランペット\n石田 花\tアルトサックス\n上野 空\tホルン\n江口 海\tピット（鍵盤・フロント）\n加藤 森\tその他');
  await expect(page.locator('#rosterPrev')).toContainText('5人を読み取りました');
  await page.click('[data-act="addRoster"]');
  const ps = await page.evaluate(() => __db.S.performers.map(p => [p.label, p.sec]));
  expect(ps).toEqual([['赤井 一郎', 'Tp'], ['石田 花', 'As'], ['上野 空', 'Hr'], ['江口 海', 'Pit'], ['加藤 森', 'Ot']]);
  // もう一度：全員いる
  await page.evaluate(() => { __db.ui.rosterOpen = true; __db.renderSide(); });
  await page.locator('[data-act="fromGakuya"]').first().click();
  await expect(page.locator('#toast')).toContainText('もう全員が隊員にいます');
  // 名字だけ（別のショーで）
  await page.evaluate(() => { const D = __db; D.S = D.normalize(D.emptyShow('square')); D.afterLoad(true); D.setMode('edit'); D.ui.rosterOpen = true; D.ui.rosterText = ''; D.openTab('perf'); });
  await page.click('[data-act="fromGakuya"][data-short="1"]');
  await expect(page.locator('#rosterIn')).toHaveValue(/^赤井\tトランペット\n石田\tアルトサックス/);
  await noErrors(errors);
});

test('楽屋に部員がいないときは、ボタンを出さない', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { const D = __db; D.S = D.normalize(D.emptyShow('square')); D.afterLoad(true); D.setMode('edit'); D.ui.rosterOpen = true; D.openTab('perf'); });
  await expect(page.locator('#rosterIn')).toBeVisible();
  await expect(page.locator('[data-act="fromGakuya"]')).toHaveCount(0);
  await noErrors(errors);
});

test('ファイル置き場の録音（テンポマップの録音）を音源に選べる。ドリルボードで選んだ音源はファイル置き場に入る', async ({ page }) => {
  const errors = await openApp(page);
  // テンポマップで録った録音を、ファイル置き場に入れておく
  const b64 = fs.readFileSync(WAV).toString('base64');
  await page.evaluate(async b64 => { const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], '自由曲_2026-10-09_1600.wav', { type: 'audio/wav' }); await __db.gmPut(f, { from: 'tempomap', mapTitle: '自由曲', dur: 8, at: new Date('2026-10-09T16:00:00').getTime() }); }, b64);
  await page.evaluate(() => __db.openTab('aud'));
  await page.locator('[data-act="gmPick"][data-k="0"]').click();
  const m = page.locator('#askModal');
  await expect(m.locator('#askTitle')).toContainText('の音源を選ぶ');
  await expect(m.locator('.gmitem')).toHaveCount(1);
  await expect(m.locator('.gmitem')).toContainText('自由曲');
  await expect(m.locator('.gmitem')).toContainText('テンポマップ');
  await m.locator('.gmitem').click();
  await expect.poll(() => page.evaluate(() => __db.ui.audios[0] && __db.ui.audios[0].name)).toBe('自由曲_2026-10-09_1600.wav');
  await expect.poll(() => page.evaluate(() => !!(__db.ui.audios[0] && __db.ui.audios[0].stored)), { timeout: 15000 }).toBe(true);
  expect(await page.evaluate(async () => (await __db.gmList()).length)).toBe(1);   // 置き場から選んだものは、2つ入れない
  // ドリルボードで選んだ音源 → ファイル置き場に入る（合奏ノートなどから選べる）
  await page.locator('input[data-audio="0"]').setInputFiles(WAV);
  await expect.poll(() => page.evaluate(async () => (await __db.gmList()).map(m => [m.name, m.from]))).toEqual([['click120.wav', 'drillboard'], ['自由曲_2026-10-09_1600.wav', 'tempomap']]);
  await noErrors(errors);
});
