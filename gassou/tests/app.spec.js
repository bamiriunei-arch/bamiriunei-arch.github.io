// 合奏ノートの基本の動き
const { test } = require('@playwright/test');
const { openApp, noErrors, expect } = require('./helpers');

// 1秒・440Hz の小さな WAV（録音を開くテスト用）
function wav(sec = 1.5, sr = 8000) {
  const n = Math.floor(sec * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / sr * 2 * Math.PI * 440) * 12000), 44 + i * 2);
  return b;
}

test('例：合成した音・小節の目印・コメントが出る', async ({ page }) => {
  const errors = await openApp(page);
  await page.waitForFunction(() => __app.buf);
  await page.click('[data-tab="rec"]');
  const r = await page.evaluate(() => ({ d: __app.buf.duration, marks: __app.N().bars.marks.length, b1: __app.barAt(__app.N(), 0.6), b3: __app.barAt(__app.N(), 4.6), none: __app.barAt(__app.N(), 0.1) }));
  expect(r.d).toBeGreaterThan(48);
  expect(r.marks).toBe(24);
  expect(r).toMatchObject({ b1: 1, b3: 3, none: null });
  await expect(page.locator('#cList .cm')).toHaveCount(5);
  await noErrors(errors);
});

test('いまの所にコメントを足す（少し前の時刻・小節つき）', async ({ page }) => {
  const errors = await openApp(page);
  await page.waitForFunction(() => __app.buf);
  await page.click('[data-tab="rec"]');
  await page.evaluate(() => __app.seek(21));
  await page.locator('#cParts [data-p="Tp"]').click();
  await page.locator('#cText').fill('テストのコメント');
  await page.locator('#cText').press('Enter');
  const c = await page.evaluate(() => __app.N().comments.find(x => x.text === 'テストのコメント'));
  expect(c.t).toBeCloseTo(20, 1);
  expect(c.parts).toEqual(['Tp']);
  await expect(page.locator('#cList')).toContainText('テストのコメント');
  await noErrors(errors);
});

test('テンポから目印をつける・テンポマップ（カットあり）から目印をつける', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="bars"]');
  await page.locator('#tpAt').fill('1');
  await page.locator('#tpBpm').fill('60');
  await page.locator('#tpBeats').fill('3');
  await page.locator('#tpBars').fill('4');
  await page.click('#tpGo');
  let m = await page.evaluate(() => __app.N().bars.marks);
  expect(m).toEqual([1, 4, 7, 10]);
  // テンポマップ：A 2小節 4/4 ♩=120（2秒ずつ）、B 2小節 6/8 ♩.=60（2秒ずつ、切る）、C 1小節 4/4 ♩=60（4秒）
  const r = await page.evaluate(() => __app.barsFromMap({ start: 1, sections: [{ id: 'a', bars: 2, meter: '4/4', unit: '4', bpm: 120 }, { id: 'b', bars: 2, meter: '6/8', unit: '4.', bpm: 60 }, { id: 'c', bars: 1, meter: '4/4', unit: '4', bpm: 60, extra: 0 }], plans: [{ id: 'p', cut: ['b'] }] }, 'p', 0.5));
  expect(r.marks).toEqual([0.5, 2.5, 4.5]);
  expect(r.start).toBe(1);
  // 共有コード（圧縮なし TMJ）も読める
  const code = await page.evaluate(() => { const o = { v: 1, t: 'テスト曲', st: 1, s: [['A', 2, '4/4', '4', 120, null, 0, '', '']], p: [['なし', []]], pi: 0 }; const b = new TextEncoder().encode(JSON.stringify(o)); return 'TMJ' + btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); });
  await page.locator('#tmCode').fill(code);
  await page.locator('#tmCode').press('Tab');
  await page.locator('#tmAt').fill('0');
  await page.click('#tmGo');
  m = await page.evaluate(() => __app.N().bars.marks);
  expect(m).toEqual([0, 2]);
  await noErrors(errors);
});

test('録音のファイルを開ける', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="rec"]');
  const chooser = page.waitForEvent('filechooser');
  await page.click('#pickFile');
  await (await chooser).setFiles({ name: 'rec.wav', mimeType: 'audio/wav', buffer: wav() });
  await page.waitForFunction(() => __app.buf && __app.buf.duration < 2);
  const f = await page.evaluate(() => __app.N().file);
  expect(f.name).toBe('rec.wav');
  await expect(page.locator('#curPos')).toContainText('0:02');
  await noErrors(errors);
});

test('パートごとの印刷', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('[data-tab="out"]');
  await page.click('#prPart');
  await expect(page.locator('.gky-pv .gky-page').first()).toContainText('テューバ');
  await noErrors(errors);
});

test('開くとノートが最初に出る。書いたことは自動で保存され、開き直しても残る', async ({ page }) => {
  const errors = await openApp(page);
  await expect(page.locator('[data-panel="note"]')).toBeVisible();
  await expect(page.locator('#deck')).toBeHidden();
  await expect(page.locator('#memo')).toHaveValue(/【やったこと】/);
  // 新しい合奏（名前を空ける → 日付から名前）
  await page.click('#pNew');
  await page.locator('.gky-sheet #nD').fill('2026-10-04');
  await page.locator('.gky-sheet button.primary').click();
  await expect(page.locator('#pTitle')).toHaveValue('10/4（日）の合奏');
  await expect(page.locator('#memo')).toHaveValue('');
  await expect(page.locator('#memo')).toBeFocused();
  await page.locator('#memo').pressSequentially('宝島のサビ、音量のバランス');
  await expect(page.locator('#memoSaved')).toContainText('保存しました');
  await expect(page.locator('#memoCount')).toHaveText('13字');
  // 名前をノートの上で直す → 右上の選ぶ欄にも出る
  await page.locator('#pTitle').fill('10/4 合奏 宝島');
  await page.locator('#pTitle').press('Tab');
  await expect(page.locator('#nSel option:checked')).toHaveText('10/4 合奏 宝島');
  await page.reload();
  await page.waitForFunction(() => window.__app && __app.ready);
  await expect(page.locator('#memo')).toHaveValue('宝島のサビ、音量のバランス');
  await expect(page.locator('#pTitle')).toHaveValue('10/4 合奏 宝島');
  // 例の合奏に切りかえると、例のノートにもどる
  const sampleId = await page.evaluate(() => __app.S.order.find(id => __app.S.notes[id].sample));
  await page.locator('#nSel').selectOption(sampleId);
  await expect(page.locator('#memo')).toHaveValue(/ピッコロのトリオ/);
  await noErrors(errors);
});

test('ノート：見出しのボタン・「・」と番号の続き・空の行で終わる・元に戻す', async ({ page }) => {
  const errors = await openApp(page);
  await page.click('#pNew');
  await page.locator('.gky-sheet button.primary').click();
  const memo = page.locator('#memo');
  await memo.pressSequentially('きょう');
  await page.click('#memoTools [data-h="直すこと"]');      // 行の途中 → 改行してから見出し
  await memo.pressSequentially('・入りをそろえる');
  await memo.press('Enter');                               // 次の行にも「・」
  await memo.pressSequentially('音程');
  await memo.press('Enter');
  await memo.press('Enter');                               // 中身のない「・」で改行 → しるしを消す
  await memo.pressSequentially('1. 頭から');
  await memo.press('Enter');                               // 番号は1つ進む
  await memo.pressSequentially('トリオ');
  await memo.press('Enter');
  await memo.press('Enter');
  await memo.pressSequentially('①全員');
  await memo.press('Enter');
  await expect(memo).toHaveValue(/①全員\n②$/);
  await memo.press('Control+z');                           // 自動で入れた「②」も、元に戻せる
  await expect(memo).toHaveValue(/①全員$/);
  await memo.press('Enter');
  await memo.pressSequentially('低音');
  await expect(memo).toHaveValue('きょう\n【直すこと】\n・入りをそろえる\n・音程\n1. 頭から\n2. トリオ\n①全員\n②低音');
  const saved = await page.evaluate(() => new Promise(r => setTimeout(() => r(__app.N().memo), 700)));
  expect(saved).toBe('きょう\n【直すこと】\n・入りをそろえる\n・音程\n1. 頭から\n2. トリオ\n①全員\n②低音');
  await noErrors(errors);
});

test('ノート：録音を聞きながら、いまの所（小節と時刻）を書き込む', async ({ page }) => {
  const errors = await openApp(page);
  await page.waitForFunction(() => __app.buf);
  await expect(page.locator('#nRec')).toBeVisible();
  await page.locator('#memo').click();
  await page.locator('#memo').press('Control+End');
  await page.locator('#memo').press('Enter');
  await page.evaluate(() => __app.seek(21));
  await expect(page.locator('#nPos')).toContainText('11小節');
  await page.click('#nIns');
  await expect(page.locator('#memo')).toHaveValue(/\n［11小節 0:21］$/);
  // 録音のない新しい合奏では出ない
  await page.click('#pNew');
  await page.locator('.gky-sheet button.primary').click();
  await expect(page.locator('#nRec')).toBeHidden();
  await noErrors(errors);
});

test('ノートのコピーの文・印刷（長いノートはページに分かれ、はみ出さない）', async ({ page }) => {
  const errors = await openApp(page);
  const t = await page.evaluate(() => __app.noteText({ title: '10/4 合奏', date: '2026-10-04', memo: '【やったこと】\n・宝島\n\n' }));
  expect(t).toBe('10/4 合奏　2026年10月4日（日）\n\n【やったこと】\n・宝島');
  const blocks = await page.evaluate(() => __app.memoBlocks('【A】\n1\n2\n\n\n3\n' + Array.from({ length: 40 }, (_, i) => 'L' + i).join('\n')));
  expect(blocks.length).toBe(4);                 // 【A】1 2 ／ 3 L0〜L16 ／ L17〜L34 ／ L35〜L39
  expect(blocks[0]).toContain('<b>【A】</b>');
  // 長いノートを印刷
  await page.evaluate(() => { __app.N().memo = Array.from({ length: 30 }, (_, k) => `【${k + 1}回目】\n` + Array.from({ length: 6 }, (_, i) => '・ここに書いたこと ' + (i + 1)).join('\n')).join('\n\n'); });
  await page.click('[data-tab="out"]');
  await page.click('#prNote');
  const pages = page.locator('.gky-pv .gky-page');
  await expect(pages.first()).toContainText('【1回目】');
  expect(await pages.count()).toBeGreaterThan(1);
  const over = await page.evaluate(() => [...document.querySelectorAll('.gky-pv .pg-body')].some(b => { const r = b.getBoundingClientRect(), l = b.lastElementChild && b.lastElementChild.getBoundingClientRect(); return l && l.bottom > r.bottom + 1; }));
  expect(over).toBe(false);
  await expect(pages.last()).toContainText('【30回目】');
  await noErrors(errors);
});

test('ファイルに保存した合奏にノートが入り、読み込める', async ({ page }) => {
  const errors = await openApp(page);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-tab="out"]').then(() => page.click('#jsonOut'))]);
  const json = JSON.parse(await (await dl.createReadStream()).toArray().then(a => Buffer.concat(a).toString('utf8')));
  expect(json.note.memo).toContain('【やったこと】');
  json.note.memo = '読み込んだノート';
  const chooser = page.waitForEvent('filechooser');
  await page.click('#jsonIn');
  await (await chooser).setFiles({ name: 'g.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(json)) });
  await page.click('[data-tab="note"]');
  await expect(page.locator('#memo')).toHaveValue('読み込んだノート');
  await noErrors(errors);
});
