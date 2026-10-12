// Тесты движка: node tests/engine.test.js  (полный перебор всех 5-карточных рук: node tests/engine.test.js --full)
const assert = require('assert');
require('../js/engine/cards.js'); require('../js/engine/evaluator.js'); require('../js/engine/hand.js');
const E = globalThis.RTEngine, ev = E.evaluator.evaluate, H = E.hand;

const R = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const card = (t) => ({ r: R[t[0]], s: t[1] });
const cs = (str) => str.split(' ').map(card);
const score = (str) => ev(cs(str)).score;
const name = (str) => ev(cs(str)).name;

// ---------- оценка рук ----------
assert.strictEqual(name('As Ks Qs Js Ts'), 'Роял-флеш');
assert.strictEqual(name('9h 8h 7h 6h 5h'), 'Стрит-флеш');
assert.strictEqual(name('9h 9s 9d 9c 5h'), 'Каре');
assert.strictEqual(name('9h 9s 9d 5c 5h'), 'Фулл-хаус');
assert.strictEqual(name('Ah 9h 7h 6h 2h'), 'Флеш');
assert.strictEqual(name('9h 8s 7d 6c 5h'), 'Стрит');
assert.strictEqual(name('9h 9s 9d 6c 5h'), 'Сет');
assert.strictEqual(name('9h 9s 6d 6c 5h'), 'Две пары');
assert.strictEqual(name('9h 9s 7d 6c 5h'), 'Пара');
assert.strictEqual(name('Ah Ks 7d 6c 5h'), 'Старшая карта');
// колесо: A-2-3-4-5 — младший стрит, слабее стрита до шести; стрит-флеш-колесо — не роял
assert.strictEqual(name('Ah 2s 3d 4c 5h'), 'Стрит');
assert(score('6h 2s 3d 4c 5h') > score('Ah 2s 3d 4c 5h'));
assert(score('Ah 2s 3d 4c 5s') < score('2h 3s 4d 5c 6h'));
assert.strictEqual(name('Ah 2h 3h 4h 5h'), 'Стрит-флеш');
assert(score('Ah 2h 3h 4h 5h') < score('6h 2h 3h 4h 5h'));
// нет «стрита через угол»: Q-K-A-2-3
assert.strictEqual(name('Qh Ks Ad 2c 3h'), 'Старшая карта');
// порядок категорий
['Ah Ks 7d 6c 5h', '2h 2s 7d 6c 5h', '2h 2s 7d 7c 5h', '2h 2s 2d 6c 5h', '9h 8s 7d 6c 5h', 'Ah 9h 7h 6h 2h', '9h 9s 9d 5c 5h', '9h 9s 9d 9c 5h', '9h 8h 7h 6h 5h']
  .reduce((prev, h) => { const s = score(h); assert(s > prev, h); return s; }, -1);
// кикеры
assert(score('Ah Ad Ks 7c 3h') > score('Ah Ad Qs 7c 3h'));
assert(score('Ah Ad Ks 7c 3h') > score('Ah Ad Ks 6c 3h'));
assert(score('Kh Kd Ah 2c 3d') < score('Ah Ad 2s 7c 3h'));
assert(score('Ah Ad Ks Kc 3h') > score('Ah Ad Qs Qc Kh'));
assert(score('Ah Ad Ks Kc 3h') > score('Ah Ad Ks Kc 2h'));
assert.strictEqual(score('Ah Kd Qs Jc 9h'), score('As Kc Qh Jd 9s')); // масти не влияют
assert(score('2h 2s 2d Ac Ah') < score('3h 3s 3d 4c 4h')); // сет решает раньше пары
assert(score('Th Jh Qh Kh 2h') > score('Th Jh Qh 2h 3h'));
// 7 карт: берётся лучшая пятёрка
assert.strictEqual(ev(cs('As Ks 2s 7c 9h Qs Js')).name, 'Флеш');
assert.strictEqual(ev(cs('As Ks Qs Js Ts 2d 2c')).name, 'Роял-флеш');
assert.strictEqual(ev(cs('9h 9s 9d 5c 5h 5s 2d')).name, 'Фулл-хаус'); // два сета: лучший фулл — 999 55
assert.strictEqual(ev(cs('9h 9s 9d 5c 5h 5s 2d')).score, score('9h 9s 9d 5c 5h'));
assert.strictEqual(ev(cs('Ah 2s 3d 4c 5h 9s 9d')).name, 'Стрит');
assert.strictEqual(ev(cs('6h 6s 6d 6c 5h 5s 5d')).name, 'Каре');
assert.strictEqual(ev(cs('7h 7s 4d 4c 2h 2s Ad')).score, score('7h 7s 4d 4c Ad')); // три пары: старшие две + лучший кикер
assert.strictEqual(ev(cs('Ah Ks 7d 6c 5h 3s 2d')).name, 'Старшая карта');
assert.throws(() => ev(cs('Ah Ks 7d 6c')));

// распределение всех 2 598 960 пятикарточных рук (классические числа)
if (process.argv.includes('--full')) {
  const deck = E.cards.newDeck(), cnt = [0, 0, 0, 0, 0, 0, 0, 0, 0], n = deck.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) for (let e = d + 1; e < n; e++) cnt[ev([deck[a], deck[b], deck[c], deck[d], deck[e]]).cat]++;
  assert.deepStrictEqual(cnt, [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
}

// ---------- колода ----------
const d = E.cards.newDeck();
assert.strictEqual(d.length, 52);
assert.strictEqual(new Set(d.map((c) => c.r + c.s)).size, 52);
const sh = E.cards.shuffle(d);
assert.strictEqual(new Set(sh.map((c) => c.r + c.s)).size, 52);
assert.strictEqual(d[0].r, 2); // исходная колода не изменяется
for (const n of [2, 3, 7, 52]) for (let i = 0; i < 200; i++) { const v = E.cards.secureInt(n); assert(Number.isInteger(v) && v >= 0 && v < n); }
{ // равномерность: каждая карта оказывается на первой позиции примерно с вероятностью 1/52
  const hits = {}; for (let i = 0; i < 52000; i++) { const k = E.cards.shuffle(d)[0]; hits[k.r + k.s] = (hits[k.r + k.s] || 0) + 1; }
  Object.values(hits).forEach((v) => assert(v > 700 && v < 1300, 'неравномерная тасовка ' + v));
  assert.strictEqual(Object.keys(hits).length, 52);
}
// детерминированный randInt даёт ожидаемую перестановку (Fisher–Yates идёт с конца)
assert.deepStrictEqual(E.cards.shuffle([1, 2, 3, 4], () => 0), [2, 3, 4, 1]);

// ---------- раздача ----------
// колода по порядку раздачи: игроки в порядке от малого блайнда, потом сжигание и улицы
function stacked(holesFromSb, board) {
  const dk = [];
  for (let r = 0; r < 2; r++) holesFromSb.forEach((h) => dk.push(card(h.split(' ')[r])));
  const b = cs(board), burn = cs('2c');
  return dk.concat(burn, b.slice(0, 3), burn, [b[3]], burn, [b[4]]);
}
const mk = (stacks, button, deck, blinds) => H.createHand({ id: 'h', players: stacks.map((s, i) => ({ id: 'p' + i, name: 'P' + i, stack: s })), button, blinds: blinds || [25, 50], deck });
const total = (st) => st.players.reduce((s, p) => s + p.stack, 0);
const A = (st, type, amount) => H.act(st, { type, amount });
const idOf = (st) => st.players[st.toAct].id;

{ // позиции в игре вдвоём: дилер — малый блайнд и ходит первым до флопа; после флопа первым ходит большой блайнд
  const st = mk([1000, 1000], 0, stacked(['2d 7h', 'Ad Ah'], '9d 5c 3h Jd 4s'));
  assert.strictEqual(st.sbIdx, 0); assert.strictEqual(st.bbIdx, 1);
  assert.strictEqual(st.players[0].bet, 25); assert.strictEqual(st.players[1].bet, 50);
  assert.strictEqual(idOf(st), 'p0');
  A(st, 'call'); assert.strictEqual(idOf(st), 'p1'); // у BB есть опция
  A(st, 'check'); assert.strictEqual(st.street, 'flop'); assert.strictEqual(st.board.length, 3);
  assert.strictEqual(idOf(st), 'p1');
  A(st, 'check'); A(st, 'check'); assert.strictEqual(st.street, 'turn'); A(st, 'check'); A(st, 'check'); assert.strictEqual(st.street, 'river'); A(st, 'check'); A(st, 'check');
  assert(st.over); assert.strictEqual(st.board.length, 5);
  assert.strictEqual(st.result.payouts.p1, 100); assert.strictEqual(st.players[1].stack, 1050); assert.strictEqual(st.players[0].stack, 950);
}
{ // позиции за столом из трёх: SB слева от дилера, первым ходит дилер
  const st = mk([1000, 1000, 1000], 1, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  assert.strictEqual(st.sbIdx, 2); assert.strictEqual(st.bbIdx, 0); assert.strictEqual(idOf(st), 'p1');
}
{ // фолд: банк уходит последнему, лишняя часть ставки не теряется
  const st = mk([1000, 1000, 1000], 0, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  A(st, 'raise', 200); A(st, 'fold'); A(st, 'fold');
  assert(st.over); assert.strictEqual(st.result.showdown, false);
  assert.strictEqual(st.players[0].stack, 1075); assert.strictEqual(total(st), 3000);
  assert.deepStrictEqual(st.result.winners, ['p0']);
}
{ // check при ставке запрещён; call при нулевом долге запрещён; рейз ниже минимума и выше стека запрещён
  const st = mk([1000, 1000, 1000], 0, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  assert.throws(() => A(st, 'check'));
  assert.throws(() => A(st, 'raise', 99));
  assert.throws(() => A(st, 'raise', 50));
  assert.throws(() => A(st, 'raise', 1001));
  assert.throws(() => A(st, 'raise', 100.5));
  assert.throws(() => A(st, 'bogus'));
  A(st, 'raise', 100);
  assert.strictEqual(H.legalActions(st).minRaiseTo, 150); // следующий рейз — не меньше прежнего шага (50)
  assert.throws(() => A(st, 'raise', 149)); A(st, 'raise', 150);
  A(st, 'raise', 350); // шаг 200
  assert.strictEqual(H.legalActions(st).minRaiseTo, 550);
  A(st, 'fold'); A(st, 'fold');
  assert.throws(() => A(st, 'fold')); // после конца раздачи действия невозможны
}
{ // all-in нескольких игроков: основной и побочный банк
  const st = mk([100, 300, 500], 0, stacked(['Ks Kh', '2c 7d', 'As Ah'], '9d 5c 3h Jd 4s')); // sb=p1(KK) bb=p2(27)... p0=AA
  // порядок от SB: p1, p2, p0 → p1 получает 'Ks Kh', p2 — '2c 7d', p0 — 'As Ah'
  A(st, 'allin'); A(st, 'allin'); A(st, 'call');
  assert(st.over); assert(st.runout); assert.strictEqual(st.board.length, 5);
  const r = st.result;
  assert.strictEqual(r.pots.length, 2);
  assert.deepStrictEqual([r.pots[0].amount, r.pots[1].amount], [300, 400]);
  assert.deepStrictEqual(r.pots[0].eligible, ['p0', 'p1', 'p2']); assert.deepStrictEqual(r.pots[1].eligible, ['p1', 'p2']);
  assert.strictEqual(r.payouts.p0, 300); assert.strictEqual(r.payouts.p1, 400); assert.strictEqual(r.payouts.p2, 0); assert.strictEqual(st.players[2].stack, 200);
  assert.strictEqual(total(st), 900);
}
{ // три разных all-in: три банка, у каждого свой победитель
  const st = mk([100, 300, 500, 500], 3, stacked(['2c 7d', '4c 8h', 'As Ah', 'Ks Kh'], '9d 5c 3h Jd Td'));
  // btn=p3, sb=p0(27), bb=p1(48), utg=p2(AA)
  A(st, 'allin'); A(st, 'allin'); A(st, 'allin'); A(st, 'allin');
  const r = st.result;
  assert.strictEqual(total(st), 1400);
  assert.strictEqual(r.pots.reduce((s, p) => s + p.amount, 0) + Object.values(r.refunds).reduce((s, v) => s + v, 0), 1400);
  assert.strictEqual(r.payouts.p2, 100 * 4 + 200 * 3 + 200 * 2); // AA: все три слоя
  assert.strictEqual(r.payouts.p3, 0); assert.strictEqual(r.payouts.p0 + r.payouts.p1, 0);
}
{ // неоплаченная часть ставки возвращается
  const st = mk([1000, 200], 0, stacked(['2d 7h', 'Ad Ah'], '9d 5c 3h Jd 4s'));
  A(st, 'raise', 500); A(st, 'call');
  assert(st.over); assert.strictEqual(st.result.refunds.p0, 300);
  assert.strictEqual(st.result.pots.length, 1); assert.strictEqual(st.result.pots[0].amount, 400);
  assert.strictEqual(st.players[1].stack, 400); assert.strictEqual(st.players[0].stack, 800); assert.strictEqual(total(st), 1200);
}
{ // ставка без ответа (все сбросили) возвращается как есть
  const st = mk([1000, 1000], 0, stacked(['2d 7h', 'Ad Ah'], '9d 5c 3h Jd 4s'));
  A(st, 'call'); A(st, 'check'); A(st, 'check'); A(st, 'raise', 300); A(st, 'fold');
  assert.strictEqual(st.players[0].stack, 1050); assert.strictEqual(st.players[1].stack, 950); // p0 поставил на флопе вторым, p1 сбросил
}
{ // ничья: остаток от деления достаётся первому победителю слева от дилера
  const st = mk([1000, 1000, 1000], 0, stacked(['2d 3h', '4c 5d', '6c 7d'], 'As Ks Qs Js Ts'));
  // btn=p0, sb=p1, bb=p2; p1(24) и p2... нужен фолд малого блайнда: p0 call, p1 fold, p2 check
  A(st, 'call'); A(st, 'fold'); A(st, 'check');
  while (!st.over) { A(st, 'check'); }
  // p0 и p2 играют бордом (роял), p1 сбросил: банк 50+25+50=125
  assert.strictEqual(st.result.pots[0].amount, 125);
  assert.deepStrictEqual(st.result.pots[0].winners, ['p2', 'p0']);
  assert.strictEqual(st.result.payouts.p2, 63); assert.strictEqual(st.result.payouts.p0, 62);
  assert.strictEqual(total(st), 3000);
}
{ // неполный all-in-рейз не открывает торговлю заново тем, кто уже ходил
  const st = mk([1000, 1000, 200], 0, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  A(st, 'call'); A(st, 'call'); A(st, 'check'); assert.strictEqual(st.street, 'flop'); // банк по 50, у p2 осталось 150
  assert.strictEqual(idOf(st), 'p1'); A(st, 'raise', 100); // шаг 100
  assert.strictEqual(idOf(st), 'p2'); A(st, 'allin'); // 150 → шаг 50 < 100: неполный рейз
  assert.strictEqual(st.currentBet, 150); assert.strictEqual(st.lastRaise, 100);
  assert.strictEqual(idOf(st), 'p0');
  assert.strictEqual(H.legalActions(st).minRaiseTo, 250); // кто ещё не ходил — может рейзить, минимум 150+100
  A(st, 'call'); // p0 уравнял 150
  assert.strictEqual(idOf(st), 'p1');
  const lg = H.legalActions(st); assert.strictEqual(lg.canRaise, false); assert.strictEqual(lg.callAmount, 50);
  assert.throws(() => A(st, 'raise', 400)); assert.throws(() => A(st, 'allin')); // ни рейз, ни all-in-рейз
  A(st, 'call'); assert.strictEqual(st.street, 'turn'); assert.strictEqual(total(st) + H.totalPot(st), 2200);
}
{ // полный рейз открывает торговлю заново
  const st = mk([1000, 1000, 1000], 0, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  A(st, 'raise', 150); A(st, 'call'); A(st, 'raise', 400); // у BB возможен рейз
  assert.strictEqual(idOf(st), 'p0'); assert.strictEqual(H.legalActions(st).canRaise, true);
  A(st, 'raise', 900); assert.strictEqual(idOf(st), 'p1'); assert(H.legalActions(st).canRaise);
}
{ // короткий стек платит блайнд не полностью, игрок со стеком 0 не участвует
  const st = mk([1000, 20, 0, 1000], 0, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  assert.strictEqual(st.players[2].status, 'out'); assert.strictEqual(st.players[2].cards.length, 0);
  assert.strictEqual(st.sbIdx, 1); assert.strictEqual(st.players[1].status, 'allin'); assert.strictEqual(st.players[1].bet, 20);
}
{ // публичный вид не содержит чужих закрытых карт до вскрытия
  const st = mk([1000, 1000, 1000], 0, stacked(['2d 7h', '3d 8h', 'Ad Ah'], '9d 5c 3s Jd 4s'));
  const v = H.publicView(st, 'p0');
  v.players.forEach((p) => assert.strictEqual(p.cards !== null, p.id === 'p0'));
  assert(!JSON.stringify(v).includes('"deck"'));
  A(st, 'raise', 100); A(st, 'fold'); A(st, 'fold');
  H.publicView(st, 'p0').players.forEach((p) => assert.strictEqual(p.cards !== null, p.id === 'p0')); // без вскрытия карты не видны
}
{ // nextButton пропускает игроков без стека
  const pl = [{ stack: 10 }, { stack: 0 }, { stack: 5 }];
  assert.strictEqual(H.nextButton(pl, 0), 2); assert.strictEqual(H.nextButton(pl, 2), 0);
}

// ---------- случайные партии: инварианты ----------
{
  let hands = 0, showdowns = 0, runouts = 0, sideCases = 0;
  const rnd = (n) => E.cards.secureInt(n);
  for (let g = 0; g < 4000; g++) {
    const n = 2 + rnd(5), stacks = []; for (let i = 0; i < n; i++) stacks.push(rnd(6) === 0 ? 1 + rnd(120) : 100 + rnd(3000));
    const sum = stacks.reduce((a, b) => a + b, 0);
    const st = mk(stacks, rnd(n), null, [25, 50]);
    let guard = 0;
    while (!st.over) {
      assert(++guard < 300, 'раздача зациклилась');
      const l = H.legalActions(st), r = rnd(10);
      if (r < 2) A(st, 'fold');
      else if (r < 3 && l.canRaise) A(st, 'allin');
      else if (r < 5 && l.canRaise) A(st, 'raise', l.minRaiseTo + rnd(l.maxRaiseTo - l.minRaiseTo + 1));
      else if (l.canCheck) A(st, 'check'); else A(st, 'call');
      st.players.forEach((p) => { assert(p.stack >= 0 && Number.isInteger(p.stack)); assert(p.total >= p.bet); });
    }
    assert.strictEqual(total(st), sum, 'фишки потерялись или появились');
    const r = st.result, pays = Object.values(r.payouts).reduce((a, b) => a + b, 0);
    assert.strictEqual(pays, st.players.reduce((s, p) => s + p.total, 0));
    r.pots.forEach((p) => { assert(p.winners.length >= 1); assert(p.amount > 0); });
    if (r.showdown) { showdowns++; assert.strictEqual(st.board.length, 5); r.pots.forEach((p) => p.winners.forEach((w) => assert(p.eligible.includes(w)))); }
    if (st.runout) runouts++; if (r.pots.length > 1) sideCases++;
    const net = Object.values(r.net).reduce((a, b) => a + b, 0); assert.strictEqual(net, 0);
    hands++;
  }
  assert(showdowns > 300 && runouts > 100 && sideCases > 50, 'фаззинг должен покрывать вскрытия, all-in и побочные банки: ' + [showdowns, runouts, sideCases]);
}
console.log('engine tests ok');
