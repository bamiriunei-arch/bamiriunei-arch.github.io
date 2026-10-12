// 音源：この端末に覚える・URL から読む・音源込みファイル・カウントインの前奏・クリック
const path = require('path');
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');
const WAV = path.join(__dirname, 'fixtures', 'click120.wav');

test('音源を選ぶと、この端末に覚えて、開き直しても付いている', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => __db.openTab('aud'));
  await page.locator('input[data-audio="0"]').setInputFiles(WAV);
  await expect.poll(() => page.evaluate(() => !!(__db.ui.audios[0] && __db.ui.audios[0].stored)), { timeout:15000 }).toBe(true);
  await page.waitForTimeout(600);
  await page.reload();
  await page.waitForFunction(() => window.__db && window.__db.S);
  await expect.poll(() => page.evaluate(() => __db.ui.audios[0] && __db.ui.audios[0].name)).toBe('click120.wav');
  await page.evaluate(() => __db.openTab('aud'));
  await expect(page.locator('.audwave')).toBeVisible();
  await noErrors(errors);
});

test('音源のURLを書くと、共有リンクで開いた別の端末でもそこから読む', async ({ page, browser }) => {
  await openApp(page);
  const code = await page.evaluate(async () => { const D = __db; D.pushHist(); D.S.songs[0].url = 'tests/fixtures/click120.wav'; D.changed(true); return D.makeCode(D.S); });
  const ctx = await browser.newContext(), p2 = await ctx.newPage();
  await p2.goto('/index.html?test#d=' + code);
  await p2.waitForFunction(() => window.__db && window.__db.S);
  if (await p2.locator('#askModal').isVisible()) await p2.click('[data-askv="open"]');
  await expect.poll(() => p2.evaluate(() => { const A = __db.ui.audios[0]; return A && A.remote && Number.isFinite(A.el.duration) && A.el.duration > 7; }), { timeout:15000 }).toBe(true);
  await ctx.close();
});

test('音源込みのファイルで、音源ごと開ける', async ({ page, browser }) => {
  await openApp(page);
  await page.evaluate(() => __db.openTab('aud'));
  await page.locator('input[data-audio="0"]').setInputFiles(WAV);
  await expect.poll(() => page.evaluate(() => !!__db.ui.audios[0])).toBe(true);
  const text = await page.evaluate(async () => (await __db.makePack()).text);
  const ctx = await browser.newContext(), p2 = await ctx.newPage();
  await p2.goto('/index.html?test'); await p2.waitForFunction(() => window.__db && window.__db.S);
  const r = await p2.evaluate(async t => { const ok = await __db.openPack(t); return { ok, name:__db.ui.audios[0] && __db.ui.audios[0].name }; }, text);
  expect(r).toEqual({ ok:true, name:'click120.wav' });
  await ctx.close();
});

test('カウントインのあいだ、音源の前の小節が鳴っている', async ({ browser }) => {
  const ctx = await browser.newContext(), page = await ctx.newPage();
  await openApp(page);
  await page.evaluate(() => __db.openTab('aud'));
  await page.locator('input[data-audio="0"]').setInputFiles(WAV);
  await expect.poll(() => page.evaluate(() => !!(__db.ui.audios[0] && __db.ui.audios[0].el.duration > 0))).toBe(true);
  const r = await page.evaluate(async () => { const D = __db; D.ui.countIn = true; D.ui.ciMusic = true; D.goSet(1); const t0 = D.ui.t; document.querySelector('#bPlay').click();
    await new Promise(r => setTimeout(r, 700)); const A = D.ui.audios[0]; const mid = { ci:!!D.ui.ciUntil, t:D.ui.t, playing:!A.el.paused };
    document.querySelector('#bPlay').click(); return { t0, mid }; });
  expect(r.mid.ci).toBe(true);
  expect(r.mid.t).toBe(r.t0);
  await ctx.close();
});

test('クリック：裏拍・小節の頭', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => { const D = __db; D.ui.clickSub = true; const a = D.firstClick(3.2), b = D.nextClickAfter(a); D.ui.clickSub = false; D.ui.clickAccent = true; const T = D.tl(), g0 = 0;
    const acc = [1, 2, 3, 4, 5].map(n => D.clickAccentAt(n)); D.ui.clickAccent = false; return { a, b, acc }; });
  expect(r.a).toBe(3.5); expect(r.b).toBe(4);
  expect(r.acc).toEqual([true, false, false, false, true]);
});
