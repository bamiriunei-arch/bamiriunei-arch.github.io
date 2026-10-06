// 本番逆算スケジュールの基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('祝日：2026年と2027年', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => [[...__app.holidays(2026)].sort(), [...__app.holidays(2027)].sort()]);
  expect(r[0]).toEqual(['2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23']);
  expect(r[1]).toEqual(['2027-01-01', '2027-01-11', '2027-02-11', '2027-02-23', '2027-03-21', '2027-03-22', '2027-04-29', '2027-05-03', '2027-05-04', '2027-05-05', '2027-07-19', '2027-08-11', '2027-09-20', '2027-09-23', '2027-10-11', '2027-11-03', '2027-11-23']);
  await noErrors(errors);
});

test('締め切りの逆算：土日・祝日は前の平日に（本番の日は動かさない）', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const p = { date: '2027-03-21', weekday: true };   // 日曜（春分の日）
    const d = off => __app.dueOf(p, { off, due: '' });
    return { show: d(0), m1: d(-1), m2: d(-7), fixed: __app.dueOf(p, { off: -1, due: '2027-03-01' }), off: __app.dueOf({ date: '2027-03-21', weekday: false }, { off: -1, due: '' }) };
  });
  expect(r.show).toBe('2027-03-21');
  expect(r.m1).toBe('2027-03-19');     // 3/20（土）→ 3/19（金）
  expect(r.m2).toBe('2027-03-12');     // 3/14（日）→ 3/12（金）
  expect(r.fixed).toBe('2027-03-01');
  expect(r.off).toBe('2027-03-20');
  await noErrors(errors);
});

test('例：締め切りをすぎたものが目立ち、チェックできる', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#hero')).toContainText('あと 70');
  const late = page.locator('#months .task.late');
  await expect(late.first()).toContainText('チラシ・ポスターの原稿');
  const n = await late.count();
  await late.first().locator('.cb').click();
  await expect(page.locator('#months .task.late')).toHaveCount(n - 1);
  await noErrors(errors);
});

test('やることを足す・カレンダー（.ics）の中身', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#addTask');
  await page.locator('#tN').fill('衣装を決める');
  await page.locator('#tOff').fill('20');
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('#months')).toContainText('衣装を決める');
  const r = await page.evaluate(() => { const p = __app.P(); const s = __app.ics(p); return { n: (s.match(/BEGIN:VEVENT/g) || []).length, tasks: p.tasks.length, has: s.includes('SUMMARY:【締切】衣装を決める') }; });
  expect(r.n).toBe(r.tasks);
  expect(r.has).toBe(true);
  await noErrors(errors);
});

test('自分のひな形にして、来年の本番を作れる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="edit"]');
  await page.click('#saveTpl');
  await page.click('.gky-sheet footer .btn.primary');
  await page.click('#btnPlan');
  await page.click('#sNew');
  await page.locator('#nT').fill('来年の演奏会');
  // ひな形の数がふえても、自分のひな形（mine:…）を選ぶ
  await page.locator('#nK').selectOption(await page.locator('#nK option[value^="mine:"]').getAttribute('value'));
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => ({ title: __app.P().title, n: __app.P().tasks.length, mine: __app.S.mine.length }));
  expect(r.title).toBe('来年の演奏会');
  expect(r.mine).toBe(1);
  expect(r.n).toBe(29);
  await noErrors(errors);
});
