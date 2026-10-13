// 楽屋 v8：年度末・年度はじめにやることを「いまの名簿の年度」に合わせる・部員用の端末を代表者・顧問用にもどせなくする
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const setOrg = (page, o) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(Object.assign({ app: 'gakuya' }, o))), o);
const org = page => page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org') || '{}'));
const reopen = async page => { await page.goto('/index.html?test'); await page.waitForFunction(() => window.__app && window.__app.ready); };
const BASE = { org: { name: 'テスト中学校 吹奏楽部', type: 'chu' }, members: [{ id: 'm1', name: '山田 花子', part: 'Cl', grade: '中2', status: 'active' }] };
const MEMBER = { org: { name: 'テスト中学校 吹奏楽部', type: 'chu', year: 2026, role: 'member', member: { tools: ['gassou', 'shukketsu'], at: '2026-10-01' } }, members: [{ id: 'm1', name: '山田 花子', part: 'Cl', grade: '中2', status: 'active' }] };

test('年度末・年度はじめにやること：「いまの名簿の年度」を変えると、見出しと済んだ印もその年度になる', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-03-10T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, BASE, { org: Object.assign({}, BASE.org, { year: 2026 }) }));
  await reopen(page);
  await page.click('[data-tab="org"]');
  const box = page.locator('#yeBox');
  await expect(box).toContainText('2026年度 → 2027年度');
  await box.locator('[data-yeck="kaikei"]').check();
  expect(await page.evaluate(() => Object.keys(GKY.pref('yearEnd')))).toEqual(['2026']);
  // 年度を 2025 に変えると、2025年度のリスト（済んだ印はまだない）
  await page.locator('#oYear').fill('2025'); await page.locator('#oYear').press('Tab');
  await expect(box).toContainText('2025年度 → 2026年度');
  await expect(box.locator('[data-yeck="kaikei"]')).not.toBeChecked();
  // もどすと 2026年度の印が出る
  await page.locator('#oYear').fill('2026'); await page.locator('#oYear').press('Tab');
  await expect(box).toContainText('2026年度 → 2027年度');
  await expect(box.locator('[data-yeck="kaikei"]')).toBeChecked();
  await noErrors(errors);
});

test('年度末・年度はじめにやること：進級したばかりなら進級の前の年度のまま。半年たてば新しい年度', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-04-05T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, BASE, { org: Object.assign({}, BASE.org, { year: 2027, promoted: { to: 2027, at: '2027-03-25' } }) }));
  await reopen(page);
  expect(await page.evaluate(() => __app.yeFy(GKY.org()))).toBe(2026);
  await page.click('[data-tab="org"]');
  await expect(page.locator('#yeBox')).toContainText('2026年度 → 2027年度');
  await expect(page.locator('#yeBox .first.done', { hasText: '進級させる' })).toHaveCount(1);
  expect(await page.evaluate(() => __app.yeFy(GKY.org(), new Date('2028-02-20T10:00:00')))).toBe(2027);
  // 年度を入れていなければ、今までどおり今日の日付から（4月は前の年度）
  await setOrg(page, BASE); await reopen(page);
  expect(await page.evaluate(() => __app.yeFy(GKY.org()))).toBe(2026);
  await noErrors(errors);
});

test('部員用の端末：もどすボタンと「この端末の団体」はない。データをすべて消しても部員用のまま', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, MEMBER);
  await page.evaluate(() => localStorage.setItem('kouban.v1', '{"v":1}'));
  await reopen(page);
  await expect(page.locator('html')).toHaveAttribute('data-role', 'member');
  await page.click('[data-tab="org"]');
  await expect(page.locator('#meStaff')).toHaveCount(0);
  await expect(page.locator('#profList')).toBeHidden();
  await expect(page.locator('#profNew')).toBeHidden();
  await page.click('[data-tab="backup"]');
  await page.click('#wipeAll');
  await expect(page.locator('.gky-sheet')).toContainText('部員用のまま');
  await page.click('#wipeGo');
  await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
  await page.waitForFunction(() => window.__app && window.__app.ready);
  const o = await org(page);
  expect([o.org.name, o.org.role, o.org.year, o.org.member.tools.join()]).toEqual(['テスト中学校 吹奏楽部', 'member', 2026, 'gassou,shukketsu']);
  expect(o.members || []).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('kouban.v1'))).toBeNull();
  await expect(page.locator('html')).toHaveAttribute('data-role', 'member');
  await noErrors(errors);
});

test('部員用の端末：代表者・顧問用のバックアップから戻しても、部員用のまま', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, MEMBER);
  await reopen(page);
  const file = { app: 'gakuya-backup', format: 1, exportedAt: '2026-10-01T00:00:00Z', keys: { 'gakuya.org': JSON.stringify({ app: 'gakuya', org: { name: 'テスト中学校 吹奏楽部', type: 'chu', role: 'staff' }, members: [{ id: 'x', name: '顧問のデータ', part: 'Tp' }] }), 'kouban.v1': '{"v":1}' } };
  await page.click('[data-tab="backup"]');
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bkLoad')]);
  await fc.setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('html')).toHaveAttribute('data-role', 'member');
  const o = await org(page);
  expect([o.org.role, o.org.member.tools.join(), o.members.map(m => m.name).join()]).toEqual(['member', 'gassou,shukketsu', '顧問のデータ']);
  await noErrors(errors);
});

test('楽器決めの「楽屋の名簿を開く」：#members で部員のタブが開く', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, BASE);
  await page.goto('/index.html?test#members'); await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('[data-tab="members"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#mLead')).toContainText('楽器決めの新しい部員に出ます');
  await noErrors(errors);
});
