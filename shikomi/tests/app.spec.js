// 仕込み図の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('使うものからインプットリストができる', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => __app.genInputs({ mc: 'wl', kage: true, cond: false, solo: 2, vocal: 0, bass: true, key: true, gtr: false, drums: true, play: false, rec: 'own', hang: false }).map(x => [x.ch, x.src, x.phantom]));
  expect(r.map(x => x[1])).toEqual(['司会', '影アナ', 'ソロ1', 'ソロ2', 'エレキベース', 'キーボード L', 'キーボード R', 'バスドラム', 'スネア', 'ドラム上 L', 'ドラム上 R', '録音 L', '録音 R']);
  expect(r.map(x => x[0])).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  expect(r.find(x => x[1] === 'ドラム上 L')[2]).toBe(true);
  expect(r.find(x => x[1] === 'エレキベース')[2]).toBe(null);   // DIは「？」（アクティブかどうかで変わる）
  // 画面から：ソロを0にして作り直す
  await page.locator('[data-n="solo"]').fill('0');
  await page.locator('[data-n="solo"]').press('Tab');
  await page.click('#btnGen');
  await expect(page.locator('#inTable tbody tr')).toHaveCount(await page.evaluate(() => __app.E().inputs.length));
  const srcs = await page.evaluate(() => __app.E().inputs.map(x => x.src));
  expect(srcs).not.toContain('ソロ1');
  expect(srcs).toContain('司会');
  await noErrors(errors);
});

test('仕込み図：機材を選んで舞台を押すと置ける', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { __app.E().inputs.forEach(x => { x.x = null; x.y = null; }); __app.renderAll(); });
  await page.click('[data-tab="plot"]');
  await page.locator('#placeList [data-place]').first().click();
  const box = await page.locator('#plot').boundingBox();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.8);
  const placed = await page.evaluate(() => __app.E().inputs.filter(x => x.x != null).length);
  expect(placed).toBe(1);
  await expect(page.locator('#plot [data-mk^="i:"]')).toHaveCount(1);
  // 電源の印も置ける
  await page.locator('#markList [data-place="k:power"]').click();
  await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await expect(page.locator('#plot [data-mk^="m:"]')).toHaveCount(4);
  await noErrors(errors);
});

test('きっかけ表をステマネのファイルから作れる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="cues"]');
  const file = { app: 'stagemane', format: 1, concert: { info: { title: '春の演奏会', date: '2027-03-20', venue: 'テスト会館' }, program: [
    { id: 'a', type: 'mark', label: '開場', time: '13:30', hideScript: true },
    { id: 'b', type: 'part', name: '第1部' },
    { id: 'c', type: 'anno', bell: '本ベル', time: '14:00', text: '…', rs: { light: '客電を落とす' } },
    { id: 'd', type: 'cue', steps: ['奏者入場', '指揮者入場'], rs: { stage: '入場' } },
    { id: 'e', type: 'piece', title: '宝島' },
    { id: 'f', type: 'mc', who: '司会', where: '舞台下手', text: '…' },
    { id: 'g', type: 'brk', minutes: 15 } ] } };
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnCueStagemane');
  await (await chooser).setFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await page.click('.gky-sheet footer .btn.primary');
  const cues = await page.evaluate(() => __app.E().cues.map(c => [c.part, c.at, c.sound, c.light, c.stage]));
  expect(cues[0][1]).toBe('開場 13:30');
  expect(cues[1][0]).toBe('第1部');
  expect(cues[1][2]).toContain('影アナ');
  expect(cues[1][3]).toBe('客電を落とす');
  expect(cues[2][1]).toBe('奏者入場 → 指揮者入場');
  expect(cues[3][1]).toBe('曲：宝島');
  expect(cues[4][2]).toContain('司会');
  expect(cues[4][3]).toBe('司会にピンスポット');
  expect(cues[5][1]).toBe('休憩 15分');
  const ev = await page.evaluate(() => [__app.E().title, __app.E().venue]);
  expect(ev).toEqual(['春の演奏会', 'テスト会館']);
  await noErrors(errors);
});

test('まとめて印刷：4つの資料がページに分かれる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="out"]');
  await page.click('#btnPrint');
  await expect(page.locator('.gky-pv .gky-page').first()).toBeVisible();
  const n = await page.locator('.gky-pv .gky-page').count();
  expect(n).toBeGreaterThanOrEqual(4);
  await expect(page.locator('.gky-pv')).toContainText('インプットリスト');
  await expect(page.locator('.gky-pv svg')).toHaveCount(1);
  await noErrors(errors);
});
