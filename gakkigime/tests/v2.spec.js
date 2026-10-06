// 楽器決め・編成計画 v2：二重に数えない・団体の種類で学年の数・楽器の台数・経験（案D）・一般の団体の欠員と募集
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

// 楽屋のデータを入れてから開く（例のデータは消しておく）
async function openWith(page, org, { date } = {}) {
  if (date) await page.clock.setFixedTime(new Date(date));
  await page.addInitScript(o => {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('gakuya.org', JSON.stringify(o));
  }, org);
  const errors = await openApp(page);
  await page.evaluate(() => { const S = __app.S; S.sample = false; S.newbies = []; S.quota = {}; S.fc.counts = {}; S.fc.intake = {}; S.fc.src = 'org'; S.fc.cohort = 'auto'; __app.renderAll(); });
  return errors;
}
const M = (name, grade, part, status = 'active') => ({ name, grade, part, status });

test('4月に新入部員を楽屋に中1として足しても、来年のフルートを二重に数えない（正しくは4人）', async ({ page }) => {
  const org = { org: { name: 'テスト中学校吹奏楽部', type: 'chu', year: 2027 }, members: [
    M('新田 一', '中1', 'Fl'), M('新田 二', '中1', 'Fl'), M('中野 二', '中2', 'Fl'), M('三上 三', '中3', 'Fl') ] };
  const errors = await openWith(page, org, { date: '2027-04-20T10:00:00' });
  const r = await page.evaluate(() => {
    const S = __app.S;
    S.fc.intake = { Fl: 1 };
    S.newbies = [{ id: 'a', name: '新田 一', w: ['Fl', '', ''], apt: [], exp: '', fixed: '', note: '', decided: 'Fl' }, { id: 'b', name: '（例）新田 二', w: ['Fl', '', ''], apt: [], exp: '', fixed: '', note: '', decided: 'Fl' }];
    const f = __app.forecast(S).find(x => x.p === 'Fl');
    return { c: f.c, y1: f.y1, t1: f.t1, t2: f.t2 };
  });
  expect(r.c).toEqual([2, 1, 1]);
  expect(r.y1).toEqual([1, 2, 1]);
  expect(r.t1).toBe(4);           // 前は 5 になっていた
  expect(r.t2).toBe(4);           // 再来年：入る見込み1 + 1 + 2
  await page.click('[data-tab="fc"]');
  await expect(page.locator('#fcCohort')).toContainText('今年度の中1');
  await expect(page.locator('#fcCohortNote')).toContainText('楽屋にまだいない0人');
  await expect(page.locator('#fcTable thead')).toContainText('中3');
  await noErrors(errors);
});

test('楽屋にまだ足していない新入部員は、4月なら今年度の1年として1回だけ数える。数え方は選べる', async ({ page }) => {
  const org = { org: { type: 'chu', year: 2027 }, members: [M('中野 二', '中2', 'Fl'), M('三上 三', '中3', 'Fl')] };
  const errors = await openWith(page, org, { date: '2027-04-20T10:00:00' });
  const r = await page.evaluate(() => {
    const S = __app.S;
    S.fc.intake = { Fl: 1 };
    S.newbies = [{ id: 'a', name: '新田 一', w: ['Fl', '', ''], apt: [], decided: 'Fl' }, { id: 'b', name: '新田 二', w: ['Fl', '', ''], apt: [], decided: 'Fl' }].map(n => Object.assign({ exp: '', fixed: '', note: '' }, n));
    const now = __app.forecast(S).find(x => x.p === 'Fl');
    S.fc.cohort = 'next';
    const next = __app.forecast(S).find(x => x.p === 'Fl');
    S.fc.cohort = 'auto';
    return { now: [now.c, now.t1, now.added], next: [next.c, next.t1] };
  });
  expect(r.now).toEqual([[2, 1, 1], 4, 2]);    // 今年度の中1として：来年 = 1 + 2 + 1
  expect(r.next).toEqual([[0, 1, 1], 3]);      // 来年度の中1として：来年 = 2 + 0 + 1
  await page.click('[data-tab="fc"]');
  // 中1の欄は「0 +2」（楽屋の0人＋楽器決めで決めた2人）
  await expect(page.locator('#fcTable tbody tr', { hasText: 'フルート' }).locator('td').nth(1)).toHaveText('0 +2');
  await expect(page.locator('#fcCohortNote')).toContainText('楽屋にまだいない2人を今の中1に足しています');
  await page.selectOption('#fcCohort', 'next');
  await expect(page.locator('#fcCohortNote')).toContainText('来年の中1として数えています');
  await expect(page.locator('#fcTable tbody tr', { hasText: 'フルート' }).locator('td').nth(1)).toHaveText('');
  await noErrors(errors);
});

test('中高一貫は中1〜高3の6学年、大学は引退の時期までの学年で数える', async ({ page }) => {
  const errors = await openWith(page, { org: { type: 'chuko' }, members: [M('A', '中1', 'Tp'), M('B', '中3', 'Tp'), M('C', '高1', 'Tp'), M('D', '高3', 'Tp')] });
  const r = await page.evaluate(() => { const f = __app.forecast(__app.S).find(x => x.p === 'Tp'); return { ys: __app.yearList(), c: f.c, t1: f.t1, gone: f.gone }; });
  expect(r.ys).toEqual(['中1', '中2', '中3', '高1', '高2', '高3']);
  expect(r.c).toEqual([1, 0, 1, 1, 0, 1]);
  expect(r.gone).toBe(1);   // 高3だけが引退。中3は高1へ（卒業しない）
  expect(r.t1).toBe(3);
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); o.org.type = 'daigaku'; o.org.retire = '大3'; o.members = [{ name: 'A', grade: '大1', part: 'Tb' }, { name: 'B', grade: '大3', part: 'Tb' }, { name: 'C', grade: '大4', part: 'Tb' }]; localStorage.setItem('gakuya.org', JSON.stringify(o)); });
  const d = await page.evaluate(() => { const f = __app.forecast(__app.S).find(x => x.p === 'Tb'); return { ys: __app.yearList(), c: f.c, t1: f.t1 }; });
  expect(d.ys).toEqual(['大1', '大2', '大3']);
  expect(d.c).toEqual([1, 0, 1]);   // 引退の時期（3回生）をすぎた大4は数えない
  expect(d.t1).toBe(1);
  await noErrors(errors);
});

test('楽器台帳の台数：募集が楽器のあきをこえると知らせ、あきまでにできる', async ({ page }) => {
  const org = { org: { type: 'koko' }, members: [M('A', '高1', 'Fl'), M('B', '高3', 'Fl')], instruments: [
    { no: 'Fl-1', name: 'フルート', part: 'Fl', owner: '学校', state: '使える' },
    { no: 'Fl-2', name: 'フルート', part: 'Fl', owner: '学校', state: '修理中' },
    { no: 'Fl-3', name: 'フルート', part: 'Fl', owner: '個人', state: '使える' },
    { no: 'Fl-4', name: 'フルート', part: 'Fl', owner: '学校', state: '使えない' },
    { no: 'Tp-1', name: 'トランペット', part: 'Tp', owner: '学校', state: '使える' } ] };
  const errors = await openWith(page, org);
  const fr = await page.evaluate(() => __app.instFree());
  expect(fr.Fl).toEqual({ n: 2, keep: 1, free: 1 });   // 個人の楽器・使えない楽器はのぞく。高3は来年使わない
  await page.locator('[data-q="Fl"]').fill('3'); await page.locator('[data-q="Fl"]').press('Tab');
  await page.locator('[data-q="Hn"]').fill('2'); await page.locator('[data-q="Hn"]').press('Tab');
  await expect(page.locator('#quota label', { hasText: 'フルート' }).locator('.ins')).toHaveClass(/over/);
  await expect(page.locator('#quota label', { hasText: 'フルート' }).locator('.ins')).toContainText('あき 1');
  await page.click('#qFromInst');
  const q = await page.evaluate(() => __app.S.quota);
  expect(q).toEqual({ Fl: 1, Hn: 2 });   // 台帳に1台もないホルンはそのまま
  await noErrors(errors);
});

test('案D 経験を大事に：前に吹いていた楽器を重く見る。理由にも出る', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const st = { quota: { Fl: 1, Tp: 1 }, newbies: [{ id: 'x', name: 'X', w: ['Fl', '', ''], apt: [], exp: 'Tp', fixed: '' }] };
    const a = __app.assign(st, 'a'), d = __app.assign(st, 'd');
    return { a, d, why: __app.explain(st, d)[0].why };
  });
  expect(r.a).toEqual({ x: 'Fl' });
  expect(r.d).toEqual({ x: 'Tp' });
  expect(r.why).toContain('前に吹いていた楽器');
  await expect(page.locator('#nbTable thead')).toContainText('経験');
  await page.click('[data-tab="plan"]');
  await expect(page.locator('body')).toContainText('案D 経験を大事に');
  await noErrors(errors);
});

test('一般の団体：編成計画のかわりに「欠員と募集」。足りない人数と募集の文', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const org = { org: { name: '〇〇市民吹奏楽団', type: 'ippan' }, members: [M('A', '', 'Tp'), M('B', '', 'Tp', 'extra'), M('C', '', 'Hn', 'leave')] };
  const errors = await openWith(page, org);
  await page.click('[data-tab="fc"]');
  await expect(page.locator('#fcSec')).toBeHidden();
  await expect(page.locator('#vacSec')).toBeVisible();
  const tp = page.locator('#vacTable tbody tr', { hasText: 'トランペット' });
  await expect(tp.locator('td').nth(1)).toHaveText('1');
  await expect(tp.locator('td').nth(2)).toHaveText('1');   // エキストラ・賛助（参考）
  await tp.locator('[data-vmin]').fill('3'); await tp.locator('[data-vmin]').press('Tab');
  await expect(page.locator('#vacTable tbody tr', { hasText: 'トランペット' }).locator('td').nth(4)).toHaveText('2');
  await page.click('#vacCopy');
  const txt = await page.evaluate(() => navigator.clipboard.readText());
  expect(txt).toContain('〇〇市民吹奏楽団募集');
  expect(txt).toContain('トランペット：2人');
  await noErrors(errors);
});

test('楽屋に足す：学年は団体の種類で（大学は大1、一般は入団した年）。もう楽屋にいる人は足さない', async ({ page }) => {
  const errors = await openWith(page, { org: { type: 'daigaku', retire: '大4' }, members: [M('既存 太郎', '大1', 'Cl')] });
  await page.evaluate(() => { const S = __app.S; S.newbies = [{ id: 'a', name: '既存 太郎', decided: 'Cl' }, { id: 'b', name: '新入 花子', decided: 'Fl' }].map(n => Object.assign({ w: ['', '', ''], apt: [], exp: '', fixed: '', note: '' }, n)); __app.renderAll(); });
  await page.click('[data-tab="plan"]');
  await page.click('#toOrg');
  await expect(page.locator('.gky-sheet')).toContainText('もう楽屋にいる1人は足しません');
  await expect(page.locator('.gky-sheet #gr')).toHaveValue('大1');
  await page.click('.gky-sheet footer .btn.primary');
  const ms = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.map(m => [m.name, m.grade, m.part, m.status]));
  expect(ms).toEqual([['既存 太郎', '大1', 'Cl', 'active'], ['新入 花子', '大1', 'Fl', 'active']]);
  // 一般の団体：学年のかわりに入団した年。ボタンの名前も「団員」
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); o.org.type = 'ippan'; o.members = []; localStorage.setItem('gakuya.org', JSON.stringify(o)); __app.renderAll(); });
  await expect(page.locator('#toOrg')).toHaveText('楽屋の団員に足す');
  await page.click('#toOrg');
  await expect(page.locator('.gky-sheet #gr')).toHaveCount(0);
  await page.locator('.gky-sheet #jn').fill('2026');
  await page.click('.gky-sheet footer .btn.primary');
  const ip = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.map(m => [m.name, m.grade, m.joined]));
  expect(ip).toEqual([['既存 太郎', '', 2026], ['新入 花子', '', 2026]]);
  await noErrors(errors);
});

test('新入部員をまとめて足す：コンバス・パーカス・ペットも楽器として読む', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { __app.S.newbies = []; __app.renderAll(); });
  await page.click('#nbMany');
  await page.locator('#manyIn').fill('佐藤 次郎 コンバス パーカス ペット\n高橋 スネア');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => __app.S.newbies.map(n => [n.name, n.w.join(',')]));
  expect(r).toEqual([['佐藤 次郎', 'St.B,Perc,Tp'], ['高橋', 'Perc,,']]);
  await noErrors(errors);
});
