// 楽器決め・編成計画の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('割り振り：定員を守り、全員が入り、同じ入力なら同じ答え', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const S = __app.S;
    const out = {};
    for (const k of ['a', 'b', 'c']) {
      const a = __app.assign(S, k), b = __app.assign(S, k);
      const per = {}; Object.values(a).forEach(p => per[p] = (per[p] || 0) + 1);
      out[k] = { n: Object.keys(a).length, over: Object.entries(per).filter(([p, c]) => c > S.quota[p]).length, same: JSON.stringify(a) === JSON.stringify(b), ranks: __app.explain(S, a).map(x => x.rank) };
    }
    return out;
  });
  for (const k of ['a', 'b', 'c']) { expect(r[k].n).toBe(14); expect(r[k].over).toBe(0); expect(r[k].same).toBe(true); }
  // 案A は第1希望の人数がいちばん多い。案C は第3希望・希望外がいちばん少ない
  const cnt = (rs, v) => rs.filter(x => x === v).length;
  expect(cnt(r.a.ranks, 1)).toBeGreaterThanOrEqual(cnt(r.c.ranks, 1));
  expect(cnt(r.c.ranks, 3) + cnt(r.c.ranks, 0)).toBeLessThanOrEqual(cnt(r.a.ranks, 3) + cnt(r.a.ranks, 0));
  await noErrors(errors);
});

test('小さな例：希望と見立てで答えが変わる', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const st = { quota: { Fl: 1, Cl: 1 }, newbies: [
      { id: 'x', name: 'X', w: ['Fl', 'Cl', ''], apt: ['Cl'], fixed: '' },
      { id: 'y', name: 'Y', w: ['Fl', 'Cl', ''], apt: ['Fl'], fixed: '' } ] };
    const b = __app.assign(st, 'b');
    const fixed = __app.assign({ quota: { Fl: 1 }, newbies: [{ id: 'z', name: 'Z', w: ['Fl', '', ''], apt: [], fixed: 'Tb' }, { id: 'w', name: 'W', w: ['Fl', '', ''], apt: [], fixed: '' }] }, 'a');
    return { b, fixed };
  });
  expect(r.b).toEqual({ x: 'Cl', y: 'Fl' });          // 見立てを大事にすると、向いていそうな方へ
  expect(r.fixed).toEqual({ z: 'Tb', w: 'Fl' });      // 決まっている人は、募集がなくてもその楽器
  await noErrors(errors);
});

test('理由：第1希望に入れなかった人には、定員と希望の人数が出る', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="plan"]');
  await expect(page.locator('#resList .r')).toHaveCount(14);
  await expect(page.locator('#resList')).toContainText('第1希望のフルートは、募集 2人に第1希望が3人');
  await page.click('#decide');
  const dec = await page.evaluate(() => __app.S.newbies.filter(n => n.decided).length);
  expect(dec).toBe(14);
  await noErrors(errors);
});

test('編成計画：3年生が引退した来年・再来年の人数と、足りないパート', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => { const f = __app.forecast(__app.S); const g = p => f.find(x => x.p === p); return { tuba: g('Tuba'), hn: g('Hn'), cl: g('Cl') }; });
  // テューバ：今は3年生だけ1人 → 来年0人
  expect(r.tuba.now).toBe(1); expect(r.tuba.zero).toBe(true); expect(r.tuba.t1).toBe(0);
  // クラリネット：今 2+3+3=8 → 来年は 入る見込み2 + 1年2 + 2年3 = 7
  expect(r.cl.now).toBe(8); expect(r.cl.t1).toBe(7);
  await page.click('[data-tab="fc"]');
  await expect(page.locator('#fcTable tbody tr.focus').first()).toBeVisible();
  await noErrors(errors);
});

test('新入部員をまとめて足す（楽器の書き方がちがっても読める）', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#nbMany');
  await page.locator('#manyIn').fill('山田花子 フルート クラ アルト\n鈴木 太郎 ラッパ ホルン パーカッション');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => __app.S.newbies.map(n => [n.name, n.w.join(',')]));
  expect(r).toEqual([['山田花子', 'Fl,Cl,A.Sax'], ['鈴木 太郎', 'Tp,Hn,Perc']]);
  await noErrors(errors);
});
