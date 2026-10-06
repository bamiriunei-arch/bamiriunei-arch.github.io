// テストで使う共通の道具
// index.html を「?test」付きで開くと、アプリの中身を window.__app から触れるようになります（ふだんは出てきません）
const { expect } = require('@playwright/test');

async function openApp(page, query = '?test') {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g|net::ERR|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  // 文字のフォントは読みに行かない（テストを速く、ネットの調子に左右されないようにする）
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('/index.html' + query);
  await page.waitForFunction(() => window.__app && window.__app.ready);
  return errors;
}

async function noErrors(errors) { expect(errors, errors.join('\n')).toEqual([]); }

// ページの横はみ出し（スマホで横に動いてしまう）がないか
async function noSideScroll(page) {
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(w[0], 'ページが横にはみ出しています').toBeLessThanOrEqual(w[1] + 1);
}

module.exports = { openApp, noErrors, noSideScroll, expect };
