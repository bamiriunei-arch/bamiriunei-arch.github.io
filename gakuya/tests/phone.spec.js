// スマホの幅（390px）で、どの画面も横にはみ出さない。部員の表は1人1枚の札になる
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で全部の画面が横にはみ出さない', async ({ page }) => {
  const errors = await openApp(page);
  const ms = []; for (let i = 0; i < 30; i++) ms.push({ id: 'm' + i, name: '部員' + i, grade: '中' + (1 + i % 3), part: ['Fl', 'Cl', 'Tp'][i % 3], roles: i ? [] : ['部長'] });
  await page.evaluate(ms => localStorage.setItem('gakuya.org', JSON.stringify({ app: 'gakuya', org: { name: 'スマホ中学校吹奏楽部', type: 'chu' }, members: ms })), ms);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  for (const t of ['tools', 'concerts', 'members', 'org', 'notice', 'links', 'backup']) {
    await page.click(`[data-tab="${t}"]`);
    await expect(page.locator(`[data-panel="${t}"]`)).toBeVisible();
    await noSideScroll(page);
  }
  // 本番のカレンダー・当日の画面
  await page.evaluate(() => { const o = GKY.org(); GKY.saveOrg('concerts', [{ id: 'c1', title: 'とても長い名前の本番（第20回 定期演奏会 〜春の訪れ〜）', date: GKY.ymd(), start: '14:00', venue: '市民会館 大ホール', day: { meet: '09:00', meetPlace: '市民会館の楽屋口（北側の通用口）', tt: [['9:00', '集合・楽器の搬入とステージの準備・音出し']], items: ['楽器・マウスピース・リード・楽譜'], jobs: [['楽器運搬', '2年 全員と保護者会の方']] } }]); });
  await page.click('[data-tab="concerts"]');
  await page.click('#cView [data-v="cal"]');
  await expect(page.locator('#cList .calm').first()).toBeVisible();
  await noSideScroll(page);
  await page.click('#cView [data-v="month"]');
  await page.click('[data-tab="tools"]');
  await page.click('[data-dayopen="c1"]');
  await expect(page.locator('.gky-sheet .dmeet')).toBeVisible();
  await noSideScroll(page);
  await page.keyboard.press('Escape');
  // 部員：見出しの行は出さず、1人ずつの札（名前の欄に見出し）
  await page.click('[data-tab="members"]');
  await expect(page.locator('#mTable thead')).toBeHidden();
  const tr = page.locator('#mTable tbody tr').first();
  expect(await tr.evaluate(el => getComputedStyle(el).display)).toBe('grid');
  // ツールの一覧は2列
  await page.click('[data-tab="tools"]');
  const xs = await page.locator('.tool').evaluateAll(els => els.slice(0, 2).map(e => Math.round(e.getBoundingClientRect().top)));
  expect(xs[0]).toBe(xs[1]);
  await noErrors(errors);
});
