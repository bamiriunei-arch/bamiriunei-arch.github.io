// ドリルの道具：自動割り当て・接触の直し方・間隔・左右対称・大会のルール
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');

test('だれがどこへ：行き先を入れかえると道のりが短くなり、交差がなくなる', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => {
    const D = __db, S = D.S, i = 2, st = S.sets[i];
    D.goSet(i); D.setMode('edit');
    const ids = S.performers.filter(p => p.sec !== 'DM').map(p => p.id);
    // わざと行き先をばらばらにする
    D.pushHist(); const old = ids.map(id => [...st.pos[id]]); ids.forEach((id, k) => st.pos[id] = old[(k * 7) % ids.length]); D.changed(true);
    const before = D.transStats(i, ids);
    D.ui.sel.clear(); D.assignRun(false, true, false);
    const after = D.transStats(i, ids);
    const spots = a => a.map(q => q.join(',')).sort().join('|');
    return { before, after, sameSpots:spots(old) === spots(ids.map(id => S.sets[i].pos[id])) };
  });
  expect(r.after.sum).toBeLessThan(r.before.sum);
  expect(r.after.cross).toBe(0);
  expect(r.sameSpots).toBe(true);   // 位置（形）は変わらない
  await noErrors(errors);
});

test('接触：出発を遅らせる案が見つかり、全部直すと接触がなくなる', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const D = __db, sh = D.emptyShow('square');
    sh.performers = [{ id:'a', label:'A1', sec:'Tp' }, { id:'b', label:'B1', sec:'Tb' }];
    // A は左から右へ、B は下から上へ。同じ時に真ん中を通る
    sh.sets = [{ name:'Set 1', counts:0, hold:0, pos:{ a:[-2.5, 0], b:[0, -2.5] }, sg:0 }, { name:'Set 2', counts:16, hold:0, pos:{ a:[2.5, 0], b:[0, 2.5] }, sg:0 }];
    D.S = D.normalize(sh); D.afterLoad(true); D.goSet(1); D.setMode('edit');
    const coll = D.analyzeAll()[1].coll.length, opts = D.fixOptions(1, 'a', 'b');
    D.fixAll();
    return { coll, opts:opts.length, after:D.analyzeAll()[1].coll.length, tm:D.S.sets[1].tm };
  });
  expect(r.coll).toBeGreaterThan(0);
  expect(r.opts).toBeGreaterThan(0);
  expect(r.after).toBe(0);
  expect(r.tm).toBeTruthy();
});

test('間隔：となりの人との間隔がわかる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const g = await page.evaluate(() => __db.gapSummary(0));
  expect(g.min).toBeGreaterThan(0);
  expect(g.med).toBeGreaterThanOrEqual(g.min);
});

test('左右対称：左側の形を右側に写すと、ずれがなくなる', async ({ page }) => {
  await openApp(page);
  const r = await page.evaluate(() => {
    const D = __db, sh = D.emptyShow('square');
    sh.performers = ['a', 'b', 'c', 'd'].map((id, k) => ({ id, label:'Tp' + (k + 1), sec:'Tp' }));
    sh.sets = [{ name:'Set 1', counts:0, hold:0, pos:{ a:[-5, 0], b:[-2.5, 2.5], c:[3.75, 0], d:[1.25, 5] }, sg:0 }];
    D.S = D.normalize(sh); D.afterLoad(true); D.goSet(0); D.setMode('edit'); D.ui.sel.clear();
    const before = D.symInfo(0).bad.length; D.mirrorSide('L2R'); const after = D.symInfo(0).bad.length;
    return { before, after, c:D.S.sets[0].pos.c, d:D.S.sets[0].pos.d };
  });
  expect(r.before).toBeGreaterThan(0);
  expect(r.after).toBe(0);
  expect(r.c).toEqual([5, 0]);
  expect(r.d).toEqual([2.5, 2.5]);
});

test('大会のルール：時間オーバーとフロアの外を見つける', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(() => {
    const D = __db, S = D.S; D.pushHist();
    S.rules.limit = 20; S.rules.on.time = true; S.sets[2].pos[S.performers[0].id] = [16, 0]; D.changed(true);
    const c = D.ruleCheck(); return { over:c.over > 0, outside:c.outside.map(x => x.i), parse:[D.parseMS('6:00'), D.parseMS('6'), D.parseMS('360')] };
  });
  expect(r.over).toBe(true);
  expect(r.outside).toContain(2);
  expect(r.parse).toEqual([360, 360, 360]);
  await page.evaluate(() => { __db.goSet(2); __db.openTab('sets'); });
  await expect(page.locator('#pane')).toContainText('エリアの外');
  await expect(page.locator('#songbar')).toContainText('制限 0:20');
});
