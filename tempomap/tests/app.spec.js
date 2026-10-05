// テンポマップの計算とクリック
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('時間の計算：4/4・6/8・7/8・rit.・ゆとり秒', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const t = s => __app.secTime(Object.assign({ bars: 32, meter: '4/4', unit: '4', bpm: 120, bpmEnd: null, extra: 0 }, s));
    return {
      a: t({}),                                                     // 32×4拍÷120×60 = 64秒
      b: t({ bars: 24, meter: '6/8', unit: '4.', bpm: 96 }),        // 24×2拍÷96×60 = 30秒
      c: t({ bars: 10, meter: '7/8', unit: '8', bpm: 336 }),        // 70拍÷336×60 = 12.5秒
      d: t({ bars: 10, meter: '7/8', unit: '4', bpm: 168 }),        // 35拍÷168×60 = 12.5秒（四分で数えても同じ）
      e: t({ bars: 8, bpm: 120, bpmEnd: 60 }),                      // 32拍、120→60 ： 60×32×ln(0.5)/(-60) = 22.18秒
      f: t({ extra: 4 }),
      bpb: __app.beatsPerBar({ meter: '6/8', unit: '4.' }),
    };
  });
  expect(r.a).toBeCloseTo(64, 6);
  expect(r.b).toBeCloseTo(30, 6);
  expect(r.c).toBeCloseTo(12.5, 6);
  expect(r.d).toBeCloseTo(12.5, 6);
  expect(r.e).toBeCloseTo(22.1807, 3);
  expect(r.f).toBeCloseTo(68, 6);
  expect(r.bpb).toBe(2);
  await noErrors(errors);
});

test('クリックの長さは計算の時間とほぼ同じ（テンポが変わる区間も）', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const m = __app.M();
    const built = __app.buildClicks(m, m.plans[0].id, m.start, 100, false, null);
    const calc = m.sections.reduce((t, s) => t + __app.secTime(s), 0);
    const d = m.sections.find(s => s.meter === '7/8');
    const one = __app.buildClicks(m, m.plans[0].id, m.start, 100, false, d.id);
    return { len: built.len, calc, sevens: one.list.slice(0, 7).map(x => x.level) };
  });
  expect(Math.abs(r.len - r.calc)).toBeLessThan(0.6);
  expect(r.sevens).toEqual([2, 0, 1, 0, 1, 0, 0]);   // 2+2+3 のまとまりの頭が中くらいの音
  await noErrors(errors);
});

test('カット案：チェックを外すと切る区間になり、合計と制限との差が変わる', async ({ page }) => {
  const errors = await openApp(page);
  const before = await page.evaluate(() => __app.totals(__app.M()).music);
  await page.locator('.scard').first().locator('[data-play]').uncheck();
  const after = await page.evaluate(() => __app.totals(__app.M()).music);
  const intro = await page.evaluate(() => __app.secTime(__app.M().sections[0]));
  expect(before - after).toBeCloseTo(intro, 5);
  await page.click('[data-tab="plans"]');
  await expect(page.locator('.plan')).toHaveCount(3);
  await expect(page.locator('.plan.on .diff')).toBeVisible();
  // 実測を入れると、ほかの案に目安が出る
  await page.locator('.plan').first().locator('[data-meas]').fill('8:10');
  await page.locator('.plan').first().locator('[data-meas]').press('Tab');
  await expect(page.locator('#topSums')).toContainText('実測のずれ');
  await noErrors(errors);
});

test('共有コードで同じテンポマップを開ける', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(async () => {
    const m = __app.M();
    const code = await __app.encode(m);
    const n = await __app.decode('ここから→ ' + code + ' ←ここまで');
    return { code: code.slice(0, 3), same: JSON.stringify(n.sections.map(s => [s.name, s.bars, s.meter, s.unit, s.bpm, s.bpmEnd, s.extra])) === JSON.stringify(m.sections.map(s => [s.name, s.bars, s.meter, s.unit, s.bpm, s.bpmEnd, s.extra])), plans: n.plans.map(p => p.cut.length), limit: n.limit, others: n.others.length };
  });
  expect(r.code).toBe('TMZ');
  expect(r.same).toBe(true);
  expect(r.plans).toEqual([0, 1, 2]);
  expect(r.limit).toBe(720);
  expect(r.others).toBe(1);
  await page.click('[data-tab="share"]');
  const code = await page.locator('#shCode').inputValue();
  await page.locator('#inCode').fill(code);
  await page.click('#inBtn');
  await expect(page.locator('#mapSel option')).toHaveCount(2);
  await noErrors(errors);
});

test('クリックが鳴り始め、止められる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="click"]');
  await page.locator('#pFrom').fill('17');
  await page.click('#pPlay');
  await page.waitForTimeout(1500);
  await expect(page.locator('#pReh')).not.toHaveText('—');
  await page.click('#pStop');
  await expect(page.locator('#pPlay')).toBeEnabled();
  await noErrors(errors);
});

test('まとめて足す・印刷のプレビュー', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#btnAddMany');
  await page.locator('#manyIn').fill('F 16 3/4 132\nG 12 6/8 100→90\nだめな行');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => __app.M().sections.slice(-2).map(s => [s.name, s.unit, s.bpmEnd]));
  expect(r).toEqual([['F', '4', null], ['G', '4.', 90]]);
  await page.click('[data-tab="share"]');
  await page.click('#prMap');
  await expect(page.locator('.gky-pv .gky-page')).toHaveCount(1);
  await noErrors(errors);
});
