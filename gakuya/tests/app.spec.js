// 楽屋の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const org = page => page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org') || '{}'));
const setOrg = (page, o) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(Object.assign({ app: 'gakuya' }, o))), o);
const reopen = async (page, q = '?test') => { await page.goto('/index.html' + q); await page.waitForFunction(() => window.__app && window.__app.ready); };
// WindowsのExcelで保存したCSV（Shift_JIS）：名前,学年,パート／山田 花子,中2,クラリネット／鈴木 太郎,1年,パーカス／佐藤 次郎,中3,フルート・ピッコロ
const SJIS_CSV = 'lryRTyyKd5ROLINwgVuDZw0KjlKTYyCJ1I5xLJKGMiyDToOJg4qDbINig2cNCpfpltggkb6YWSwxlE4sg3CBW4NKg1gNCo2yk6Egjp+YWSyShjMsg3SDi4Fbg2eBRYNzg2KDUoONDQo=';

test('ツールの一覧：14のツールが出て、同じツールは同じタブで開く。ステマネはClaudeの画面', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('.tool')).toHaveCount(14);
  const kb = page.locator('.tool[data-slug="kouban"]');
  await expect(kb).toHaveAttribute('href', '../kouban/');
  await expect(kb).toHaveAttribute('target', 'gky-kouban');
  await expect(page.locator('.tool[data-slug="bamiri"]')).toHaveAttribute('href', '../bamiri/');
  await expect(page.locator('.tool[data-slug="shukketsu"]')).toHaveAttribute('href', '../shukketsu/');
  await expect(page.locator('.tool[data-slug="kaikei"]')).toHaveAttribute('href', '../kaikei/');
  const sm = page.locator('.tool[data-slug="stagemane"]');
  await expect(sm).toHaveAttribute('href', /claude\.ai\/artifact/);
  await expect(sm).toContainText('Claudeの画面で開きます');
  await expect(sm).not.toContainText('まだ使っていません');
  // 置き方のタブは ?dev のときだけ
  await expect(page.locator('[data-tab="setup"]')).toBeHidden();
  await reopen(page, '?test&dev');
  await expect(page.locator('[data-tab="setup"]')).toBeVisible();
  await page.click('[data-tab="setup"]');
  await expect(page.locator('#repoTable')).toContainText('shukketsu/');
  await expect(page.locator('#fbTop')).toHaveAttribute('href', 'https://forms.gle/HpXuHj7YCkBAsbGt9');
  await noErrors(errors);
});

test('団体の種類を選ぶと、呼び方と学年が変わる（一般の団体は「団員」と入団した年）', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#typeAsk [data-type="ippan"]');
  expect((await org(page)).org.type).toBe('ippan');
  await expect(page.locator('#wMember')).toHaveText('団員');
  await page.click('[data-tab="members"]');
  await page.click('#mAdd');
  await expect(page.locator('#mTable thead')).toContainText('入団した年');
  await expect(page.locator('#mTable [data-k="joined"]')).toHaveCount(1);
  await noErrors(errors);
});

test('まとめて足す：足す前に確かめる表が出て、読めない言葉は名前にくっつけない', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト中学', type: 'chu' }, members: [{ id: 'a', name: '鈴木 花子', grade: '中2', part: 'Cl' }] });
  await reopen(page);
  await page.click('[data-tab="members"]');
  await page.click('#mMany');
  await page.locator('#mmIn').fill('田中一郎 パーカス\n山田 太郎 1年生 フルート・ピッコロ\n佐藤 次郎 2年 ペット パートリーダー\n高橋 三郎 中3 コンバス 引退\n森 OG スネア\n田中二郎 カホン\n鈴木 花子 中2 クラ');
  await page.click('.gky-sheet footer .btn.primary');
  const pv = page.locator('.gky-sheet', { hasText: '足す前に確かめる' });
  await expect(pv).toBeVisible();
  await expect(pv.locator('tr[data-i]')).toHaveCount(7);
  await expect(pv.locator('tr[data-i="5"] .unk')).toHaveText('カホン');
  await expect(pv.locator('tr[data-i="6"] [data-k="on"]')).not.toBeChecked();   // 同じ名前の人がもういる
  await pv.locator('footer .btn.primary').click();
  const ms = (await org(page)).members.map(m => [m.name, m.grade, m.part, m.subs.join('/'), m.status, m.roles.join('/')]);
  expect(ms).toEqual([
    ['鈴木 花子', '中2', 'Cl', '', 'active', ''],
    ['田中一郎', '', 'Perc', '', 'active', ''],
    ['山田 太郎', '中1', 'Fl', 'Pic', 'active', ''],
    ['佐藤 次郎', '中2', 'Tp', '', 'active', 'パートリーダー'],
    ['高橋 三郎', '中3', 'St.B', '', 'retired', ''],
    ['森', '', 'Perc', '', 'support', ''],
    ['田中二郎', '', '', '', 'active', ''],
  ]);
  await noErrors(errors);
});

test('ExcelのCSV（Shift_JIS）を文字化けせずに読み、確かめてから足す', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト中学', type: 'chu' }, members: [] });
  await reopen(page);
  await page.click('[data-tab="members"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#mCsv');
  await (await chooser).setFiles({ name: '名簿.csv', mimeType: 'text/csv', buffer: Buffer.from(SJIS_CSV, 'base64') });
  const pv = page.locator('.gky-sheet', { hasText: '足す前に確かめる' });
  await expect(pv).toContainText('Shift_JIS');
  await expect(pv.locator('tr[data-i]')).toHaveCount(3);
  await pv.locator('footer .btn.primary').click();
  const ms = (await org(page)).members.map(m => [m.name, m.grade, m.part, m.subs.join('/')]);
  expect(ms).toEqual([['山田 花子', '中2', 'Cl', ''], ['鈴木 太郎', '中1', 'Perc', ''], ['佐藤 次郎', '中3', 'Fl', 'Pic']]);
  await noErrors(errors);
});

test('部員の表：さがす・しぼる・並べ替える。進級で上がらない学年は知らせる', async ({ page }) => {
  const errors = await openApp(page);
  const ms = []; for (let i = 0; i < 80; i++) ms.push({ id: 'm' + i, name: '部員' + String(i).padStart(2, '0'), grade: ['高1', '高2', '高3'][i % 3], part: ['Fl', 'Cl', 'Tp', 'Perc'][i % 4], status: 'active' });
  ms.push({ id: 'x', name: '山田 二年', grade: '2年', part: 'Hn', status: 'active' });
  await setOrg(page, { org: { name: 'テスト高校', type: 'koko' }, members: ms });
  await reopen(page);
  await page.click('[data-tab="members"]');
  await expect(page.locator('#mTable tbody tr')).toHaveCount(81);
  await expect(page.locator('#mTable tr[data-id="x"] [data-k="grade"]')).toHaveClass(/warn/);
  await page.locator('#mQ').fill('部員07');
  await expect(page.locator('#mTable tbody tr')).toHaveCount(1);
  await page.locator('#mQ').fill('');
  await page.locator('#mFPart').selectOption('Tp');
  await expect(page.locator('#mTable tbody tr')).toHaveCount(20);
  await page.locator('#mFGrade').selectOption('高3');
  await expect(page.locator('#mTable tbody tr')).toHaveCount(7);
  // 学年を「2」と直すと、高校なので「高2」にそろう
  await page.locator('#mFPart').selectOption('');
  await page.locator('#mFGrade').selectOption('');
  await page.locator('#mTable tr[data-id="x"] [data-k="grade"]').fill('2年');
  await page.locator('#mTable tr[data-id="x"] [data-k="grade"]').dispatchEvent('change');
  expect((await org(page)).members.find(m => m.id === 'x').grade).toBe('高2');
  await noErrors(errors);
});

test('進級：年度を入れていない2027年4月に押すと、2027年度になる（卒業は2026年度）。2回目は確かめる', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-04-06T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト中学', type: 'chu' }, members: [{ id: 'a', name: 'A', grade: '中1' }, { id: 'b', name: 'B', grade: '中3' }, { id: 'c', name: 'C', grade: '中2', status: 'retired' }, { id: 'd', name: 'D', grade: '', status: 'extra' }] });
  await reopen(page);
  await page.click('[data-tab="org"]');
  await expect(page.locator('#promote .arrow')).toContainText('2026年度');
  await expect(page.locator('#promote .arrow')).toContainText('2027年度');
  await page.click('#doPromote');
  await page.click('.gky-sheet footer .btn.primary');
  let o = await org(page);
  expect(o.org.year).toBe(2027);
  expect(o.org.promoted.to).toBe(2027);
  expect(o.members.map(m => [m.name, m.grade, m.status, m.active])).toEqual([['A', '中2', 'active', true], ['B', '中3', 'gone', false], ['C', '中3', 'retired', false], ['D', '', 'extra', true]]);
  expect(o.members[1].note).toContain('2026年度 卒業');
  // もう一度押すと、すぐには進級させず確かめる
  await page.click('#doPromote');
  await expect(page.locator('.gky-sheet')).toContainText('2027年度への進級は、2027-04-06にもう済んでいます');
  await page.click('.gky-sheet footer .btn:not(.primary)');
  expect((await org(page)).org.year).toBe(2027);
  await noErrors(errors);
});

test('中高一貫は中3を高1に上げる。学年ごとに引退させる', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-03-25T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト学園', type: 'chuko', year: 2026 }, members: [{ id: 'a', name: 'A', grade: '中3' }, { id: 'b', name: 'B', grade: '高3' }, { id: 'c', name: 'C', grade: '高2' }] });
  await reopen(page);
  await page.click('[data-tab="org"]');
  await expect(page.locator('#pCont')).toBeChecked();
  await page.click('#doPromote');
  await page.click('.gky-sheet footer .btn.primary');
  expect((await org(page)).members.map(m => [m.grade, m.status])).toEqual([['高1', 'active'], ['高3', 'gone'], ['高3', 'active']]);
  await page.locator('#rtGrade').selectOption('高3');
  await page.click('#doRetire');
  expect((await org(page)).members.map(m => m.status)).toEqual(['active', 'gone', 'retired']);
  await noErrors(errors);
});

test('この端末の団体を切りかえると、全部のツールのデータが入れかわり、戻すと元どおり', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'A中学校', type: 'chu' }, members: [{ id: 'a', name: '青木' }] });
  await page.evaluate(() => { localStorage.setItem('kouban.v1', '{"v":1,"mark":"A"}'); localStorage.setItem('bamiri.auth', 'x'); });
  await reopen(page);
  await page.click('[data-tab="org"]');
  await page.click('#profNew');
  await page.locator('#pnName').fill('B地域クラブ');
  await page.click('.gky-sheet footer .btn.primary');
  let o = await org(page);
  expect(o.org.name).toBe('B地域クラブ');
  expect(o.members).toEqual([]);
  expect(await page.evaluate(() => [localStorage.getItem('kouban.v1'), localStorage.getItem('bamiri.auth')])).toEqual([null, 'x']);
  await page.evaluate(() => localStorage.setItem('kouban.v1', '{"v":1,"mark":"B"}'));
  // A にもどる
  await page.locator('.prof:not(.on) [data-sw]').click();
  o = await org(page);
  expect(o.org.name).toBe('A中学校');
  expect(o.members.map(m => m.name)).toEqual(['青木']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kouban.v1')).mark)).toBe('A');
  // B のデータはしまってある
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.profiles')));
  expect(p.list.length).toBe(2);
  const bId = p.list.find(x => x.id !== p.current).id;
  expect(await page.evaluate(id => JSON.parse(JSON.parse(localStorage.getItem('gakuya.profile.' + id)).keys['kouban.v1']).mark, bId)).toBe('B');
  await noErrors(errors);
});

test('まとめてバックアップ：楽屋シリーズとバミリのデータが1つのファイルに入る（ログインの記録は入れない）', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => { localStorage.setItem('kouban.v1', '{"v":1}'); localStorage.setItem('shukketsu.v1', '{"events":[]}'); localStorage.setItem('bamiri.current', '{"items":[]}'); localStorage.setItem('bamiri.auth', '1'); localStorage.setItem('other.app', 'x'); });
  await reopen(page);
  await page.click('[data-tab="backup"]');
  await expect(page.locator('#bkList')).toContainText('kouban.v1');
  await expect(page.locator('#usage')).toContainText('使っています');
  const dl = page.waitForEvent('download');
  await page.click('#bkSave');
  const file = await dl;
  const j = JSON.parse(Buffer.concat(await (await file.createReadStream()).toArray()).toString('utf8'));
  expect(j.app).toBe('gakuya-backup');
  expect(Object.keys(j.keys).filter(k => k !== 'gakuya.ui').sort()).toEqual(['bamiri.current', 'kouban.v1', 'shukketsu.v1']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.ui')).lastBackup > 0)).toBe(true);
  await noErrors(errors);
});

test('引き継ぎファイル：メモと全部のデータが入り、戻すとメモが出る。指導者メモは入れないこともできる', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト高校', type: 'koko' }, members: [{ id: 'a', name: 'A', staffNote: '面談の記録' }] });
  await page.evaluate(() => localStorage.setItem('gakufu.v1', '{"v":1,"songs":[]}'));
  await reopen(page);
  await page.click('[data-tab="backup"]');
  await page.locator('#hoMemo').fill('トラックは〇〇楽器に6月に予約');
  const dl = page.waitForEvent('download');
  await page.click('#hoSave');
  const buf = Buffer.concat(await (await (await dl).createReadStream()).toArray());
  const j = JSON.parse(buf.toString('utf8'));
  expect(j.handover.memo).toBe('トラックは〇〇楽器に6月に予約');
  expect(JSON.parse(j.keys['gakuya.org']).members[0].staffNote).toBe('');
  expect(j.keys['gakufu.v1']).toBeTruthy();
  // ちがう端末（空の楽屋）で戻す
  await page.evaluate(() => localStorage.clear());
  await reopen(page);
  await page.click('[data-tab="backup"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#bkLoad');
  await (await chooser).setFiles({ name: '引き継ぎ.json', mimeType: 'application/json', buffer: buf });
  await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('.gky-sheet', { hasText: '引き継ぎのメモ' })).toContainText('トラックは〇〇楽器に6月に予約');
  expect((await org(page)).org.name).toBe('テスト高校');
  await noErrors(errors);
});

test('印刷：引き継ぎのしおりを A4・B4・A3 で並べ直せる', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="backup"]');
  await page.click('#hoPrint');
  await expect(page.locator('.gky-pv .gky-page').first()).toBeVisible();
  const w = () => page.locator('.gky-pv .gky-page').first().evaluate(el => el.offsetWidth);
  expect(await w()).toBe(794);
  await page.locator('.gky-pv [data-act="size"]').selectOption('A3');
  expect(await w()).toBe(1123);
  await expect(page.locator('.gky-pv .msg')).toContainText('A3');
  await page.click('.gky-pv [data-act="close"]');
  await noErrors(errors);
});
