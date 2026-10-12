/* Игровой контроллер: связывает движок (js/engine), ботов, прогресс и интерфейс (RTUI).
   Здесь нет правил покера: все решения о ставках, банках и победителях принимает RTEngine.
   Анимации и таймеры только показывают уже посчитанное состояние. */
(function (root) {
  'use strict';
  var UI = root.RTUI, E = root.RTEngine, H = E.hand, B = E.bots, P = root.RTProgress, Snd = root.RTSound;
  var BLINDS = [25, 50], REBUY = 10000;
  var STREET_NAMES = { preflop: 'Префлоп', flop: 'Флоп', turn: 'Тёрн', river: 'Ривер' };
  var BOT_DEFS = [
    { id: 'b0', name: 'Макс', prof: 'easy', stack: 8200 },
    { id: 'b1', name: 'Нора', prof: 'normal', stack: 12400 },
    { id: 'b2', name: 'Ковбой', prof: 'normal', stack: 5600 },
    { id: 'b3', name: 'Профессор', prof: 'hard', stack: 15300 }
  ];

  // deps: { save, persist(), haptic(kind), onExit() }
  function create(deps) {
    var save = deps.save, fmt = UI.fmt;
    var timers = [], gen = 0, seats = [], hero = null, heroIdx = 4, button = 0, hand = null, handNo = 0;
    var phase = 'idle', shown = 0, thinkingId = null, lastCommitted = -1, counter = 0, autoTimer = null;

    // ---------- время ----------
    function speed() { var a = save.settings.anim; return a === 'off' ? 0.08 : a === 'fast' ? 0.45 : 1; }
    function later(fn, ms) {
      var g = gen, id = setTimeout(function () { timers = timers.filter(function (x) { return x !== id; }); if (g !== gen) return; fn(); }, Math.max(30, ms * speed()));
      timers.push(id); return id;
    }
    function sound(n) { if (save.settings.sound) Snd.play(n); }
    function buzz(k) { if (save.settings.haptics) deps.haptic(k); }

    // ---------- сессия ----------
    function start() {
      stop();
      hero = { id: 'hero', name: 'Вы', stack: save.balance, hero: true };
      seats = BOT_DEFS.map(function (b) { return { id: b.id, name: b.name, stack: b.stack, prof: B.PROFILES[b.prof] }; }).concat([hero]);
      heroIdx = seats.length - 1;
      button = E.cards.secureInt(seats.length);
      phase = 'between'; hand = null;
      UI.dealerAnim('enter');
      nextHand();
    }

    // Выход посреди раздачи = сброс карт героя; остальные доигрывают мгновенно, результат записывается один раз.
    function stop() {
      finishNow();
      gen++; timers.forEach(clearTimeout); timers = [];
      phase = 'idle'; hand = null; thinkingId = null;
    }

    function botDecide(p) {
      var prof = seats.filter(function (s) { return s.id === p.id; })[0].prof;
      try { return B.decide(H.publicView(hand, p.id), prof); } catch (e) { return { type: 'fold' }; }
    }
    function finishNow() {
      if (!hand) return;
      var guard = 0;
      while (!hand.over && guard++ < 500) {
        var p = hand.players[hand.toAct], a = p.id === 'hero' ? { type: 'fold' } : botDecide(p);
        try { H.act(hand, a); } catch (e) { H.act(hand, { type: 'fold' }); }
      }
      if (hand.over) settleToSave();
    }

    // ---------- раздача ----------
    function nextHand() {
      if (phase !== 'between') return;
      clearTimeout(autoTimer);
      seats.forEach(function (s) { if (!s.hero && s.stack < BLINDS[1] * 4) s.stack = REBUY; }); // боты докупаются между раздачами
      hero.stack = save.balance;
      if (hero.stack < BLINDS[1]) return bust();
      button = H.nextButton(seats, button);
      var id = Date.now().toString(36) + '-' + (++counter) + '-' + E.cards.secureInt(1679616).toString(36);
      hand = H.createHand({ id: id, players: seats, button: button, blinds: BLINDS });
      phase = 'playing'; shown = 0; thinkingId = null; lastCommitted = -1; handNo = save.handsPlayed + 1;
      syncPending();
      UI.clearActions();
      UI.dealerPose('deal', 900); sound('deal');
      UI.dealerSay('Раздача ' + handNo + '. Удачи!', 1800, 'smile');
      render();
      later(step, 700);
    }

    // Вклад героя пишем в сохранение сразу: если игру закроют посреди раздачи, внесённые фишки не вернутся.
    function syncPending() {
      var c = hand.players[heroIdx].total;
      if (c !== lastCommitted) { lastCommitted = c; P.markHand(save, hand.id, c); deps.persist(); }
    }

    function step() {
      if (phase !== 'playing' || !hand) return;
      if (hand.over) return endHand();
      var p = hand.players[hand.toAct];
      if (p.id === 'hero') heroTurn(); else botTurn(p);
    }

    function botTurn(p) {
      thinkingId = p.id; render();
      var prof = seats.filter(function (s) { return s.id === p.id; })[0].prof;
      var ms = prof.think[0] + E.cards.secureInt(prof.think[1] - prof.think[0] + 1);
      later(function () { thinkingId = null; applyAction(botDecide(p), p); }, ms);
    }

    function applyAction(action, actor) {
      try { H.act(hand, action); }
      catch (e) {
        if (actor.id === 'hero') { UI.toast('Это действие сейчас недоступно'); return heroTurn(); }
        H.act(hand, { type: hand.currentBet === actor.bet ? 'check' : 'fold' });
      }
      var la = hand.players.filter(function (p) { return p.id === actor.id; })[0].lastAction;
      if (la) {
        if (la.type === 'fold') sound('fold'); else if (la.type === 'check') sound('check'); else sound('chip');
        if (la.allin && actor.id !== 'hero') UI.dealerSay(actor.name + ': ва-банк!', 1800, 'surprise');
        else if (la.allin) UI.dealerSay('Ставка ва-банк. Смело.', 1800, 'serious');
      }
      UI.clearActions();
      if (actor.id === 'hero') syncPending();
      render();
      revealBoard(function () { later(step, 250); });
    }

    // Общие карты открываются по улицам; при all-in — с паузами (карты уже определены движком).
    function revealBoard(done) {
      var target = hand.board.length;
      if (shown >= target) return done();
      var seq = [3, 4, 5].filter(function (n) { return n > shown && n <= target; });
      (function next(i) {
        if (i >= seq.length) return done();
        var from = shown; shown = seq[i];
        sound('deal'); UI.dealerPose('deal', 600); UI.dealerAnim('nudge');
        render({ newFrom: from });
        later(function () { next(i + 1); }, i < seq.length - 1 ? 1000 : 300);
      })(0);
    }

    // ---------- ход героя ----------
    function heroTurn() {
      thinkingId = null; render();
      var l = H.legalActions(hand), toCall = hand.currentBet - hand.players[heroIdx].bet;
      sound('turn'); buzz('light');
      var acts = [{ id: 'fold', label: 'Fold', kind: 'danger' }];
      if (l.canCheck) acts.push({ id: 'check', label: 'Check', kind: 'ghost' });
      else if (l.callAmount >= l.stack) acts.push({ id: 'call', label: 'All-in', sub: fmt(l.stack), kind: 'primary' });
      else acts.push({ id: 'call', label: 'Call', sub: fmt(l.callAmount), kind: 'ghost' });
      if (l.canRaise && l.stack > toCall) {
        if (!l.raiseIsAllIn) acts.push({ id: 'raise', label: hand.currentBet === 0 ? 'Bet' : 'Raise', kind: 'primary' });
        acts.push({ id: 'allin', label: 'All-in', sub: fmt(l.stack), kind: 'ghost' });
      }
      UI.renderActions(acts, function (id) { onHeroAction(id, l); });
    }

    function onHeroAction(id, l) {
      if (phase !== 'playing' || !hand || hand.over || hand.players[hand.toAct].id !== 'hero') return;
      buzz('medium');
      if (id === 'raise') {
        var pot = H.totalPot(hand), toCall = hand.currentBet - hand.players[heroIdx].bet;
        var rt = function (frac) { return Math.round(hand.currentBet + (pot + toCall) * frac); };
        UI.openBet({ min: l.minRaiseTo, max: l.maxRaiseTo, label: hand.currentBet === 0 ? 'Bet' : 'Raise to',
          presets: [{ label: 'Мин', value: l.minRaiseTo }, { label: '½ банка', value: rt(0.5) }, { label: 'Банк', value: rt(1) }, { label: 'Макс', value: l.maxRaiseTo }] },
          function (v) { applyAction({ type: 'raise', amount: v }, hero); });
        return;
      }
      applyAction({ type: id }, hero);
    }

    // ---------- конец раздачи ----------
    function endHand() {
      phase = 'ending'; UI.clearActions();
      var res = hand.result;
      revealBoard(function () {
        if (res.showdown) { render({ reveal: true }); later(finalize, 1200); } else later(finalize, 300);
      });
    }

    // Запись итога в сохранение (один раз на id раздачи) — общая для обычного конца и для выхода посреди раздачи.
    function settleToSave() {
      var res = hand.result, hp = hand.players[heroIdx], hh = res.hands.hero;
      var out = P.applyHandResult(save, { handId: hand.id, finalStack: hp.stack, net: res.net.hero, won: res.winners.indexOf('hero') >= 0,
        cat: hh ? hh.cat : -1, name: hh ? hh.name : '', pot: H.totalPot(hand), allin: hp.status === 'allin' });
      deps.persist();
      seats.forEach(function (s, i) { s.stack = hand.players[i].stack; });
      return out;
    }

    function finalize() {
      if (phase !== 'ending') return;
      var res = hand.result, won = res.winners.indexOf('hero') >= 0;
      var out = settleToSave();
      phase = 'between';
      render({ reveal: true, final: true });
      var names = res.winners.map(function (id) { return hand.players.filter(function (p) { return p.id === id; })[0]; });
      var bestName = res.showdown && res.hands[res.winners[0]] ? res.hands[res.winners[0]].name : '';
      if (won) { UI.dealerPose('win', 2200); UI.dealerAnim('accent'); sound('win'); buzz('heavy'); }
      else if (hand.players[heroIdx].status === 'folded' || res.net.hero < 0) { UI.dealerPose('lose', 2000); sound('lose'); }
      var who = res.winners.length > 1 ? 'Банк делят: ' + names.map(function (p) { return p.name === 'Вы' ? 'вы' : p.name; }).join(', ')
        : (won ? 'Вы забираете банк' : names[0].name + ' забирает банк');
      var heroCat = res.hands.hero ? res.hands.hero.cat : -1, lostStrong = !won && res.showdown && heroCat >= 4 && res.net.hero < 0;
      var emo = won ? (res.net.hero >= 2000 ? 'surprise' : 'joy') : lostStrong ? 'anger' : (hand.players[heroIdx].status === 'folded' && !res.showdown ? 'wink' : (res.net.hero < 0 ? 'sad' : 'smile'));
      UI.dealerSay(who + (bestName ? ' — ' + bestName : ''), 3200, emo);
      if (out && out.applied) announce(out);
      UI.renderActions([{ id: 'next', label: 'Дальше', kind: 'primary' }], function () { later(nextHand, 150); });
      autoTimer = later(function () { if (phase === 'between' && hand && hand.over) nextHand(); }, 6000);
    }

    function announce(out) {
      var msgs = [];
      out.levels.forEach(function (lv) { msgs.push('Новый уровень ' + lv); });
      if (out.levelBonus) msgs.push('Бонус за уровень +' + fmt(out.levelBonus));
      out.achievements.forEach(function (id) { var a = P.ACHIEVEMENTS.filter(function (x) { return x.id === id; })[0]; if (a) msgs.push('Достижение: ' + a.title); });
      msgs.forEach(function (m, i) { later(function () { UI.toast(m); }, 600 + i * 2400); });
    }

    // ---------- нет фишек ----------
    function bust() {
      phase = 'bust'; thinkingId = null; hand = null;
      UI.dealerPose('lose', 2500);
      var rs = P.refillState(save, Date.now()), acts = [];
      if (rs.available) acts.push({ id: 'refill', label: 'Получить фишки', sub: '+' + fmt(rs.amount), kind: 'primary' });
      acts.push({ id: 'exit', label: 'В меню', kind: 'ghost' });
      UI.dealerSay(rs.available ? 'Фишки закончились. Держите подарок от клуба!' : 'Фишки закончились. Новое пополнение через ' + Math.ceil(rs.waitMs / 60000) + ' мин.', 8000, rs.available ? 'shy' : 'sad');
      UI.renderActions(acts, function (id) {
        if (id === 'refill') { P.refill(save, Date.now()); deps.persist(); phase = 'between'; nextHand(); }
        else deps.onExit();
      });
    }

    // ---------- отображение ----------
    function badgeFor(p, res, final) {
      if (final && res) {
        if (res.winners.indexOf(p.id) >= 0) return '+' + fmt(res.net[p.id]);
        if (res.showdown && p.status !== 'folded' && res.hands[p.id]) return res.hands[p.id].name;
        return '';
      }
      var la = p.lastAction;
      if (!la || p.status !== 'in') return '';
      if (la.type === 'blind') return la.label;
      return la.type; // check / call / raise
    }

    function render(opts) {
      opts = opts || {};
      var res = hand.over ? hand.result : null, reveal = !!opts.reveal && res && res.showdown, final = !!opts.final;
      var board = hand.board.slice(0, shown);
      var players = hand.players.map(function (p, i) {
        var isHero = p.id === 'hero', show = isHero || (reveal && p.status !== 'folded' && p.status !== 'out');
        var handName = '';
        if (isHero && p.status !== 'folded' && board.length >= 3) { try { handName = E.evaluator.evaluate(p.cards.concat(board)).name; } catch (e) {} }
        if (isHero && final && res && res.winners.indexOf('hero') >= 0) handName = (res.hands.hero ? res.hands.hero.name + ' ' : '') + '+' + fmt(res.net.hero);
        return { id: p.id, name: p.name, stack: p.stack, bet: p.bet, status: p.status, isHero: isHero, isDealer: i === hand.button,
          active: !hand.over && i === hand.toAct, thinking: thinkingId === p.id, winner: final && res && res.winners.indexOf(p.id) >= 0,
          badge: badgeFor(p, res, final), reveal: !!reveal && show, handName: handName,
          cards: p.status === 'out' ? [] : (show ? p.cards : [null, null]) };
      });
      var status = STREET_NAMES[hand.street] || '';
      if (final && res) status = res.winners.length > 1 ? 'Ничья' : (res.winners[0] === 'hero' ? 'Вы выиграли' : hand.players.filter(function (p) { return p.id === res.winners[0]; })[0].name + ' выиграл');
      var highlight = [];
      if (final && res && res.showdown) res.winners.forEach(function (id) { if (res.hands[id]) res.hands[id].best.forEach(function (c) { highlight.push(c.r + c.s); }); });
      UI.renderTable({ highlight: highlight, hand: handNo, blinds: BLINDS, balance: phase === 'between' ? save.balance : hand.players[heroIdx].stack, pot: H.totalPot(hand), board: board, newFrom: opts.newFrom, status: status, players: players });
    }

    return { start: start, stop: stop };
  }

  root.RTGame = { create: create, BLINDS: BLINDS };
})(window);
