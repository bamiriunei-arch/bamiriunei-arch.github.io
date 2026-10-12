// 印刷・PDF：コンテ（1セット1ページ）と隊員ごとのドットシート
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');

test('コンテ：全部のセットが1ページずつ、右側にカウントとメモ', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(async () => { const r = await __db.doPrint('conte', { range:'all', paths:true, paper:true, noPrint:true }); return { n:r.n, sets:__db.S.sets.length, pages:document.querySelectorAll('#printArea .pp.conte').length }; });
  expect(r.pages).toBe(r.sets);
  await expect(page.locator('#printArea .cp-note').nth(1)).toContainText('ここで楽器を構える');
  await page.emulateMedia({ media:'print' });
  const pdf = await page.pdf({ format:'A4', landscape:true, printBackground:true, preferCSSPageSize:true });
  expect(pdf.length).toBeGreaterThan(10000);
  await noErrors(errors);
});

test('ドットシート：1人1ページ・QRコード付き・位置の言い方を選べる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(async () => {
    const D = __db; D.ui.focus = D.S.performers[0].id;
    const one = await D.doPrint('sheet', { who:'one', fmt:'ctr', qr:true, mini:true, noPrint:true });
    const txt = document.querySelector('#printArea').textContent;
    const all = await D.doPrint('sheet', { who:'all', fmt:'pt', qr:false, noPrint:true });
    return { one:one.n, all:all.n, n:D.S.performers.length, ctr:txt.includes('センターから'), qr:true };
  });
  expect(r.one).toBe(1);
  expect(r.all).toBe(r.n);
  expect(r.ctr).toBe(true);
});
