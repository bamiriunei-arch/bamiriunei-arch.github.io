// 保存データ・共有リンク・自分用リンク・自動バックアップ
const { test } = require('@playwright/test');
const { openApp, loadFixture, noErrors, expect } = require('./helpers');

test('保存データを書き出して読み直しても同じ（メモ・版・ルール込み）', async ({ page }) => {
  const errors = await openApp(page);
  await loadFixture(page);
  const r = await page.evaluate(async () => {
    const D = __db, S = D.S; D.pushHist();
    S.sets[2].pn = { [S.performers[0].id]:'ベルアップ' }; S.performers[1].note = '左きき'; D.applyPreset('jmba_hs'); S.rules.on.floor = false; S.rules.entry = 40; S.songs[0].url = 'audio/op.mp3'; D.changed(true);
    const code = await D.makeCode(S), sh = await D.readCode(code);
    const strip = x => JSON.stringify(D.packShow(x));
    return { same:strip(sh) === strip(S), id:sh.id === S.id, up:sh.updated === S.updated, note:sh.sets[1].note, pn:sh.sets[2].pn, pnote:sh.performers[1].note, rules:[sh.rules.preset, sh.rules.limit, sh.rules.entry, sh.rules.on.floor, sh.rules.on.time, sh.rules.grp.length], url:sh.songs[0].url, songId:sh.songs[0].id === S.songs[0].id };
  });
  expect(r.same).toBe(true);
  expect(r.id).toBe(true);
  expect(r.up).toBe(true);
  expect(r.note).toBe('ここで楽器を構える');
  expect(r.pnote).toBe('左きき');
  expect(r.rules).toEqual(['jmba_hs', 570, 40, false, true, 3]);
  expect(r.url).toBe('audio/op.mp3');
  expect(r.songId).toBe(true);
  await noErrors(errors);
});

test('ブラウザに自動保存され、開き直しても残る', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => { __db.pushHist(); __db.S.title = '自動保存のテスト'; __db.changed(true); });
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => window.__db && window.__db.S);
  expect(await page.evaluate(() => __db.S.title)).toBe('自動保存のテスト');
});

async function setupLocal(page) {
  await openApp(page);
  await loadFixture(page);
  await page.evaluate(async () => { const D = __db; D.pushHist(); D.S.title = '共有テスト'; D.changed(true); await D.libSave(false); });
  return page.evaluate(async () => {
    const D = __db, base = JSON.parse(JSON.stringify(D.S));
    const make = async f => { const sh = JSON.parse(JSON.stringify(base)); f(sh); return D.makeCode(D.normalize(sh)); };
    return {
      same:await make(() => {}),
      newer:await make(sh => { sh.updated += 3600e3; sh.sets[2].counts = 12; }),
      older:await make(sh => { sh.updated -= 86400e3; sh.sets[1].name = '古い名前'; }),
    };
  });
}

test('共有リンク：同じ版なら何も聞かずに開く・自分用（&me=）でその人のドットシート', async ({ page }) => {
  const codes = await setupLocal(page);
  await page.goto('/index.html?test#d=' + codes.same + '&me=Tp1');
  await expect(page.locator('#toast')).toContainText('同じ版');
  await expect(page.locator('#askModal')).toBeHidden();
  const r = await page.evaluate(() => ({ tab:__db.ui.tab, me:__db.ui.me, mode:__db.ui.mode }));
  expect(r).toEqual({ tab:'dot', me:'Tp1', mode:'view' });
});

test('共有リンク：新しい版は知らせて、変わったセットに印を付ける', async ({ page }) => {
  const codes = await setupLocal(page);
  await page.goto('/index.html?test#d=' + codes.newer);
  await expect(page.locator('#askTitle')).toHaveText('新しい版が届きました');
  await expect(page.locator('#askBody')).toContainText('変わったセット');
  await page.click('[data-askv="open"]');
  await expect(page.locator('#askModal')).toBeHidden();
  const r = await page.evaluate(() => ({ changed:[...(__db.ui.changedSets || [])], lib:__db.libLoad().length }));
  expect(r.changed).toEqual([2]);
  expect(r.lib).toBe(1);   // ショー一覧の同じショーを置きかえる
  // 置きかえる前の版は自動バックアップに残る
  await expect.poll(() => page.evaluate(() => __db.snapLoad().some(x => x.why === 'replace'))).toBe(true);
});

test('共有リンク：古い版は知らせて、手元の版を守る', async ({ page }) => {
  const codes = await setupLocal(page);
  await page.goto('/index.html?test#d=' + codes.older);
  await expect(page.locator('#askTitle')).toHaveText('古い版のリンクです');
  await page.click('[data-askv="cancel"]');
  expect(await page.evaluate(() => __db.S.sets[1].name)).not.toBe('古い名前');
});

test('自分用リンク：その人だけのデータでも開ける（別の端末）', async ({ page, browser }) => {
  await openApp(page);
  await loadFixture(page);
  const url = await page.evaluate(async () => { const p = __db.S.performers.find(x => x.label === 'Tb1'); return (await __db.personalURL(p)).part; });
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await p2.goto(url.replace('/index.html#', '/index.html?test#'));
  await p2.waitForFunction(() => window.__db && window.__db.S && window.__db.S.part);
  const r = await p2.evaluate(() => ({ part:__db.S.part, n:__db.S.performers.length, tab:__db.ui.tab }));
  expect(r).toEqual({ part:'Tb1', n:1, tab:'dot' });
  await ctx.close();
});

test('自動バックアップ：その日の最初の状態に戻せる', async ({ page }) => {
  await openApp(page);
  await loadFixture(page);
  await page.evaluate(() => { __db.pushHist(); __db.S.title = 'バックアップ前'; __db.changed(true); });
  await expect.poll(() => page.evaluate(() => __db.snapLoad().length)).toBeGreaterThan(0);
  await page.evaluate(() => { __db.pushHist(); __db.S.title = '直しすぎた'; __db.changed(true); });
  await page.click('#bLib');
  await page.click('[data-act="snapOpen"]');
  expect(await page.evaluate(() => __db.S.title)).toBe('テスト用ショー');
});
