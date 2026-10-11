// 楽譜ライブラリ v4：譜面の配布と回収
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const SONGS = [
  { id: 's1', title: '宝島', composer: '和泉宏隆', parts: ['Tp1', 'Tp2', 'Hn', 'Hn'], inv: {} },
  { id: 's2', title: 'ふるさと', composer: '岡野貞一', parts: ['Tp1'], inv: {} },
  { id: 's3', title: 'アルヴァマー序曲', composer: 'J.バーンズ', parts: ['Tp1'], inv: {} },
];
async function seed(page, extra = {}) {
  await page.evaluate(([songs, extra]) => {
    localStorage.setItem('gakufu.v1', JSON.stringify(Object.assign({ v: 1, songs, setlists: [{ id: 'l1', title: '定期演奏会', date: '2026-12-20', concert: 'c1', ids: ['s1', 's2'] }], slCur: 'l1' }, extra)));
    localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト高校' }, members: [{ id: 'a', name: '赤井', part: 'Tp', status: 'active' }, { id: 'b', name: '石田', part: 'Tp', status: 'active' }, { id: 'c', name: '上野', part: 'Hn', status: 'active' }], concerts: [{ id: 'c1', title: '定期演奏会', date: '2026-12-20' }] }));
  }, [SONGS, extra]);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
}

test('配布・回収：コウバンの受け持ちから入れる（曲目一覧にない曲は足す）→ 配った・返った・まとめて', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.evaluate(() => localStorage.setItem('kouban.v1', JSON.stringify({ v: 1, current: 'k1', order: ['k1'], projects: { k1: { id: 'k1', title: '定演の香盤', concert: 'c1', date: '2026-12-20',
    members: [{ id: 'a', name: '赤井' }, { id: 'b', name: '石田' }, { id: 'c', name: '上野' }],
    pieces: [{ id: 'p1', title: '宝島', slots: [{ id: 'x1', label: 'Tp1' }, { id: 'x2', label: 'Tp2' }, { id: 'x3', label: 'Hn' }] }, { id: 'p2', title: 'アルヴァマー序曲', slots: [{ id: 'y1', label: 'Tp1' }] }, { id: 'p3', title: '台帳にない曲', slots: [{ id: 'z', label: 'Tp1' }] }],
    assign: { p1: { x1: 'a', x2: 'b', x3: 'c' }, p2: { y1: 'b' }, p3: { z: 'a' } } } } })));
  await page.click('[data-tab="dist"]');
  await expect(page.locator('#dsList')).toContainText('まだ記録がありません');
  await expect(page.locator('#dsKouban')).toBeVisible();
  await page.click('#dsKouban');
  await expect(page.locator('.gky-toast')).toContainText('コウバンの「定演の香盤」から4枚を入れました（曲目一覧に1曲を足しました）。台帳にない曲：台帳にない曲');
  const L = await page.evaluate(() => { const l = __app.S.setlists[0]; return { ids: l.ids, d: l.dist.map(r => [r.song, r.part, r.who]) }; });
  expect(L.ids).toEqual(['s1', 's2', 's3']);
  expect(L.d).toEqual([['s1', 'Tp1', '赤井'], ['s1', 'Tp2', '石田'], ['s1', 'Hn', '上野'], ['s3', 'Tp1', '石田']]);
  // 人ごと：石田は2枚
  const grp = page.locator('#dsList tr.dgrp', { hasText: '石田' });
  await expect(grp).toContainText('2枚・配った 0・返った 0');
  await grp.locator('[data-gall="out"]').click();
  await expect(page.locator('#dsList tr.dgrp', { hasText: '石田' })).toContainText('2枚・配った 2・返った 0');
  await expect(page.locator('#dsSum')).toContainText('4枚・配った 2・返った 0・まだ 2');
  await expect(page.locator('#cntDist')).toHaveText('2');
  // 1枚返った
  await page.locator('#dsList tr', { hasText: 'アルヴァマー序曲' }).locator('[data-dk="back"]').click();
  await expect(page.locator('#dsSum')).toContainText('返った 1・まだ 1');
  // まだ返っていないものだけ
  await page.locator('#dsOpen').check();
  await expect(page.locator('#dsList tbody tr:not(.dgrp)')).toHaveCount(1);
  await page.locator('#dsOpen').uncheck();
  // もう一度入れても、2つにならない
  await page.click('#dsKouban');
  await expect(page.locator('.gky-toast')).toContainText('もう全部入っています');
  // 曲ごと
  await page.click('#dsView [data-v="song"]');
  await expect(page.locator('#dsList tr.dgrp').first()).toContainText('宝島');
  await noErrors(errors);
});

test('配布・回収：曲のパートから行を作る → だれを入れる。原本をなくすと台帳で欠けにする。印刷・コピー', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.click('[data-tab="dist"]');
  await expect(page.locator('#dsKouban')).toBeHidden();
  await page.click('#dsParts');
  let d = await page.evaluate(() => __app.S.setlists[0].dist.map(r => [r.song, r.part, r.who]));
  expect(d).toEqual([['s1', 'Tp1', ''], ['s1', 'Tp2', ''], ['s1', 'Hn', ''], ['s1', 'Hn', ''], ['s2', 'Tp1', '']]);
  await page.click('#dsParts');
  await expect(page.locator('.gky-toast')).toContainText('もう行があります');
  // だれを入れる（人ごとの見かた：はじめは「だれかまだ」）
  await expect(page.locator('#dsList tr.dgrp')).toHaveText(/（だれかまだ）/);
  const w = page.locator('#dsList input[data-dk="who"]');
  await w.nth(0).fill('赤井'); await w.nth(0).press('Tab');
  await page.locator('#dsList input[data-dk="who"]').nth(1).fill('赤井'); await page.locator('#dsList input[data-dk="who"]').nth(1).press('Tab');
  d = await page.evaluate(() => __app.S.setlists[0].dist.filter(r => r.who).map(r => [r.song, r.part]));
  expect(d.length).toBe(2);
  // 配って、原本をなくした → 台帳で欠け
  await page.locator('#dsList tr.dgrp', { hasText: '赤井' }).locator('[data-gall="out"]').click();
  const r2 = page.locator('#dsList tbody tr:not(.dgrp)').first();
  await r2.locator('[data-dk="orig"]').check();
  await page.locator('#dsList tbody tr:not(.dgrp)').first().locator('[data-dk="lost"]').check();
  const s = await page.evaluate(() => { const l = __app.S.setlists[0], r = l.dist.find(x => x.lost); return { r: [r.song, r.part], inv: __app.S.songs.find(x => x.id === r.song).inv[r.part] }; });
  expect(s.inv.st).toBe('missing');
  await expect(page.locator('.gky-toast')).toContainText('台帳で「欠けている」にしました');
  // 印刷：配布表・まだ返っていない一覧
  await page.click('#dsPrint');
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('譜面の配布表');
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('赤井');
  await page.click('.gky-pv [data-act="close"]');
  await page.click('#dsPrintOpen');
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('まだ返っていない分');
  await page.click('.gky-pv [data-act="close"]');
  const txt = await page.evaluate(async () => { let out = ''; const c = GKY.copyText; GKY.copyText = async t => { out = t; return true; }; document.querySelector('#dsCopy').click(); await new Promise(r => setTimeout(r, 50)); GKY.copyText = c; return out; });
  expect(txt).toMatch(/^【定期演奏会　譜面の回収】まだ返っていない譜面です。持ってきてください。\n・赤井：/);
  await noErrors(errors);
});

test('配布・回収：本番がすぎて返っていないものは「まだ返っていない」と出る。部員用の端末にはタブがない', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-10T10:00:00'));
  const errors = await openApp(page);
  await seed(page, { setlists: [{ id: 'l1', title: '定期演奏会', date: '2026-12-20', ids: ['s1'], dist: [{ id: 'd1', song: 's1', part: 'Tp1', who: '赤井', out: '2026-11-01' }] }] });
  await page.click('[data-tab="dist"]');
  await expect(page.locator('#dsList [data-dk="back"]')).toHaveText('まだ返っていない');
  await expect(page.locator('#dsList [data-dk="back"]')).toHaveClass(/late/);
  await page.evaluate(() => { const o = JSON.parse(localStorage.getItem('gakuya.org')); o.org.role = 'member'; o.org.member = { tools: ['gakufu'] }; localStorage.setItem('gakuya.org', JSON.stringify(o)); });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('[data-tab="dist"]')).toBeHidden();
  await noErrors(errors);
});
