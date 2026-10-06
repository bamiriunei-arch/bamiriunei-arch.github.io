// 会計の基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const MS = [{ name: '青木 美咲', part: 'Fl', grade: '中2' }, { name: '石井 大翔', part: 'Fl', grade: '中1' }, { name: '上田 さくら', part: 'Cl', grade: '中3' }, { name: '卒業 太郎', part: 'Tp', grade: '中3', status: 'gone' }];
// 楽屋の名簿を入れて、空の会計で開く（今日は 2027年5月12日）
async function openEmpty(page) {
  await page.clock.setFixedTime(new Date('2027-05-12T10:00:00'));
  await page.addInitScript(ms => { if (location.protocol === 'about:') return; if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト中学校吹奏楽部', type: 'chu' }, members: ms })); localStorage.setItem('kaikei.v1', JSON.stringify({ v: 1, start: 4, ledger: [] })); } }, MS);
  return openApp(page);
}
const money = page => page.locator('#money').innerText();

test('例：繰越＋収入−支出＝残高。団費は日ごとにまとめて帳簿に出る', async ({ page }) => {
  const errors = await openApp(page);
  const r = await page.evaluate(() => { const y = __app.yearOf(__app.Y); const fee = y.rows.filter(x => x.virtual); return { carry: y.carry, in: y.t.in, out: y.t.out, bal: y.bal, fee: fee.length, feeSum: fee.reduce((t, x) => t + x.amount, 0) }; });
  expect(r.bal).toBe(r.carry + r.in - r.out);
  expect(r.fee).toBeGreaterThan(0);
  await expect(page.locator('#money')).toContainText(r.bal.toLocaleString('ja-JP') + '円');
  await expect(page.locator('#bkTable tr.fee').first()).toContainText('団費：');
  await noErrors(errors);
});

test('収入・支出を足す（金額は「1,200円」でも読める）。立替は「返した」まで一覧に出る', async ({ page }) => {
  const errors = await openEmpty(page);
  await page.click('#bkIn');
  await page.locator('#eD').fill('2027-04-20'); await page.locator('#eA').fill('30,000円'); await page.locator('#eC').fill('補助金・助成金'); await page.locator('#eT').fill('PTAからの補助');
  await page.click('.gky-sheet footer .btn.primary');
  await page.click('#bkOut');
  await page.locator('#eD').fill('2027-05-01'); await page.locator('#eA').fill('12800'); await page.locator('#eC').fill('印刷費'); await page.locator('#eT').fill('プログラムの印刷');
  await page.locator('#eM').selectOption('立替');
  await expect(page.locator('#eWL')).toHaveText('立て替えた人');
  await page.locator('#eW').fill('青木 美咲');
  await page.click('.gky-sheet footer .btn.primary');
  // 金額がおかしいと足さない
  await page.click('#bkOut'); await page.locator('#eA').fill('abc'); await page.click('.gky-sheet footer .btn.primary');
  await expect(page.locator('.gky-sheet')).toBeVisible(); await page.keyboard.press('Escape');
  const r = await page.evaluate(() => { const y = __app.yearOf(2027); return [y.t.in, y.t.out, y.bal, __app.S.ledger.length]; });
  expect(r).toEqual([30000, 12800, 17200, 2]);
  await expect(page.locator('#tateBox')).toContainText('青木 美咲');
  await page.locator('#tateBox [data-back]').click();
  await expect(page.locator('#tateBox')).toContainText('ありません');
  // 行を押すと直せる
  await page.locator('#bkTable tr', { hasText: 'PTAからの補助' }).click();
  await page.locator('#eA').fill('35000'); await page.click('.gky-sheet footer .btn.primary');
  expect(await page.evaluate(() => __app.yearOf(2027).t.in)).toBe(35000);
  await noErrors(errors);
});

test('団費：毎月の集金をまとめて作り、受け取り・免除・まだの人。帳簿にも入る', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors = await openEmpty(page);
  await page.click('[data-tab="fee"]');
  await page.click('#feeNew');
  await page.locator('#pA').fill('1500');
  await page.locator('#pMonthly').check();
  await page.locator('#pM1').selectOption({ label: '4月' }); await page.locator('#pM2').selectOption({ label: '6月' });
  await page.click('.gky-sheet footer .btn.primary');
  const ps = await page.evaluate(() => __app.S.fees.plans.map(p => [p.name, p.amount, p.due]));
  expect(ps).toEqual([['4月分', 1500, '2027-04-10'], ['5月分', 1500, '2027-05-10'], ['6月分', 1500, '2027-06-10']]);
  await page.locator('#feePlan').selectOption({ index: 0 });
  await expect(page.locator('#feeList .fee-row')).toHaveCount(3);     // 卒業した人は出ない
  await page.locator('#feeDate').fill('2027-04-12');
  await page.locator('#feeList .fee-row', { hasText: '青木 美咲' }).locator('[data-a="pay"]').click();
  await page.locator('#feeList .fee-row', { hasText: '石井 大翔' }).locator('[data-a="pay"]').click();
  await page.locator('#feeList .fee-row', { hasText: '上田 さくら' }).locator('[data-a="ex"]').click();
  await expect(page.locator('#feeSums')).toContainText('受け取った 2人・3,000円');
  await expect(page.locator('#feeSums')).toContainText('免除 1人');
  await page.locator('#feePlan').selectOption({ index: 1 });
  await page.click('#feeCopy');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('青木 美咲、石井 大翔、上田 さくら');
  // 締め切り（5/10）をすぎた5月分のまだの人の数が、タブに出る
  await expect(page.locator('#cntFee')).toHaveText('3');
  const r = await page.evaluate(() => { const y = __app.yearOf(2027); return { in: y.t.in, rows: y.rows.filter(x => x.virtual).map(x => [x.date, x.title, x.amount]) }; });
  expect(r.in).toBe(3000);
  expect(r.rows).toEqual([['2027-04-12', '団費：4月分（2人）', 3000]]);
  await page.locator('#feeMx').scrollIntoViewIfNeeded();
  await expect(page.locator('#feeMx tbody tr', { hasText: '上田 さくら' })).toContainText('—');
  await noErrors(errors);
});

test('予算と実績：帳簿の記録に予算をつけると、科目ごとの実績と差が出る', async ({ page }) => {
  const errors = await openEmpty(page);
  await page.click('[data-tab="budget"]');
  await page.click('#bgNew');
  await page.locator('#bN').fill('定期演奏会');
  await page.click('.gky-sheet footer .btn.primary');
  await page.locator('#bgBody tr[data-cat="会場費"] [data-plan]').fill('40000');
  await page.locator('#bgBody tr[data-cat="会場費"] [data-plan]').press('Tab');
  await page.click('[data-tab="book"]');
  await page.click('#bkOut');
  await page.locator('#eD').fill('2027-05-02'); await page.locator('#eA').fill('42000'); await page.locator('#eC').fill('会場費'); await page.locator('#eT').fill('ホールの使用料');
  await page.locator('#eB').selectOption({ label: '定期演奏会' });
  await page.click('.gky-sheet footer .btn.primary');
  await page.click('[data-tab="budget"]');
  const row = page.locator('#bgBody tr[data-cat="会場費"]');
  await expect(row).toContainText('42,000円');
  await expect(row.locator('td.diff')).toHaveText('+2,000円');
  await expect(row.locator('td.diff')).toHaveClass(/over/);
  const v = await page.evaluate(() => { const b = __app.S.budgets[0]; const x = __app.budgetView(b); return [x.tout.plan, x.tout.act]; });
  expect(v).toEqual([40000, 42000]);
  await noErrors(errors);
});

test('会計報告：前の年度の残高を繰越にする。設定で繰越を入れられる。印刷に署名の欄', async ({ page }) => {
  const errors = await openEmpty(page);
  await page.evaluate(() => { const S = __app.S; S.ledger.push({ id: 'a', date: '2026-06-01', kind: 'in', cat: '寄付・協賛', title: '去年の寄付', amount: 50000, who: '', method: '現金', receipt: '', budget: '', note: '', paidBack: false }, { id: 'b', date: '2027-03-31', kind: 'out', cat: '雑費', title: '去年の最後', amount: 8000, who: '', method: '現金', receipt: '', budget: '', note: '', paidBack: false }, { id: 'c', date: '2027-04-01', kind: 'out', cat: '楽譜', title: '今年はじめ', amount: 2000, who: '', method: '現金', receipt: '', budget: '', note: '', paidBack: false }); GKY.store.set('kaikei.v1', S); __app.renderAll(); });
  let r = await page.evaluate(() => [__app.carryOf(2026), __app.carryOf(2027), __app.yearOf(2027).bal]);
  expect(r).toEqual([0, 42000, 40000]);
  await page.click('#btnSet');
  await page.locator('#sCa').fill('45000');
  await page.click('.gky-sheet footer .btn.primary');
  r = await page.evaluate(() => [__app.carryOf(2027), __app.yearOf(2027).bal]);
  expect(r).toEqual([45000, 43000]);
  await page.click('[data-tab="report"]');
  await expect(page.locator('#repBody')).toContainText('2027年度 会計報告');
  await expect(page.locator('#repBody')).toContainText('2027年4月1日〜2028年3月31日');
  await page.click('#repPrint');
  const pg = page.locator('.gky-pv .gky-page').last();
  await expect(pg).toContainText('監査');
  await expect(pg).toContainText('次年度への繰越（残高）');
  await page.keyboard.press('Escape');
  // 年度のはじまりを1月にすると、1〜12月で区切る
  await page.click('#btnSet');
  await page.locator('#sSt').selectOption('1');
  await page.locator('#sCa').fill('');
  await page.click('.gky-sheet footer .btn.primary');
  r = await page.evaluate(() => [__app.fyOf('2027-03-31'), __app.yRange(2027)]);
  expect(r).toEqual([2027, ['2027-01-01', '2027-12-31']]);
  await noErrors(errors);
});
