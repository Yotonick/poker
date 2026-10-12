/* Движок одной раздачи Texas Hold'em. Без DOM, без таймеров, без зависимостей от интерфейса.
   Состояние — обычный объект; все изменения идут через act(). Ставки проверяются, результат считает только движок.
   Суммы везде целые. raise.amount — итоговая ставка игрока на текущей улице («raise to»). */
(function (root) {
  'use strict';
  if (typeof require === 'function' && !(root.RTEngine && root.RTEngine.cards)) { require('./cards.js'); require('./evaluator.js'); }
  var E = root.RTEngine;
  var STREETS = ['preflop', 'flop', 'turn', 'river'];

  function nextIdx(st, from, pred) {
    var n = st.players.length;
    for (var k = 1; k <= n; k++) { var j = (from + k) % n; if (pred(st.players[j])) return j; }
    return -1;
  }
  var isLive = function (p) { return p.status !== 'out'; };
  var isIn = function (p) { return p.status === 'in'; };
  var needsAction = function (st, p) { return p.status === 'in' && (!p.acted || p.bet < st.currentBet); };
  function nextActor(st, from) { return nextIdx(st, from, function (p) { return needsAction(st, p); }); }
  function pay(p, amt) { p.stack -= amt; p.bet += amt; p.total += amt; if (p.stack === 0) p.status = 'allin'; }
  function totalPot(st) { return st.players.reduce(function (s, p) { return s + p.total; }, 0); }

  // Следующая кнопка дилера: первый игрок со стеком по часовой после предыдущей.
  function nextButton(players, prev) {
    var n = players.length;
    for (var k = 1; k <= n; k++) { var j = (prev + k) % n; if (players[j].stack > 0) return j; }
    return -1;
  }

  function createHand(opts) {
    var sbA = opts.blinds[0], bbA = opts.blinds[1];
    var st = {
      id: opts.id, blinds: [sbA, bbA], street: 'preflop', board: [], currentBet: 0, lastRaise: bbA, incomplete: 0,
      toAct: -1, over: false, result: null, runout: false, log: [], deck: null,
      players: opts.players.map(function (p) {
        var stack = Math.floor(p.stack);
        return { id: p.id, name: p.name, stack: stack > 0 ? stack : 0, bet: 0, total: 0, status: stack > 0 ? 'in' : 'out', cards: [], acted: false, lastAction: null };
      })
    };
    if (st.players.filter(isLive).length < 2) throw new Error('Для раздачи нужно минимум 2 игрока со стеком');
    st.startStacks = {}; st.players.forEach(function (p) { st.startStacks[p.id] = p.stack; });
    var btn = opts.button || 0;
    if (!isLive(st.players[btn])) btn = nextIdx(st, btn, isLive);
    st.button = btn;
    st.deck = (opts.deck ? opts.deck.slice() : E.cards.shuffle(E.cards.newDeck(), opts.randInt));
    var live = st.players.filter(isLive).length;
    var sb = live === 2 ? btn : nextIdx(st, btn, isLive);
    var bb = nextIdx(st, sb, isLive);
    st.sbIdx = sb; st.bbIdx = bb;
    pay(st.players[sb], Math.min(sbA, st.players[sb].stack)); st.players[sb].lastAction = { type: 'blind', amount: st.players[sb].bet, label: 'SB' };
    pay(st.players[bb], Math.min(bbA, st.players[bb].stack)); st.players[bb].lastAction = { type: 'blind', amount: st.players[bb].bet, label: 'BB' };
    st.currentBet = Math.max(st.players[sb].bet, st.players[bb].bet);
    // карты: два круга, начиная с малого блайнда
    for (var r = 0; r < 2; r++) {
      var i = sb;
      for (var k = 0; k < live; k++) { st.players[i].cards.push(st.deck.shift()); i = nextIdx(st, i, isLive); }
    }
    var first = nextActor(st, bb);
    if (first >= 0) st.toAct = first; else endRound(st);
    return st;
  }

  function legalActions(st) {
    if (st.over || st.toAct < 0) return null;
    var p = st.players[st.toAct], toCall = Math.max(0, st.currentBet - p.bet), maxTo = p.bet + p.stack;
    var canRaise = !p.acted && maxTo > st.currentBet;
    return {
      id: p.id, index: st.toAct, stack: p.stack, bet: p.bet,
      canCheck: toCall === 0, canCall: toCall > 0, callAmount: Math.min(toCall, p.stack),
      canRaise: canRaise, minRaiseTo: Math.min(st.currentBet + st.lastRaise, maxTo), maxRaiseTo: maxTo,
      // единственный возможный «рейз» — весь стек (меньше минимального)
      raiseIsAllIn: canRaise && st.currentBet + st.lastRaise >= maxTo
    };
  }

  function act(st, action) {
    if (st.over) throw new Error('Раздача уже завершена');
    var p = st.players[st.toAct], type = action && action.type, toCall = st.currentBet - p.bet, amount;
    if (type === 'allin') { type = (p.stack <= toCall) ? 'call' : 'raise'; amount = p.bet + p.stack; }
    else amount = action.amount;
    var paid = 0, prevBet = p.bet;
    if (type === 'fold') { p.status = 'folded'; }
    else if (type === 'check') { if (toCall !== 0) throw new Error('Check невозможен: есть ставка'); }
    else if (type === 'call') { if (toCall <= 0) throw new Error('Нечего уравнивать'); paid = Math.min(toCall, p.stack); pay(p, paid); }
    else if (type === 'raise') {
      var maxTo = p.bet + p.stack;
      if (!Number.isInteger(amount)) throw new Error('Сумма должна быть целой');
      if (p.acted) throw new Error('Рейз сейчас недоступен (ставка не открыта заново)');
      if (amount <= st.currentBet) throw new Error('Рейз должен быть больше текущей ставки');
      if (amount > maxTo) throw new Error('Ставка больше стека');
      if (amount < st.currentBet + st.lastRaise && amount < maxTo) throw new Error('Рейз меньше минимального');
      paid = amount - p.bet; pay(p, paid);
      var size = amount - st.currentBet, reopen = false;
      if (size >= st.lastRaise) { st.lastRaise = size; st.incomplete = 0; reopen = true; }
      else { st.incomplete += size; if (st.incomplete >= st.lastRaise) { st.incomplete = 0; reopen = true; } } // неполный рейз
      st.currentBet = amount;
      if (reopen) st.players.forEach(function (o) { if (o !== p && o.status === 'in') o.acted = false; });
    } else throw new Error('Неизвестное действие: ' + type);
    p.acted = true;
    p.lastAction = { type: type, amount: p.bet, allin: p.status === 'allin' };
    st.log.push({ street: st.street, id: p.id, type: type, paid: paid, to: p.bet });
    var alive = st.players.filter(function (x) { return x.status === 'in' || x.status === 'allin'; });
    if (alive.length === 1) { settle(st, false); return st; }
    var nxt = nextActor(st, st.toAct);
    if (nxt >= 0) st.toAct = nxt; else endRound(st);
    return st;
  }

  function endRound(st) {
    for (;;) {
      st.players.forEach(function (p) { p.bet = 0; p.acted = false; p.lastAction = null; });
      st.currentBet = 0; st.lastRaise = st.blinds[1]; st.incomplete = 0;
      if (st.street === 'river') { settle(st, true); return; }
      st.street = STREETS[STREETS.indexOf(st.street) + 1];
      st.deck.shift(); // сжигаем карту
      var n = st.street === 'flop' ? 3 : 1;
      for (var i = 0; i < n; i++) st.board.push(st.deck.shift());
      if (st.players.filter(isIn).length >= 2) { st.toAct = nextActor(st, st.button); return; }
      st.runout = true; // торговаться некому — карты открываются до конца
    }
  }

  // Основной и побочные банки по слоям вкладов. Неоплаченная часть самой большой ставки возвращается.
  function buildPots(players) {
    var levels = [], pots = [], refunds = {};
    players.forEach(function (p) { if (p.total > 0 && levels.indexOf(p.total) < 0) levels.push(p.total); });
    levels.sort(function (a, b) { return a - b; });
    var prev = 0;
    levels.forEach(function (L) {
      var contrib = players.filter(function (p) { return p.total > prev; });
      var amount = players.reduce(function (s, p) { return s + Math.min(p.total, L) - Math.min(p.total, prev); }, 0);
      var elig = players.filter(function (p) { return p.status !== 'folded' && p.status !== 'out' && p.total >= L; }).map(function (p) { return p.id; });
      prev = L;
      if (contrib.length === 1) { refunds[contrib[0].id] = (refunds[contrib[0].id] || 0) + amount; return; }
      if (!elig.length) { if (pots.length) pots[pots.length - 1].amount += amount; else contrib.forEach(function (p) { refunds[p.id] = (refunds[p.id] || 0) + Math.min(p.total, L); }); return; }
      var last = pots[pots.length - 1];
      if (last && last.eligible.join() === elig.join()) last.amount += amount;
      else pots.push({ amount: amount, eligible: elig });
    });
    return { pots: pots, refunds: refunds };
  }

  function settle(st, showdown) {
    var bp = buildPots(st.players), payouts = {}, hands = {}, byId = {};
    st.players.forEach(function (p) { byId[p.id] = p; payouts[p.id] = 0; p.bet = 0; });
    Object.keys(bp.refunds).forEach(function (id) { payouts[id] += bp.refunds[id]; });
    var alive = st.players.filter(function (p) { return p.status === 'in' || p.status === 'allin'; });
    if (showdown) alive.forEach(function (p) { var e = E.evaluator.evaluate(p.cards.concat(st.board)); hands[p.id] = { name: e.name, cat: e.cat, score: e.score, best: e.best }; });
    bp.pots.forEach(function (pot) {
      var winners;
      if (!showdown) winners = pot.eligible.slice();
      else {
        var top = Math.max.apply(null, pot.eligible.map(function (id) { return hands[id].score; }));
        winners = pot.eligible.filter(function (id) { return hands[id].score === top; });
      }
      // остаток от деления — по одной фишке победителям, начиная слева от дилера
      var ordered = [], i = st.button;
      for (var k = 0; k < st.players.length; k++) { i = (i + 1) % st.players.length; if (winners.indexOf(st.players[i].id) >= 0) ordered.push(st.players[i].id); }
      var share = Math.floor(pot.amount / ordered.length), rem = pot.amount - share * ordered.length;
      ordered.forEach(function (id, n) { payouts[id] += share + (n < rem ? 1 : 0); });
      pot.winners = ordered; pot.share = share;
    });
    st.players.forEach(function (p) { p.stack += payouts[p.id]; });
    var winnersAll = st.players.filter(function (p) { return payouts[p.id] > p.total; }).map(function (p) { return p.id; });
    st.result = { showdown: showdown, pots: bp.pots, refunds: bp.refunds, payouts: payouts, hands: hands, winners: winnersAll,
      net: st.players.reduce(function (o, p) { o[p.id] = payouts[p.id] - p.total; return o; }, {}) };
    st.over = true; st.toAct = -1;
    return st.result;
  }

  // Что видит конкретный игрок (в том числе бот): чужие закрытые карты недоступны.
  function publicView(st, forId) {
    var reveal = st.over && st.result && st.result.showdown;
    var leg = (!st.over && st.toAct >= 0 && st.players[st.toAct].id === forId) ? legalActions(st) : null;
    return {
      id: st.id, blinds: st.blinds.slice(), street: st.street, board: st.board.slice(), pot: totalPot(st), currentBet: st.currentBet,
      minRaise: st.lastRaise, button: st.button, over: st.over, me: forId, toAct: st.toAct >= 0 ? st.players[st.toAct].id : null, legal: leg,
      players: st.players.map(function (p, i) {
        return { id: p.id, name: p.name, seat: i, stack: p.stack, bet: p.bet, total: p.total, status: p.status, acted: p.acted,
          lastAction: p.lastAction ? { type: p.lastAction.type, amount: p.lastAction.amount } : null,
          cards: (p.id === forId || (reveal && p.status !== 'folded')) ? p.cards.slice() : null };
      })
    };
  }

  E.hand = { createHand: createHand, act: act, legalActions: legalActions, publicView: publicView, totalPot: totalPot, nextButton: nextButton, buildPots: buildPots };
  if (typeof module !== 'undefined' && module.exports) module.exports = E.hand;
})(typeof window !== 'undefined' ? window : globalThis);
