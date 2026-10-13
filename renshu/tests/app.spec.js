// 練習計画の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const ORG = { org: { name: 'テスト中学校吹奏楽部', type: 'chu' },
  songs: [{ id: 's1', title: '宝島', composer: '和泉宏隆', parts: ['Fl', 'Cl', 'Tp'] }, { id: 's2', title: 'ふるさと', parts: ['Fl', 'Cl'] }],
  concerts: [{ id: 'c1', title: '定期演奏会', date: '2027-06-05', start: '14:00', kind: 'concert' }] };
const ev = (id, date, start = '16:00', end = '18:00', title = '合奏', kind = 'practice') => ({ id, date, start, end, title, kind, place: '音楽室', note: '', concert: '' });
// 楽屋・出欠などを入れて開く（1回だけ）
async function openWith(page, data, date = '2027-05-10T10:00:00') {
  await page.clock.setFixedTime(new Date(date));
  await page.addInitScript(d => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); for (const k in d) localStorage.setItem(k, JSON.stringify(d[k])); }, data);
  return openApp(page);
}
const att = page => page.evaluate(() => JSON.parse(localStorage.getItem('shukketsu.v1') || 'null'));

test('はじめは例の練習の日とメニュー。タイムテーブルの時刻が出る。例を消すと空になる', async ({ page }) => {
  const errors = await openApp(page);
  expect(await page.evaluate(() => [__app.S.sample, __app.practiceEvents(__app.events()).length])).toEqual([true, 3]);
  await page.locator('#evList button.ev').first().click();
  await expect(page.locator('#day .mi')).toHaveCount(3);
  await expect(page.locator('#day .mi .tm').first()).toContainText(/^(16|9):00/);
  await page.click('#sbClear'); await page.click('#sbClear');
  expect(await page.evaluate(() => [__app.S.sample, Object.keys(__app.S.days).length])).toEqual([false, 0]);
  await expect(page.locator('#attNote')).toContainText('練習の日がまだありません');
  await noErrors(errors);
});

test('練習の日を毎週くり返して足すと出欠に入る。メニューを足すとタイムテーブルになり、時間をこえると知らせる', async ({ page }) => {
  const errors = await openWith(page, { 'gakuya.org': ORG, 'shukketsu.v1': { v: 1, events: [], att: {}, extra: [] } });
  await page.click('#evAdd');
  await page.locator('#eD').fill('2027-05-11'); await page.locator('#eS').fill('16:00'); await page.locator('#eE').fill('17:00');
  await page.locator('#eT').fill('合奏');
  await page.locator('#eRep').check();
  await page.locator('#eTo').fill('2027-05-25');
  await page.click('.gky-sheet footer .btn.primary');
  const a = await att(page);
  expect(a.events.map(e => [e.date, e.start, e.end, e.kind])).toEqual([['2027-05-11', '16:00', '17:00', 'practice'], ['2027-05-18', '16:00', '17:00', 'practice'], ['2027-05-25', '16:00', '17:00', 'practice']]);
  // メニュー：曲を選ぶ・分
  await page.click('#miAdd');
  const mi = page.locator('#day .mi').first();
  await mi.locator('[data-k="song"]').selectOption('s1');
  await mi.locator('[data-k="min"]').fill('40'); await mi.locator('[data-k="min"]').press('Tab');
  await expect(page.locator('#day .mi').first().locator('.tm')).toHaveText('16:00〜16:40');
  await page.click('#miAdd');
  await page.locator('#day .mi').nth(1).locator('[data-k="min"]').fill('30'); await page.locator('#day .mi').nth(1).locator('[data-k="min"]').press('Tab');
  await expect(page.locator('#day .issue.bad')).toContainText('10分こえています');
  await expect(page.locator('#cntOver')).toHaveText('1');
  const d = await page.evaluate(() => __app.S.days[JSON.parse(localStorage.getItem('shukketsu.v1')).events[0].id].items.map(x => [x.fmt, x.title, x.song, x.min]));
  expect(d).toEqual([['gassou', '宝島', 's1', 40], ['gassou', '宝島', 's1', 30]]);
  // 日時を直すと出欠も直る
  await page.click('#dEdit');
  await page.locator('#eE').fill('18:00');
  await page.click('.gky-sheet footer .btn.primary');
  expect((await att(page)).events[0].end).toBe('18:00');
  await expect(page.locator('#day .issue.bad')).toHaveCount(0);
  await noErrors(errors);
});

test('本番から下書き：曲目一覧の曲を、譜読み → 区間 → 通し → ゲネプロで割り振る。区間はテンポマップの練習番号と小節', async ({ page }) => {
  const evs = ['2027-05-11', '2027-05-13', '2027-05-15', '2027-05-18', '2027-05-20', '2027-05-22', '2027-05-25', '2027-05-27', '2027-05-29', '2027-06-01', '2027-06-03']
    .map((d, i) => ev('p' + i, d, GKY_SAT(d) ? '09:00' : '16:00', GKY_SAT(d) ? '12:00' : '18:00')).concat([ev('show', '2027-06-05', '14:00', '17:00', '定期演奏会', 'show'), ev('after', '2027-06-08')]);
  const errors = await openWith(page, { 'gakuya.org': ORG, 'shukketsu.v1': { v: 1, events: evs, att: {}, extra: [] },
    'gakufu.v1': { v: 1, songs: [{ id: 's1', title: '宝島', composer: '和泉宏隆', dur: 300, parts: ['Fl'] }, { id: 's2', title: 'ふるさと', dur: 180 }], setlists: [{ id: 'l1', title: '定演の曲目', concert: 'c1', ids: ['s1', 's2'] }] },
    'tempomap.v1': { v: 1, current: 'm1', maps: { m1: { id: 'm1', title: '宝島', start: 1, sections: [{ name: 'A', bars: 8 }, { name: 'B', bars: 16 }, { name: 'C', bars: 16 }, { name: 'D', bars: 8 }] } } } });
  expect(await page.evaluate(() => __app.sectionsOf('宝島').map(s => s.label))).toEqual(['A（1〜8小節）', 'B（9〜24小節）', 'C（25〜40小節）', 'D（41〜48小節）']);
  await page.click('[data-tab="draft"]');
  await expect(page.locator('#dfInfo')).toContainText('曲 2');
  await expect(page.locator('#dfInfo')).toContainText('本番までの練習 11回');
  await expect(page.locator('#dfInfo')).toContainText('楽譜ライブラリの曲目一覧「定演の曲目」');
  await page.click('#dfMake');
  await expect(page.locator('[data-tab="plan"]')).toHaveAttribute('aria-selected', 'true');
  const r = await page.evaluate(() => { const S = __app.S, ev = __app.practiceEvents(__app.events()); return ev.filter(e => S.days[e.id]).map(e => { const d = S.days[e.id], tl = __app.timeline(e, d); return { id: e.id, phase: d.phase, over: tl.over, total: tl.total, items: d.items.map(x => [x.fmt, x.title, x.range]) }; }); });
  expect(r.map(x => x.id)).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10']);   // 本番のあとの練習には入れない
  expect(r.map(x => x.phase)).toEqual(['read', 'read', 'read', 'read', 'sec', 'sec', 'sec', 'sec', 'run', 'run', 'gp']);
  expect(r.every(x => x.over === 0 && x.total > 0)).toBe(true);
  expect(r[0].items[1]).toEqual(['part', '宝島', '全体を譜読み（音とリズム）']);
  expect(r[4].items.map(x => x[2])).toContain('A〜B（1〜24小節）');
  expect(r[10].items.filter(x => x[0] === 'tooshi').map(x => x[1])).toEqual(['宝島', 'ふるさと']);   // ゲネプロ：本番の順に通す
  expect(await page.evaluate(() => __app.S.targets.map(t => t.concert))).toEqual(['c1']);
  // もう入っている日は、作り直さない（選べば作り直す）
  await page.evaluate(() => { __app.S.days.p0.items[0].note = '自分で直した'; });
  await page.click('[data-tab="draft"]'); await page.click('#dfMake');
  expect(await page.evaluate(() => __app.S.days.p0.items[0].note)).toBe('自分で直した');
  await noErrors(errors);
});
function GKY_SAT(d) { return new Date(d + 'T00:00:00').getDay() === 6; }

test('見るだけのリンクで、日ごとのメニューとタイムテーブルが見られる。文でコピー・カレンダー', async ({ page }) => {
  const errors = await openWith(page, { 'gakuya.org': ORG, 'shukketsu.v1': { v: 1, events: [ev('a', '2027-05-11'), ev('b', '2027-05-13')], att: {}, extra: [] },
    'renshu.v1': { v: 1, days: { a: { phase: 'read', memo: '譜面台を出す', items: [{ fmt: 'kiso', range: 'ロングトーン', min: 15 }, { fmt: 'gassou', title: '宝島', song: 's1', range: 'A〜B', parts: 'Fl・Cl', min: 45, note: 'ゆっくり' }] } }, targets: [] } });
  const txt = await page.evaluate(() => __app.dayText(__app.events()[0]));
  expect(txt).toBe('■ 5/11（火） 合奏 16:00〜18:00（音楽室）\n16:00〜 基礎合奏 ロングトーン（15分）\n16:15〜 合奏 宝島 A〜B （Fl・Cl）（45分）　ゆっくり\n※ 譜面台を出す');
  const ics = (await page.evaluate(() => __app.icsOf(__app.events(), 'テスト'))).replace(/\r\n /g, '');
  expect(ics).toContain('DTSTART:20270511T160000');
  expect(ics).toContain('SUMMARY:合奏');
  expect(ics).toContain('16:15〜 合奏 宝島');
  const hash = await page.evaluate(async () => { const u = await GKY.shareUrl('renshu', __app.sharePayload(__app.events())); return u.slice(u.indexOf('#')); });
  await page.goto('/index.html?test=view' + hash); await page.waitForFunction(() => window.__app && window.__app.ready);
  const v = page.locator('#gkyView');
  await expect(v.locator('.vw-day')).toHaveCount(2);
  await expect(v.locator('.vw-day').first()).toContainText('16:15〜17:00');
  await expect(v.locator('.vw-day').first()).toContainText('宝島　A〜B');
  await expect(v.locator('.vw-day').first()).toContainText('譜面台を出す');
  await expect(v.locator('.vw-day').nth(1)).toContainText('メニューはまだありません');
  await noErrors(errors);
});

test('楽屋の本番から開くと、その本番の下書きの画面になる', async ({ page }) => {
  const errors = await openWith(page, { 'gakuya.org': ORG, 'shukketsu.v1': { v: 1, events: [ev('a', '2027-05-11')], att: {}, extra: [] } });
  await page.goto('/index.html?test#concert=c1'); await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-sheet')).toContainText('まだありません');
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('[data-tab="draft"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#dfConcert')).toHaveValue('c1');
  await noErrors(errors);
});

test('部員用の端末では、出欠の予定を書きかえない', async ({ page }) => {
  const errors = await openWith(page, { 'gakuya.org': Object.assign({}, ORG, { org: { name: 'テスト', type: 'chu', role: 'member', member: { tools: ['renshu'] } } }), 'shukketsu.v1': { v: 1, events: [], att: {}, extra: [] } });
  await page.click('#evAdd');
  await page.locator('#eD').fill('2027-05-11');
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('.gky-toast')).toContainText('部員用の端末からは');
  expect((await att(page)).events).toEqual([]);
  await noErrors(errors);
});
