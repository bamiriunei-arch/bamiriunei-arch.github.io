// 合奏ノート v2：長い録音でもメモリを使いすぎない再生・波形・くり返しどおりの小節番号・パートのボタン
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

// 10秒鳴って10秒だまる、のくり返し（波形の山と谷の位置を確かめる）
function wavOnOff(sec = 60, sr = 8000) {
  const n = Math.floor(sec * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) { const t = i / sr, on = (t % 20) < 10; b.writeInt16LE(on ? Math.round(Math.sin(t * 2 * Math.PI * 440) * 20000) : 0, 44 + i * 2); }
  return b;
}

test('録音はファイルのまま再生し（全部を広げない）、波形はファイルを少しずつ読んで作る', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="rec"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#pickFile');
  await (await chooser).setFiles({ name: 'long.wav', mimeType: 'audio/wav', buffer: wavOnOff(60) });
  await page.waitForFunction(() => __app.buf && __app.buf.name === 'long.wav' && __app.peaks);
  const r = await page.evaluate(() => {
    const p = __app.peaks, d = __app.buf.duration, at = t => p[Math.floor(t / d * p.length)];
    return { d, media: __app.media && __app.media.tagName, decoded: typeof __app.buf.getChannelData, n: p.length, on: [at(5), at(25), at(45)], off: [at(15), at(35), at(55)] };
  });
  expect(r.media).toBe('AUDIO');
  expect(r.decoded).toBe('undefined');             // AudioBuffer（全部を広げた音）は持たない
  expect(r.d).toBeCloseTo(60, 1);
  expect(r.n).toBe(1500);                          // 1秒に25本
  r.on.forEach(v => expect(v).toBeGreaterThan(0.9));
  r.off.forEach(v => expect(v).toBeLessThan(0.01));
  // 再生すると時刻が進む。速さを変えても音の高さは変わらない設定
  await page.evaluate(() => __app.seek(30));
  await page.click('#play');
  await page.waitForTimeout(700);
  const t = await page.evaluate(() => { const x = __app.pos(); __app.stop(); return { x, pitch: __app.media.preservesPitch }; });
  expect(t.x).toBeGreaterThan(30.2);
  expect(t.pitch).toBe(true);
  await page.selectOption('#rate', '0.5');
  expect(await page.evaluate(() => __app.media.playbackRate)).toBe(0.5);
  await noErrors(errors);
});

test('A-Bくり返し：Bまで来たらAへもどる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="rec"]');
  await page.evaluate(() => __app.seek(10));
  await page.click('#setA');
  await page.evaluate(() => __app.seek(10.6));
  await page.click('#setB');
  await page.evaluate(() => __app.seek(10));
  await page.click('#play');
  await page.waitForTimeout(1500);
  const p = await page.evaluate(() => { const x = __app.pos(); __app.stop(); return x; });
  expect(p).toBeGreaterThanOrEqual(9.95);
  expect(p).toBeLessThan(10.75);
  await noErrors(errors);
});

test('テンポマップのくり返し・D.S. どおりに、小節の目印の番号がもどる', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    // A 2小節（くり返し）・B 1小節・Coda 1小節、B のおわりで A へもどり、A のあと Coda。4/4 ♩=120 は1小節2秒
    const m = { start: 1, sections: [{ id: 'a', bars: 2, meter: '4/4', unit: '4', bpm: 120, rep: 2 }, { id: 'b', bars: 1, meter: '4/4', unit: '4', bpm: 120 }, { id: 'c', bars: 1, meter: '4/4', unit: '4', bpm: 120 }], plans: [{ id: 'p', cut: [] }], jump: { at: 'b', to: 'a', until: 'a', next: 'c' } };
    const x = __app.barsFromMap(m, 'p', 0);
    const n = __app.N(); n.bars.marks = x.marks; n.bars.start = x.start; n.bars.nums = x.nums;
    return { marks: x.marks, nums: x.nums, at: [__app.barAt(n, 0.5), __app.barAt(n, 4.5), __app.barAt(n, 10.5), __app.barAt(n, 14.5)] };
  });
  expect(r.marks).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  expect(r.nums).toEqual([1, 2, 1, 2, 3, 1, 2, 4]);
  expect(r.at).toEqual([1, 1, 1, 4]);
  // 共有コード（テンポマップ v2 の r と j）も読める
  const code = await page.evaluate(() => { const o = { v: 1, t: 'くり返しの曲', st: 1, s: [['A', 2, '4/4', '4', 120, null, 0, '', ''], ['B', 1, '4/4', '4', 120, null, 0, '', ''], ['Coda', 1, '4/4', '4', 120, null, 0, '', '']], p: [['なし', []]], pi: 0, r: [2, 1, 1], j: [1, 0, 0, 2] }; const b = new TextEncoder().encode(JSON.stringify(o)); return 'TMJ' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); });
  await page.click('[data-tab="bars"]');
  await page.locator('#tmCode').fill(code); await page.locator('#tmCode').press('Tab');
  await page.locator('#tmAt').fill('0');
  await page.click('#tmGo');
  const b = await page.evaluate(() => __app.N().bars);
  expect(b.nums).toEqual([1, 2, 1, 2, 3, 1, 2, 4]);
  await expect(page.locator('#mkSum')).toContainText('くり返しあり');
  // 手で目印を足すと、ふつうの続き番号にもどる
  await page.evaluate(() => { __app.seek(20); });
  await page.click('#tapBtn');
  expect(await page.evaluate(() => __app.N().bars.nums)).toBe(null);
  await noErrors(errors);
});

test('コメントのパートのボタンは、楽屋にいるパートだけ（「ほかのパート」で全部）', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('gakuya.org', JSON.stringify({ org: { type: 'chu' }, members: [{ name: 'A', grade: '中1', part: 'Fl' }, { name: 'B', grade: '中2', part: 'Cl' }, { name: 'C', grade: '中2', part: 'Tp', status: 'gone' }] })); } });
  const errors = await openApp(page);
  await page.click('[data-tab="rec"]');
  const parts = () => page.locator('#cParts [data-p]').evaluateAll(xs => xs.map(x => x.dataset.p));
  expect(await parts()).toEqual(['全体', 'Fl', 'Cl']);   // 卒業・退部の人のパート（Tp）は出さない
  await page.click('#cAllP');
  expect((await parts()).length).toBeGreaterThan(15);
  await page.locator('#cParts [data-p="Tuba"]').click();
  await page.click('#cAllP');
  expect(await parts()).toEqual(['全体', 'Fl', 'Cl', 'Tuba']);   // 選んだパートは、しぼっても出したまま
  await noErrors(errors);
});
