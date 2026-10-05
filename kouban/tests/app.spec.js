// コウバンの基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('起動すると例の演奏会が出て、エラーが出ない', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('.sample-flag')).toBeVisible();
  await expect(page.locator('#pieceBar .piecechip')).toHaveCount(5); // 「すべての曲」＋4曲
  const r = await page.evaluate(() => { const a = __app.analyze(__app.P()); return { bad: a.issues.filter(x => x.lv === 'bad').length, warn: a.issues.filter(x => x.lv === 'warn').length, filled: a.filled, total: a.slotsTotal }; });
  expect(r.bad).toBeGreaterThan(0);            // 例ではチャイムが空いている
  expect(r.warn).toBeGreaterThan(0);           // 例では1曲で2つ受け持っている人がいる
  expect(r.filled).toBe(r.total - 1);
  await noErrors(errors);
});

test('受け持ちを選ぶと保存され、元に戻せる', async ({ page }) => {
  const errors = await openApp(page);
  const first = page.locator('.slot select').first();
  const before = await first.inputValue();
  await first.selectOption('');
  await expect(page.locator('.slot').first()).toHaveClass(/hole/);
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('kouban.v1')); const p = s.projects[s.current]; const pc = p.pieces[0]; return p.assign[pc.id][pc.slots[0].id] || ''; });
  expect(saved).toBe('');
  await page.click('#btnUndo');
  await expect(page.locator('.slot select').first()).toHaveValue(before);
  await noErrors(errors);
});

test('空きを埋める案：空けた所に楽器の合う人が入る', async ({ page }) => {
  const errors = await openApp(page);
  // 1曲目のPic（ピッコロ）を空けると、持ち替えできる人が入る
  await page.evaluate(() => { const p = __app.P(); const pc = p.pieces[0]; const s = pc.slots.find(x => x.label === 'Pic'); delete p.assign[pc.id][s.id]; __app.renderAll(); });
  await page.click('.piecechip[data-pc]:nth-child(2)');
  await page.click('[data-fill]');
  await expect(page.locator('.gky-sheet')).toContainText('Pic');
  await page.click('.gky-sheet footer .btn.primary');
  const who = await page.evaluate(() => { const p = __app.P(); const pc = p.pieces[0]; const s = pc.slots.find(x => x.label === 'Pic'); const m = p.members.find(x => x.id === p.assign[pc.id][s.id]); return m && m.name; });
  expect(who).toBe('青木 美咲');
  await noErrors(errors);
});

test('香盤表のマスから受け持ちを変えられる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="matrix"]');
  await expect(page.locator('table.mx')).toBeVisible();
  const cell = page.locator('td.cell').first();
  await cell.click();
  await expect(page.locator('.gky-sheet')).toBeVisible();
  await page.locator('.gky-sheet input[type=checkbox]').first().uncheck();
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('.gky-sheet')).toHaveCount(0);
  await noErrors(errors);
});

test('欠席シミュレーション：休みにした人の所と代わりの候補が出る', async ({ page }) => {
  const errors = await openApp(page);
  // 宝島はユーフォニアムが1人だけなので、そこに入っている人を休みにすると、もう1人が候補に出る
  const who = await page.evaluate(() => { const p = __app.P(); const pc = p.pieces[2]; const s = pc.slots.find(x => x.label === 'Euph'); const id = p.assign[pc.id][s.id]; const m = p.members.find(x => x.id === id); const n = p.pieces.filter(q => Object.values(p.assign[q.id]).includes(id)).length; return { name: m.name, n }; });
  await page.click('[data-tab="check"]');
  await page.locator('#absentPick [data-m]', { hasText: who.name }).click();
  await expect(page.locator('#holeList .issue')).toHaveCount(who.n);
  await expect(page.locator('#holeList [data-sub]')).toHaveCount(1);
  await page.locator('#holeList [data-sub]').first().click();
  await expect(page.locator('#holeList .issue')).toHaveCount(who.n - 1);
  await noErrors(errors);
});

test('印刷のプレビュー：香盤表・曲ごと・カードがページに分かれる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="out"]');
  for (const id of ['#prMatrix', '#prPieces', '#prCards']) {
    await page.click(id);
    await expect(page.locator('.gky-pv .gky-page').first()).toBeVisible();
    // ページの中身がはみ出していない
    const r = await page.evaluate(() => {
      const bodies = Array.from(document.querySelectorAll('.gky-pv .pg-body'));
      const over = bodies.some(b => { const last = b.lastElementChild; return last && last.getBoundingClientRect().bottom > b.getBoundingClientRect().bottom + 1; });
      // 最後のページ以外は、ページの半分より多く使っている（1ページに1行だけ、のような分け方になっていない）
      const thin = bodies.slice(0, -1).some(b => { const last = b.lastElementChild; return !last || (last.getBoundingClientRect().bottom - b.getBoundingClientRect().top) < b.getBoundingClientRect().height * 0.5; });
      return { over, thin, n: bodies.length };
    });
    expect(r.over).toBe(false);
    expect(r.thin).toBe(false);
    await page.click('.gky-pv [data-act="close"]');
  }
  await noErrors(errors);
});

test('ファイルに保存した形から同じ演奏会に戻せる', async ({ page }) => {
  const errors = await openApp(page);
  const same = await page.evaluate(() => { const p = __app.P(); const q = __app.normalizeProject(JSON.parse(JSON.stringify(p))); return JSON.stringify(q.assign) === JSON.stringify(p.assign) && q.pieces.length === p.pieces.length && q.members.length === p.members.length; });
  expect(same).toBe(true);
  await noErrors(errors);
});

test('ステマネのファイルから曲を読み込める', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="pieces"]');
  const file = { app: 'stagemane', format: 1, concert: { info: { title: '春の演奏会', date: '2027-03-20' }, program: [
    { id: 'a', type: 'part', name: '第1部' }, { id: 'b', type: 'piece', title: 'ジュビラント序曲', composer: 'A.リード', dur: 420 }, { id: 'c', type: 'mc', text: 'こんにちは' }, { id: 'd', type: 'piece', title: '星条旗よ永遠なれ', composer: 'J.P.スーザ' } ] } };
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnImportStagemane');
  await (await chooser).setFiles({ name: 'concert.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await expect(page.locator('.gky-sheet')).toContainText('ジュビラント序曲');
  await expect(page.locator('.gky-sheet')).toContainText('すでにある1曲');
  await page.click('.gky-sheet footer .btn.primary');
  const titles = await page.evaluate(() => __app.P().pieces.map(x => x.title));
  expect(titles).toContain('ジュビラント序曲');
  expect(titles.filter(t => t === '星条旗よ永遠なれ').length).toBe(1);
  await noErrors(errors);
});

test('バミリの配置図に名前を入れられる（同じパートは左の席から）', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const items = [
      { id: 'a', t: 'player', label: 'Tp', x: 300, y: 100 }, { id: 'b', t: 'player', label: 'Tp', x: 100, y: 100 }, { id: 'c', t: 'player', label: 'Tp', x: 200, y: 100 }, { id: 'd', t: 'player', label: 'Tp', x: 400, y: 100 },
      { id: 'e', t: 'player', label: 'Pic', x: 50, y: 50 }, { id: 'f', t: 'circle', label: 'S.D.', x: 500, y: 50 }, { id: 'g', t: 'circle', label: '32"', v: 'ring', x: 10, y: 10 }, { id: 'h', t: 'conductor', label: '指揮', x: 0, y: 0 },
    ];
    const bm = { title: 'テスト', W: 1000, D: 600, items, raw: { title: 'テスト', W: 1000, D: 600, items } };
    const p = __app.P();
    const out = __app.fillBamiri(bm, p.pieces[0].id);
    const name = id => out.doc.items.find(i => i.id === id).name;
    const tp1 = p.pieces[0].slots.filter(s => s.label === 'Tp1').map(s => p.members.find(m => m.id === p.assign[p.pieces[0].id][s.id]).name);
    return { left: name('b'), second: name('c'), pic: name('e'), sd: name('f'), tp1, miss: out.miss.length, shown: out.doc.showNames };
  });
  expect(r.left).toBe(r.tp1[0]);
  expect(r.second).toBe(r.tp1[1]);
  expect(r.pic).toBe('青木 美咲');
  expect(r.sd).toBeTruthy();
  expect(r.miss).toBeGreaterThan(0);   // 席が足りないパートは「見つからない」に出る
  expect(r.shown).toBe(true);
  await noErrors(errors);
});

test('楽屋の部員を読み込める（同じ場所に置いたとき）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ app: 'gakuya', format: 1, org: { name: 'テスト吹奏楽団' }, members: [{ id: 'm1', name: '楽屋 太郎', grade: '中1', part: 'クラリネット' }, { id: 'm2', name: '楽屋 花子', grade: '中2', part: 'Tp' }] })));
  await page.click('[data-tab="members"]');
  await page.click('#btnFromOrg');
  await expect(page.locator('.gky-sheet')).toContainText('2人を足す');
  await page.click('.gky-sheet footer .btn.primary');
  const r = await page.evaluate(() => __app.P().members.map(m => m.name + ':' + m.part));
  expect(r).toEqual(['楽屋 太郎:Cl', '楽屋 花子:Tp']);   // 例の部員は消えて、パートは記号にそろう
  await noErrors(errors);
});
