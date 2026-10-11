// ステマネの基本の動き（楽屋シリーズに入れたところ）
const path = require('path');
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const ORG = { app: 'gakuya', org: { name: 'テスト中学校 吹奏楽部', type: 'chu' }, members: [], concerts: [
  { id: 'c1', title: '第20回 定期演奏会', date: '2027-03-21', venue: '市民ホール', start: '14:00', kind: 'concert' },
  { id: 'c2', title: '夏の発表会', date: '2027-07-30', venue: '体育館', start: '', kind: 'event' },
] };
const setOrg = (page, o = ORG) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(o)), o);
const reopen = async (page, hash = '') => { await page.goto('/index.html?test' + hash); await page.waitForFunction(() => window.__app && window.__app.ready); };

test('はじめは例の演奏会。団体・指揮者・演奏会の名前は架空のもので、実在の名前とロゴは入っていない', async ({ page }) => {
  const errors = await openApp(page);
  const c = await page.evaluate(() => __app.C);
  expect(c.id).toBe('sample-sunsun11');
  expect(c.info.org).toBe('〇〇市立〇〇中学校吹奏楽部');
  expect(c.info.title).toBe('第11回 スプリングコンサート');
  expect(c.info.logo).toBe('');
  const all = await page.evaluate(() => document.body.innerText + JSON.stringify(localStorage));
  for (const bad of ['十三', '13中', '富岡', '藤田', 'サンサン', '豊中']) expect(all, bad).not.toContain(bad);
  await expect(page.locator('#editBody .intro')).toContainText('例の演奏会が入っています');
  // 楽屋のツールの一覧が「例だけ」と分かるように
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('stagemane.v1')).sample)).toBe(true);
  await page.click('#btnNew');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('stagemane.v1')).sample)).toBe(false);
  await noErrors(errors);
});

test('楽屋への戻り道と、このツールについて（更新内容）', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('#homeLink')).toHaveAttribute('href', '../gakuya/');
  await expect(page.locator('#homeLink')).toHaveAttribute('target', 'gky-gakuya');
  await page.click('#brand');
  const sh = page.locator('.gky-sheet');
  await expect(sh).toContainText('ステマネについて');
  await expect(sh).toContainText('v2');
  await expect(sh).toContainText('公開ページ');
  await noErrors(errors);
});

test('「基本情報」で楽屋の本番とつなぐ：新しい演奏会なら名前・日付・会場・開演も入る。つないだあとは名前を変えない', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page); await reopen(page);
  await page.click('#btnNew');
  await page.click('[data-etab="info"]');
  const sel = page.locator('#editBody [data-gky-concert]');
  await expect(sel).toHaveValue('');
  await sel.selectOption('c1');
  await expect.poll(() => page.evaluate(() => __app.C.info.concert)).toBe('c1');
  const i = await page.evaluate(() => __app.C.info);
  expect([i.title, i.date, i.venue, i.start]).toEqual(['第20回 定期演奏会', '2027-03-21', '市民ホール', '14:00']);
  await expect(page.locator('#toast')).toContainText('楽屋の本番「第20回 定期演奏会」とつなぎました');
  await expect(page.locator('#editBody [data-gky-concert]')).toHaveValue('c1');
  // 別の本番につなぎ直しても、入っている名前・日付は変えない
  await page.locator('#editBody [data-gky-concert]').selectOption('c2');
  const j = await page.evaluate(() => __app.C.info);
  expect([j.concert, j.title, j.date]).toEqual(['c2', '第20回 定期演奏会', '2027-03-21']);
  // つなげない
  await page.locator('#editBody [data-gky-concert]').selectOption('');
  expect(await page.evaluate(() => __app.C.info.concert)).toBe('');
  // 保存されている（開き直しても）
  await page.locator('#editBody [data-gky-concert]').selectOption('c1');
  await page.waitForTimeout(900);
  await reopen(page);
  expect(await page.evaluate(() => __app.C.info.concert)).toBe('c1');
  await noErrors(errors);
});

test('「＋ 楽屋の本番の一覧に入れる」で、この演奏会を楽屋の本番にする', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, ORG, { concerts: [] })); await reopen(page);
  await page.click('#btnNew');
  await page.evaluate(() => { __app.C.info.title = '冬のコンサート'; __app.C.info.date = '2027-12-20'; __app.C.info.venue = '文化会館'; });
  await page.click('[data-etab="program"]'); await page.click('[data-etab="info"]');
  await page.locator('#editBody [data-gky-concert]').selectOption('+');
  const o = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')));
  expect(o.concerts.map(c => [c.title, c.date, c.venue])).toEqual([['冬のコンサート', '2027-12-20', '文化会館']]);
  expect(await page.evaluate(() => __app.C.info.concert)).toBe(o.concerts[0].id);
  await noErrors(errors);
});

test('楽屋の本番から開く（#concert=）：つないだ演奏会を開く。なければ作るか聞いて、本番の名前・日付・会場・開演で作る', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page);
  await reopen(page, '#concert=c1');
  const sh = page.locator('.gky-sheet');
  await expect(sh).toContainText('第20回 定期演奏会の司会原稿・進行表');
  await sh.locator('footer .btn.primary').click();
  const c = await page.evaluate(() => __app.C);
  expect([c.info.title, c.info.date, c.info.venue, c.info.start, c.info.open, c.info.end, c.info.concert, c.info.org]).toEqual(['第20回 定期演奏会', '2027-03-21', '市民ホール', '14:00', '13:30', '15:30', 'c1', 'テスト中学校 吹奏楽部']);
  expect(c.program.length).toBeGreaterThan(5);
  expect(c.timetable.rows.length).toBeGreaterThan(5);
  await expect(page.locator('#concertSel')).toHaveValue(c.id);
  expect(await page.evaluate(() => location.hash)).toBe('');
  // 例の演奏会に切りかえてから、もう一度その本番から開く → 作った演奏会が開く（2つ作らない）
  await page.evaluate(() => __app.switchTo(__app.SAMPLE_ID, true));
  await page.waitForTimeout(800);
  await reopen(page, '#concert=c1');
  await expect.poll(() => page.evaluate(() => __app.C.id)).toBe(c.id);
  await expect(page.locator('.gky-toast')).toContainText('司会原稿・進行表を開きました');
  expect(await page.evaluate(() => __app.S.order.length)).toBe(2);
  await noErrors(errors);
});

test('同じ日付の演奏会は、つないでいなくても楽屋の本番から開ける（例の演奏会はのぞく）', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, ORG, { concerts: [...ORG.concerts, { id: 'c3', title: '例と同じ日', date: '2026-03-31', venue: '', kind: 'concert' }] }));
  await reopen(page);
  await page.click('#btnNew');
  await page.evaluate(() => { __app.C.info.date = '2027-07-30'; __app.C.info.title = '発表会の司会'; });
  await page.evaluate(() => { const c = __app.C; c.updatedAt = Date.now(); localStorage.setItem('stagemane.v1.c.' + c.id, JSON.stringify(c)); });
  await reopen(page, '#concert=c2');
  await expect.poll(() => page.evaluate(() => __app.C.info.title)).toBe('発表会の司会');
  // 例の演奏会（2026-03-31）は、同じ日付の本番でも開かない
  await reopen(page, '#concert=c3');
  await expect(page.locator('.gky-sheet')).toContainText('まだありません');
  await noErrors(errors);
});

test('部員用の端末では、楽屋で決めたツールでなければ開かない。「＋ 楽屋の本番に入れる」も出さない', async ({ page }) => {
  const errors = await openApp(page);
  // 公開ページと同じ「/stagemane/」のアドレスで開く（ツールの名前がアドレスから分かるように）
  await page.route(/\/stagemane\/index\.html/, r => r.fulfill({ path: path.join(__dirname, '..', 'index.html'), contentType: 'text/html; charset=utf-8' }));
  const open = async () => { await page.goto('/stagemane/index.html?test'); await page.waitForFunction(() => window.__app && window.__app.ready); };
  await setOrg(page, Object.assign({}, ORG, { org: Object.assign({}, ORG.org, { role: 'member', member: { tools: ['gassou'] } }) }));
  await open();
  await expect(page.locator('.gky-gate')).toContainText('ステマネは、部員用の画面では使いません');
  await setOrg(page, Object.assign({}, ORG, { org: Object.assign({}, ORG.org, { role: 'member', member: { tools: ['stagemane'] } }) }));
  await open();
  await expect(page.locator('.gky-gate')).toHaveCount(0);
  await page.click('[data-etab="info"]');
  await expect(page.locator('#editBody [data-gky-concert] option[value="+"]')).toHaveCount(0);
  await noErrors(errors);
});

test('書き出したデータに楽屋の本番が入り、読み込むと戻る', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page); await reopen(page);
  await page.click('#btnNew');
  await page.click('[data-etab="info"]');
  await page.locator('#editBody [data-gky-concert]').selectOption('c2');
  const data = await page.evaluate(() => JSON.stringify({ app: 'stagemane', format: 1, concert: __app.C }));
  expect(JSON.parse(data).concert.info.concert).toBe('c2');
  const chooser = page.waitForEvent('filechooser');
  await page.click('label[for="fileImport"]');
  await (await chooser).setFiles({ name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(data) });
  await expect.poll(() => page.evaluate(() => __app.S.order.length)).toBe(3);
  expect(await page.evaluate(() => __app.C.info.concert)).toBe('c2');
  await noErrors(errors);
});
