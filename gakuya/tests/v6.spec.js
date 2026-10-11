// 楽屋 v6：当日の案内・年間カレンダー・年度末のチェックリスト・保護者向けのお知らせ・同期ファイル
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const org = page => page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org') || '{}'));
const setOrg = (page, o) => page.evaluate(o => localStorage.setItem('gakuya.org', JSON.stringify(Object.assign({ app: 'gakuya' }, o))), o);
const reopen = async (page, q = '?test') => { await page.goto('/index.html' + q); await page.waitForFunction(() => window.__app && window.__app.ready); };
const BASE = { org: { name: 'テスト中学校 吹奏楽部', type: 'chu' }, members: [{ id: 'm1', name: '山田 花子', part: 'Cl', grade: '中2', status: 'active' }],
  concerts: [{ id: 'c1', title: '第13回 定期演奏会', date: '2026-10-31', start: '14:00', venue: '市民会館', kind: 'concert' }, { id: 'c2', title: '地区大会', date: '2026-08-01', start: '13:20', kind: 'contest' }] };

test('当日の案内：時刻の書き方（9:00・9時半・13時15分・〜）と、担当の書き方を読む', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => [__app.parseTt('9:00 集合・積み込み\n9時半 出発\n１３：１５〜 リハーサル\n13時15分 本番\n14:00〜15:00 片付け\n雨なら体育館'), __app.parseJobs('受付：山田・佐藤\n写真: 保護者会\n運搬')]);
  expect(r[0]).toEqual([['9:00', '集合・積み込み'], ['9:30', '出発'], ['13:15', 'リハーサル'], ['13:15', '本番'], ['14:00', '〜15:00 片付け'], ['', '雨なら体育館']]);
  expect(r[1]).toEqual([['受付', '山田・佐藤'], ['写真', '保護者会'], ['運搬', '']]);
  // ひな形：開演の時刻から
  const t = await page.evaluate(() => [__app.dayTemplate({ kind: 'concert', start: '14:00' }), __app.dayTemplate({ kind: 'contest', start: '13:20' })]);
  expect([t[0].meet, t[0].tt[0], t[0].tt.at(-1), t[0].end]).toEqual(['9:00', ['9:00', '集合・楽器の搬入'], ['17:00', '解散'], '17:00']);
  expect(t[1].tt.find(x => x[1] === '演奏（出演）')[0]).toBe('13:20');
  expect(t[0].items).toContain('楽譜（本番の曲）');
  await noErrors(errors);
});

test('当日の案内：本番から作る（ひな形・持ち物）→ 当日の画面・リンク・印刷。部員用の設定リンクにも入る', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-31T11:10:00'));
  const errors = await openApp(page);
  await setOrg(page, BASE); await reopen(page);
  await page.click('[data-tab="concerts"]');
  await page.locator('#cList .crow[data-c="c1"] .t1').click();
  const sh = page.locator('.gky-sheet', { hasText: 'ツールごとの記録' });
  await expect(sh).toContainText('当日の案内');
  await sh.locator('[data-dy="edit"]').click();
  const ed = page.locator('.gky-sheet', { hasText: '当日の案内：第13回 定期演奏会' });
  await ed.locator('#dyTpl').click();
  await expect(ed.locator('#dyTt')).toHaveValue(/^9:00 集合・楽器の搬入\n9:30 ステージの準備・音出し/);
  await expect(ed.locator('#dyMeet')).toHaveValue('09:00');
  await ed.locator('#dyMeetP').fill('市民会館 楽屋口');
  await ed.locator('#dyItemsTpl').click();
  await ed.locator('#dyDress').fill('制服（冬服）');
  await ed.locator('#dyJobs').fill('受付：1年 山田・佐藤\n楽器運搬：2年');
  await ed.locator('#dyContact').fill('顧問 鈴木');
  await ed.locator('footer .btn.primary').click();
  const c = (await org(page)).concerts.find(x => x.id === 'c1');
  expect([c.day.meet, c.day.meetPlace, c.day.end, c.day.tt.length, c.day.items.length, c.day.dress, c.day.jobs]).toEqual(['09:00', '市民会館 楽屋口', '17:00', 9, 7, '制服（冬服）', [['受付', '1年 山田・佐藤'], ['楽器運搬', '2年']]]);
  // 保存のあとは、本番の画面にもどって「当日の画面」が出る
  const sh2 = page.locator('.gky-sheet', { hasText: 'ツールごとの記録' });
  await expect(sh2).toContainText('集合 09:00 市民会館 楽屋口');
  await sh2.locator('[data-dy="open"]').click();
  const dv = page.locator('.gky-sheet', { hasText: '当日の画面' });
  await expect(dv.locator('.dmeet')).toContainText('09:00');
  await expect(dv.locator('.dhead')).toContainText('今日');
  // 11:10 → 「昼食・休憩」の前の「リハーサル」（10:00）が「いま」
  await expect(dv.locator('.dtt li.now')).toContainText('リハーサル');
  await expect(dv.locator('.dtt li.past')).toHaveCount(2);
  // 持ち物のチェックは、この端末に残る
  await dv.locator('[data-ck="0"]').check();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.view.day.c1')))).toEqual({ 0: true });
  await dv.locator('[data-close]').click();
  // ツールのタブ：今日の本番の「当日の画面」
  await page.click('[data-tab="tools"]');
  await expect(page.locator('#nextBox .dsoon')).toContainText('今日は「第13回 定期演奏会」');
  // 見るだけのリンク
  const url = await page.evaluate(async () => GKY.shareUrl('gakuya', __app.dayPayload(GKY.concertOf('c1'), GKY.org())));
  await page.goto('about:blank');
  await reopen(page, '?test' + url.slice(url.indexOf('#')));
  await expect(page.locator('.gky-viewer')).toContainText('当日の案内');
  await expect(page.locator('#gkyViewBody .dhead')).toContainText('第13回 定期演奏会');
  await expect(page.locator('#gkyViewBody .djobs')).toContainText('1年 山田・佐藤');
  await expect(page.locator('#gkyViewBody [data-ck="0"]')).toBeChecked();      // 同じ本番のチェックは同じ
  await page.click('#vwDayPrint');
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('タイムテーブル');
  await noErrors(errors);
});

test('当日の案内：つないだステマネのタイスケ（生徒の列）から、タイムテーブルを入れる', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, BASE);
  await page.evaluate(() => {
    localStorage.setItem('stagemane.v1', JSON.stringify({ order: ['s1'] }));
    localStorage.setItem('stagemane.v1.c.s1', JSON.stringify({ id: 's1', info: { title: '定演の進行', date: '2026-10-31', concert: 'c1' }, program: [], timetable: { cols: [{ id: 'k1', name: '舞台' }, { id: 'k2', name: '生徒' }], rows: [{ time: '9:00', cells: { k1: { t: '仕込み' }, k2: { t: 'ホール集合\n音出し' } } }, { time: '１０：３０', cells: { k2: { t: 'リハーサル' } } }, { time: '12:00', cells: { k1: { t: '照明' } } }] } }));
  });
  await reopen(page);
  const r = await page.evaluate(() => __app.ttFromStagemane(GKY.concertOf('c1')));
  expect(r).toEqual({ title: '定演の進行', col: '生徒', rows: [['9:00', 'ホール集合・音出し'], ['10:30', 'リハーサル']] });
  await page.click('[data-tab="concerts"]');
  await page.locator('#cList .crow[data-c="c1"] .t1').click();
  await page.locator('[data-dy="edit"]').click();
  await page.locator('#dySm').click();
  await expect(page.locator('#dyTt')).toHaveValue('9:00 ホール集合・音出し\n10:30 リハーサル');
  // もう入っているときは、もう一度押して入れかえる
  await page.locator('#dyTt').fill('8:00 集合');
  await page.locator('#dySm').click();
  await expect(page.locator('#dyTt')).toHaveValue('8:00 集合');
  await page.locator('#dySm').click();
  await expect(page.locator('#dyTt')).toHaveValue('9:00 ホール集合・音出し\n10:30 リハーサル');
  await noErrors(errors);
});

test('部員用の設定リンクで、当日の案内も部員の端末に入り、本番から当日の画面を開ける', async ({ page }) => {
  const errors = await openApp(page);
  const day = { meet: '09:00', meetPlace: '音楽室', tt: [['9:00', '集合']], items: ['楽器'] };
  await setOrg(page, Object.assign({}, BASE, { org: Object.assign({}, BASE.org, { member: { tools: ['gassou'], concerts: true } }), concerts: [Object.assign({}, BASE.concerts[0], { day })] }));
  await reopen(page);
  const p = await page.evaluate(() => { const o = GKY.org(); return { k: 'join', v: 1, o: { name: o.org.name, type: o.org.type }, cfg: o.org.member, at: '2026-10-01', c: o.concerts.map(c => c.day ? [c.id, c.date, c.start, c.title, c.kind, c.venue, c.note, c.day] : [c.id, c.date, c.start, c.title, c.kind, c.venue, c.note]) }; });
  await page.evaluate(p => __app.applyJoin(p, 'member'), p);
  const o = await org(page);
  expect([o.org.role, o.concerts[0].day.meetPlace, o.concerts[0].day.tt]).toEqual(['member', '音楽室', [['9:00', '集合']]]);
  await page.click('[data-tab="concerts"]');
  await page.locator('#cList .crow').first().locator('.t1').click();
  await expect(page.locator('[data-dy="edit"]')).toHaveCount(0);
  await page.locator('[data-dy="open"]').click();
  await expect(page.locator('.gky-sheet .dmeet')).toContainText('音楽室');
  await noErrors(errors);
});

test('年間カレンダー：本番に、出欠の予定と本番逆算の締め切りも重ねる。日を押すと一覧。印刷・.ics', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, BASE);
  await page.evaluate(() => {
    localStorage.setItem('shukketsu.v1', JSON.stringify({ v: 1, events: [{ id: 'e1', date: '2026-10-20', start: '16:00', end: '18:00', title: '合奏', kind: 'practice', place: '音楽室' }, { id: 'e2', date: '2026-10-31', title: '定演', kind: 'show', concert: 'c1' }, { id: 'e3', date: '2027-04-10', title: '来年度', kind: 'practice' }], att: {} }));
    localStorage.setItem('gyakusan.v1', JSON.stringify({ v: 1, plans: { a: { id: 'a', title: '定演', date: '2026-10-31', tasks: [{ id: 't1', name: 'プログラムを印刷', off: -10, done: false }, { id: 't2', name: '会場予約', off: -180, done: true }] }, s: { id: 's', title: '例', date: '2026-10-31', sample: true, tasks: [{ id: 'x', name: '例の締め切り', off: -3 }] } } }));
  });
  await reopen(page);
  await page.click('[data-tab="concerts"]');
  await page.click('#cView [data-v="cal"]');
  await expect(page.locator('#cList .calm')).toHaveCount(12);
  await expect(page.locator('#cList .calm').first()).toContainText('4月');
  await expect(page.locator('#cList td[data-day="2026-10-31"] .ev')).toHaveText(['第13回 定期演奏会']);      // 本番とつないだ出欠の予定は重ねない
  await expect(page.locator('#cList td[data-day="2026-10-20"] .ev')).toHaveText(['合奏']);
  await expect(page.locator('#cList td[data-day="2026-10-21"] .ev')).toHaveCount(0);                          // 締め切りははじめは出さない
  await page.locator('#calDue').check();
  await expect(page.locator('#cList td[data-day="2026-10-21"] .ev')).toHaveText(['〆プログラムを印刷']);      // すんだもの・例の本番は出さない
  await page.locator('#calAtt').uncheck();
  await expect(page.locator('#cList td[data-day="2026-10-20"] .ev')).toHaveCount(0);
  await page.locator('#calAtt').check();
  // 日を押すと、その日の一覧。本番を押すと本番の画面
  await page.locator('#cList td[data-day="2026-10-20"]').click();
  await expect(page.locator('.gky-sheet')).toContainText('16:00');
  await expect(page.locator('.gky-sheet')).toContainText('〜18:00　音楽室');
  await page.keyboard.press('Escape');
  await page.locator('#cList td[data-day="2026-10-31"]').click();
  await page.locator('.gky-sheet .crow[data-c="c1"]').click();
  await expect(page.locator('.gky-sheet')).toContainText('ツールごとの記録');
  await page.keyboard.press('Escape');
  // 印刷：1年を1枚（横）・月ごと（12ページ）
  await expect(page.locator('#cPrint')).toHaveText('カレンダーを印刷・PDF');
  await page.click('#cPrint');
  await page.click('[data-cp="year"]');
  const pg = page.locator('.gky-pv .gky-page');
  await expect(pg).toHaveCount(1);
  await expect(pg.first()).toHaveClass(/landscape/);
  await expect(pg.first()).toContainText('31日 第13回 定期演奏会');
  await page.click('.gky-pv [data-act="close"]');
  await page.click('#cPrint');
  await page.click('[data-cp="month"]');
  await expect(page.locator('.gky-pv .gky-page')).toHaveCount(12);
  await page.click('.gky-pv [data-act="close"]');
  // .ics：練習（終わりの時刻つき）と締め切りも入る
  const ics = await page.evaluate(async () => { let out = ''; const sf = GKY.saveFile; GKY.saveFile = async (n, d) => { out = d; return true; }; document.querySelector('#cIcs').click(); await new Promise(r => setTimeout(r, 100)); GKY.saveFile = sf; return out; });
  expect(ics).toContain('SUMMARY:合奏');
  expect(ics).toContain('DTSTART:20261020T160000');
  expect(ics).toContain('DTEND:20261020T180000');
  expect(ics).toContain('SUMMARY:〆 プログラムを印刷（定演）');
  expect(ics).toContain('DTSTART;VALUE=DATE:20261021');
  expect(ics).not.toContain('来年度');
  await noErrors(errors);
});

test('年度末のチェックリスト：順に案内し、済んだものに印。2月なかば〜4月はツールのタブで知らせる', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-03-10T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, BASE, { concerts: [...BASE.concerts, { id: 'n1', title: '新入生歓迎演奏', date: '2027-04-12', kind: 'school' }] }));
  await reopen(page);
  expect(await page.evaluate(() => __app.yeFy())).toBe(2026);
  await expect(page.locator('#yeBanner')).toContainText('年度末・年度はじめにやること');
  await expect(page.locator('#yeBanner')).toContainText('（1 / 10）');       // 次の年度の本番が入っている
  await page.click('#yeGo');
  const box = page.locator('#yeBox');
  await expect(box).toBeVisible();
  await expect(box).toContainText('2026年度 → 2027年度');
  await expect(box.locator('.first')).toHaveCount(10);
  await expect(box.locator('.first.done')).toHaveCount(1);
  await expect(box.locator('.first', { hasText: '会計：今年度の会計報告' }).locator('a')).toHaveAttribute('href', '../kaikei/');
  await box.locator('[data-yeck="kaikei"]').check();
  await expect(box.locator('.first.done')).toHaveCount(2);
  expect(await page.evaluate(() => GKY.pref('yearEnd')['2026'].kaikei)).toBe('2027-03-10');
  // バックアップを保存すると自動で済み
  await page.evaluate(() => GKY.setPref('lastBackup', Date.now()));
  await page.click('[data-tab="tools"]'); await page.click('[data-tab="org"]');
  await expect(box.locator('.first.done')).toHaveCount(3);
  // 一般の団体：引退・進級・楽器決めはない
  await setOrg(page, Object.assign({}, BASE, { org: { name: '市民吹奏楽団', type: 'ippan' } }));
  await reopen(page);
  expect(await page.evaluate(() => __app.yeSteps(GKY.org()).map(s => s.id))).toEqual(['backup', 'kaikei', 'gakufu', 'gakki', 'concerts', 'role', 'handover']);
  // 今年は出さない
  await page.click('#yeHide');
  await expect(page.locator('#yeBanner')).toBeEmpty();
  await reopen(page);
  await expect(page.locator('#yeBanner')).toBeEmpty();
  await noErrors(errors);
});

test('年度末のお知らせは、時期でないとき・部員用の端末では出ない', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, BASE); await reopen(page);
  await expect(page.locator('#yeBanner')).toBeEmpty();
  await page.clock.setFixedTime(new Date('2027-04-20T10:00:00'));
  await setOrg(page, Object.assign({}, BASE, { org: Object.assign({}, BASE.org, { role: 'member' }) })); await reopen(page);
  await expect(page.locator('#yeBanner')).toBeHidden();
  await noErrors(errors);
});

test('お知らせ：本番を選んで送迎のお願い（当日の案内の集合・解散が入る）→ 直す・印刷（返事の欄）・リンク・コピー', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T10:00:00'));
  const errors = await openApp(page);
  await setOrg(page, Object.assign({}, BASE, { concerts: [Object.assign({}, BASE.concerts[0], { day: { meet: '09:00', meetPlace: '学校', end: '17:30', endPlace: '学校' } })] }));
  await reopen(page);
  await page.click('[data-tab="notice"]');
  await expect(page.locator('#ntList')).toContainText('まだお知らせがありません');
  await page.click('#ntNew [data-nk="ride"]');
  await page.locator('.gky-sheet [data-pc="c1"]').click();
  const ed = page.locator('.gky-sheet', { hasText: '送迎のお願いを作る' });
  await expect(ed.locator('#ntT')).toHaveValue('第13回 定期演奏会の送迎のお願い');
  await expect(ed.locator('#ntTo')).toHaveValue('保護者の皆様');
  await expect(ed.locator('#ntFr')).toHaveValue('テスト中学校 吹奏楽部　顧問');
  await expect(ed.locator('#ntR')).toHaveValue('日時｜2026年10月31日（土）　市民会館\n集合｜09:00　学校\n解散（予定）｜17:30　学校');
  await expect(ed.locator('#ntDue')).toHaveValue('2026-10-24');
  await ed.locator('#ntB').fill('送迎のご協力をお願いします。');
  await ed.locator('footer .btn.primary').click();
  const s = await page.evaluate(() => __app.ntState());
  expect(s.list.map(n => [n.kind, n.title, n.body, n.rows.length, n.reply, n.qs.length])).toEqual([['ride', '第13回 定期演奏会の送迎のお願い', '送迎のご協力をお願いします。', 3, true, 4]]);
  await expect(page.locator('#ntList .ntrow')).toContainText('返事は 10/24（土） まで');
  // 印刷：返事の切り取り欄
  await page.locator('#ntList .ntrow').click();
  await page.click('#ntPrint');
  const pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('第13回 定期演奏会の送迎のお願い');
  await expect(pg).toContainText('ここで切り取ってください');
  await expect(pg).toContainText('行き：　送迎できる　・　できない');
  await page.click('.gky-pv [data-act="close"]');
  // 文でコピー
  const txt = await page.evaluate(async () => { let out = ''; const c = GKY.copyText; GKY.copyText = async t => { out = t; return true; }; document.querySelector('#ntCopy').click(); await new Promise(r => setTimeout(r, 50)); GKY.copyText = c; return out; });
  expect(txt).toMatch(/^【第13回 定期演奏会の送迎のお願い】\n保護者の皆様\n\n送迎のご協力をお願いします。\n\n日時　2026年10月31日（土）　市民会館\n集合　09:00　学校/);
  expect(txt).toContain('返事の締め切り：2026年10月24日（土）');
  // 見るだけのリンク
  const n = s.list[0];
  const url = await page.evaluate(async n => GKY.shareUrl('gakuya', { k: 'notice', o: 'テスト中学校 吹奏楽部', n }), n);
  await page.goto('about:blank');
  await reopen(page, '?test' + url.slice(url.indexOf('#')));
  await expect(page.locator('.gky-viewer')).toContainText('お知らせ');
  await expect(page.locator('#gkyViewBody .ntti')).toHaveText('第13回 定期演奏会の送迎のお願い');
  await expect(page.locator('#gkyViewBody')).not.toContainText('切り取って');
  await noErrors(errors);
});

test('お知らせ：会計の集金から集金のお知らせ。当番は3つの列。一般の団体では「団員の皆様」', async ({ page }) => {
  const errors = await openApp(page);
  await setOrg(page, BASE);
  await page.evaluate(() => localStorage.setItem('kaikei.v1', JSON.stringify({ v: 1, ledger: [], fees: { plans: [{ id: 'f1', name: '後期の部費', amount: 3000, due: '2026-11-10' }], paid: {}, ex: {} }, budgets: [] })));
  await reopen(page);
  await page.click('[data-tab="notice"]');
  await expect(page.locator('#ntFee')).toBeVisible();
  await page.click('#ntFee');
  await page.locator('[data-fp="0"]').click();
  const ed = page.locator('.gky-sheet', { hasText: '集金のお知らせを作る' });
  await expect(ed.locator('#ntT')).toHaveValue('後期の部費の集金のお知らせ');
  await expect(ed.locator('#ntR')).toHaveValue('後期の部費｜3,000円');
  await expect(ed.locator('#ntDue')).toHaveValue('2026-11-10');
  await ed.locator('footer .btn.primary').click();
  // 当番：日付｜当番｜担当
  await page.click('#ntNew [data-nk="duty"]');
  await page.click('.gky-sheet footer >> text=本番なしで作る');
  const ed2 = page.locator('.gky-sheet', { hasText: '当番のお知らせを作る' });
  await ed2.locator('#ntR').fill('11/3｜受付｜山田さん\n11/3｜お茶当番');
  await ed2.locator('footer .btn.primary').click();
  const s = await page.evaluate(() => __app.ntState().list.find(n => n.kind === 'duty'));
  expect(s.rows).toEqual([['11/3', '受付', '山田さん'], ['11/3', 'お茶当番', '']]);
  // 消す（元に戻せる）
  await expect(page.locator('#ntList .ntrow')).toHaveCount(2);
  await page.locator('#ntList .ntrow', { hasText: '当番' }).click();
  await page.click('#ntDel'); await page.click('#ntDel');
  await expect(page.locator('#ntList .ntrow')).toHaveCount(1);
  await page.click('.gky-toast button');
  await expect(page.locator('#ntList .ntrow')).toHaveCount(2);
  expect(await page.evaluate(() => { GKY.saveOrg('org', { type: 'ippan' }); return __app.ntTemplate('general', null).to; })).toBe('団員の皆様');
  await noErrors(errors);
});

test('同期ファイル：ツールごとに新しいほう、楽屋のデータは区分ごと。この端末の使い方は変えない。元に戻せる', async ({ page, browser }) => {
  const errors = await openApp(page);
  // 端末A（この page）：部員・会計を直した
  await setOrg(page, BASE);
  await page.evaluate(() => {
    GKY.store.set('kaikei.v1', { v: 1, ledger: [{ id: 'l1', title: 'Aの記録' }] });
    GKY.store.set('kouban.v1', { v: 1, projects: { k: { id: 'k', title: 'Aの香盤' } } });
    GKY.store.set('hannyu.v1', { v: 1, trips: {} });
    const o = GKY.org(); GKY.saveOrg('members', o.members.concat([{ name: '端末Aで足した人', part: 'Tp', status: 'active' }]));
  });
  const fileA = await page.evaluate(() => __app.buildSync());
  expect(fileA.app).toBe('gakuya-sync');
  expect(Object.keys(fileA.keys).sort()).toEqual(['gakuya.org', 'hannyu.v1', 'kaikei.v1', 'kouban.v1']);
  expect(fileA.mtimes['kaikei.v1']).toBeGreaterThan(0);
  // 端末B（別のブラウザ）：あとから香盤と本番を直し、搬入出を消した。部員用の端末
  const ctx = await browser.newContext(); const pb = await ctx.newPage();
  await pb.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pb.goto('/index.html?test'); await pb.waitForFunction(() => window.__app && window.__app.ready);
  await pb.evaluate(o => { localStorage.setItem('gakuya.org', JSON.stringify(Object.assign({ app: 'gakuya' }, o, { org: Object.assign({}, o.org, { role: 'member' }), updated: { org: 0, members: 1, songs: 0, instruments: 0, concerts: 1 } }))); }, BASE);
  await pb.waitForTimeout(20);
  await pb.evaluate(() => {
    GKY.store.set('kouban.v1', { v: 1, projects: { k: { id: 'k', title: 'Bで直した香盤' } } });
    GKY.store.set('shukketsu.v1', { v: 1, events: [] });
    GKY.store.set('hannyu.v1', { v: 1, trips: {} }); GKY.store.del('hannyu.v1');
    const o = GKY.org(); o.concerts.push({ id: 'cb', title: 'Bで足した本番', date: '2027-01-10' }); o.updated.concerts = Date.now(); localStorage.setItem('gakuya.org', JSON.stringify(o));
  });
  await pb.evaluate(() => { localStorage.setItem('bamiri.current', JSON.stringify({ items: [1] })); });
  await page.evaluate(() => { localStorage.setItem('bamiri.current', JSON.stringify({ items: [1, 2] })); });
  const fileB = await pb.evaluate(() => __app.buildSync());
  expect(fileB.mtimes['hannyu.v1']).toBeLessThan(0);
  // 端末Aで、Bの同期ファイルを比べる
  const plan = await page.evaluate(f => __app.syncPlan(f).map(p => [p.k, p.act, p.secs || null]), fileB);
  expect(plan).toEqual([['bamiri.current', 'ask', null], ['gakuya.org', 'org', ['concerts']], ['hannyu.v1', 'del', null], ['kaikei.v1', 'keep', null], ['kouban.v1', 'take', null], ['shukketsu.v1', 'take', null]]);
  // 画面から合わせる（分からないものは選ぶ）
  await page.evaluate(() => __app.showTab('backup'));
  const chooser = page.waitForEvent('filechooser');
  await page.click('#syncLoad');
  await (await chooser).setFiles({ name: 'sync.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fileB)) });
  const sh = page.locator('.gky-sheet', { hasText: '同期ファイルで合わせる' });
  await expect(sh).toContainText('どちらが新しいか分かりません');
  await sh.locator('[data-sy]').check();
  await sh.locator('footer .btn.primary').click();
  const after = await page.evaluate(() => ({ o: GKY.org(), kb: GKY.store.get('kouban.v1'), kk: GKY.store.get('kaikei.v1'), hn: GKY.store.raw('hannyu.v1'), sk: !!GKY.store.raw('shukketsu.v1'), bm: GKY.store.get('bamiri.current') }));
  expect(after.o.org.role).toBe('staff');                                             // この端末の使い方はそのまま
  expect(after.o.members.map(m => m.name)).toContain('端末Aで足した人');             // 部員はこの端末のほうが新しい
  expect(after.o.concerts.map(c => c.title)).toContain('Bで足した本番');             // 本番はBのほうが新しい
  expect([after.kb.projects.k.title, after.kk.ledger[0].title, after.hn, after.sk, after.bm.items.length]).toEqual(['Bで直した香盤', 'Aの記録', null, true, 1]);
  // 合わせたものの時刻は、同期ファイルの時刻のまま（反対の端末で合わせたときに、また入れかえない）
  expect(await page.evaluate(() => GKY.store.mtimes()['kouban.v1'])).toBe(fileB.mtimes['kouban.v1']);
  // 元に戻す
  await page.click('.gky-toast button');
  const back = await page.evaluate(() => ({ kb: GKY.store.get('kouban.v1'), hn: !!GKY.store.raw('hannyu.v1'), sk: !!GKY.store.raw('shukketsu.v1'), cs: GKY.org().concerts.map(c => c.title) }));
  expect([back.kb.projects.k.title, back.hn, back.sk, back.cs.includes('Bで足した本番')]).toEqual(['Aの香盤', true, false, false]);
  // 反対：Bの端末にAの同期ファイル → Aで直した部員だけが入る（部員用の設定は部員用のまま）
  const planB = await pb.evaluate(f => __app.syncPlan(f).map(p => [p.k, p.act, p.secs || null]), fileA);
  expect(planB.find(p => p[0] === 'gakuya.org')).toEqual(['gakuya.org', 'org', ['members']]);
  await ctx.close();
  await noErrors(errors);
});

test('同期ファイルの読み込みで、バックアップのファイルを選んだときは知らせる', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => __app.showTab('backup'));
  const chooser = page.waitForEvent('filechooser');
  await page.click('#syncLoad');
  await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'gakuya-backup', keys: {} })) });
  await expect(page.locator('.gky-toast')).toContainText('これはバックアップのファイルです');
  await noErrors(errors);
});
