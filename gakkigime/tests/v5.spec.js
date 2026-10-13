// 楽器決め・編成計画 v5：楽屋の名簿とつなぐ（楽屋で楽器が未定の人 → 新入部員、楽器決めで足した人・決めた楽器 → 楽屋）
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

const seed = (page, org, extra = {}) => page.addInitScript(([o, x]) => {
  if (sessionStorage.getItem('__seeded')) return;
  sessionStorage.setItem('__seeded', '1');
  localStorage.setItem('gakuya.org', JSON.stringify(o));
  for (const k in x) localStorage.setItem(k, JSON.stringify(x[k]));
}, [org, extra]);
const orgMembers = page => page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.map(m => [m.name, m.part, m.grade]));
const ORG = { org: { name: 'テスト中学校', type: 'chu', year: 2027 }, members: [
  { id: 'a', name: '先輩 一', part: 'Cl', grade: '中2', status: 'active' },
  { id: 'n1', name: '新入 花子', part: '', grade: '中1', status: 'active' },
  { id: 'n2', name: '新入 太郎', part: '', grade: '中1', status: 'active' },
  { id: 'g', name: '卒業 三', part: '', grade: '中3', status: 'gone' } ] };

test('楽屋で楽器が（未定）の人は、新入部員に出る（例のデータは消す）。楽器決めで決めると楽屋の楽器も入る', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-04-20T10:00:00'));
  await seed(page, ORG);
  const errors = await openApp(page);
  expect(await page.evaluate(() => __app.S.sample)).toBe(false);
  await expect(page.locator('#nbTable [data-k="name"]')).toHaveCount(2);
  expect(await page.evaluate(() => __app.S.newbies.map(n => [n.name, n.mid]))).toEqual([['新入 花子', 'n1'], ['新入 太郎', 'n2']]);
  // 決まりを入れると楽屋の楽器も
  await page.locator('#nbTable tr[data-id]').first().locator('[data-k="fixed"]').selectOption('Fl');
  await page.evaluate(() => { __app.S.quota = { Fl: 1, Tp: 1 }; __app.S.newbies[1].w = ['Tp', '', '']; });
  await page.click('[data-tab="plan"]');
  await page.click('#decide');
  expect(await orgMembers(page)).toEqual([['先輩 一', 'Cl', '中2'], ['新入 花子', 'Fl', '中1'], ['新入 太郎', 'Tp', '中1'], ['卒業 三', '', '中3']]);
  // 元に戻すと楽屋の楽器も戻る
  await page.click('#btnUndo');
  expect((await orgMembers(page))[2]).toEqual(['新入 太郎', '', '中1']);
  await noErrors(errors);
});

test('楽器決めで足した人は楽屋に足し、消すと楽屋からも消える（元に戻すで両方もどる）。楽屋から来た人は消しても楽屋に残る', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-04-20T10:00:00'));
  await seed(page, ORG);
  const errors = await openApp(page);
  await page.click('#nbAdd');
  await page.locator('#nbTable [data-k="name"]').last().fill('体験 次郎'); await page.locator('#nbTable [data-k="name"]').last().press('Tab');
  expect((await orgMembers(page)).at(-1)).toEqual(['体験 次郎', '', '中1']);
  // 名前を直すと楽屋も
  await page.locator('#nbTable [data-k="name"]').last().fill('体験 二郎'); await page.locator('#nbTable [data-k="name"]').last().press('Tab');
  expect((await orgMembers(page)).at(-1)).toEqual(['体験 二郎', '', '中1']);
  // 消す
  await page.locator('#nbTable tr[data-id]').last().locator('[data-del]').click();
  await expect(page.locator('.gky-toast')).toContainText('楽屋の名簿からも消しました');
  expect((await orgMembers(page)).map(m => m[0])).not.toContain('体験 二郎');
  await page.click('#btnUndo');
  expect((await orgMembers(page)).map(m => m[0])).toContain('体験 二郎');
  // 楽屋から来た人は楽屋に残り、開き直しても新入部員にはもう出ない
  await page.locator('#nbTable tr[data-id]').nth(1).locator('[data-del]').click();
  await expect(page.locator('.gky-toast')).toContainText('楽屋の名簿には残っています');
  expect((await orgMembers(page)).map(m => m[0])).toContain('新入 太郎');
  await page.waitForTimeout(400);
  await page.reload(); await page.waitForFunction(() => window.__app && window.__app.ready);
  expect(await page.evaluate(() => __app.S.newbies.map(n => n.name))).toEqual(['新入 花子', '体験 二郎']);
  await noErrors(errors);
});

test('ほかのタブの楽屋で足した・直した・消した人が、開き直さなくても新入部員に出る', async ({ page }) => {
  await seed(page, ORG);
  const errors = await openApp(page);
  await page.evaluate(() => {
    const o = JSON.parse(localStorage.getItem('gakuya.org'));
    o.members.push({ id: 'n3', name: '新入 三子', part: '', grade: '中1', status: 'active' });
    o.members = o.members.filter(m => m.id !== 'n2');
    o.members.find(m => m.id === 'n1').part = 'Ob';
    const v = JSON.stringify(o); localStorage.setItem('gakuya.org', v);
    window.dispatchEvent(new StorageEvent('storage', { key: 'gakuya.org', newValue: v }));
  });
  expect(await page.evaluate(() => __app.S.newbies.map(n => [n.name, n.decided]))).toEqual([['新入 花子', 'Ob'], ['新入 三子', '']]);
  await expect(page.locator('#nbTable [data-k="name"]')).toHaveCount(2);
  await noErrors(errors);
});

test('前に「楽屋の部員に足す」で足した人（id なし・同じ名前）は、つなぎ直して二重にしない', async ({ page }) => {
  await seed(page, { org: { type: 'chu' }, members: [{ name: '前の 人', part: 'Tb', grade: '中1', status: 'active' }] },
    { 'gakkigime.v1': { v: 1, sample: false, quota: {}, plan: 'a', newbies: [{ id: 'x', name: '前の 人', w: ['Tb', '', ''], decided: 'Tb' }], fc: { src: 'org' } } });
  const errors = await openApp(page);
  const r = await page.evaluate(() => [__app.S.newbies.map(n => !!n.mid), JSON.parse(localStorage.getItem('gakuya.org')).members.length, JSON.parse(localStorage.getItem('gakuya.org')).members[0].id === __app.S.newbies[0].mid]);
  expect(r).toEqual([[true], 1, true]);
  await noErrors(errors);
});

test('部員用の端末では、楽屋の名簿を書きかえない', async ({ page }) => {
  await seed(page, Object.assign({}, ORG, { org: Object.assign({}, ORG.org, { role: 'member', member: { tools: ['gakkigime'] } }) }));
  const errors = await openApp(page);
  const before = await orgMembers(page);
  await page.evaluate(() => { __app.S.sample = false; __app.renderAll(); });
  await page.click('#nbAdd');
  await page.locator('#nbTable [data-k="name"]').last().fill('だれか'); await page.locator('#nbTable [data-k="name"]').last().press('Tab');
  expect(await orgMembers(page)).toEqual(before);
  await noErrors(errors);
});

test('編成計画：楽屋に入った新入部員を二重に数えない。1〜3月に足す人は学年なし・入団した年は来年度', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-02-10T10:00:00'));
  await seed(page, { org: { type: 'chu', year: 2026 }, members: [{ id: 'f2', name: '中野 二', part: 'Fl', grade: '中2', status: 'active' }] });
  const errors = await openApp(page);
  await page.evaluate(() => { __app.S.sample = false; __app.S.newbies = []; __app.S.quota = {}; __app.S.fc = Object.assign(__app.S.fc, { src: 'org', counts: {}, intake: {}, cohort: 'auto' }); __app.renderAll(); });
  await page.click('#nbAdd'); await page.locator('#nbTable [data-k="name"]').last().fill('新田 一'); await page.locator('#nbTable [data-k="name"]').last().press('Tab');
  await page.locator('#nbTable tr[data-id]').last().locator('[data-k="fixed"]').selectOption('Fl');
  const m = await page.evaluate(() => JSON.parse(localStorage.getItem('gakuya.org')).members.find(x => x.name === '新田 一'));
  expect([m.part, m.grade, m.joined]).toEqual(['Fl', '', 2027]);
  await page.evaluate(() => { __app.S.newbies[0].decided = 'Fl'; });
  const r = await page.evaluate(() => { const f = __app.forecast(__app.S).find(x => x.p === 'Fl'); return [f.now, f.t1]; });
  expect(r).toEqual([1, 2]);   // 今：中2の1人。来年：中3の1人＋来年度の中1の1人（二重に数えない）
  await noErrors(errors);
});
