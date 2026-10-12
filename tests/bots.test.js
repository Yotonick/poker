// Тесты ботов: node tests/bots.test.js
const assert = require('assert');
require('../js/engine/cards.js'); require('../js/engine/evaluator.js'); require('../js/engine/hand.js'); require('../js/bots.js');
const E = globalThis.RTEngine, H = E.hand, B = E.bots;
const card = (t) => ({ r: { T: 10, J: 11, Q: 12, K: 13, A: 14 }[t[0]] || +t[0], s: t[1] });

// сила рук: порядок разумный
const pf = (a, b) => B.preflopStrength([card(a), card(b)]);
assert(pf('As', 'Ah') > pf('Ks', 'Kh') && pf('Ks', 'Kh') > pf('As', 'Ks') && pf('As', 'Ks') > pf('Qs', 'Jd') && pf('Qs', 'Jd') > pf('7s', '2d'));
const po = (h, b) => B.postflopStrength(h.split(' ').map(card), b.split(' ').map(card));
assert(po('As Ah', '2d 7c 9h') > po('As Kh', '2d 7c 9h'));
assert(po('9s 9h', '9d 7c 2h') > po('As Kh', 'Ad 7c 2h') && po('As Kh', 'Ad 7c 2h') > po('Qs Jh', 'Ad 7c 2h'));
assert(po('As Ks', '2s 7s 9h') > po('As Kh', '2s 7c 9h')); // флеш-дро сильнее воздуха
assert(po('Jh Th', '9s 8c 2d') > po('Jh Th', 'As 8c 2d')); // открытый стрит-дро
assert(po('Ah Kh', '2s 2c 9d 9h Ks') > po('Ah Kh', '2s 2c 9d 9h 4s'));

// матч ботов за столом: каждое решение допустимо, чужих карт бот не видит, фишки сохраняются
const profs = [B.PROFILES.easy, B.PROFILES.normal, B.PROFILES.normal, B.PROFILES.hard, B.PROFILES.hard];
const seats = profs.map((p, i) => ({ id: 'b' + i, name: 'B' + i, stack: 10000, prof: p }));
const start = seats.reduce((s, p) => s + p.stack, 0);
let button = 0, hands = 0, folds = 0, decisions = 0, showdowns = 0, raises = 0, pfDecisions = 0, pfFolds = 0;
for (let h = 0; h < 1500; h++) {
  seats.forEach((p) => { if (p.stack < 50) p.stack += 10000; }); // докупка
  const before = seats.reduce((s, p) => s + p.stack, 0);
  const st = H.createHand({ id: 'g' + h, players: seats, button, blinds: [25, 50] });
  let guard = 0;
  while (!st.over) {
    assert(++guard < 300);
    const actor = st.players[st.toAct], prof = seats.find((s) => s.id === actor.id).prof;
    const view = H.publicView(st, actor.id);
    view.players.forEach((p) => { if (p.id !== actor.id) assert.strictEqual(p.cards, null, 'бот увидел чужие карты'); });
    assert(!('deck' in view));
    const a = B.decide(view, prof);
    decisions++; if (a.type === 'fold') folds++; if (a.type === 'raise' || a.type === 'allin') raises++;
    if (st.street === 'preflop') { pfDecisions++; if (a.type === 'fold') pfFolds++; }
    H.act(st, a); // движок бросит исключение, если действие недопустимо
  }
  if (st.result.showdown) showdowns++;
  st.players.forEach((p, i) => { seats[i].stack = p.stack; });
  assert.strictEqual(seats.reduce((s, p) => s + p.stack, 0), before);
  button = H.nextButton(seats, st.button); hands++;
}
const fr = folds / decisions, pfr = pfFolds / pfDecisions;
assert(pfr > 0.25 && pfr < 0.8, 'доля фолдов до флопа странная: ' + pfr);
assert(raises / decisions > 0.05 && raises / decisions < 0.5, 'агрессия странная: ' + raises / decisions);
assert(showdowns > hands * 0.15, 'слишком мало вскрытий: ' + showdowns);
// бот без права хода не может решать
assert.throws(() => B.decide({ legal: null }, B.PROFILES.easy));
console.log('bots tests ok (preflop fold ' + (pfr * 100).toFixed(0) + '%, raise ' + (raises / decisions * 100).toFixed(0) + '%, showdowns ' + (showdowns / hands * 100).toFixed(0) + '%)');
