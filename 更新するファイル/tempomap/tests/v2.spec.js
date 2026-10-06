// テンポマップ v2：くり返し・D.S.・D.C.・何小節目から分ける・共有コード
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

// 4/4 ♩=120 は1小節2秒
const SEC = (name, bars, o = {}) => Object.assign({ name, bars, meter: '4/4', unit: '4', bpm: 120 }, o);
async function useMap(page, sections, jump = null) {
  return page.evaluate(([secs, j]) => {
    const m = __app.normalizeMap({ title: 'テスト', sections: secs });
    if (j) { const id = n => m.sections.find(s => s.name === n).id; m.jump = { at: id(j[0]), to: id(j[1]), until: id(j[2]), next: j[3] ? id(j[3]) : '' }; }
    const S = __app.S; S.maps[m.id] = __app.normalizeMap(m); S.order.unshift(m.id); S.current = m.id; __app.renderAll();
    return m.id;
  }, [sections, jump]);
}

test('くり返し：時間はくり返しの回数分、ゆとり秒は最後に1回', async ({ page }) => {
  const errors = await openApp(page);
  await useMap(page, [SEC('A', 4, { rep: 2, extra: 1 }), SEC('B', 2)]);
  const r = await page.evaluate(() => { const m = __app.M(); return { t: __app.totals(m).music, a: __app.secTime(m.sections[0]), order: __app.playOrder(m).map(x => x.s.name + '×' + x.reps) }; });
  expect(r.a).toBeCloseTo(17, 6);          // 8秒×2 ＋ 1秒
  expect(r.t).toBeCloseTo(21, 6);
  expect(r.order).toEqual(['A×2', 'B×1']);
  await expect(page.locator('#secList .scard').first().locator('.rep')).toHaveText('×2');
  await expect(page.locator('#barWrap .seg').first()).toContainText('A×2');
  await noErrors(errors);
});

test('D.S. al Coda と D.C. al Fine：演奏の順番と時間', async ({ page }) => {
  const errors = await openApp(page);
  const secs = [SEC('Intro', 2), SEC('A', 4, { rep: 2 }), SEC('B', 4), SEC('C', 2), SEC('Coda', 2)];
  await useMap(page, secs, ['C', 'A', 'A', 'Coda']);
  let r = await page.evaluate(() => { const m = __app.M(); return { t: __app.totals(m).music, order: __app.playOrder(m).map(x => x.s.name + (x.pass === 2 ? '*' : '') + (x.reps > 1 ? '×' + x.reps : '')) }; });
  // Intro 4 + A 8×2 + B 8 + C 4 + A（D.S.、くり返しなし）8 + Coda 4 = 44
  expect(r.order).toEqual(['Intro', 'A×2', 'B', 'C', 'A*', 'Coda']);
  expect(r.t).toBeCloseTo(44, 6);
  await expect(page.locator('#jumpBox .order')).toContainText('A（D.S.）');
  await useMap(page, secs, ['C', 'Intro', 'A', '']);
  r = await page.evaluate(() => { const m = __app.M(); return { t: __app.totals(m).music, order: __app.playOrder(m).map(x => x.s.name + (x.pass === 2 ? '*' : '')) }; });
  expect(r.order).toEqual(['Intro', 'A', 'B', 'C', 'Intro*', 'A*']);   // Fine で終わる（Coda はひかない）
  expect(r.t).toBeCloseTo(4 + 16 + 8 + 4 + 4 + 8, 6);
  await expect(page.locator('#jumpBox .order')).toContainText('Intro（D.C.）');
  await noErrors(errors);
});

test('クリックも演奏の順番どおり。とちゅうの小節から鳴らすと、はじめてそこに来た所から', async ({ page }) => {
  const errors = await openApp(page);
  await useMap(page, [SEC('A', 2, { rep: 2 }), SEC('B', 1), SEC('C', 1)], ['B', 'A', 'A', 'C']);
  const r = await page.evaluate(() => {
    const m = __app.M(), bars = (from) => __app.buildClicks(m, null, from, 100, false, null).list.filter(x => x.level === 2).map(x => x.bar);
    const all = __app.buildClicks(m, null, 1, 100, false, null);
    return { all: bars(1), from2: bars(2), len: all.len, t: __app.totals(m).music, sec: all.list.filter(x => x.level === 2).map(x => x.sec) };
  });
  expect(r.all).toEqual([1, 2, 1, 2, 3, 1, 2, 4]);
  expect(r.from2).toEqual([2, 1, 2, 3, 1, 2, 4]);
  expect(r.len).toBeCloseTo(r.t, 6);
  expect(r.sec).toEqual(['A（1回目）', 'A（1回目）', 'A（2回目）', 'A（2回目）', 'B', 'A（D.C.）', 'A（D.C.）', 'C']);   // はじめへもどるので D.C.
  await noErrors(errors);
});

test('画面で D.S. を入れる：チェックして、もどる先とそのあとを選ぶ', async ({ page }) => {
  const errors = await openApp(page);
  await useMap(page, [SEC('A', 4), SEC('B', 4), SEC('C', 2), SEC('Coda', 2)]);
  await page.locator('#jOn').check();
  await page.selectOption('#jAt', { label: 'C' });
  await page.selectOption('#jTo', { label: 'B' });
  await page.selectOption('#jUntil', { label: 'B' });
  await page.selectOption('#jNext', { label: 'Coda' });
  await expect(page.locator('#jumpBox .order')).toHaveText(/A→B→C→B（D\.S\.）→Coda/);
  const t = await page.evaluate(() => __app.totals(__app.M()).music);
  expect(t).toBeCloseTo(8 + 8 + 4 + 8 + 4, 6);
  // 区間を消すと、合わない D.S. は外れる
  await page.locator('#jOn').uncheck();
  expect(await page.evaluate(() => __app.M().jump)).toBe(null);
  await noErrors(errors);
});

test('何小節目から分けるかを選んで、2つに分ける（時間は変わらない。カット案も引きつぐ）', async ({ page }) => {
  const errors = await openApp(page);
  await useMap(page, [SEC('A', 16), SEC('B', 8)]);
  await page.evaluate(() => { const m = __app.M(); m.plans[0].cut = [m.sections[0].id]; __app.renderAll(); });
  const before = await page.evaluate(() => __app.totals(__app.M()).all);
  await page.locator('#secList .scard').first().locator('[data-more]').click();
  await page.locator('.gky-sheet [data-a="split"]').click();
  await expect(page.locator('.gky-sheet')).toContainText('1〜16小節');
  await page.locator('.gky-sheet #spAt').fill('11');
  await page.locator('.gky-sheet #spName').fill('A2');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => { const m = __app.M(); return { secs: m.sections.map(s => [s.name, s.bars]), all: __app.totals(m).all, cut: m.plans[0].cut.length }; });
  expect(r.secs).toEqual([['A', 10], ['A2', 6], ['B', 8]]);
  expect(r.all).toBeCloseTo(before, 6);
  expect(r.cut).toBe(2);
  await expect(page.locator('#secList .scard').nth(1).locator('.bars')).toHaveText('11〜16小節');
  await noErrors(errors);
});

test('共有コードに、くり返しと D.S. が入る（読み込むと同じ順番）', async ({ page }) => {
  const errors = await openApp(page);
  await useMap(page, [SEC('A', 2, { rep: 3 }), SEC('B', 2), SEC('Coda', 1)], ['B', 'A', 'A', 'Coda']);
  const r = await page.evaluate(async () => {
    const m = __app.M(), code = await __app.encode(m), n = await __app.decode(code);
    const o = x => __app.playOrder(x).map(i => i.s.name + i.pass + 'x' + i.reps).join(',');
    return { a: o(m), b: o(n), t1: __app.totals(m).music, t2: __app.totals(n).music };
  });
  expect(r.b).toBe(r.a);
  expect(r.a).toBe('A1x3,B1x1,A2x1,Coda1x1');
  expect(r.t2).toBeCloseTo(r.t1, 6);
  await noErrors(errors);
});

test('前の版で保存したデータ（くり返しなし）は、そのまま同じ時間', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => { const m = __app.normalizeMap({ sections: [{ name: 'A', bars: 8, meter: '4/4', unit: '4', bpm: 120 }] }); return { rep: m.sections[0].rep, jump: m.jump, t: __app.totals(m).music }; });
  expect(r).toEqual({ rep: 1, jump: null, t: 16 });
  await noErrors(errors);
});
