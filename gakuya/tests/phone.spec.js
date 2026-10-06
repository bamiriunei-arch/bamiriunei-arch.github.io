// スマホの幅（390px）で、どの画面も横にはみ出さない。部員の表は1人1枚の札になる
const { test } = require('@playwright/test');
const { openApp, noErrors, noSideScroll, expect } = require('./helpers');

test('スマホの幅で全部の画面が横にはみ出さない', async ({ page }) => {
  const errors = await openApp(page);
  const ms = []; for (let i = 0; i < 30; i++) ms.push({ id: 'm' + i, name: '部員' + i, grade: '中' + (1 + i % 3), part: ['Fl', 'Cl', 'Tp'][i % 3], roles: i ? [] : ['部長'] });
  await page.evaluate(ms => localStorage.setItem('gakuya.org', JSON.stringify({ app: 'gakuya', org: { name: 'スマホ中学校吹奏楽部', type: 'chu' }, members: ms })), ms);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  for (const t of ['tools', 'members', 'org', 'links', 'backup']) {
    await page.click(`[data-tab="${t}"]`);
    await expect(page.locator(`[data-panel="${t}"]`)).toBeVisible();
    await noSideScroll(page);
  }
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
