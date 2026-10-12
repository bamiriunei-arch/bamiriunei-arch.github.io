// テストで使う共通の道具
// index.html を「?test」付きで開くと、アプリの中身を window.__db から触れるようになります（ふだんは出てきません）
const { expect } = require('@playwright/test');

async function openApp(page, query = '?test') {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('/index.html' + query);
  if (query.includes('test')) await page.waitForFunction(() => window.__db && window.__db.S);
  return errors;
}

// テスト用のショー：サンプルに練習番号・メモ・接触しない動きを足したもの
async function loadFixture(page, type = 'square') {
  await page.evaluate(t => {
    const D = window.__db; const sh = D.sampleShow(t);
    sh.title = 'テスト用ショー';
    sh.sets[1].note = 'ここで楽器を構える';
    D.S = D.normalize(sh); D.afterLoad(true);
  }, type);
}

async function noErrors(errors) { expect(errors, errors.join('\n')).toEqual([]); }

module.exports = { openApp, loadFixture, noErrors, expect };
