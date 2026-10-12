// 動きの計算が変わっていないか（前の版と同じ位置になるか）
// 動きの計算をわざと変えたときは「npm run test:update」で答えを作り直してください
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { openApp, expect } = require('./helpers');
const GOLD = path.join(__dirname, 'fixtures', 'motion-golden.json');

test('サンプル（各フロア）の動きが、記録した答えと同じ', async ({ page }) => {
  await openApp(page);
  const got = await page.evaluate(() => {
    const D = __db, out = {};
    for (const t of ['football', 'indoor', 'square']){
      D.S = D.normalize(D.sampleShow(t)); D.afterLoad(true);
      const end = D.total(), rows = [];
      for (let k = 0; k <= 60; k++){ const tt = end * k / 60, P = D.posAt(tt); rows.push([Math.round(D.secAt(tt) * 1000) || 0, Object.keys(P).sort().map(id => P[id].map(v => Math.round(v * 1000) || 0))]); }
      out[t] = rows;
    }
    return out;
  });
  if (process.env.UPDATE_GOLDEN || !fs.existsSync(GOLD)){ fs.mkdirSync(path.dirname(GOLD), { recursive:true }); fs.writeFileSync(GOLD, JSON.stringify(got)); }
  const want = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
  expect(got).toEqual(want);
});
