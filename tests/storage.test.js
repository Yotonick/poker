const assert = require('assert');
const S = require('../js/storage.js');
assert.strictEqual(S.sanitize(null).balance, 10000);
assert.strictEqual(S.sanitize({ balance: -5, level: 'x' }).balance, 10000);
assert.strictEqual(S.sanitize({ balance: 500.7 }).balance, 500);
assert.strictEqual(S.sanitize({ settings: { anim: 'bad' } }).settings.anim, 'normal');
assert.strictEqual(S.migrate({ v: 99 }), null);
assert.strictEqual(S.load().level, 1); // без localStorage — значения по умолчанию
console.log('storage tests ok');
// версия 2: новые поля и миграция из версии 1
assert.strictEqual(S.VERSION, 2);
const d = S.defaults(); assert.strictEqual(d.wins, 0); assert.strictEqual(d.lastHandId, ''); assert.strictEqual(d.pendingHand, null);
const m = S.sanitize(S.migrate({ v: 1, balance: 777, equipped: { table: 'onyx', back: 'royal' } }));
assert.strictEqual(m.balance, 777); assert.strictEqual(m.v, 2);
assert.deepStrictEqual(m.unlocked, ['table:onyx']); // прежний выбор косметики сохраняется
assert.strictEqual(S.sanitize({ pendingHand: { id: 'x', committed: -5 } }).pendingHand.committed, 0);
assert.strictEqual(S.sanitize({ pendingHand: 'bad' }).pendingHand, null);
assert.strictEqual(S.sanitize({ lastHandId: 5 }).lastHandId, '');
console.log('storage v2 ok');
