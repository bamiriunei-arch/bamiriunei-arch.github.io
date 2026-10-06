// 出欠の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

// 楽屋の名簿を入れて、例のない空の状態で開く
async function openWith(page, members, date = '2027-05-12T10:00:00') {
  await page.clock.setFixedTime(new Date(date));
  await page.addInitScript(ms => { if (location.protocol === 'about:') return; if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト中学校吹奏楽部', type: 'chu' }, members: ms })); localStorage.setItem('shukketsu.v1', JSON.stringify({ v: 1, events: [], att: {}, extra: [] })); } }, members);
  return openApp(page);
}
const MS = [{ name: '青木 美咲', part: 'Fl', grade: '中2' }, { name: '石井 大翔', part: 'Fl', grade: '中1' }, { name: '上田 さくら', part: 'Cl', grade: '中3' }, { name: '平田 颯', part: 'Tuba', grade: '中2' }, { name: '森 陽向', part: 'Perc', grade: '中1' }, { name: '卒業 太郎', part: 'Tp', grade: '中3', status: 'gone' }];

test('はじめは例の予定と出欠が出る。例を消すと空になる（楽屋はそのまま）', async ({ page }) => {
  const errors = await openApp(page);
  const n = await page.evaluate(() => __app.S.events.length);
  expect(n).toBeGreaterThan(10);
  await expect(page.locator('#evList .ev').first()).toBeVisible();
  await page.click('#sbClear'); await page.click('#sbClear');
  expect(await page.evaluate(() => [__app.S.events.length, __app.S.sample])).toEqual([0, false]);
  await noErrors(errors);
});

test('毎週くり返して予定を足す（祝日はのぞく）。同じ予定は二重に足さない', async ({ page }) => {
  const errors = await openWith(page, MS);
  await page.click('#evAdd');
  await page.locator('#eD').fill('2027-04-27');   // 火曜。4/29（木）は祝日
  await page.locator('#eS').fill('16:00'); await page.locator('#eE').fill('18:00');
  await page.locator('#eT').fill('パート練習');
  await page.locator('#eRep').check();
  await page.locator('[data-wd="4"]').check();     // 木曜も
  await page.locator('#eTo').fill('2027-05-13');
  // 火・木：4/27・4/29（昭和の日）・5/4（みどりの日）・5/6・5/11・5/13 → 祝日の2日をのぞいて4回
  await expect(page.locator('#eRepN')).toContainText('4回分');
  await page.click('.gky-sheet footer .btn.primary');
  const ds = await page.evaluate(() => __app.S.events.map(e => e.date).sort());
  expect(ds).toEqual(['2027-04-27', '2027-05-06', '2027-05-11', '2027-05-13']);
  // もう一度同じものを足そうとしても、ふえない
  await page.click('#evAdd');
  await page.locator('#eD').fill('2027-05-06'); await page.locator('#eS').fill('16:00'); await page.locator('#eT').fill('パート練習');
  await page.click('.gky-sheet footer .btn.primary');
  expect(await page.evaluate(() => __app.S.events.length)).toBe(ds.length);
  await noErrors(errors);
});

test('出欠を入れる：○×遅早と理由。だれもいないパートが出る。名簿は楽屋の在籍の人', async ({ page }) => {
  const errors = await openWith(page, MS);
  await page.evaluate(() => { __app.S.events.push({ id: 'e1', date: '2027-05-15', start: '09:00', end: '12:00', title: '合奏', kind: 'practice', place: '音楽室', note: '' }); __app.renderAll(); });
  await page.locator('#evList .ev').first().click();
  await expect(page.locator('#att .arow')).toHaveCount(5);          // 卒業した人は出ない
  await page.locator('#att .arow', { hasText: '平田 颯' }).locator('[data-s="a"]').click();
  await page.locator('#att .arow', { hasText: '平田 颯' }).locator('[data-why]').fill('通院');
  await page.locator('#att .arow', { hasText: '平田 颯' }).locator('[data-why]').press('Tab');
  await expect(page.locator('#att')).toContainText('だれもいないパート：テューバ');
  await expect(page.locator('#att')).toContainText('まだ返事がなく');
  await page.click('#aAll');
  const r = await page.evaluate(() => { const s = __app.summary(__app.S.events[0]); return { c: s.c, empty: s.empty, maybe: s.maybe, why: __app.S.att.e1[__app.nameKey('平田 颯')] }; });
  expect(r.c).toEqual({ p: 4, l: 0, e: 0, a: 1, none: 0 });
  expect(r.empty).toEqual(['Tuba']); expect(r.maybe).toEqual([]);
  expect(r.why).toEqual({ s: 'a', r: '通院' });
  // 同じボタンをもう一度押すと、未記入にもどる
  await page.locator('#att .arow', { hasText: '森 陽向' }).locator('[data-s="p"]').click();
  expect(await page.evaluate(() => __app.summary(__app.S.events[0]).c.none)).toBe(1);
  await noErrors(errors);
});

test('出席率：人とパート。未記入と、今日より後の予定は数えない', async ({ page }) => {
  const errors = await openWith(page, MS);
  await page.evaluate(() => {
    const S = __app.S, k = __app.nameKey;
    ['2027-05-01', '2027-05-04', '2027-05-08', '2027-05-20'].forEach((d, i) => S.events.push({ id: 'e' + i, date: d, start: '', end: '', title: '練習', kind: 'practice', place: '', note: '' }));
    S.att = { e0: { [k('青木 美咲')]: { s: 'p', r: '' }, [k('石井 大翔')]: { s: 'a', r: '塾' } }, e1: { [k('青木 美咲')]: { s: 'l', r: '委員会' }, [k('石井 大翔')]: { s: 'a', r: '' } }, e2: { [k('青木 美咲')]: { s: 'a', r: '' } }, e3: { [k('青木 美咲')]: { s: 'a', r: '' } } };
    __app.renderAll();
  });
  const r = await page.evaluate(() => { const x = __app.rates('all', false); const g = n => x.rows.find(m => m.name === n); return { n: x.evs.length, a: [g('青木 美咲').rate, g('青木 美咲').c], b: [g('石井 大翔').rate, g('石井 大翔').c.none], c: g('上田 さくら').rate }; });
  expect(r.n).toBe(3);
  expect(r.a[0]).toBeCloseTo(2 / 3, 6);
  expect(r.a[1]).toEqual({ p: 1, l: 1, e: 0, a: 1, none: 0 });
  expect(r.b).toEqual([0, 1]);
  expect(r.c).toBe(null);
  await page.click('[data-tab="rate"]');
  await page.selectOption('#rtRange', 'all');
  await page.selectOption('#rtSort', 'low');
  await expect(page.locator('#rtTable tbody tr').first()).toContainText('石井 大翔');
  await expect(page.locator('#rtTable tbody tr.low')).toHaveCount(2);
  await expect(page.locator('#rtParts')).toContainText('フルート');
  await noErrors(errors);
});

test('見るだけのリンクで出欠を入れ、返事の文を貼り付けると取り込める', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = await openWith(page, MS);
  await page.evaluate(() => { const S = __app.S; S.events.push({ id: 'ea', date: '2027-05-15', start: '09:00', end: '12:00', title: '合奏', kind: 'practice', place: '', note: '' }, { id: 'eb', date: '2027-05-22', start: '', end: '', title: '地域の演奏会', kind: 'show', place: '公民館', note: '' }, { id: 'ec', date: '2027-08-01', start: '', end: '', title: '遠い予定', kind: 'practice', place: '', note: '' }); GKY.store.set('shukketsu.v1', S); __app.renderAll(); });
  const url = await page.evaluate(async () => GKY.shareUrl('shukketsu', __app.sharePayload(31, true)));
  await page.goto('about:blank');
  await page.goto('/index.html?test' + url.slice(url.indexOf('#')));
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-viewer')).toContainText('見るだけ');
  await expect(page.locator('.vw-ev')).toHaveCount(2);              // 1か月先までの予定だけ
  await page.locator('#vwWho').selectOption({ label: '平田 颯（Tuba）' });
  await page.locator('.vw-ev[data-id="ea"] [data-s="p"]').click();
  await page.locator('.vw-ev[data-id="eb"] [data-s="a"]').click();
  await page.locator('.vw-ev[data-id="eb"] [data-why]').fill('法事');
  await page.click('#vwCopy');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('【出欠の返事】平田 颯');
  expect(text).toContain('地域の演奏会：欠席（法事）');
  expect(text).toMatch(/SK1\|平田 颯\|ea=p,eb=a~法事/);
  // もとの画面にもどって、返事を貼り付ける（ほかの文がまじっていてもよい）
  await page.goto('about:blank');
  await page.goto('/index.html?test');
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('[data-tab="share"]');
  await page.locator('#rpIn').fill('おつかれさまです\n' + text + '\n\nSK1|知らない 人|ea=p');
  await page.click('#rpRead');
  await expect(page.locator('.gky-sheet')).toContainText('1人の返事（2件）');
  await expect(page.locator('.gky-sheet')).toContainText('名簿にいない名前：知らない 人');
  await page.click('.gky-sheet footer .btn.primary');
  const a = await page.evaluate(() => { const k = __app.nameKey('平田 颯'); return [__app.S.att.ea[k], __app.S.att.eb[k]]; });
  expect(a).toEqual([{ s: 'p', r: '' }, { s: 'a', r: '法事' }]);
  await noErrors(errors);
});

test('印刷：記入用の出欠表と、出欠の記録（理由つき）', async ({ page }) => {
  const errors = await openWith(page, MS);
  await page.evaluate(() => { const S = __app.S, k = __app.nameKey; S.events.push({ id: 'p1', date: '2027-05-08', start: '', end: '', title: '合奏', kind: 'practice', place: '', note: '' }, { id: 'p2', date: '2027-05-11', start: '', end: '', title: '練習', kind: 'practice', place: '', note: '' }); S.att = { p1: { [k('青木 美咲')]: { s: 'a', r: '体調不良' } } }; __app.renderAll(); });
  await page.click('[data-tab="io"]');
  await page.selectOption('#prMonth', '2027-05');
  await page.click('#prBlank');
  let pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('出欠表');
  await expect(pg).toContainText('青木 美咲');
  await expect(pg).toContainText('5/8');
  await page.keyboard.press('Escape');
  await page.click('#prFilled');
  pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('体調不良');
  await noErrors(errors);
});

test('この出欠だけの名簿に足せる（楽屋にいる人は足さない）', async ({ page }) => {
  const errors = await openWith(page, MS);
  await page.click('[data-tab="io"]');
  await page.click('#exAdd');
  await page.locator('#exIn').fill('青木 美咲 フルート\n外部 花子 クラリネット 一般');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => ({ extra: __app.S.extra.map(m => [m.name, m.part]), n: __app.roster().length }));
  expect(r.extra).toEqual([['外部 花子', 'Cl']]);
  expect(r.n).toBe(6);
  await noErrors(errors);
});
