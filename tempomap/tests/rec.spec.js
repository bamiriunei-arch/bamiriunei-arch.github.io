// テンポマップ v3：通しの録音（前後の無音・実測に入れる・合奏ノートへ・消す）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

// テスト用のマイク（Chromium の作り物のマイク。許可の確かめも出さない）
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['microphone'] });

/* 無音の WAV（1ch・8000Hz）。秒数ぶん */
const wavB64 = sec => { const n = Math.round(8000 * sec), b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b.toString('base64'); };
/* 3秒の無音・10秒の演奏・2秒の無音（0.1秒ごとの音の大きさ） */
const LV = [...Array(30).fill(12), ...Array(100).fill(72), ...Array(20).fill(11)];

test('前後の無音を除いた所を見つける（無音だけ・ずっと同じ大きさは null）', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(LV => [__app.trimOf(LV), __app.trimOf(Array(50).fill(3)), __app.trimOf(Array(50).fill(60)), __app.trimOf([1, 2])], LV);
  expect(r[0]).toEqual({ a: 2.9, b: 13.1 });
  expect(r.slice(1)).toEqual([null, null, null]);
  await noErrors(errors);
});

test('録音を入れると、演奏の長さが出て、実測に入れられる。合奏ノートで開くリンク・消す・元に戻す', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="rec"]');
  await expect(page.locator('#rList')).toContainText('まだ録音はありません');
  const plan = await page.evaluate(() => __app.M().plan);
  const id = await page.evaluate(async ({ b64, LV }) => { const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'audio/wav' }); const m = await __app.saveRec(blob, { dur: 15, lv: LV }); return m.id; }, { b64: wavB64(15), LV });
  const row = page.locator(`#rList .rrow[data-rid="${id}"]`);
  await expect(row).toContainText('演奏 0:10（前 0:03・後ろ 0:02 の無音を除く）・録音 0:15');
  await expect(row.locator('svg.wv path.in')).toHaveCount(1);
  await expect(row.locator('[data-rgs]')).toHaveAttribute('href', new RegExp(`gassou/(index\\.html)?#media=${id}$`));
  // ファイル置き場の中身（ほかのツールから見る形）
  const meta = await page.evaluate(id => GKY.media.meta(id), id);
  expect([meta.cat, meta.from, meta.map, meta.plan, meta.trim, meta.name.endsWith('.wav')]).toEqual(['audio', 'tempomap', await page.evaluate(() => __app.S.current), plan, { a: 2.9, b: 13.1 }, true]);
  // 実測に入れる → 元に戻す
  await row.locator('[data-rmeas]').click();
  await expect(page.locator('#gkyToast')).toContainText('の実際に計った時間を 0:10 にしました');
  expect(await page.evaluate(p => __app.M().plans.find(x => x.id === p).measured, plan)).toBe(10);
  await expect(row).toContainText('実測に入れた');
  await page.locator('#gkyToast button', { hasText: '元に戻す' }).click();
  expect(await page.evaluate(p => __app.M().plans.find(x => x.id === p).measured, plan)).toBeNull();
  // 聞く（その場の再生の部品）
  await row.locator('[data-rplay]').click();
  await expect(row.locator('audio')).toHaveCount(1);
  // 消す（2回押す）→ 元に戻す
  await row.locator('[data-rdel]').click(); await row.locator('[data-rdel]').click();
  await expect(page.locator('#rList .rrow')).toHaveCount(0);
  await page.locator('#gkyToast button', { hasText: '元に戻す' }).click();
  await expect(page.locator('#rList .rrow')).toHaveCount(1);
  // ほかの曲の録音は出ない
  await page.evaluate(() => { const S = __app.S; const id = Object.keys(S.maps)[0]; const n = __app.normalizeMap({ title: 'ほかの曲' }); S.maps[n.id] = n; S.order.push(n.id); });
  await page.evaluate(() => { const S = __app.S; S.current = S.order[S.order.length - 1]; __app.renderAll(); });
  await expect(page.locator('#rList')).toContainText('まだ録音はありません');
  await noErrors(errors);
});

test('マイクで録音する（クリックも鳴らす）：止めるとファイル置き場に入り、はじめる小節の頭の時刻が残る', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="rec"]');
  await page.check('#rClick');
  await page.click('#rStart');
  await expect(page.locator('#rState')).toContainText('録音しています');
  await expect(page.locator('#recBox')).toHaveClass(/on/);
  await expect(page.locator('#rStart')).toBeDisabled();
  await page.waitForTimeout(2600);
  await expect(page.locator('#rTime')).toHaveText(/^0:0[23]$/);
  await page.click('#rStop');
  await expect(page.locator('#rList .rrow')).toHaveCount(1);
  const m = await page.evaluate(() => __app.RECS[0]);
  expect(m.dur).toBeGreaterThan(2); expect(m.dur).toBeLessThan(4.5);
  expect(m.size).toBeGreaterThan(1000);
  expect(m.type).toMatch(/^audio\//);
  expect(m.lv.length).toBeGreaterThanOrEqual(20);
  // 例の曲は Intro が ♩=60 の 4/4 → 1小節のカウント（4秒）のあとに1小節目
  expect(m.click.from).toBe(1); expect(m.click.speed).toBe(100);
  expect(m.click.at).toBeGreaterThan(3.9); expect(m.click.at).toBeLessThan(4.6);
  await expect(page.locator('#rStart')).toBeEnabled();
  await expect(page.locator('#rList .rrow')).toContainText('クリックつき（1小節から）');
  await noErrors(errors);
});
