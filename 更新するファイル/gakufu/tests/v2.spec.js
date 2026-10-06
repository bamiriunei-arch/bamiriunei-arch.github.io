// 楽譜ライブラリ v2：できる曲の数え方・著作権の手続き用・曲目一覧をいくつも・貸し借り・2つのタブ
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

test('できる曲：30人ほどの中学の名簿で、宝島が「できる」になる（打楽器は人数・弦バスはなくても可・バストロはトロンボーンの人）', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => {
    const song = __app.S.songs.find(s => s.title === '宝島');
    const counts = { Fl: 3, Ob: 1, Cl: 6, 'B.Cl': 1, 'A.Sax': 2, 'T.Sax': 1, 'B.Sax': 1, Tp: 4, Hn: 3, Tb: 3, Euph: 2, Tuba: 1, Perc: 4 };
    const x = __app.canPlay(song, __app.playersFromCounts(counts));
    // 打楽器の人数を入れていないときは、パートの数のおよそ6割（4パート → 3人）
    const y = __app.percOf(Object.assign({}, song, { percN: null }));
    // 打楽器が2人しかいないと、1人足りない
    const z = __app.canPlay(song, __app.playersFromCounts(Object.assign({}, counts, { Perc: 2 })));
    return { miss: x.miss, via: x.via, need: y.need, z: z.miss };
  });
  expect(r.miss).toEqual([]);
  expect(r.via).toEqual(['B.Tb←Tb']);
  expect(r.need).toBe(3);
  expect(r.z).toEqual(['打楽器']);
  await page.click('[data-tab="can"]');
  await expect(page.locator('#canTable tr', { hasText: '宝島' })).toContainText('できる（持ち替え）');
  await noErrors(errors);
});

test('作詞・原曲名・メドレーの内訳が、著作権の手続き用の曲目一覧に出る。曲目一覧はいくつも持てる', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#songList .spine', { hasText: '宝島' }).click();
  await page.locator('#detail [data-k="lyricist"]').fill('（例）作詞者');
  await page.locator('#detail [data-k="lyricist"]').press('Tab');
  await page.click('#medAdd');
  await page.locator('#medList [data-mk="title"]').last().fill('内訳の曲A');
  await page.locator('#medList [data-mk="title"]').last().press('Tab');
  await page.click('[data-tab="setlist"]');
  await page.locator('#slTitle').fill('春の演奏会'); await page.locator('#slTitle').press('Tab');
  await page.locator('#slPick label', { hasText: '宝島' }).locator('input').check();
  await page.click('#slPrintJ');
  const pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('（例）作詞者');
  await expect(pg).toContainText('1-1 内訳の曲A');
  await expect(pg).toContainText('TAKARAJIMA');
  await page.click('.gky-pv [data-act="close"]');
  // 2つめの曲目一覧
  await page.click('#slNew');
  await page.locator('#slTitle').fill('夏祭り'); await page.locator('#slTitle').press('Tab');
  await page.locator('#slPick label', { hasText: 'ふるさと' }).locator('input').check();
  const lists = await page.evaluate(() => __app.S.setlists.map(l => [l.title, l.ids.length]));
  expect(lists).toEqual([['夏祭り', 1], ['春の演奏会', 1]]);
  await page.locator('#slSel').selectOption({ index: 1 });
  await expect(page.locator('#slTitle')).toHaveValue('春の演奏会');
  await noErrors(errors);
});

test('ほかの団体との貸し借りを記録し、「貸し借り中」でしぼれる', async ({ page }) => {
  const errors = await openApp(page);
  await page.locator('#songList .spine', { hasText: 'ジュビラント序曲' }).click();
  await page.click('#loAdd');
  await page.locator('#loWho').fill('〇〇高校吹奏楽部');
  await page.click('.gky-sheet footer .btn.primary');
  await page.click('#filters [data-f="loan"]');
  await expect(page.locator('#songList .spine')).toHaveCount(1);
  await expect(page.locator('#songList .spine')).toContainText('貸している：〇〇高校吹奏楽部');
  await page.click('#songList .spine');
  await page.click('[data-lback]');
  await expect(page.locator('#songList .spine')).toHaveCount(0);
  await noErrors(errors);
});

test('2つのタブ：タブAで足した曲が、タブBで曲を足しても消えない（報告で再現した不具合）', async ({ page, context }) => {
  const errors = await openApp(page);
  await page.click('#sbClear'); await page.click('#sbClear');
  await page.waitForTimeout(500);
  const b = await context.newPage();
  await b.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await b.goto('/index.html?test'); await b.waitForFunction(() => window.__app && window.__app.ready);
  await page.click('#btnAdd'); await page.locator('#detail [data-k="title"]').fill('タブAの曲'); await page.locator('#detail [data-k="title"]').press('Tab');
  await page.waitForTimeout(600);
  await b.bringToFront();
  await b.click('#btnAdd'); await b.locator('#detail [data-k="title"]').fill('タブBの曲'); await b.locator('#detail [data-k="title"]').press('Tab');
  await b.waitForTimeout(600);
  const titles = await page.evaluate(() => JSON.parse(localStorage.getItem('gakufu.v1')).songs.map(s => s.title).sort());
  expect(titles).toEqual(['タブAの曲', 'タブBの曲']);
  await noErrors(errors);
});

test('ExcelのCSV（Shift_JIS）も文字化けせずに取り込める', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="io"]');
  const sjis = Buffer.from('i8iWvCyN7IvIDQqDZYNYg2eLyCyOUpNjDQo=', 'base64');   // 曲名,作曲 ／ テスト曲,山田
  const chooser = page.waitForEvent('filechooser');
  await page.click('#btnCsvIn');
  await (await chooser).setFiles({ name: 'list.csv', mimeType: 'text/csv', buffer: sjis });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => __app.S.songs.map(s => [s.title, s.composer]))).toEqual([['テスト曲', '山田']]);
  await noErrors(errors);
});
