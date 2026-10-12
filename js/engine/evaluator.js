/* Оценка рук: 5–7 карт. Возвращает { score, cat, name, best } — чем больше score, тем сильнее рука.
   cat: 0 старшая карта … 8 стрит-флеш (роял-флеш = стрит-флеш до туза). */
(function (root) {
  'use strict';
  var E = root.RTEngine || (root.RTEngine = {});
  var NAMES = ['Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш'];

  function eval5(cards) {
    var flush = cards.every(function (c) { return c.s === cards[0].s; });
    var counts = {};
    cards.forEach(function (c) { counts[c.r] = (counts[c.r] || 0) + 1; });
    // группы: сначала по количеству, потом по старшинству ранга
    var groups = Object.keys(counts).map(function (r) { return { r: +r, n: counts[r] }; })
      .sort(function (a, b) { return b.n - a.n || b.r - a.r; });
    var order = groups.map(function (g) { return g.r; });
    var shape = groups.map(function (g) { return g.n; }).join('');
    var straightHigh = 0;
    if (groups.length === 5) {
      if (order[0] - order[4] === 4) straightHigh = order[0];
      else if (order[0] === 14 && order[1] === 5 && order[4] === 2) straightHigh = 5; // колесо A-2-3-4-5
    }
    var cat, kick;
    if (straightHigh && flush) { cat = 8; kick = [straightHigh]; }
    else if (shape === '41') { cat = 7; kick = order; }
    else if (shape === '32') { cat = 6; kick = order; }
    else if (flush) { cat = 5; kick = order; }
    else if (straightHigh) { cat = 4; kick = [straightHigh]; }
    else if (shape === '311') { cat = 3; kick = order; }
    else if (shape === '221') { cat = 2; kick = order; }
    else if (shape === '2111') { cat = 1; kick = order; }
    else { cat = 0; kick = order; }
    var score = cat;
    for (var i = 0; i < 5; i++) score = score * 15 + (kick[i] || 0);
    var name = (cat === 8 && straightHigh === 14) ? 'Роял-флеш' : NAMES[cat];
    return { score: score, cat: cat, name: name, best: cards.slice() };
  }

  // Лучшая рука из 5–7 карт: перебор всех пятикарточных комбинаций.
  function evaluate(cards) {
    var n = cards.length;
    if (n < 5 || n > 7) throw new Error('Нужно 5–7 карт, получено ' + n);
    if (n === 5) return eval5(cards);
    var best = null, idx = [0, 1, 2, 3, 4];
    while (true) {
      var r = eval5(idx.map(function (i) { return cards[i]; }));
      if (!best || r.score > best.score) best = r;
      var k = 4;
      while (k >= 0 && idx[k] === n - 5 + k) k--;
      if (k < 0) break;
      idx[k]++;
      for (var j = k + 1; j < 5; j++) idx[j] = idx[j - 1] + 1;
    }
    return best;
  }

  E.evaluator = { evaluate: evaluate, NAMES: NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.evaluator;
})(typeof window !== 'undefined' ? window : globalThis);
