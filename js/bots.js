/* Боты. Решение принимается ТОЛЬКО по публичному виду (RTEngine.hand.publicView): свои карты, общие карты,
   банк, ставки, стеки и позиции. Закрытых карт соперников у бота нет и быть не может.
   decide(view, profile) → { type: 'fold'|'check'|'call'|'raise'|'allin', amount? } (amount — итоговая ставка «raise to»). */
(function (root) {
  'use strict';
  if (typeof require === 'function' && !(root.RTEngine && root.RTEngine.evaluator)) { require('./engine/cards.js'); require('./engine/evaluator.js'); }
  var E = root.RTEngine;

  // loose — как часто играет слабые руки; aggr — склонность ставить/рейзить; bluff — частота блефа; noise — «человеческая» ошибка;
  // margin — запас по шансам банка (меньше нуля = звонит слишком часто); think — задержка «думает», мс.
  var PROFILES = {
    easy:   { id: 'easy',   level: 'easy',   loose: 0.75, aggr: 0.25, bluff: 0.07, noise: 0.20, margin: -0.07, think: [700, 1500] },
    normal: { id: 'normal', level: 'normal', loose: 0.45, aggr: 0.55, bluff: 0.20, noise: 0.09, margin: 0.02,  think: [800, 1800] },
    hard:   { id: 'hard',   level: 'hard',   loose: 0.30, aggr: 0.65, bluff: 0.28, noise: 0.03, margin: 0.03,  think: [1000, 2200] }
  };

  var rand = function () { return E.cards.secureInt(100000) / 100000; };
  var between = function (a, b) { return a + rand() * (b - a); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  // Сила стартовой руки 0..1 (AA ≈ 1, 72o ≈ 0.18).
  function preflopStrength(h) {
    var hi = Math.max(h[0].r, h[1].r), lo = Math.min(h[0].r, h[1].r);
    if (hi === lo) return 0.45 + (hi - 2) / 12 * 0.55;
    var s = (hi - 2) / 12 * 0.42 + (lo - 2) / 12 * 0.18, gap = hi - lo - 1;
    if (h[0].s === h[1].s) s += 0.06;
    if (gap === 0) s += 0.05; else if (gap === 1) s += 0.03; else if (gap === 2) s += 0.01; else if (gap >= 4) s -= 0.04;
    if (hi === 14) s += 0.05;
    return clamp(s, 0, 1);
  }

  // Сколько карт-рангов даст стрит (для оценки дро).
  function straightOuts(ranks) {
    var set = {}; ranks.forEach(function (r) { set[r] = 1; if (r === 14) set[1] = 1; });
    var outs = 0;
    for (var add = 2; add <= 14; add++) {
      if (set[add]) continue;
      var s2 = Object.assign({}, set); s2[add] = 1; if (add === 14) s2[1] = 1;
      for (var lo = 1; lo <= 10; lo++) { var ok = true; for (var k = 0; k < 5; k++) if (!s2[lo + k]) { ok = false; break; } if (ok) { outs++; break; } }
    }
    return outs;
  }

  // Сила руки после флопа 0..1 с учётом дро.
  function postflopStrength(hole, board) {
    var all = hole.concat(board), made = E.evaluator.evaluate(all), cat = made.cat, base;
    var boardMax = Math.max.apply(null, board.map(function (c) { return c.r; }));
    var cnt = {}; all.forEach(function (c) { cnt[c.r] = (cnt[c.r] || 0) + 1; });
    var bcnt = {}; board.forEach(function (c) { bcnt[c.r] = (bcnt[c.r] || 0) + 1; });
    var holeRanks = hole.map(function (c) { return c.r; });
    var pocket = hole[0].r === hole[1].r;
    var usesHole = function (r) { return holeRanks.indexOf(r) >= 0; };
    if (cat >= 6) base = 0.97;
    else if (cat === 5) base = 0.92;
    else if (cat === 4) base = 0.88;
    else if (cat === 3) { var tr = +Object.keys(cnt).filter(function (r) { return cnt[r] === 3; }).sort(function (a, b) { return b - a; })[0]; base = (pocket || usesHole(tr) && bcnt[tr] === 2) ? 0.88 : 0.72; }
    else if (cat === 2) { var pairs = Object.keys(cnt).filter(function (r) { return cnt[r] === 2; }); base = pairs.filter(function (r) { return usesHole(+r); }).length === 2 ? 0.78 : (pairs.some(function (r) { return usesHole(+r); }) ? 0.6 : 0.3); }
    else if (cat === 1) {
      var pr = +Object.keys(cnt).filter(function (r) { return cnt[r] === 2; })[0];
      if (!usesHole(pr)) base = 0.2 + (Math.max(hole[0].r, hole[1].r) === 14 ? 0.05 : 0);
      else if (pocket) base = pr > boardMax ? 0.68 : 0.45;
      else if (pr === boardMax) base = 0.58 + (Math.max(hole[0].r, hole[1].r) - 8) * 0.01;
      else base = pr > boardMax - 3 ? 0.42 : 0.33;
    } else base = 0.12 + (Math.max(hole[0].r, hole[1].r) === 14 ? 0.05 : 0);
    var bonus = 0;
    if (board.length < 5 && cat < 4) {
      var suits = {}; all.forEach(function (c) { suits[c.s] = (suits[c.s] || 0) + 1; });
      var fd = Object.keys(suits).some(function (s) { return suits[s] === 4 && hole.some(function (c) { return c.s === s; }); });
      if (fd) bonus += board.length === 3 ? 0.2 : 0.16;
      var outs = straightOuts(all.map(function (c) { return c.r; }));
      if (outs >= 2) bonus += board.length === 3 ? 0.15 : 0.12; else if (outs === 1) bonus += 0.06;
    }
    return clamp(base + bonus, 0, 0.97);
  }

  function round5(v) { return Math.max(5, Math.round(v / 5) * 5); }

  function decide(view, profile) {
    var pf = profile || PROFILES.normal, l = view.legal;
    if (!l) throw new Error('Сейчас ход не этого игрока');
    var me = view.players.filter(function (p) { return p.id === view.me; })[0];
    var hole = me.cards, bb = view.blinds[1];
    var opp = view.players.filter(function (p) { return p.id !== view.me && (p.status === 'in' || p.status === 'allin'); }).length;
    var canActOpp = view.players.filter(function (p) { return p.id !== view.me && p.status === 'in'; }).length;
    var toCall = Math.max(0, view.currentBet - me.bet);
    var pot = view.pot, preflop = view.street === 'preflop';

    // оценка шансов
    var eq;
    if (preflop) eq = 0.13 + 0.64 * preflopStrength(hole);
    else eq = 0.04 + 0.86 * postflopStrength(hole, view.board);
    eq *= Math.pow(preflop ? 0.94 : 0.88, Math.max(0, opp - 1));
    eq += (rand() - 0.5) * pf.noise * 2;
    // слабые руки реже играются у «тайтовых» ботов
    if (preflop) eq += (pf.loose - 0.45) * 0.12;

    var potOdds = toCall > 0 ? l.callAmount / (pot + l.callAmount) : 0;
    var canBluff = canActOpp >= 1 && opp <= 2 && l.stack > bb * 6;

    var wantRaise = false, size = 0.6;
    if (l.canRaise) {
      if (eq > 0.74) { wantRaise = rand() < 0.5 + 0.4 * pf.aggr; size = between(0.55, 0.9); }
      else if (eq > 0.5) { wantRaise = rand() < pf.aggr * 0.7; size = between(0.4, 0.65); }
      else if (eq > 0.4 && toCall === 0 && opp <= 2) { wantRaise = rand() < pf.aggr * 0.3; size = between(0.3, 0.5); }
      else if (canBluff && rand() < pf.bluff * (toCall === 0 ? 1 : 0.35)) { wantRaise = true; size = between(0.45, 0.7); }
    }
    if (wantRaise) {
      var to;
      if (preflop) to = view.currentBet <= bb ? bb * between(2.2, 3.6) : view.currentBet * between(2.4, 3.2);
      else to = view.currentBet + (pot + toCall) * size;
      to = clamp(round5(to), l.minRaiseTo, l.maxRaiseTo);
      if (to >= (l.maxRaiseTo) * 0.65 || l.raiseIsAllIn) return { type: 'allin' };
      return { type: 'raise', amount: to };
    }
    if (toCall === 0) return { type: 'check' };
    // против ставки: колл при достаточных шансах, иногда «дешёвый» колл ради розыгрыша
    var cheap = toCall <= bb * 1.2 && preflop && eq > 0.4;
    if (eq >= potOdds + pf.margin || cheap) return { type: 'call' };
    return { type: 'fold' };
  }

  E.bots = { PROFILES: PROFILES, decide: decide, preflopStrength: preflopStrength, postflopStrength: postflopStrength };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.bots;
})(typeof window !== 'undefined' ? window : globalThis);
