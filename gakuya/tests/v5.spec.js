// 楽屋 v5：本番の一覧・まとめて足す／まとめて変える・仮引退・代表者用と部員用・アンケートのお願い
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const org = page => page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org') || '{}'));
const setOrg = (page, o) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(Object.assign({ app: 'gakuya' }, o))), o);
const reopen = async (page, q = '?test') => { await page.goto('about:blank'); await page.goto('/index.html' + q); await page.waitForFunction(() => window.__app && window.__app.ready); };

test('本番：足す・月ごと／年度ごと・押すとツールごとの記録を開く／作る', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト中学', type: 'chu' }, concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2026-10-31', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '地区大会', date: '2026-08-01', kind: 'contest' }, { id: 'c3', title: '新春コンサート', date: '2027-01-10', kind: 'event' }, { id: 'c0', title: '前の年の定演', date: '2026-03-20' }] });
  await page.evaluate(() => localStorage.setItem('kouban.v1', JSON.stringify({ v: 1, current: 'k1', order: ['k1'], projects: { k1: { id: 'k1', title: '定演の香盤表', date: '2026-10-31', pieces: [{ id: 'p', title: '宝島', slots: [] }], members: [], absent: [], assign: {} } } })));
  // ステマネ：楽屋の本番 c1 とつないだ演奏会（日付はちがっても c1 のもの）と、例の演奏会（同じ日付でも出さない）
  await page.evaluate(() => { const C = (id, title, date, concert, prog) => ({ id, v: 1, info: { title, date, concert }, program: prog, timetable: { cols: [], rows: [] } });
    localStorage.setItem('stagemane.v1', JSON.stringify({ order: ['sample-sunsun11', 's1'] }));
    localStorage.setItem('stagemane.v1.c.sample-sunsun11', JSON.stringify(C('sample-sunsun11', '第11回 スプリングコンサート', '2026-08-01', '', [])));
    localStorage.setItem('stagemane.v1.c.s1', JSON.stringify(C('s1', '定演の司会原稿', '2026-10-30', 'c1', [{ id: 'a', type: 'piece', title: '宝島' }, { id: 'b', type: 'piece', title: 'ふるさと' }, { id: 'c', type: 'piece', contOf: 'b' }]))); });
  await reopen(page);
  await expect(page.locator('#cntC')).toHaveText('2');            // これからの本番
  await page.click('[data-tab="concerts"]');
  // 月ごと：2026年度（4月〜3月）の12か月。3月20日は2025年度なので出ない
  await expect(page.locator('#cList .cmonth')).toHaveCount(12);
  await expect(page.locator('#cList .crow')).toHaveCount(3);
  await expect(page.locator('#cList')).not.toContainText('前の年の定演');
  // 同じ日付のコウバンの演奏会は、つないでいなくてもこの本番のものとして出る
  const row = page.locator('#cList .crow[data-c="c1"]');
  await expect(row).toContainText('あと20日');
  await expect(row.locator('.tl')).toHaveText(['コウバン', 'ステマネ']);
  await expect(row.locator('.tl').first()).toHaveAttribute('href', '../kouban/#concert=c1');
  await expect(row.locator('.tl').nth(1)).toHaveAttribute('href', '../stagemane/#concert=c1');
  await expect(page.locator('#cList .crow[data-c="c2"] .tl')).toHaveCount(0);
  // 1月はじまり（年）にすると、2026年には8月と10月、新春コンサート（2027年）は出ない
  await page.locator('#cStart').selectOption('1');
  await expect(page.locator('#cList .crow')).toHaveCount(3);       // 3/20・8/1・10/31
  await page.locator('#cStart').selectOption('4');
  // 年度ごと
  await page.click('#cView [data-v="year"]');
  await expect(page.locator('#cList details.cyear')).toHaveCount(2);
  await expect(page.locator('#cList details.cyear').first()).toContainText('2026年度');
  await expect(page.locator('#cList details.cyear').first()).toContainText('本番 3（演奏会1・コンクール・大会1・依頼演奏・イベント1）');
  await page.click('#cView [data-v="month"]');
  // 押すと：ツールごとの記録（あるものは「開く」、ないものは「作る」）
  await row.locator('.t1').click();
  const sh = page.locator('.gky-sheet', { hasText: 'ツールごとの記録' });
  await expect(sh.locator('.ctool')).toHaveCount(8);
  await expect(sh.locator('.ctool', { hasText: 'コウバン' })).toContainText('定演の香盤表　曲 1');
  await expect(sh.locator('.ctool', { hasText: 'ステマネ' })).toContainText('司会原稿・進行表');
  await expect(sh.locator('.ctool', { hasText: 'ステマネ' })).toContainText('定演の司会原稿　曲 2');
  await expect(sh.locator('.ctool', { hasText: 'ステマネ' }).locator('a')).toHaveText('開く');
  await expect(sh.locator('.ctool', { hasText: 'コウバン' }).locator('a')).toHaveText('開く');
  await expect(sh.locator('.ctool', { hasText: '本番逆算' }).locator('a')).toHaveText('作る');
  await expect(sh.locator('.ctool', { hasText: '本番逆算' }).locator('a')).toHaveAttribute('href', '../gyakusan/#concert=c1');
  await sh.locator('[data-close]').click();
  // 足す
  await page.click('#cAdd');
  await page.locator('#ceT').fill('文化祭');
  await page.locator('#ceD').fill('2026-11-03');
  await page.locator('#ceK').selectOption('school');
  await page.locator('#ceH').check();
  await page.click('.gky-sheet footer .btn.primary');
  const c = (await org(page)).concerts.find(x => x.title === '文化祭');
  expect([c.date, c.kind, c.hide]).toEqual(['2026-11-03', 'school', true]);
  await expect(page.locator('.crow', { hasText: '文化祭' })).toContainText('部員に見せない');
  // ツールの一覧の上に「次の本番」
  await page.click('[data-tab="tools"]');
  await expect(page.locator('#nextBox .crow')).toHaveCount(2);
  await expect(page.locator('#nextBox .crow').first()).toContainText('第13回 定期演奏会');
  await noErrors(errors);
});

test('本番：ほかのツールで見つけた本番を入れる。印刷・カレンダー（.ics）・見るだけのリンク', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト高校', type: 'koko' }, concerts: [{ id: 'c1', title: '定期演奏会', date: '2026-10-31', start: '14:00', venue: '市民会館' }, { id: 'h', title: 'ないしょ', date: '2026-12-01', hide: true }] });
  await page.evaluate(() => {
    localStorage.setItem('gyakusan.v1', JSON.stringify({ v: 1, plans: { a: { id: 'a', title: '吹奏楽コンクール', date: '2027-07-30', kind: 'contest', tasks: [] }, s: { id: 's', title: '（例）第12回 定期演奏会', date: '2026-12-20', sample: true, tasks: [] } } }));
    localStorage.setItem('hannyu.v1', JSON.stringify({ v: 1, trips: { t: { id: 't', title: '吹奏楽コンクール県大会', date: '2027-07-30', to: '県民会館', items: [] } } }));
  });
  await reopen(page);
  await page.click('[data-tab="concerts"]');
  const f = page.locator('#cFound');
  await expect(f).toContainText('ほかのツールで見つけた本番（1）');            // 例の本番は入れない。同じ日付は1つにまとめる
  await f.locator('summary').click();
  await expect(f.locator('.frow')).toContainText('吹奏楽コンクール県大会');            // 長いほうの名前
  await f.locator('[data-found="0"]').click();
  const c = (await org(page)).concerts.find(x => x.date === '2027-07-30');
  expect([c.title, c.venue, c.kind]).toEqual(['吹奏楽コンクール県大会', '県民会館', 'contest']);
  await expect(page.locator('#cFound')).toBeEmpty();
  // 印刷（2026年度）
  await page.click('#cPrint');
  const pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('2026年度の本番');
  await expect(pg).toContainText('定期演奏会');
  await page.keyboard.press('Escape');
  // カレンダー：月ごとのときは選んだ年度（2026年度）だけ、年度ごとのときは全部
  const icsText = async () => { const dl = page.waitForEvent('download'); await page.click('#cIcs'); return Buffer.concat(await (await (await dl).createReadStream()).toArray()).toString('utf8'); };
  let ics = await icsText();
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('DTSTART:20261031T140000');
  expect(ics).toContain('DTEND:20261031T170000');
  expect(ics).toContain('SUMMARY:定期演奏会');
  expect(ics).not.toContain('20270730');
  await page.click('#cView [data-v="year"]');
  ics = await icsText();
  expect(ics).toContain('DTSTART;VALUE=DATE:20270730');
  expect(ics).toContain('DTEND;VALUE=DATE:20270731');
  // 見るだけのリンク：部員に見せない本番は入らない
  const url = await page.evaluate(async () => { const o = JSON.parse(localStorage.getItem('gakuya.org')); return GKY.shareUrl('gakuya', { k: 'concerts', o: 'テスト高校', c: o.concerts.filter(c => !c.hide).map(c => [c.date, c.start, c.title, c.kind, c.venue, c.note]) }); });
  await page.goto('about:blank');
  await page.goto('/index.html?test' + url.slice(url.indexOf('#')));
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-viewer')).toContainText('本番の予定');
  await expect(page.locator('#gkyViewBody .crow')).toHaveCount(2);
  await expect(page.locator('#gkyViewBody')).not.toContainText('ないしょ');
  await noErrors(errors);
});

test('まとめて足す：先に楽器・学年・状態を選べる。足す前の表でチェックした行をそろえる', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'テスト中学', type: 'chu' }, members: [] });
  await reopen(page);
  await page.click('[data-tab="members"]');
  await page.click('#mMany');
  await page.locator('#mmPart').selectOption('Cl');
  await page.locator('#mmGrade').selectOption('中1');
  await page.locator('#mmSt').selectOption('active');
  await page.locator('#mmIn').fill('青木 美咲\n石井 大翔 中2\n上田 さくら フルート\n岡本 陽菜 引退');
  await page.click('.gky-sheet footer .btn.primary');
  const pv = page.locator('.gky-sheet', { hasText: '足す前に確かめる' });
  await expect(pv.locator('tr[data-i]')).toHaveCount(4);
  // 4行目だけチェックを外して、残りを「仮引退」にそろえる → やっぱり在籍にもどす
  await pv.locator('tr[data-i="3"] [data-k="on"]').uncheck();
  await pv.locator('[data-b="status"]').selectOption('semi');
  await pv.locator('[data-b="go"]').click();
  await expect(pv.locator('tr[data-i="0"] [data-k="status"]')).toHaveValue('semi');
  await expect(pv.locator('tr[data-i="3"] [data-k="status"]')).toHaveValue('retired');
  await pv.locator('[data-b="status"]').selectOption('active');
  await pv.locator('[data-b="go"]').click();
  await pv.locator('tr[data-i="3"] [data-k="on"]').check();
  await pv.locator('footer .btn.primary').click();
  const ms = (await org(page)).members.map(m => [m.name, m.grade, m.part, m.status]);
  expect(ms).toEqual([['青木 美咲', '中1', 'Cl', 'active'], ['石井 大翔', '中2', 'Cl', 'active'], ['上田 さくら', '中1', 'Fl', 'active'], ['岡本 陽菜', '中1', 'Cl', 'retired']]);
  // 次に開いたときも、選んだ楽器・学年が残っている
  await page.click('#mMany');
  await expect(page.locator('#mmPart')).toHaveValue('Cl');
  await noErrors(errors);
});

test('えらんでまとめて変える：学年・楽器・状態・役職を何人分も。元に戻せる。仮引退は学年ごとにも', async ({ page }) => {
  const errors = await openApp(page);
  const ms = []; for (let i = 0; i < 9; i++) ms.push({ id: 'm' + i, name: '部員' + i, grade: ['中1', '中2', '中3'][i % 3], part: 'Fl' });
  await setOrg(page, { org: { name: 'テスト中学', type: 'chu' }, members: ms });
  await reopen(page);
  await page.click('[data-tab="members"]');
  await page.click('#mSelMode');
  await expect(page.locator('#mBulk')).toBeVisible();
  await page.locator('#mFGrade').selectOption('中1');
  await page.locator('#mAll').check();
  await expect(page.locator('#mBulk')).toContainText('3人');
  await page.locator('#bPart').selectOption('Cl');
  await page.locator('#bGrade').selectOption('中2');
  await page.locator('#bRole').fill('楽器係');
  await page.click('#bGo');
  let o = await org(page);
  expect(o.members.filter(m => m.part === 'Cl').map(m => [m.id, m.grade, m.roles.join()])).toEqual([['m0', '中2', '楽器係'], ['m3', '中2', '楽器係'], ['m6', '中2', '楽器係']]);
  await page.locator('.gky-toast button').click();             // 元に戻す
  o = await org(page);
  expect(o.members.filter(m => m.part === 'Cl')).toEqual([]);
  // 仮引退：中3を仮引退にして、引退の人とまとめてもどす
  await page.click('[data-tab="org"]');
  await page.locator('#rtGrade').selectOption('中3');
  await page.click('#doSemi');
  o = await org(page);
  expect(o.members.filter(m => m.status === 'semi').map(m => m.id)).toEqual(['m2', 'm5', 'm8']);
  expect(o.members.find(m => m.id === 'm2').active).toBe(false);
  await page.click('#undoRetire'); await page.click('#undoRetire');
  expect((await org(page)).members.every(m => m.status === 'active')).toBe(true);
  await noErrors(errors);
});

test('代表者用と部員用：部員用の設定リンクを開くと、決めたツールだけの部員用の画面になる', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, { org: { name: '〇〇吹奏楽団', type: 'ippan' }, members: [{ id: 'a', name: '山田 花子', part: 'Cl', staffNote: 'ないしょ' }, { id: 'b', name: '鈴木', part: 'Tp', status: 'gone' }], concerts: [{ id: 'c1', title: '定期演奏会', date: '2026-11-01' }, { id: 'c2', title: 'ないしょの本番', date: '2026-12-01', hide: true }] });
  await reopen(page);
  await page.click('[data-tab="org"]');
  await page.locator('#roleTools [data-rt="tempomap"]').uncheck();
  await page.locator('#roleTools [data-rt="shukketsu"]').check();
  await page.locator('#roleFeats [data-rf="roster"]').check();
  await page.locator('#roleMsg').fill('合奏ノートは合奏のあとに提出してください');
  await page.locator('#roleMsg').press('Tab');
  await page.waitForTimeout(500);
  await page.click('#joinLink');
  const url = await page.locator('.gky-share textarea').inputValue();
  expect(url).toContain('#join=');
  await expect(page.locator('.gky-sheet')).toContainText('名簿（1人・名前と楽器と学年だけ）');
  // 部員のスマホ（まっさらな端末）
  const ctx = await browser.newContext(); const mp = await ctx.newPage();
  // このテストのサーバーは楽屋のフォルダだけを配るので、ほかのツールのページはリポジトリのファイルを返す
  const path = require('path');
  await ctx.route(/\/(kouban|shukketsu)\/index\.html/, r => r.fulfill({ path: path.join(__dirname, '..', '..', r.request().url().match(/\/(kouban|shukketsu)\//)[1], 'index.html'), contentType: 'text/html; charset=utf-8' }));
  const merr = []; mp.on('pageerror', e => merr.push(String(e)));
  await mp.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await mp.goto('/index.html?test' + url.slice(url.indexOf('#')));
  await mp.waitForFunction(() => window.__app && window.__app.ready);
  await expect(mp.locator('.gky-sheet')).toContainText('「〇〇吹奏楽団」の団員用の設定');
  await mp.click('.gky-sheet footer .btn.primary');
  const mo = await mp.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')));
  expect([mo.org.name, mo.org.role, mo.org.member.tools.sort().join()]).toEqual(['〇〇吹奏楽団', 'member', 'bamiri,drillboard,gassou,shukketsu']);
  expect(mo.concerts.map(c => c.title)).toEqual(['定期演奏会']);
  expect(mo.members.map(m => [m.name, m.part, m.staffNote])).toEqual([['山田 花子', 'Cl', '']]);
  // 部員用の画面：決めたツールだけ、お知らせ、つながりのタブはない
  await expect(mp.locator('html')).toHaveAttribute('data-role', 'member');
  await expect(mp.locator('.tool')).toHaveCount(4);
  await expect(mp.locator('#memberNote')).toContainText('合奏ノートは合奏のあとに提出してください');
  await expect(mp.locator('[data-tab="links"]')).toBeHidden();
  await mp.click('[data-tab="members"]');
  await expect(mp.locator('#mTable tbody tr')).toHaveCount(1);
  await expect(mp.locator('#mTable input')).toHaveCount(0);       // 見るだけ
  await expect(mp.locator('#mAdd')).toBeHidden();
  // 部員用に出さないツールを開くと知らせる。出すツールは開ける
  await mp.goto('/kouban/index.html?test'); await mp.waitForFunction(() => window.__app && window.__app.ready);
  await expect(mp.locator('.gky-gate')).toContainText('コウバンは、団員用の画面では使いません');
  await mp.goto('/shukketsu/index.html?test'); await mp.waitForFunction(() => window.__app && window.__app.ready);
  await expect(mp.locator('.gky-gate')).toHaveCount(0);
  // 代表者・顧問用にもどす
  await mp.goto('/index.html?test'); await mp.waitForFunction(() => window.__app && window.__app.ready);
  await mp.click('[data-tab="org"]');
  await mp.click('#meStaff'); await mp.click('#meStaff');
  await expect(mp.locator('html')).toHaveAttribute('data-role', 'staff');
  await expect(mp.locator('[data-tab="links"]')).toBeVisible();
  expect(merr).toEqual([]);
  await ctx.close();
  await noErrors(errors);
});

test('代表者の端末で自分の設定リンクを開いても、名簿は消えない（本番だけ受け取る）', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, { org: { name: 'A中', type: 'chu', member: { tools: ['gassou'], concerts: true } }, members: [{ id: 'a', name: '青木', staffNote: 'メモ' }], concerts: [{ id: 'c1', title: '定演', date: '2026-11-01' }] });
  await reopen(page);
  const url = await page.evaluate(async () => GKY.pageUrl('gakuya') + '#join=' + await GKY.packShare({ k: 'join', v: 1, o: { name: 'A中', type: 'chu' }, cfg: { tools: ['gassou'] }, c: [['c1', '2026-11-01', '', '定演（直した名前）', 'concert', '', ''], ['c9', '2026-12-24', '', 'クリスマス', 'event', '', '']], at: '2026-10-11' }));
  await page.goto('about:blank'); await page.goto('/index.html?test' + url.slice(url.indexOf('#')));
  await page.waitForFunction(() => window.__app && window.__app.ready);
  await expect(page.locator('.gky-sheet [name="jm"][value="concerts"]')).toBeChecked();
  await page.click('.gky-sheet footer .btn.primary');
  const o = await org(page);
  expect([o.org.role, o.members[0].staffNote]).toEqual(['staff', 'メモ']);
  expect(o.concerts.map(c => c.title)).toEqual(['定演(直した名前)', 'クリスマス']);   // かっこは半角にそろう
  await noErrors(errors);
});

test('アンケートのお願い：3回目に開いたときに出て、「今後表示しない」で出なくなる', async ({ page }) => {
  const errors = await openApp(page, '?test&survey');
  await expect(page.locator('#survey')).toBeHidden();
  await reopen(page, '?test&survey');
  await reopen(page, '?test&survey');
  await expect(page.locator('#survey')).toBeVisible({ timeout: 4000 });
  await expect(page.locator('#svGo')).toHaveAttribute('href', 'https://forms.gle/HpXuHj7YCkBAsbGt9');
  await page.click('#svNever');
  await reopen(page, '?test&survey');
  await page.waitForTimeout(1800);
  await expect(page.locator('#survey')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.ui')).survey.state)).toBe('never');
  await noErrors(errors);
});
