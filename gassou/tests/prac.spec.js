// 合奏ノート v5：個人練習の記録と提出
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const ready = page => page.waitForFunction(() => window.__app && window.__app.ready);
const reopen = async (page, hash = '') => { if (hash) await page.goto('about:blank'); await page.goto('/index.html?test' + hash); await ready(page); };

test('個人練習を記録する：時間のボタン・この1週間の棒・週ごとの一覧・消す（元に戻す）・CSV', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T19:00:00'));   // 日曜
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト中学校' }, songs: [{ id: 's', title: '宝島' }] })));
  await reopen(page);
  await page.click('[data-tab="prac"]');
  await expect(page.locator('#prDate')).toHaveValue('2026-10-11');
  await expect(page.locator('#prList')).toContainText('まだ記録がありません');
  expect(await page.evaluate(() => [...document.querySelectorAll('#prWhatL option')].map(o => o.value))).toContain('宝島');
  // 時間がないと記録しない
  await page.click('#prAdd');
  await expect(page.locator('#gkyToast')).toContainText('時間（分）を入れてください');
  await page.click('#prQuick [data-m="30"]');
  await page.locator('#prWhat').fill('ロングトーン');
  await page.locator('#prMemo').fill('高い音の音程がよくなった');
  await page.click('#prAdd');
  await page.locator('#prDate').fill('2026-10-09');
  await page.locator('#prMin').fill('45'); await page.locator('#prWhat').fill('宝島のサビ');
  await page.click('#prAdd');
  await page.locator('#prDate').fill('2026-10-04');   // 先週の日曜
  await page.locator('#prMin').fill('20'); await page.click('#prAdd');
  // 先の日付はだめ
  await page.locator('#prDate').fill('2026-10-12'); await page.locator('#prMin').fill('20'); await page.click('#prAdd');
  await expect(page.locator('#gkyToast')).toContainText('先の日付には記録できません');
  const log = await page.evaluate(() => __app.S.prac.log.map(x => [x.date, x.min, x.what, x.memo]));
  expect(log).toEqual([['2026-10-11', 30, 'ロングトーン', '高い音の音程がよくなった'], ['2026-10-09', 45, '宝島のサビ', ''], ['2026-10-04', 20, '', '']]);
  await expect(page.locator('#prSum')).toHaveText('今週 1時間15分・今月 1時間35分');
  await expect(page.locator('#prWeek .prday')).toHaveCount(7);
  await expect(page.locator('#prWeek .prday.today')).toContainText('30分');
  await expect(page.locator('#prWeek')).toContainText('7日で 1時間15分・2日');        // 10/4 は7日より前
  await expect(page.locator('#prList .prwk')).toHaveCount(2);
  await expect(page.locator('#prList .prwk').first()).toContainText('10/5（月）〜10/11（日）');
  // 消す・元に戻す
  await page.locator('#prList [data-prdel]').last().click();
  expect(await page.evaluate(() => __app.S.prac.log.length)).toBe(2);
  await page.click('#gkyToast button');
  expect(await page.evaluate(() => __app.S.prac.log.length)).toBe(3);
  // 開き直しても残る
  await page.waitForTimeout(400);
  await reopen(page);
  expect(await page.evaluate(() => __app.S.prac.log.length)).toBe(3);
  const csv = await page.evaluate(async () => { let out = ''; const sf = GKY.saveFile; GKY.saveFile = async (n, d) => { out = d; return true; }; document.querySelector('#prCsv').click(); await new Promise(r => setTimeout(r, 50)); GKY.saveFile = sf; return out; });
  expect(csv).toContain('2026-10-09,金,45,宝島のサビ,');
  await noErrors(errors);
});

test('個人練習を提出する（部員用の端末）→ 代表者の端末で受け取り、人ごとの合計。同じ記録を2回送っても1回に数える', async ({ page, browser }) => {
  await page.clock.setFixedTime(new Date('2026-10-11T19:00:00'));
  const errors = await openApp(page);
  await page.evaluate(() => {
    localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト中学校', role: 'member', member: { tools: ['gassou'], notes: true } } }));
    localStorage.setItem('gassou.v1', JSON.stringify({ v: 1, current: 'n1', order: ['n1'], notes: { n1: { id: 'n1', title: '合奏', date: '2026-10-09' } }, prac: { log: [
      { id: 'a', date: '2026-10-11', min: 30, what: 'ロングトーン', at: 3 }, { id: 'b', date: '2026-10-09', min: 45, what: '宝島', memo: 'サビ', at: 2 }, { id: 'c', date: '2026-09-20', min: 60, what: '譜読み', at: 1 }] } }));
  });
  await reopen(page);
  await page.click('[data-tab="prac"]');
  await expect(page.locator('#prSent')).toHaveText('まだ提出していません。');
  await page.click('#prSubmit');
  const sh = page.locator('.gky-sheet', { hasText: '個人練習を提出' });
  await expect(sh.locator('[name="psR"]:checked')).toHaveValue('7');
  await expect(sh).toContainText('この1週間（2回・1時間15分）');
  await expect(sh).toContainText('全部（3回・2時間15分）');
  await sh.locator('#psName').fill('赤井 一郎'); await sh.locator('#psPart').fill('Tp');
  await sh.locator('footer .btn.primary').click();
  const link1 = await page.locator('.gky-share textarea').last().inputValue();
  expect(link1).toMatch(/#n=/);
  await expect(page.locator('#prSent')).toContainText('前に提出したのは 10/11（日）');
  await expect(page.locator('#prSent')).toContainText('それより後の記録 0回');
  // 2回目：全部（前の1週間と重なる）
  await page.keyboard.press('Escape');
  await page.clock.setFixedTime(new Date('2026-10-11T19:05:00'));
  await page.click('#prSubmit');
  const sh2 = page.locator('.gky-sheet', { hasText: '個人練習を提出' });
  await expect(sh2.locator('[name="psR"][value="sent"]')).toBeDisabled();
  await sh2.locator('[name="psR"][value="all"]').check();
  await sh2.locator('footer .btn.primary').click();
  const link2 = await page.locator('.gky-share textarea').last().inputValue();
  // 部員用の端末でリンクを開いても入れない
  await reopen(page, link1.slice(link1.indexOf('#')));
  await expect(page.locator('.gky-sheet')).toContainText('赤井 一郎さんの個人練習');
  await expect(page.locator('.gky-sheet')).toContainText('2回・合計 1時間15分');
  // 代表者の端末
  const ctx = await browser.newContext(); const pb = await ctx.newPage();
  await pb.clock.setFixedTime(new Date('2026-10-11T20:00:00'));
  await pb.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await pb.goto('/index.html?test'); await ready(pb);
  await pb.goto('/index.html?test' + link1.slice(link1.indexOf('#'))); await ready(pb);
  await expect(pb.locator('[data-panel="inbox"]')).toBeVisible();
  await expect(pb.locator('#gkyToast')).toContainText('赤井 一郎さんの個人練習（2回）を受け取りました');
  await expect(pb.locator('#cntIn')).toHaveText('1');
  // 2つ目は貼って入れる（同じリンクをもう一度貼っても1つ）
  await pb.locator('#inPaste').fill(`赤井です\n${link2}\n${link1}`);
  await pb.click('#inAdd');
  await expect(pb.locator('#gkyToast')).toContainText('1件入れました・もう入っていたもの 1件');
  const ps = await pb.evaluate(() => __app.piPeople().map(g => [g.name, g.part, g.total, g.days, g.es.length]));
  expect(ps).toEqual([['赤井 一郎', 'Tp', 75, 2, 2]]);           // この1週間：同じ記録は1回
  await pb.click('#piRange [data-r="0"]');
  await expect(pb.locator('#piList')).toContainText('2時間15分');
  await expect(pb.locator('#piList')).toContainText('3日');
  await expect(pb.locator('#piList')).toContainText('新しい提出');
  await pb.click('#piRead');
  await expect(pb.locator('#piList')).not.toContainText('新しい提出');
  await pb.click('#piPrint');
  await expect(pb.locator('.gky-pv .gky-page').first()).toContainText('個人練習の記録');
  await pb.click('.gky-pv [data-act="close"]');
  const txt = await pb.evaluate(async () => { let out = ''; const c = GKY.copyText; GKY.copyText = async t => { out = t; return true; }; document.querySelector('#piCopy').click(); await new Promise(r => setTimeout(r, 50)); GKY.copyText = c; return out; });
  expect(txt).toBe('【個人練習】すべて\n赤井 一郎（Tp）　2時間15分・3日　ロングトーン・宝島・譜読み');
  await ctx.close();
  await noErrors(errors);
});

test('部員用の端末で提出を使わない設定のときは、提出の欄を出さない', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => localStorage.setItem('gakuya.org', JSON.stringify({ org: { name: 'テスト', role: 'member', member: { tools: ['gassou'], notes: false } } })));
  await reopen(page);
  await page.click('[data-tab="prac"]');
  await expect(page.locator('#prSubSec')).toBeHidden();
  await expect(page.locator('#prAdd')).toBeVisible();
  await noErrors(errors);
});
