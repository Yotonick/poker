/* Колода и перемешивание. Без DOM. Карта: { r: 2..14 (14 = туз), s: 's'|'h'|'d'|'c' }. */
(function (root) {
  'use strict';
  var E = root.RTEngine || (root.RTEngine = {});
  var SUITS = ['s', 'h', 'd', 'c'];

  function newDeck() {
    var d = [];
    SUITS.forEach(function (s) { for (var r = 2; r <= 14; r++) d.push({ r: r, s: s }); });
    return d;
  }

  function getCrypto() {
    if (root.crypto && root.crypto.getRandomValues) return root.crypto;
    try { if (typeof require === 'function') return require('crypto').webcrypto; } catch (e) {}
    return null;
  }

  // Случайное целое 0..n-1 без смещения (отбрасываем «хвост» диапазона). Math.random не используется.
  function secureInt(n) {
    var c = getCrypto();
    if (!c) throw new Error('crypto.getRandomValues недоступен');
    var buf = new Uint32Array(1), limit = Math.floor(4294967296 / n) * n;
    do { c.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % n;
  }

  // Fisher–Yates. randInt подменяется только в тестах.
  function shuffle(deck, randInt) {
    var rnd = randInt || secureInt, a = deck.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  E.cards = { SUITS: SUITS, newDeck: newDeck, shuffle: shuffle, secureInt: secureInt };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.cards;
})(typeof window !== 'undefined' ? window : globalThis);
