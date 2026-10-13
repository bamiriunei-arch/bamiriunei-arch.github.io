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

test('カレンダー：行事・休みを期間つきで入れると、1年の表と月の表に色の帯で出る。印刷・.ics にも入り、消せる', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, BASE, { concerts: [{ id: 'c1', title: '定期演奏会', date: '2026-10-31', start: '14:00', kind: 'concert' }] }));
  await reopen(page);
  await page.click('[data-tab="cal"]');
  await expect(page.locator('#calYearG .ym')).toHaveCount(12);
  await expect(page.locator('#calSum')).toContainText('2026年4月〜2027年3月　本番 1');
  await page.click('#calAdd');
  await page.locator('#yT').fill('2学期 期末テスト');
  await page.selectOption('#yK', 'test');
  await page.locator('#yD').fill('2026-11-20'); await page.locator('#yE').fill('2026-11-27');
  await page.click('.gky-sheet footer .btn.primary');
  // 1年の表：期間の日に色。月の表は11月になる
  await expect(page.locator('#calYearG td[data-day="2026-11-23"]')).toHaveClass(/b-test/);
  await expect(page.locator('#calYearG td[data-day="2026-11-28"]')).not.toHaveClass(/b-test/);
  await expect(page.locator('#calMonthSec')).toContainText('11月');
  await expect(page.locator('#calMonthSec td[data-day="2026-11-20"] .ev')).toHaveText(['2学期 期末テスト']);   // 名前ははじまりの日と日曜だけ
  await expect(page.locator('#calMonthSec td[data-day="2026-11-21"] .ev')).toHaveCount(0);
  await expect(page.locator('#calMonthSec td[data-day="2026-11-22"] .ev')).toHaveCount(1);
  await expect(page.locator('#calMonthSec .agenda .ar')).toHaveCount(1);
  await expect(page.locator('#calMonthSec .agenda')).toContainText('（〜11/27（金））');
  await expect(page.locator('#calEvSec .er')).toContainText('11/20（金）〜11/27（金）');
  // 月を行き来する
  await page.click('#calMP');
  await expect(page.locator('#calMonthSec td[data-day="2026-10-31"] .ev')).toHaveText(['定期演奏会']);
  // .ics：期間は1つの終日の予定
  const ics = await page.evaluate(async () => { let out = ''; const sf = GKY.saveFile; GKY.saveFile = async (n, d) => { out = d; return true; }; document.querySelector('#calIcs').click(); await new Promise(r => setTimeout(r, 100)); GKY.saveFile = sf; return out; });
  expect(ics.split('SUMMARY:2学期 期末テスト').length - 1).toBe(1);
  expect(ics).toContain('DTSTART;VALUE=DATE:20261120');
  expect(ics).toContain('DTEND;VALUE=DATE:20261128');
  // 印刷（1年を1枚）に入る
  await page.click('#calPrint'); await page.click('[data-cp="year"]');
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('20日〜27日 2学期 期末テスト');
  await page.click('.gky-pv [data-act="close"]');
  // 行事・休みを切るとかくれる
  await page.locator('[data-layer="calEv"]').uncheck();
  await expect(page.locator('#calYearG td[data-day="2026-11-23"]')).not.toHaveClass(/b-test/);
  await page.locator('[data-layer="calEv"]').check();
  // 消す（元に戻せる）
  await page.locator('#calEvSec .er').click();
  await page.locator('.gky-sheet footer .btn', { hasText: '消す' }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.calendar')).list.length)).toBe(0);
  await noErrors(errors);
});

test('カレンダー：練習計画のある練習の日は、段階と曲を出して「練習計画で開く」。練習計画を切ると、ふつうの練習として出る', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, BASE);
  await page.evaluate(() => {
    localStorage.setItem('shukketsu.v1', JSON.stringify({ v: 1, events: [{ id: 'e1', date: '2026-10-20', start: '16:00', end: '18:00', title: '合奏', kind: 'practice', place: '音楽室' }, { id: 'e2', date: '2026-10-22', start: '16:00', end: '18:00', title: 'パート練習', kind: 'practice' }], att: {} }));
    localStorage.setItem('renshu.v1', JSON.stringify({ v: 1, days: { e1: { phase: 'sec', items: [{ fmt: 'kiso', min: 15 }, { fmt: 'gassou', title: '宝島', range: 'A', min: 60 }, { fmt: 'bunsou', title: 'ふるさと', min: 30 }] } }, targets: [] }));
  });
  await reopen(page);
  await page.click('[data-tab="cal"]');
  await expect(page.locator('#calMonthSec td[data-day="2026-10-20"] .ev.k-plan')).toHaveText('合奏');
  await expect(page.locator('#calMonthSec td[data-day="2026-10-22"] .ev.k-att')).toHaveText('パート練習');
  await expect(page.locator('#calMonthSec .agenda')).toContainText('区間　宝島・ふるさと');
  await page.locator('#calMonthSec td[data-day="2026-10-20"]').click();
  await expect(page.locator('.gky-sheet a', { hasText: '練習計画で開く' })).toHaveAttribute('href', /renshu\/#day=e1$/);
  await page.keyboard.press('Escape');
  await page.locator('[data-layer="calPlan"]').uncheck();
  await expect(page.locator('#calMonthSec td[data-day="2026-10-20"] .ev.k-att')).toHaveText('合奏');
  await noErrors(errors);
});
