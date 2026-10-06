// ホーム画面に追加した「楽屋」のアプリの中（standalone）での動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('アプリの中では、前に開いていたツールへの「つづきから」が出て、ツールは同じ画面で開く', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true });
    try { localStorage.setItem('gakuya.ui', JSON.stringify({ lastTool: 'kouban' })); } catch (e) { /* about:blank */ }
  });
  const errors = await openApp(page);
  await expect(page.locator('#lastTool')).toHaveText('コウバンを開く');
  // ツールの札には target があるが、押すと同じ画面で開く（新しいタブにしない）
  const card = page.locator('#toolGrid a.tool[data-slug="gakufu"]');
  await expect(card).toHaveAttribute('target', 'gky-gakufu');
  const pages = page.context().pages().length;
  await card.click();
  await page.waitForURL(/\/gakufu\/$/);
  expect(page.context().pages().length).toBe(pages);
  await noErrors(errors.filter(e => !/404|Failed to load/.test(e)));
});

test('ふつうのブラウザでは「つづきから」は出さない', async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('gakuya.ui', JSON.stringify({ lastTool: 'kouban' })); } catch (e) { /* about:blank */ } });
  const errors = await openApp(page);
  await expect(page.locator('#toolGrid .sums')).toBeVisible();
  await expect(page.locator('#lastTool')).toHaveCount(0);
  await noErrors(errors);
});
