// テスト用：同じ場所のステマネ（localStorage の stagemane.v1）に演奏会を入れる
const SM = [
  { id: 'cA', v: 1, updatedAt: 2, info: { org: '', title: '春の演奏会', date: '2027-03-20', venue: 'テスト会館', start: '14:00', concert: 'k1' }, program: [
    { id: 'a', type: 'mark', label: '開場', time: '13:30', hideScript: true }, { id: 'b', type: 'part', name: '第1部' },
    { id: 'c', type: 'anno', bell: '本ベル', time: '14:00', text: '…', rs: { light: '客電を落とす' } },
    { id: 'd', type: 'piece', title: 'ジュビラント序曲', composer: 'A.リード', dur: 420 }, { id: 'e', type: 'mc', who: '司会', where: '舞台下手', text: 'こんにちは' },
    { id: 'f', type: 'piece', title: '宝島', composer: '和泉宏隆', dur: 280 } ], timetable: { cols: [], rows: [] } },
  { id: 'sample-sunsun11', v: 1, updatedAt: 1, info: { title: '第11回 スプリングコンサート', date: '2026-03-31' }, program: [{ id: 'x', type: 'piece', title: 'サライ' }] },
];
const putSM = (page, list = SM) => page.evaluate(list => { localStorage.setItem('stagemane.v1', JSON.stringify({ order: list.map(c => c.id), current: list[0].id })); list.forEach(c => localStorage.setItem('stagemane.v1.c.' + c.id, JSON.stringify(c))); }, list);
module.exports = { SM, putSM };
