// 搬入出リスト v2：見るだけのリンク（担当・車でしぼって、自分の端末でチェック）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('見るだけのリンク：担当でしぼってチェックでき、チェックはその端末だけに残る', async ({ page }) => {
  const errors = await openApp(page);
  const info = await page.evaluate(async () => {
    const t = __app.T(), who = t.items.find(i => i.who).who;
    return { url: await GKY.shareUrl('hannyu', __app.sharePayload(t)), who, mine: t.items.filter(i => i.who === who).length };
  });
  expect(info.url).toContain('#v=');   // 公開ページでは …/hannyu/#v=…
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto('/index.html?test' + info.url.slice(info.url.indexOf('#')));
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-viewer')).toContainText('見るだけ');
  await expect(page.locator('.gky-tabs')).toBeHidden();
  await page.locator('#vwWho').selectOption(info.who);
  await expect(page.locator('#vwList .crow')).toHaveCount(info.mine);
  await page.locator('#vwList .crow').first().click();
  await expect(page.locator('#vwList .crow.on')).toHaveCount(1);
  await expect(page.locator('#vwPh [data-ph="load1"]')).toContainText(`1 / ${info.mine}`);
  // 開き直しても、担当としぼりとチェックが残る（ふだんの台帳 hannyu.v1 には書かない）
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('#vwWho')).toHaveValue(info.who);
  await expect(page.locator('#vwList .crow.on')).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem('hannyu.v1'))).toBeNull();
  // 帰りの段階に切りかえ
  await page.locator('#vwPh [data-ph="load2"]').click();
  await expect(page.locator('#vwPh [data-ph="load2"]')).toHaveAttribute('aria-pressed', 'true');
  await noErrors(errors);
});

test('リンクを作る画面に、QRコードが出る', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="out"]');
  await page.click('#shareView');
  await expect(page.locator('.gky-sheet .gky-share textarea')).toHaveValue(/#v=/);
  await expect(page.locator('.gky-sheet .gky-share svg')).toBeVisible();
  await noErrors(errors);
});
