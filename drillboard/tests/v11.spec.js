// v11：ゲートターン・平行四辺形・形をくり返して並べる・動画から隊形を拾う（続けて拾う・まとめる）
// 動画のテストは、tests/fixtures/make_floor_test.py で作った絵の動画（30m四方のフロアと12人）を使います
const path = require('path');
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');
const VID = path.join(__dirname, 'fixtures', 'floor_test.webm');
const TRUTH = require('./fixtures/floor_test.json');

async function block(page){
  await page.evaluate(() => { const D = __db, S = D.S; D.setMode('edit'); const ids = S.performers.slice(0, 12).map(p => p.id);
    [0, 1].forEach(i => ids.forEach((id, k) => { S.sets[i].pos[id] = [-3.75 + (k % 4) * 2.5, 5 - Math.floor(k / 4) * 2.5]; }));
    S.sets[2].pos = JSON.parse(JSON.stringify(S.sets[1].pos)); D.changed(true); });
}

test('ゲートターン：列ごとに、それぞれの端を軸にして回る', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  await block(page);
  await page.evaluate(() => { const D = __db; D.goSet(2); D.ui.sel = new Set(D.S.performers.slice(0, 12).map(p => p.id)); D.ui.rotMode = 'rank'; D.ui.rankAxis = 'h'; D.ui.rankEnd = 'a'; D.ui.rotDeg = 90; D.ui.rotDir = -1; D.ui.rotOpen = true; D.openTab('sets'); });
  await expect(page.locator('#rotBox')).toContainText('3本見つけました');
  await page.click('[data-act="rotApply"]');
  const r = await page.evaluate(() => { const S = __db.S, A = S.sets[1].pos, B = S.sets[2].pos, ids = S.performers.slice(0, 12).map(p => p.id);
    return ids.map(id => [A[id], B[id].map(v => Math.round(v * 100) / 100), S.sets[2].pat[id].c]); });
  // 左の端の人は動かず、ほかの人は左の端のまわりを90°回る
  expect(r[0][1]).toEqual(r[0][0]);
  expect(r[1][1]).toEqual([r[0][0][0], r[0][0][1] - 2.5]);
  expect(r[5][2]).toEqual(r[4][0]);
  await noErrors(errors);
});

test('平行四辺形：後ろの列ほど右へずれる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await block(page);
  await page.evaluate(() => { const D = __db; D.goSet(1); D.ui.sel = new Set(D.S.performers.slice(0, 12).map(p => p.id)); D.onSel(); });
  await page.click('[data-tool="shearR"]');
  const r = await page.evaluate(() => { const S = __db.S, P = S.sets[1].pos; return [0, 4, 8].map(k => P[S.performers[k].id][0]); });
  expect(r[0]).toBeGreaterThan(r[1]);   // 後ろ（上の行）ほど右
  expect(r[1]).toBeGreaterThan(r[2]);
});

test('形をくり返して並べる：3人の斜めの形を4組、格子に並べる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db, S = D.S; D.setMode('edit'); D.goSet(1); const P = S.sets[1].pos, ids = S.performers.slice(0, 12).map(p => p.id);
    [[0, 0], [1.25, 1.25], [2.5, 2.5]].forEach((q, k) => { P[ids[k]] = q; }); D.changed(true);
    D.ui.sel = new Set(ids.slice(0, 3)); D.tplSet(); D.ui.tplCols = 2; D.ui.tplGx = 8; D.ui.tplGy = 8; D.ui.sel = new Set(ids); D.tplApply();
    const pts = ids.map(id => P[id]); const diag = new Set(pts.map(q => Math.round((q[0] - q[1]) * 10) / 10));
    const xs = new Set(pts.map(q => Math.round(q[0] * 10) / 10));
    return { n:pts.length, diag:diag.size, xs:xs.size }; });
  expect(r.n).toBe(12);
  expect(r.diag).toBeLessThanOrEqual(4);   // 斜めの形が4組（組ごとに x−y がそろう）
  expect(r.xs).toBe(6);
});

async function openVideo(page){
  await page.evaluate(() => { const D = __db; D.S = D.normalize(D.emptyShow('square')); D.afterLoad(true); D.openTab('conte'); });
  await page.click('[data-act="vidOpen"]');
  await page.locator('#vidIn').setInputFiles(VID);
  await page.waitForFunction(() => __db.vid.w > 0, null, { timeout:20000 });
  await page.evaluate(async () => { __db.vid.auto = false; await __db.vidSeek(0.5); });
  // 中の四角（20m）の四隅を、わざと少しずらして置く
  await page.selectOption('#vidRef', 'inner');
  return page.evaluate(c => { const D = __db; const H = D.homography([[-15, 15], [15, 15], [15, -15], [-15, -15]], c), inner = [[-10, 10], [10, 10], [10, -10], [-10, -10]].map(q => D.hApply(H, q[0], q[1]));
    D.vidSetCorners(inner.map((q, k) => [q[0] + [8, -6, 7, -9][k], q[1] - [8, -6, 7, -9][k]])); return inner; }, TRUTH.corners);
}

test('動画から隊形を拾う：線に合わせる → 人を見つける → セットにする', async ({ page }) => {
  const errors = await openApp(page);
  const inner = await openVideo(page);
  await page.click('[data-act="vidRefine"]');
  await expect.poll(() => page.evaluate(i => Math.max(...__db.vid.corners.map((q, k) => Math.hypot(q[0] - i[k][0], q[1] - i[k][1]))), inner)).toBeLessThan(5);
  await page.click('[data-act="vidDetect"]');
  await expect.poll(() => page.evaluate(() => __db.vid.dets.length)).toBe(12);
  const err = await page.evaluate(T => Math.max(...T.map(q => Math.min(...__db.vid.dets.map(d => Math.hypot(d.p[0] - q[0], d.p[1] - q[1]))))), TRUTH.people0);
  expect(err).toBeLessThan(0.5);
  await page.click('[data-act="vidCapture"][data-v="cur"]');
  expect(await page.evaluate(() => __db.S.performers.length)).toBe(12);
  // 4秒目（2m右へ動いたあと）：カメラを追いかけて合わせ直し、次のセットに
  await page.evaluate(async () => { __db.vid.auto = true; await __db.vidSeek(3.8); __db.vidDetect(true); });
  await page.click('[data-act="vidCapture"][data-v="new"]');
  const mv = await page.evaluate(() => { const S = __db.S; return S.performers.map(p => S.sets[1].pos[p.id][0] - S.sets[0].pos[p.id][0]); });
  mv.forEach(d => expect(Math.abs(d - 2)).toBeLessThan(0.5));
  await noErrors(errors);
});

test('続けて拾う → まっすぐの所をまとめる', async ({ page }) => {
  await openApp(page);
  await openVideo(page);
  await page.evaluate(() => { __db.vidRefine(true, [24, 12, 6, 3]); __db.vidDetect(true); });
  await page.click('[data-act="vidCapture"][data-v="cur"]');
  const made = await page.evaluate(async () => { const v = __db.vid; v.autoN = 1; v.autoEnd = 3.9; v.auto = true; v.lastT = v.t; return __db.vidAutoRun(); });
  expect(made).toBeGreaterThanOrEqual(6);
  const before = await page.evaluate(() => __db.S.sets.length);
  const removed = await page.evaluate(() => { const ix = __db.songSets(0); return __db.vidSimplify(ix[0], ix[ix.length - 1], 0.5); });
  const after = await page.evaluate(() => ({ n:__db.S.sets.length, hold:__db.S.sets[0].hold }));
  expect(removed).toBeGreaterThan(0);
  expect(after.n).toBeLessThan(before);
  expect(after.hold).toBeGreaterThan(0);   // 止まっている間は「静止」に
  // 最後のセット（4秒目の少し前）：全員がそろって右へ1.5〜2m動いている（動画では2秒目から2秒かけて2m右へ）
  const mv = await page.evaluate(() => { const S = __db.S, L = S.sets[S.sets.length - 1].pos; return S.performers.map(p => L[p.id][0] - S.sets[0].pos[p.id][0]); });
  const mean = mv.reduce((a, b) => a + b, 0) / mv.length;
  expect(mean).toBeGreaterThan(1.3); expect(mean).toBeLessThan(2.1);
  mv.forEach(d => expect(Math.abs(d - mean)).toBeLessThan(0.45));
});

test('ショー全体のカウントは1500まで・音源に動画ファイルも選べる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => { const D = __db; D.S.sets[1].counts = 1200; D.changed(true); return D.total(); });
  expect(r).toBeGreaterThan(1200);
  await page.evaluate(() => __db.openTab('aud'));
  expect(await page.locator('input[data-audio="0"]').getAttribute('accept')).toContain('video/mp4');
});

test('見失っていた人の動きをつなぎ直す：まわりと同じように動いて、次に見つかった位置に着く', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => { const D = __db, sh = D.emptyShow('square');
    for (let k = 0; k < 10; k++) sh.performers.push({ id:'q' + k, label:'Tp' + (k + 1), sec:'Tp' });
    D.S = D.normalize(sh); D.afterLoad(true); const S = D.S; D.setMode('edit');
    const ids = S.performers.filter(p => p.sec !== 'DM').map(p => p.id), lost = ids[0];
    while (S.sets.length < 6) D.vidAddSet(S.sets.length - 1, 4);
    S.sets.forEach((s, i) => { ids.forEach((id, k) => { s.pos[id] = [(k % 5) * 1.25 + i * 1, Math.floor(k / 5) * 1.25]; }); });
    // 2〜3セット目で見失って、前の位置に取り残されている
    S.sets[2].pos[lost] = [...S.sets[1].pos[lost]]; S.sets[3].pos[lost] = [...S.sets[1].pos[lost]];
    D.vid.lostOf = new WeakMap(); D.vid.lostOf.set(S.sets[2], [lost]); D.vid.lostOf.set(S.sets[3], [lost]); [0, 1, 4, 5].forEach(i => D.vid.lostOf.set(S.sets[i], []));
    D.changed(true); const n = D.vidRelink(0, S.sets.length - 1);
    return { n, x:[1, 2, 3, 4].map(i => Math.round(S.sets[i].pos[lost][0] * 100) / 100) }; });
  expect(r.n).toBe(1);
  expect(r.x).toEqual([1, 2, 3, 4]);
});

test('定点カメラ（ズームあり）：ズームして四隅が画面の外に出ても、フロアの正しい場所のまま', async ({ page }) => {
  const errors = await openApp(page);
  const Z = require('./fixtures/zoom_test.json');
  await page.evaluate(() => { const D = __db; D.S = D.normalize(D.emptyShow('square')); D.afterLoad(true); D.openTab('conte'); });
  await page.click('[data-act="vidOpen"]');
  await page.locator('#vidIn').setInputFiles(path.join(__dirname, 'fixtures', 'zoom_test.webm'));
  await page.waitForFunction(() => __db.vid.w > 0, null, { timeout:20000 });
  await page.evaluate(async () => { __db.vid.auto = false; await __db.vidSeek(0.5); });
  await page.selectOption('#vidRef', 'inner');
  const sc = await page.evaluate(W => __db.vid.w / W, Z.W);
  // ズームしていないコマ（0.5秒）で、中の四角の四隅を合わせる
  await page.evaluate(c => __db.vidSetCorners(c), Z.frames[5].inner.map(q => [q[0] * sc, q[1] * sc]));
  await page.selectOption('#vidCam', 'zoom');
  // 3.5秒：2.2倍にズームしたあと（手前の角は画面の外）。人は右へ1.5m動いている
  await page.evaluate(async () => { await __db.vidSeek(3.5); });
  const r = await page.evaluate(() => ({ c:__db.vid.corners, off:__db.vidOffCorners(), lost:!!__db.vid.lost }));
  const truth = Z.frames[35].inner.map(q => [q[0] * sc, q[1] * sc]);
  const err = Math.max(...r.c.map((q, k) => Math.hypot(q[0] - truth[k][0], q[1] - truth[k][1])));
  expect(r.lost).toBe(false);
  expect(r.off).toBeGreaterThanOrEqual(2);
  expect(err).toBeLessThan(8 * sc);
  // 人の足もとも、フロアの正しい場所に見つかる
  await page.evaluate(() => __db.vidDetect(true));
  const miss = await page.evaluate(P => P.filter(q => !__db.vid.dets.some(d => Math.hypot(d.p[0] - q[0], d.p[1] - q[1]) < 0.5)).length, Z.frames[35].people);
  expect(miss).toBe(0);
  // 画面の外の四隅まで見えるように小さくできる
  await page.click('[data-act="vidZoom"][data-v="-1"]');
  expect(await page.evaluate(() => __db.vid.view.s)).toBeLessThan(1);
  await noErrors(errors);
});
