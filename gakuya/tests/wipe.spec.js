// この端末のデータをすべて消す
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const reopen = async page => { await page.goto('/index.html?test'); await page.waitForFunction(() => window.__app && window.__app.ready); };
// 楽屋シリーズのデータ・好み・ほかのアプリのデータ・写真・録音を入れる
const fill = page => page.evaluate(async () => {
  localStorage.setItem('gakuya.org', JSON.stringify({ app: 'gakuya', org: { name: 'テスト高校', type: 'koko' }, members: [{ id: 'a', name: 'A' }] }));
  localStorage.setItem('kouban.v1', '{"v":1}');
  localStorage.setItem('bamiri.current', '{"items":[]}');
  localStorage.setItem('gakuya.profile.p1', '{"keys":{}}');
  localStorage.setItem('gakuya.mtime', '{"kouban.v1":1}');
  localStorage.setItem('gakuya.ui', '{"lastBackup":1}');
  localStorage.setItem('bamiri.auth', '1');
  localStorage.setItem('other.app', 'x');
  await new Promise(res => { const r = indexedDB.open('gakki', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos'); r.onsuccess = () => { const tx = r.result.transaction('photos', 'readwrite'); tx.objectStore('photos').put('data:image/png;base64,AA', 'ph1'); tx.oncomplete = () => { r.result.close(); res(); }; }; });
  await GKY.media.put(new Blob(['abc'], { type: 'audio/webm' }), { name: '録音' });
});
const dbNames = page => page.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort());
const keys = page => page.evaluate(() => Object.keys(localStorage).sort());

test('すべて消す：選ばなければ、データと写真だけ消えて、録音・好み・ほかのアプリは残る。1回押しただけでは消えない', async ({ page }) => {
  const errors = await openApp(page);
  await fill(page);
  await reopen(page);
  await page.click('[data-tab="backup"]');
  await page.click('#wipeAll');
  const sh = page.locator('.gky-sheet', { hasText: 'この端末のデータをすべて消す' });
  await expect(sh).toContainText('楽器台帳の写真（1枚）');
  await expect(sh).toContainText('録音・楽譜のファイル（1つ');
  await page.click('#wipeGo');
  await expect(page.locator('#wipeGo')).toHaveText('もう一度押すと消す');
  expect(await keys(page)).toContain('kouban.v1');
  await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
  await page.waitForFunction(() => window.__app && window.__app.ready);
  expect(await keys(page)).toEqual(expect.arrayContaining(['bamiri.auth', 'gakuya.ui', 'other.app']));
  for (const k of ['gakuya.org', 'kouban.v1', 'bamiri.current', 'gakuya.profile.p1', 'gakuya.mtime']) expect(await keys(page)).not.toContain(k);
  const dbs = await dbNames(page);
  expect(dbs).not.toContain('gakki');
  expect(await page.evaluate(async () => (await GKY.media.list()).length)).toBe(1);
  await noErrors(errors);
});

test('すべて消す：録音・好みも選ぶと、楽屋シリーズのものは全部消える（ほかのアプリは残る）。やめるでは何も消えない', async ({ page }) => {
  const errors = await openApp(page);
  await fill(page);
  await reopen(page);
  await page.click('[data-tab="backup"]');
  await page.click('#wipeAll');
  await page.click('.gky-sheet footer .btn:has-text("やめる")');
  expect(await keys(page)).toContain('kouban.v1');
  await page.click('#wipeAll');
  await page.check('[data-w="media"]');
  await page.check('[data-w="prefs"]');
  await page.click('#wipeGo');
  await Promise.all([page.waitForEvent('load'), page.click('#wipeGo')]);
  await page.waitForFunction(() => window.__app && window.__app.ready);
  const ks = (await keys(page)).filter(k => /^(gakuya|kouban|bamiri)\./.test(k) && k !== 'gakuya.ui');
  expect(ks).toEqual([]);
  expect(await keys(page)).toContain('other.app');
  expect(await page.evaluate(async () => (await GKY.media.list()).length)).toBe(0);
  await noErrors(errors);
});
