// 練習の道具・見せ方・タッチ操作
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');

async function advanceIn(page, ms) {
  return page.evaluate(async ms => { const D = __db; const t0 = D.ui.t; document.querySelector('#bPlay').click(); await new Promise(r => setTimeout(r, ms)); const t1 = D.ui.t; document.querySelector('#bPlay').click(); return t1 - t0; }, ms);
}

test('再生の速さ：75%ではゆっくり進む', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => __db.goSet(1));
  const full = await advanceIn(page, 1000);
  await page.evaluate(() => { __db.setSpeed(0.75); __db.goSet(1); });
  const slow = await advanceIn(page, 1000);
  expect(slow / full).toBeGreaterThan(0.6);
  expect(slow / full).toBeLessThan(0.9);
  await expect(page.locator('#speed')).toHaveValue('0.75');
  await noErrors(errors);
});

test('区間ループ：セットAに着いたところからBに着くまで', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db; D.setLoop(1, 3); const T = D.tl(); return { pr:D.playRange(), want:[T[1].arrive, T[3].arrive], t:D.ui.t }; });
  expect(r.pr).toEqual(r.want);
  expect(r.t).toBe(r.want[0]);
  // 終わりまで行くと、少し止まってから最初にもどる
  const back = await page.evaluate(async () => { const D = __db, [a, b] = D.playRange(); D.ui.t = b - 1; document.querySelector('#bPlay').click(); await new Promise(r => setTimeout(r, 2200)); const t = D.ui.t; document.querySelector('#bPlay').click(); return { t, a, b }; });
  expect(back.t).toBeGreaterThanOrEqual(back.a);
  expect(back.t).toBeLessThan(back.a + 4);
  await page.evaluate(() => __db.setLoop(null));
  expect(await page.evaluate(() => __db.ui.loopAB)).toBeNull();
});

test('カウントイン：再生の前に1小節止まったまま数える', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(async () => { const D = __db; D.ui.countIn = true; D.goSet(1); const t0 = D.ui.t; document.querySelector('#bPlay').click(); await new Promise(r => setTimeout(r, 400)); const mid = { t:D.ui.t, hud:document.querySelector('#hud').textContent }; document.querySelector('#bPlay').click(); return { t0, mid }; });
  expect(r.mid.t).toBe(r.t0);
  expect(r.mid.hud).toContain('カウントイン');
});

test('1カウントずつ進む・戻る（ボタンとキー）', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => { __db.goSet(1); __db.ui.sel.clear(); });
  const t0 = await page.evaluate(() => __db.ui.t);
  await page.click('#bStepF');
  expect(await page.evaluate(() => __db.ui.t)).toBe(t0 + 1);
  await page.locator('#cv').click({ position:{ x:5, y:5 } });   // フィールドの空いた所（選択を外す）
  await page.keyboard.press('.');
  expect(await page.evaluate(() => __db.ui.t)).toBe(t0 + 2);
  await page.keyboard.press(',');
  expect(await page.evaluate(() => __db.ui.t)).toBe(t0 + 1);
});

test('演奏者から見た向き：画面と世界の座標が行き来できて、180°回っている', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => { const D = __db; const a0 = D.w2s(3, 4); D.setFlip(true); const a = D.w2s(3, 4), b = D.s2w(...a), c = D.w2s(0, 0); D.setFlip(false); return { a0, a, b, c }; });
  expect(r.b[0]).toBeCloseTo(3, 6); expect(r.b[1]).toBeCloseTo(4, 6);
  expect(r.a[0]).toBeLessThan(r.c[0]);   // 右（+x）が画面の左に
  expect(r.a[1]).toBeGreaterThan(r.c[1]); // 後ろ（+y）が画面の下に
});

test('大画面：フィールドと大きなカウントだけになり、Esc でもどる', async ({ page }) => {
  await openApp(page);
  await page.click('#bBig');
  await expect(page.locator('body')).toHaveClass(/big/);
  await expect(page.locator('#bigCount')).toBeVisible();
  await expect(page.locator('.side')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/big/);
});

test('タッチ：2本指で広げると拡大し、隊員は動かない', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport:{ width:820, height:1180 }, hasTouch:true, isMobile:true });
  const page = await ctx.newPage();
  await openApp(page);
  const cdp = await ctx.newCDPSession(page);
  const bb = await page.locator('#cv').boundingBox(), cx = bb.x + bb.width / 2, cy = bb.y + bb.height / 2;
  const before = await page.evaluate(() => ({ s:__db.view.scale, pos:JSON.stringify(__db.S.sets[0].pos) }));
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x:cx - 40, y:cy, id:1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x:cx - 50, y:cy, id:1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x:cx - 50, y:cy, id:1 }, { x:cx + 40, y:cy, id:2 }] });
  for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x:cx - 50 - k * 12, y:cy, id:1 }, { x:cx + 40 + k * 12, y:cy, id:2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
  const after = await page.evaluate(() => ({ s:__db.view.scale, pos:JSON.stringify(__db.S.sets[0].pos) }));
  expect(after.s).toBeGreaterThan(before.s * 1.5);
  expect(after.pos).toBe(before.pos);
  await ctx.close();
});
