// Тесты прогресса и экономики: node tests/progress.test.js
const assert = require('assert');
const S = require('../js/storage.js'), P = require('../js/progress.js'), C = require('../js/collections.js');
const fresh = () => S.sanitize(null);
const res = (o) => Object.assign({ handId: 'h1', finalStack: 10000, net: 0, won: false, cat: -1, name: '', pot: 0, allin: false }, o);

{ // награды за раздачу начисляются один раз
  const s = fresh();
  const a = P.applyHandResult(s, res({ finalStack: 10100, net: 100, won: true, cat: 1, name: 'Пара', pot: 200 }));
  assert(a.applied); assert.strictEqual(s.handsPlayed, 1); assert.strictEqual(s.wins, 1); assert.strictEqual(s.balance, 10100);
  assert(s.achievements.first_win); assert.deepStrictEqual(a.achievements, ['first_win']);
  const snap = JSON.stringify(s);
  const b = P.applyHandResult(s, res({ finalStack: 99999, net: 99999, won: true, cat: 8 })); // повтор того же события
  assert.strictEqual(b.applied, false); assert.strictEqual(JSON.stringify(s), snap);
  // после перезагрузки (save → load) тот же id по-прежнему не считается
  const again = S.sanitize(JSON.parse(JSON.stringify(s)));
  assert.strictEqual(P.applyHandResult(again, res({ finalStack: 1 })).applied, false);
  assert.strictEqual(P.applyHandResult(again, res({ handId: 'h2', finalStack: 9000 })).applied, true);
  assert.strictEqual(again.balance, 9000); assert.strictEqual(again.handsPlayed, 2);
}
{ // уровни: перенос остатка XP, бонус фишек, достижение «Уровень 5» не дублируется
  const s = fresh(); s.xp = 99; s.level = 1;
  const a = P.applyHandResult(s, res({ finalStack: 10000 }));
  assert.deepStrictEqual(a.levels, [2]); assert.strictEqual(s.level, 2); assert.strictEqual(a.levelBonus, 500); assert.strictEqual(s.balance, 10500);
  assert(s.xp < P.xpNeeded(2));
  const s2 = fresh(); s2.level = 4; s2.xp = P.xpNeeded(4) - 1;
  const b = P.applyHandResult(s2, res({ handId: 'x' }));
  assert.strictEqual(s2.level, 5); assert(s2.achievements.level_5); assert(b.achievements.includes('level_5'));
  const c = P.applyHandResult(s2, res({ handId: 'y' })); assert.deepStrictEqual(c.achievements, []);
}
{ // достижения по комбинациям
  const s = fresh();
  P.applyHandResult(s, res({ finalStack: 20000, net: 6000, won: true, cat: 7, name: 'Каре', allin: true }));
  ['flush', 'full_house', 'quads', 'allin_win', 'big_pot', 'first_win'].forEach((k) => assert(s.achievements[k], k));
  assert(!s.achievements.royal); assert.strictEqual(s.biggestPot, 6000);
  const l = fresh(); P.applyHandResult(l, res({ finalStack: 9000, net: -1000, cat: 8, name: 'Роял-флеш' })); assert(!l.achievements.royal); // проигрыш не даёт достижение
}
{ // незавершённая раздача: внесённое списывается один раз
  const s = fresh(); P.markHand(s, 'hp', 700); assert.deepStrictEqual(s.pendingHand, { id: 'hp', committed: 700 });
  const loaded = S.sanitize(JSON.parse(JSON.stringify(s)));
  assert(P.resolvePending(loaded)); assert.strictEqual(loaded.balance, 9300); assert.strictEqual(loaded.pendingHand, null);
  assert.strictEqual(P.resolvePending(loaded), false); assert.strictEqual(loaded.balance, 9300);
  const big = fresh(); big.balance = 100; P.markHand(big, 'z', 5000); P.resolvePending(big); assert.strictEqual(big.balance, 0); // не уходит в минус
  // нормальное завершение снимает метку
  const ok = fresh(); P.markHand(ok, 'q', 300); P.applyHandResult(ok, res({ handId: 'q', finalStack: 9700 })); assert.strictEqual(ok.pendingHand, null);
}
{ // бесплатное пополнение
  const s = fresh(), t0 = 1e12;
  assert.strictEqual(P.refill(s, t0), 0); assert.strictEqual(P.refillState(s, t0).available, false); // много фишек — не нужно
  s.balance = 200;
  const st = P.refillState(s, t0); assert(st.available); assert.strictEqual(st.amount, 2800);
  assert.strictEqual(P.refill(s, t0), 2800); assert.strictEqual(s.balance, 3000);
  s.balance = 10; assert.strictEqual(P.refill(s, t0 + 1000), 0); // кулдаун
  assert.strictEqual(P.refillState(s, t0 + 1000).waitMs, P.REFILL_COOLDOWN - 1000);
  assert.strictEqual(P.refill(s, t0 + P.REFILL_COOLDOWN), 2990);
  s.balance = 10; // часы ушли назад: ожидание не больше кулдауна
  assert(P.refillState(s, t0 - 1e9).waitMs <= P.REFILL_COOLDOWN);
}
{ // покупки
  const s = fresh(), onyx = C.get('table', 'onyx');
  assert.strictEqual(C.isUnlocked(onyx, s), false); assert.strictEqual(C.isUnlocked(C.get('table', 'royal'), s), true);
  s.balance = 100; assert.deepStrictEqual(P.buy(s, C, onyx), { ok: false, reason: 'funds' }); assert.strictEqual(s.balance, 100);
  s.balance = 5000; assert.strictEqual(P.buy(s, C, onyx).ok, true); assert.strictEqual(s.balance, 2000); assert(C.isUnlocked(onyx, s));
  assert.deepStrictEqual(P.buy(s, C, onyx), { ok: false, reason: 'owned' }); assert.strictEqual(s.balance, 2000);
  assert.strictEqual(S.sanitize(JSON.parse(JSON.stringify(s))).unlocked[0], 'table:onyx');
}
console.log('progress tests ok');
