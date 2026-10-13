// ステマネ v3：楽譜ライブラリの曲目一覧から、プログラムの「曲」に入れる
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const GAKUFU = { v: 1, songs: [
  { id: 's1', title: '宝島', composer: '和泉宏隆', arranger: '真島俊夫', dur: 270 },
  { id: 's2', title: 'ふるさと', composer: '岡野貞一', dur: 180 },
  { id: 's3', title: 'ディズニー・メドレー', arranger: '森田一浩', dur: 420, medley: [{ title: 'ミッキーマウス・マーチ' }, { title: '星に願いを' }] },
  { id: 's4', title: 'ジュビラント序曲', composer: 'A.リード', dur: 360 },
  { id: 's5', title: 'たなばた', composer: '酒井格', dur: 420 } ],
  setlists: [{ id: 'l0', title: '別の演奏会', date: '2026-08-01', ids: ['s2'] }, { id: 'l1', title: '定演の曲目', date: '2026-12-20', ids: ['s1', 's2', 's3', 's4', 's5'] }] };

test('曲目一覧の曲を、空の「曲」の札に順に入れ、足りない分は最後の曲のあとに足す。元に戻せる', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(g => localStorage.setItem('gakufu.v1', JSON.stringify(g)), GAKUFU);
  await page.evaluate(() => { const n = __app.blankConcert(); n.info.title = '定期演奏会'; n.info.date = '2026-12-20'; __app.addConcert(n); });
  await page.click('[data-etab="program"]');
  const before = await page.evaluate(() => __app.C.program.filter(x => x.type === 'piece').length);
  expect(before).toBe(4);   // ひな形の空の曲の札
  await page.click('[data-act="from-setlist"]');
  const sh = page.locator('.gky-sheet', { hasText: '楽譜ライブラリの曲目一覧から' });
  await expect(sh.locator('.item').first()).toContainText('定演の曲目');
  await expect(sh.locator('.item').first()).toContainText('この本番');
  await sh.locator('footer .btn.primary').click();
  const ps = await page.evaluate(() => __app.C.program.filter(x => x.type === 'piece').map(x => [x.title, x.composer, x.arranger, x.dur, x.parts.map(p => p.title).join('・')]));
  expect(ps).toEqual([
    ['宝島', '和泉宏隆', '真島俊夫', 270, ''], ['ふるさと', '岡野貞一', '', 180, ''], ['ディズニー・メドレー', '', '森田一浩', 420, 'ミッキーマウス・マーチ・星に願いを'],
    ['ジュビラント序曲', 'A.リード', '', 360, ''], ['たなばた', '酒井格', '', 420, ''] ]);
  // 最後の曲は、4つ目の曲のすぐあと
  const order = await page.evaluate(() => { const P = __app.C.program; const i = P.findIndex(x => x.title === 'ジュビラント序曲'); return P[i + 1].title; });
  expect(order).toBe('たなばた');
  // もう入っている曲は入れない
  await page.click('[data-act="from-setlist"]');
  await page.locator('.gky-sheet footer .btn.primary').click();
  await expect(page.locator('#toast')).toContainText('入れる曲がありません');
  await page.locator('.gky-sheet footer .btn', { hasText: 'やめる' }).click();
  // 元に戻す
  await page.click('#btnUndo');
  expect(await page.evaluate(() => __app.C.program.filter(x => x.type === 'piece' && x.title).length)).toBe(0);
  await noErrors(errors);
});

test('楽譜ライブラリに曲目一覧がなければ、ボタンは出ない', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-etab="program"]');
  await expect(page.locator('[data-act="from-setlist"]')).toHaveCount(0);
  await noErrors(errors);
});
