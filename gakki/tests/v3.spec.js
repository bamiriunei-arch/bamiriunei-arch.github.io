// 楽器台帳 v3：ほかの団体との貸し借り（まとめて・貸出書／借用書・返した）、使う人をまとめて決める・使った人の記録
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const ITEMS = [
  { id: 'g1', no: 'Tp-01', name: 'トランペット', part: 'Tp', maker: 'メーカーD', model: 'TR-1', serial: '445566', owner: 'school', state: 'good' },
  { id: 'g2', no: 'Tp-02', name: 'トランペット', part: 'Tp', maker: 'メーカーD', model: 'TR-1', serial: '445577', owner: 'school', state: 'good' },
  { id: 'g3', no: 'Hn-01', name: 'ホルン', part: 'Hn', owner: 'club', state: 'good' },
  { id: 'g4', no: 'Tb-01', name: 'トロンボーン', part: 'Tb', owner: 'personal', ownerNote: '石田 花さんの楽器', state: 'good' },
];
const ORG = { org: { name: 'テスト中学校 吹奏楽部', type: 'chu' }, members: [{ id: 'a', name: '赤井 一郎', part: 'Tp', grade: '中2', status: 'active' }, { id: 'b', name: '石田 花', part: 'Tb', grade: '中3', status: 'active' }, { id: 'c', name: '上野 空', part: 'Tp', grade: '中1', status: 'active' }, { id: 'd', name: '江口 海', part: 'Hn', grade: '中1', status: 'active' }] };
async function seed(page) {
  await page.evaluate(({ ITEMS, ORG }) => { localStorage.setItem('gakki.v1', JSON.stringify({ v: 1, items: ITEMS, cons: [], settings: {} })); localStorage.setItem('gakuya.org', JSON.stringify(ORG)); }, { ITEMS, ORG });
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
}

test('ほかの団体に貸す：楽器をまとめて選んで記録し、貸出書を印刷。返してもらったら状態も記録する', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.click('[data-tab="lend"]');
  await expect(page.locator('#dealList')).toContainText('ほかの団体との貸し借りの記録はありません');
  await page.click('#dealOut');
  const sh = page.locator('.gky-sheet', { hasText: 'ほかの団体に貸す' });
  await sh.locator('#dOrg').fill('市立北中学校 吹奏楽部');
  await sh.locator('#dCon').fill('顧問 北村先生');
  await sh.locator('#dPur').fill('合同演奏会');
  await sh.locator('#dSince').fill('2026-10-01'); await sh.locator('#dDue').fill('2026-10-31');
  // 個人の楽器は選べない
  await expect(sh.locator('#dPick input[value="g4"]')).toBeDisabled();
  await sh.locator('#dQ').fill('Tp');
  await expect(sh.locator('#dPick label:not([hidden])')).toHaveCount(2);
  await sh.locator('#dPick input[value="g1"]').check(); await sh.locator('#dPick input[value="g2"]').check();
  await expect(sh.locator('#dCnt')).toHaveText('　2台');
  await sh.getByRole('button', { name: '貸す', exact: true }).click();
  await expect(page.locator('#gkyToast')).toContainText('2台を市立北中学校 吹奏楽部に貸しました');
  const st = await page.evaluate(() => __app.S.items.filter(i => i.lentKind === 'org').map(i => [i.no, i.lentTo, i.lentSince, i.lentDue, i.log[0].text]));
  expect(st).toEqual([['Tp-01', '市立北中学校 吹奏楽部', '2026-10-01', '2026-10-31', '市立北中学校 吹奏楽部（団体）へ（合同演奏会）'], ['Tp-02', '市立北中学校 吹奏楽部', '2026-10-01', '2026-10-31', '市立北中学校 吹奏楽部（団体）へ（合同演奏会）']]);
  const card = page.locator('#dealList .deal').first();
  await expect(card.locator('.chip').first()).toHaveText('貸している');
  await expect(card).toContainText('目的：合同演奏会');
  await expect(card.locator('.its .chip')).toHaveText(['Tp-01 トランペット', 'Tp-02 トランペット']);
  await expect(page.locator('#lendTable')).toContainText('市立北中学校 吹奏楽部');
  // 貸出書
  await card.locator('[data-dprint]').click();
  const pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('楽器貸出書');
  await expect(pg).toContainText('市立北中学校 吹奏楽部　様');
  await expect(pg).toContainText('下記のとおり楽器をお貸しします');
  await expect(pg).toContainText('445577');
  await expect(pg).toContainText('テスト中学校 吹奏楽部');
  await page.keyboard.press('Escape');
  // 1台だけ返ってきた → まだ続く。もう1台（傷みあり）→ 全部返ってきた
  await card.locator('[data-dback]').click();
  const bk = page.locator('.gky-sheet', { hasText: 'から返してもらった' });
  await bk.locator('input[value="g2"]').uncheck();
  await bk.getByRole('button', { name: '記録する' }).click();
  await expect(page.locator('#dealList .deal').first().locator('.its')).toContainText('Tp-01 トランペット 返却');
  await page.locator('#dealList .deal').first().locator('[data-dback]').click();
  await bk.locator('#bkSt').selectOption('adjust');
  await bk.getByRole('button', { name: '記録する' }).click();
  await expect(page.locator('#gkyToast')).toContainText('この貸し借りは、全部返しました');
  const r = await page.evaluate(() => { const g2 = __app.S.items.find(i => i.id === 'g2'); return [g2.lentTo, g2.state, __app.S.deals[0].back !== '', __app.S.items.filter(i => i.lentTo).length]; });
  expect(r).toEqual(['', 'adjust', true, 0]);
  await expect(page.locator('#dealList .deal').first().locator('.chip').first()).toHaveText('返してもらった');
  await noErrors(errors);
});

test('ほかの団体から借りる：借用書の楽器を書くと台帳に「借用」で入り、借用書を印刷。返したら台帳から外し、記録は残る', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.click('[data-tab="lend"]');
  await page.click('#dealIn');
  const sh = page.locator('.gky-sheet', { hasText: 'ほかの団体から借りる' });
  await sh.locator('#dOrg').fill('南高校 吹奏楽部');
  await sh.locator('#dSince').fill('2026-10-05'); await sh.locator('#dDue').fill('2027-03-31');
  const r1 = sh.locator('.inrow').nth(0);
  await r1.locator('[data-r="name"]').fill('テューバ'); await r1.locator('[data-r="no"]').fill('南-Tu'); await r1.locator('[data-r="serial"]').fill('TU-999');
  await sh.locator('#dRowAdd').click();
  const r2 = sh.locator('.inrow').nth(1);
  await r2.locator('[data-r="name"]').fill('譜面台'); await r2.locator('[data-r="qty"]').fill('3');
  await sh.getByRole('button', { name: '借りる', exact: true }).click();
  await expect(page.locator('#gkyToast')).toContainText('南高校 吹奏楽部から借りた楽器を台帳に入れました');
  const xs = await page.evaluate(() => __app.S.items.filter(i => i.owner === 'borrowed').map(i => [i.no, i.name, i.part, i.serial, i.ownerNote, i.condDate]));
  expect(xs).toEqual([
    ['南-Tu', 'テューバ', 'Tuba', 'TU-999', '南高校 吹奏楽部から借用（〜2027-03-31）', '2026-10-05'],
    ['借-02', '譜面台', '', '', '南高校 吹奏楽部から借用（〜2027-03-31）', '2026-10-05'],
    ['借-03', '譜面台', '', '', '南高校 吹奏楽部から借用（〜2027-03-31）', '2026-10-05'],
    ['借-04', '譜面台', '', '', '南高校 吹奏楽部から借用（〜2027-03-31）', '2026-10-05'],
  ]);
  await expect(page.locator('#borrowTable')).toContainText('南-Tu');
  // 借用書
  await page.locator('#dealList .deal').first().locator('[data-dprint]').click();
  const pg = page.locator('.gky-pv .gky-page').first();
  await expect(pg).toContainText('楽器借用書');
  await expect(pg).toContainText('南高校 吹奏楽部　御中');
  await expect(pg).toContainText('下記のとおり楽器を借用いたします');
  await expect(pg).toContainText('TU-999');
  await page.keyboard.press('Escape');
  // 楽器のページにも出る
  await page.click('[data-tab="list"]');
  await page.locator('#instList .inst', { hasText: '南-Tu' }).click();
  await expect(page.locator('#detail')).toContainText('南高校 吹奏楽部から借りている楽器です（2026-10-05〜2027-03-31）');
  // 全部返した → 台帳から外す
  await page.click('[data-tab="lend"]');
  await page.locator('#dealList .deal').first().locator('[data-dback]').click();
  await page.locator('.gky-sheet', { hasText: 'に返した' }).getByRole('button', { name: '記録する' }).click();
  expect(await page.evaluate(() => [__app.S.items.filter(i => i.owner === 'borrowed').length, __app.S.items.length])).toEqual([0, 4]);
  const card = page.locator('#dealList .deal').first();
  await expect(card.locator('.chip').first()).toHaveText('返した');
  await expect(card.locator('.its')).toContainText('南-Tu テューバ 返却');   // 台帳から外しても、記録には残る
  // 消す → 元に戻す
  await card.locator('[data-ddel]').click(); await card.locator('[data-ddel]').click();
  await expect(page.locator('#dealList .deal')).toHaveCount(0);
  await page.locator('#gkyToast button', { hasText: '元に戻す' }).click();
  await expect(page.locator('#dealList .deal')).toHaveCount(1);
  await noErrors(errors);
});

test('使う人をまとめて決める：同じパートの部員が先に出る。決まっていない部員がわかる。使った人の記録が残る', async ({ page }) => {
  const errors = await openApp(page);
  await seed(page);
  await page.click('[data-tab="lend"]');
  await page.click('#userBulk');
  const sh = page.locator('.gky-sheet', { hasText: '使う人をまとめて決める' });
  await expect(sh.locator('tr[data-id]')).toHaveCount(3);                     // 個人の楽器は出さない
  const dl = await sh.locator('tr[data-id="g1"] input').getAttribute('list');
  expect(await sh.locator(`datalist#${dl} option`).evaluateAll(os => os.slice(0, 2).map(o => o.value))).toEqual(['赤井 一郎', '上野 空']);
  await expect(sh.locator('#ubFree')).toContainText('楽器が決まっていない部員');
  await expect(sh.locator('#ubFree')).toContainText('赤井 一郎（Tp）');
  await expect(sh.locator('#ubFree')).not.toContainText('石田 花');           // 自分の楽器を持っている
  await sh.locator('tr[data-id="g1"] input').fill('赤井 一郎');
  await sh.locator('tr[data-id="g2"] input').fill('上野 空');
  await sh.locator('tr[data-id="g3"] input').fill('江口 海');
  await expect(sh.locator('#ubFree')).toContainText('全員の楽器が決まっています');
  await sh.getByRole('button', { name: '決める' }).click();
  await expect(page.locator('#gkyToast')).toContainText('3台の使う人を変えました');
  await expect(page.locator('#userTable')).toContainText('上野 空');
  // 使う人を変える → 使った人の記録
  await page.click('[data-tab="list"]');
  await page.locator('#instList .inst', { hasText: 'Tp-01' }).click();
  await page.locator('#detail [data-k="user"]').fill('上野 空'); await page.locator('#detail [data-k="user"]').press('Tab');
  const h = await page.evaluate(() => __app.S.items.find(i => i.id === 'g1').userHist.map(u => [u.name, !!u.since, !!u.until]));
  expect(h).toEqual([['赤井 一郎', true, true], ['上野 空', true, false]]);
  await expect(page.locator('#detail')).toContainText('使った人の記録');
  const rows = page.locator('#detail .sec', { hasText: '使った人の記録' }).locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText('いま使っている');   // 新しい人が上
  // 新年度：全部消しても、記録は残る
  await page.click('[data-tab="lend"]');
  await page.click('#userClear'); await page.click('#userClear');
  await expect(page.locator('#gkyToast')).toContainText('使った人の記録には残ります');
  const h2 = await page.evaluate(() => __app.S.items.find(i => i.id === 'g1').userHist.every(u => u.until));
  expect(h2).toBe(true);
  await noErrors(errors);
});
