// コウバン v3：バミリの席が足りない人・楽屋の本番・楽譜ライブラリの曲目一覧・出欠・仮引退
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

/* 部員6人・2曲の演奏会（Tp が3人、Hn が2人、Fl が1人） */
async function smallProject(page, extra = {}) {
  await page.evaluate(extra => {
    const members = [['m1', '赤井', 'Tp'], ['m2', '石田', 'Tp'], ['m3', '上野', 'Tp'], ['m4', '江口', 'Hn'], ['m5', '大野', 'Hn'], ['m6', '加藤', 'Fl']].map(([id, name, part]) => ({ id, name, part, grade: '高2', status: 'active', active: true }));
    const slots = [['s1', 'Tp1'], ['s2', 'Tp2'], ['s3', 'Tp3'], ['s4', 'Hn1'], ['s5', 'Hn2'], ['s6', 'Fl']].map(([id, label]) => ({ id, label, role: '' }));
    const assign = { p1: { s1: 'm1', s2: 'm2', s3: 'm3', s4: 'm4', s5: 'm5', s6: 'm6' }, p2: { s1b: 'm1' } };
    const p = Object.assign({ id: 'k1', title: '定期演奏会', date: '2026-12-20', kind: 'concert', members, absent: [], pieces: [{ id: 'p1', title: '宝島', composer: '', slots }, { id: 'p2', title: 'ふるさと', composer: '', slots: [{ id: 's1b', label: 'Tp1', role: '' }] }], assign }, extra);
    localStorage.setItem('kouban.v1', JSON.stringify({ v: 1, current: 'k1', order: ['k1'], projects: { k1: p } }));
  }, extra);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
}
const BM = { title: '舞台', W: 1400, D: 900, items: [{ id: 'a', t: 'player', label: 'Tp', x: 300, y: 200, w: 46, h: 46, r: 0 }, { id: 'b', t: 'player', label: 'Tp', x: 380, y: 200, w: 46, h: 46, r: 0 }, { id: 'c', t: 'player', label: 'Hn', x: 300, y: 300, w: 46, h: 46, r: 0 }, { id: 'd', t: 'player', label: 'Hn', x: 380, y: 300, w: 46, h: 46, r: 0 }, { id: 'e', t: 'player', label: 'Cl', x: 600, y: 300, w: 46, h: 46, r: 0 }] };

test('バミリ：パートごとの表で席が足りない人がわかる。足りない人の席を名前つきで足せる', async ({ page }) => {
  const errors = await openApp(page);
  await smallProject(page);
  await page.evaluate(bm => localStorage.setItem('bamiri.current', JSON.stringify(bm)), BM);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('[data-tab="out"]');
  await page.click('#bmLocal');
  const res = page.locator('#bmResult');
  await expect(res).toContainText('席が足りない人 2人');
  // パートごと：トランペットは席2・受け持ち3・足りない「上野」、フルートは席0、クラリネットは席があまる
  const tp = res.locator('.bm-tbl tbody tr', { hasText: 'トランペット' });
  await expect(tp.locator('td')).toHaveText(['トランペット', '2', '3', '2', '上野（Tp3）', '']);
  await expect(res.locator('.bm-tbl tbody tr', { hasText: 'フルート' })).toContainText('加藤（Fl）');
  await expect(res.locator('.bm-tbl tbody tr', { hasText: 'クラリネット' }).locator('td').last()).toHaveText('1');
  await expect(res.locator('.bm-tbl tr.short')).toHaveCount(2);
  // 足りない人の席を足す（はじめから入っている）
  await expect(res).toContainText('2人分の席を足しました：上野、加藤');
  const doc = await page.evaluate(() => { const bm = GKY.bamiri(JSON.parse(localStorage.getItem('bamiri.current'))); return __app.fillBamiri(bm, 'p1', { addSeats: true }).doc; });
  const ueno = doc.items.find(i => i.name === '上野'), kato = doc.items.find(i => i.name === '加藤');
  expect([ueno.label, ueno.t, ueno.y]).toEqual(['Tp3', 'player', 200]);       // トランペットの席のとなり（右）
  expect(ueno.x).toBeGreaterThan(380);
  expect(kato.label).toBe('Fl');
  expect(doc.items.length).toBe(7);
  // 外すと、席は足さない
  await res.locator('#bmAdd').uncheck();
  await expect(res).not.toContainText('席を足しました');
  // 曲ごとの足りない人数
  await res.locator('details summary').click();
  await expect(res.locator('[data-bmpc="p2"]')).toContainText('全員の席あり');
  await expect(res.locator('[data-bmpc="p1"]')).toContainText('足りない 2人');
  await noErrors(errors);
});

test('楽屋の本番から開くと、香盤表を作るか聞き、楽屋の部員で作る。曲目一覧から曲を入れられる', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => {
    localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト高校', type: 'koko' }, members: [{ id: 'a', name: '赤井', part: 'Tp', status: 'active' }, { id: 'b', name: '石田', part: 'Hn', status: 'semi' }, { id: 'c', name: '卒業', part: 'Fl', status: 'gone' }], concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2026-12-20' }] }));
    localStorage.setItem('gakufu.v1', JSON.stringify({ v: 1, songs: [{ id: 's1', title: '宝島', composer: '和泉宏隆', arranger: '真島俊夫', parts: ['Tp1', 'Hn1', 'Ob'], opt: ['Ob'] }, { id: 's2', title: 'ふるさと', parts: ['Tp1'] }], setlists: [{ id: 'l0', title: '別の演奏会', date: '2026-08-01', ids: ['s2'] }, { id: 'l1', title: '定演の曲目', date: '2026-12-20', ids: ['s1', 's2'] }] }));
  });
  await page.goto('/index.html?test#concert=c1');
  await page.waitForFunction(() => window.__app && window.__app.ready);
  const sh = page.locator('.gky-sheet', { hasText: 'まだありません' });
  await expect(sh).toContainText('第13回 定期演奏会');
  await sh.locator('footer .btn.primary').click();
  let p = await page.evaluate(() => __app.P());
  expect([p.title, p.date, p.concert, p.members.map(m => m.name).join()]).toEqual(['第13回 定期演奏会', '2026-12-20', 'c1', '赤井,石田']);
  expect(p.members.find(m => m.name === '石田').active).toBe(false);   // 仮引退：はじめは候補に入れない
  expect(await page.evaluate(() => location.hash)).toBe('');
  // 曲目一覧から（同じ日付の一覧が先に出て、選ばれている）
  await page.click('#btnImportSetlist');
  const sl = page.locator('.gky-sheet', { hasText: '曲目一覧から' });
  await expect(sl.locator('.item').first()).toContainText('この本番');
  await sl.locator('footer .btn.primary').click();
  p = await page.evaluate(() => __app.P());
  expect(p.pieces.map(x => [x.title, x.composer, x.slots.map(s => s.label + (s.opt ? '?' : '')).join()])).toEqual([['宝島', '和泉宏隆／真島俊夫 編曲', 'Tp1,Hn1,Ob?'], ['ふるさと', '', 'Tp1']]);
  // 仮引退の人を候補に入れる
  await page.click('#btnProj');
  await page.locator('#pjSemi').check();
  await page.click('.gky-sheet footer .btn.primary');
  p = await page.evaluate(() => __app.P());
  expect([p.semiOk, p.members.find(m => m.name === '石田').active, p.members.find(m => m.name === '石田').status]).toEqual([true, true, 'semi']);
  // 読み直しても仮引退のまま
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  expect(await page.evaluate(() => __app.P().members.find(m => m.name === '石田').status)).toBe('semi');
  // もう一度楽屋の本番から開くと、作らずにこの香盤表を開く
  await page.evaluate(() => { location.hash = 'concert=c1'; });
  await expect(page.locator('.gky-toast')).toContainText('香盤表を開きました');
  await noErrors(errors);
});

test('演奏会の設定で楽屋の本番とつなぐ（＋で楽屋の本番の一覧に入れる）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト' }, concerts: [{ id: 'c1', title: '定演', date: '2026-12-20', venue: '市民会館' }] })));
  await smallProject(page, { title: '新しい演奏会', date: '' });
  await page.click('#btnProj');
  await page.locator('[data-gky-concert]').selectOption('c1');
  await expect(page.locator('#pjTitle')).toHaveValue('定演');
  await expect(page.locator('#pjDate')).toHaveValue('2026-12-20');
  await page.click('.gky-sheet footer .btn.primary');
  expect(await page.evaluate(() => __app.P().concert)).toBe('c1');
  // ＋：ここの名前と日付で、楽屋の本番を作る
  await page.click('#btnProj');
  await page.locator('#pjTitle').fill('クリスマスコンサート');
  await page.locator('#pjDate').fill('2026-12-24');
  await page.locator('[data-gky-concert]').selectOption('+');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => ({ p: __app.P().concert, cs: JSON.parse(localStorage.getItem('gakuya.org')).concerts.map(c => [c.id, c.title, c.date]) }));
  expect(r.cs.length).toBe(2);
  expect(r.cs.find(c => c[0] === r.p).slice(1)).toEqual(['クリスマスコンサート', '2026-12-24']);
  await noErrors(errors);
});

test('出欠から「休み」を入れる：その日の欠席の人だけ（遅刻・早退は知らせるだけ）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('shukketsu.v1', JSON.stringify({ v: 1, events: [{ id: 'e1', date: '2026-12-20', title: '定期演奏会', kind: 'show' }, { id: 'e2', date: '2026-12-19', title: 'リハーサル' }], att: { e1: { '赤井': { s: 'a', r: '法事' }, '石田': { s: 'l', r: '' }, '加藤': { s: 'p' } }, e2: { '上野': { s: 'a' } } } })));
  await smallProject(page);
  await page.click('[data-tab="members"]');
  await page.click('#btnFromAtt');
  const sh = page.locator('.gky-sheet', { hasText: '出欠から' });
  await expect(sh).toContainText('赤井（法事）');
  await expect(sh).toContainText('石田（遅刻）');
  await expect(sh).not.toContainText('上野');
  await sh.locator('footer .btn.primary').click();
  expect(await page.evaluate(() => __app.P().absent)).toEqual(['m1']);
  await noErrors(errors);
});
