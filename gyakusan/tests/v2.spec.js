// 本番逆算スケジュール v2：団体の種類に合うひな形・平日にずらすかのはじめの値・新しいひな形
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

async function withType(page, type) {
  await page.addInitScript(t => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('gakuya.org', JSON.stringify({ org: { type: t } })); } }, type);
  return openApp(page);
}
async function newPlan(page, title, value) {
  await page.click('#btnPlan'); await page.click('#sNew');
  await page.locator('#nT').fill(title);
  if (value) await page.locator('#nK').selectOption(value);
  await page.click('.gky-sheet footer .btn.primary');
}

test('中学：学校行事・新入生歓迎のひな形が上に出る。保護者への案内はそのまま', async ({ page }) => {
  const errors = await withType(page, 'chu');
  await page.click('#btnPlan'); await page.click('#sNew');
  const groups = await page.locator('#nK optgroup').evaluateAll(xs => xs.map(g => [g.label, [...g.querySelectorAll('option')].map(o => o.value)]));
  expect(groups[0][0]).toBe('中学校向け');
  expect(groups[0][1]).toEqual(expect.arrayContaining(['concert', 'school', 'newcomer', 'contest']));
  expect(groups[0][1]).not.toContain('univ');
  await page.locator('#nT').fill('文化祭'); await page.locator('#nK').selectOption('school');
  await page.click('.gky-sheet footer .btn.primary');
  const p = await page.evaluate(() => ({ weekday: __app.P().weekday, names: __app.P().tasks.map(t => t.name) }));
  expect(p.weekday).toBe(true);
  expect(p.names).toContain('保護者への案内（公開のとき）');
  expect(p.names).toContain('体育館・ステージの配置（いす・譜面台の数）');
  await noErrors(errors);
});

test('大学：会場の抽選・広告集め・OB/OG への案内のある定期演奏会', async ({ page }) => {
  const errors = await withType(page, 'daigaku');
  await newPlan(page, '第50回定期演奏会', 'univ');
  const p = await page.evaluate(() => __app.P().tasks.map(t => [t.off, t.name, t.link]));
  const has = s => p.some(x => x[1].includes(s));
  ['会場の抽選', '広告集め', 'OB・OGへの案内', '次の代への引き継ぎ'].forEach(s => expect(has(s), s).toBe(true));
  expect(p.find(x => x[1] === '会計の報告')[2]).toBe('kaikei');
  await page.click('[data-tab="list"]');
  await expect(page.locator('body')).toContainText('会計を開く');
  await noErrors(errors);
});

test('一般の団体：土日・祝日の締め切りを前の平日にしない。「保護者への案内」は「団員への案内」', async ({ page }) => {
  const errors = await withType(page, 'ippan');
  await newPlan(page, '定期演奏会', 'concert');
  const p = await page.evaluate(() => ({ weekday: __app.P().weekday, names: __app.P().tasks.map(t => t.name) }));
  expect(p.weekday).toBe(false);
  expect(p.names).toContain('団員への案内（日程・お手伝い）');
  expect(p.names.some(n => n.includes('保護者'))).toBe(false);
  await expect(page.locator('#weekday')).not.toBeChecked();
  await noErrors(errors);
});

test('合宿のひな形：出欠・会計へのリンクつき', async ({ page }) => {
  const errors = await withType(page, 'koko');
  await newPlan(page, '夏合宿', 'camp');
  const links = await page.evaluate(() => [...new Set(__app.P().tasks.map(t => t.link).filter(Boolean))]);
  expect(links).toEqual(expect.arrayContaining(['shukketsu', 'kaikei', 'hannyu']));
  await noErrors(errors);
});

test('見るだけのリンク：本番までのスケジュールを、担当でしぼって見られる（直せない・保存しない）', async ({ page }) => {
  const errors = await openApp(page);
  const info = await page.evaluate(async () => { const p = __app.P(); p.tasks.filter(t => !t.done && !t.who).slice(-3).forEach(t => { t.who = '会計係'; }); return { url: await GKY.shareUrl('gyakusan', __app.sharePayload(p)), n: p.tasks.filter(t => !t.done).length, who: p.tasks.find(t => t.who && !t.done).who }; });
  await page.evaluate(() => localStorage.clear());
  await page.goto('about:blank');
  await page.goto('/index.html?test' + info.url.slice(info.url.indexOf('#')));
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-viewer')).toContainText('見るだけ');
  await expect(page.locator('#vwMonths .task')).toHaveCount(info.n);
  await expect(page.locator('#vwMonths input')).toHaveCount(0);
  await page.locator('#vwWho').selectOption(info.who);
  const n2 = await page.locator('#vwMonths .task').count();
  expect(n2).toBeLessThan(info.n);
  await expect(page.locator('#vwMonths')).toContainText('担当 ' + info.who);
  expect(await page.evaluate(() => localStorage.getItem('gyakusan.v1'))).toBeNull();
  await noErrors(errors);
});
