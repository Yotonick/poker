/* Отрисовка интерфейса. Не содержит правил покера: получает готовое состояние и показывает его.
   Формат карты (общий для движка и интерфейса): { r: 2..14 (14 = туз), s: 's' | 'h' | 'd' | 'c' }.
   Формат игрока для renderTable: { id, name, stack, bet, status: 'in'|'folded'|'allin'|'out', badge, isDealer, active, thinking, winner, cards: [card|null, card|null], reveal }. */
(function (root) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  var SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };
  var fmt = function (n) { return (Math.max(0, Math.floor(Number(n) || 0))).toLocaleString('ru-RU'); };

  var hl = {}; // ключи выигрышных карт ('14s'), подсвечиваются на вскрытии
  var isHl = function (c) { return !!(c && hl[c.r + c.s]); };

  // ---------- карты ----------
  function cardEl(card, opts) {
    opts = opts || {};
    var el = document.createElement('div');
    el.className = 'card' + (card && !opts.faceDown ? '' : ' face-down');
    var inner = document.createElement('div'); inner.className = 'card-inner';
    var face = document.createElement('div');
    if (card) {
      var red = card.s === 'h' || card.s === 'd';
      face.className = 'card-face ' + (red ? 'red' : 'black');
      var label = RANKS[card.r] || String(card.r);
      face.innerHTML = '<span class="card-rank">' + label + '</span><span class="card-suit-small">' + SUITS[card.s] + '</span><span class="card-suit-big">' + SUITS[card.s] + '</span>';
      el.setAttribute('aria-label', label + ' ' + SUITS[card.s]);
    } else { face.className = 'card-face'; }
    var back = document.createElement('div'); back.className = 'card-back';
    inner.appendChild(face); inner.appendChild(back); el.appendChild(inner);
    if (card && !opts.faceDown && isHl(card)) el.classList.add('win');
    if (opts.deal) { el.classList.add('deal-in'); el.style.animationDelay = (opts.delay || 0) + 'ms'; }
    return el;
  }

  // ---------- стол ----------
  var seatEls = {};
  function ensureSeat(p, slot) {
    var el = seatEls[p.id];
    if (el) return el;
    el = document.createElement('div');
    el.className = 'seat'; el.dataset.slot = slot;
    el.innerHTML = '<div class="seat-box"><div class="avatar"></div><div class="seat-name"></div><div class="seat-stack"></div><div class="seat-badge" hidden></div><div class="dealer-btn" hidden>D</div></div><div class="seat-cards"></div><div class="seat-bet"></div>';
    $('seats').appendChild(el); seatEls[p.id] = el;
    return el;
  }

  function renderSeat(p, slot) {
    var el = ensureSeat(p, slot);
    el.dataset.state = p.status || 'in';
    el.classList.toggle('active', !!p.active);
    el.classList.toggle('winner', !!p.winner);
    el.querySelector('.avatar').textContent = (p.name || '?').charAt(0).toUpperCase();
    el.querySelector('.seat-name').textContent = p.name;
    el.querySelector('.seat-stack').textContent = p.status === 'out' ? 'вышел' : fmt(p.stack);
    var badge = el.querySelector('.seat-badge');
    var text = p.thinking ? '<span class="thinking"><i></i><i></i><i></i></span>' : (p.badge || (p.status === 'allin' ? 'ва-банк' : p.status === 'folded' ? 'фолд' : ''));
    badge.hidden = !text; badge.innerHTML = text;
    el.querySelector('.dealer-btn').hidden = !p.isDealer;
    var bet = el.querySelector('.seat-bet'); var betText = p.bet > 0 ? fmt(p.bet) : '';
    if (bet.textContent !== betText) { bet.textContent = betText; if (betText) { bet.classList.remove('changed'); void bet.offsetWidth; bet.classList.add('changed'); } }
    var cardsBox = el.querySelector('.seat-cards');
    var sig = (p.cards || []).map(function (c) { return c ? c.r + c.s : '-'; }).join(',') + (p.reveal ? 'R' : 'H') + (p.cards || []).map(function (c) { return isHl(c) ? 'w' : ''; }).join('');
    el.classList.toggle('revealed', !!p.reveal);
    if (cardsBox.dataset.sig !== sig) {
      cardsBox.dataset.sig = sig; cardsBox.innerHTML = '';
      (p.cards || []).forEach(function (c) {
        var ce = cardEl(c, { faceDown: !p.reveal || !c });
        cardsBox.appendChild(ce);
        if (p.reveal && c) { // карта сначала лежит рубашкой вверх, затем переворачивается
          ce.classList.add('face-down');
          requestAnimationFrame(function () { requestAnimationFrame(function () { ce.classList.remove('face-down'); }); });
        }
      });
    }
  }

  var boardSig = '';
  function renderBoard(cards, newFrom) {
    var sig = cards.map(function (c) { return c.r + c.s + (isHl(c) ? 'w' : ''); }).join(',');
    if (sig === boardSig) return; boardSig = sig;
    var box = $('board'); box.innerHTML = '';
    for (var i = 0; i < 5; i++) {
      if (cards[i]) {
        var isNew = newFrom != null && i >= newFrom;
        box.appendChild(cardEl(cards[i], { deal: isNew, delay: isNew ? (i - newFrom) * 140 : 0 }));
      } else {
        var s = document.createElement('div'); s.className = 'slot'; box.appendChild(s);
      }
    }
  }

  function renderTable(state) {
    hl = {}; (state.highlight || []).forEach(function (k) { hl[k] = 1; });
    $('board').classList.toggle('has-win', (state.highlight || []).length > 0);
    $('pot-amount').textContent = fmt(state.pot);
    $('g-hand').textContent = state.hand;
    $('g-blinds').textContent = fmt(state.blinds[0]) + ' / ' + fmt(state.blinds[1]);
    $('g-balance').textContent = fmt(state.balance);
    $('table-status').textContent = state.status || '';
    renderBoard(state.board || [], state.newFrom);
    var slot = 1;
    state.players.forEach(function (p) { if (p.isHero) renderHero(p); else renderSeat(p, slot++); });
  }

  var heroSig = '';
  function renderHero(p) {
    var box = $('hero-cards');
    var sig = (p.cards || []).map(function (c) { return c.r + c.s + (isHl(c) ? 'w' : ''); }).join(',') + '|' + p.status;
    if (sig !== heroSig) {
      var fresh = heroSig === '' || heroSig.split('|')[0] !== sig.split('|')[0];
      heroSig = sig; box.innerHTML = '';
      (p.cards || []).forEach(function (c, i) {
        var el = cardEl(c, { deal: fresh, delay: i * 160 });
        if (p.status === 'folded') el.classList.add('dimmed');
        box.appendChild(el);
      });
    }
    var info = $('hero-info');
    info.classList.toggle('active', !!p.active);
    info.classList.toggle('winner', !!p.winner);
    box.classList.toggle('winner', !!p.winner);
    info.innerHTML = '<span class="hero-name">' + escapeHtml(p.name) + '</span><span class="hero-stack">' + fmt(p.stack) + '</span><span class="hero-hand">' + escapeHtml(p.handName || (p.bet > 0 ? 'ставка ' + fmt(p.bet) : '')) + '</span>';
  }
  function resetTableCache() { boardSig = ''; heroSig = ''; seatEls = {}; $('seats').innerHTML = ''; $('board').innerHTML = ''; $('hero-cards').innerHTML = ''; }

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- панель действий ----------
  var locked = false;
  function renderActions(list, onAction) {
    locked = false; closeBet();
    var box = $('actions'); box.innerHTML = '';
    list.forEach(function (a, i) {
      var b = document.createElement('button');
      b.className = 'btn ' + (a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-danger' : 'btn-ghost');
      b.style.animationDelay = i * 40 + 'ms';
      b.innerHTML = a.label + (a.sub ? '<small>' + a.sub + '</small>' : '');
      b.addEventListener('click', function () {
        if (locked) return; // защита от двойных нажатий
        locked = true; box.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
        onAction(a.id);
      });
      box.appendChild(b);
    });
  }
  function lockActions() { locked = true; $('actions').querySelectorAll('button').forEach(function (x) { x.disabled = true; }); closeBet(); }
  function clearActions() { $('actions').innerHTML = ''; closeBet(); }

  // ---------- ставка ----------
  var betHandler = null;
  function openBet(cfg, onConfirm) {
    // cfg: { min, max, label, presets: [{label, value}] }. Значения всегда приводятся к целому в [min, max].
    var min = Math.max(1, Math.floor(cfg.min) || 1), max = Math.max(min, Math.floor(cfg.max) || min);
    var slider = $('bet-slider');
    slider.min = min; slider.max = max; slider.step = 1; slider.value = min;
    var clamp = function (v) { v = Math.floor(Number(v)); if (!isFinite(v)) v = min; return Math.min(max, Math.max(min, v)); };
    var show = function () { $('bet-value').textContent = fmt(clamp(slider.value)); $('bet-ok').textContent = cfg.label + ' ' + fmt(clamp(slider.value)); };
    slider.oninput = show;
    var quick = $('bet-quick'); quick.innerHTML = '';
    (cfg.presets || []).forEach(function (p) {
      var b = document.createElement('button'); b.textContent = p.label;
      b.addEventListener('click', function () { slider.value = clamp(p.value); show(); });
      quick.appendChild(b);
    });
    betHandler = function () { onConfirm(clamp(slider.value)); };
    locked = false; // нажатие «Raise» заблокировало кнопки действий; для окна ставки блокировка снимается
    show(); $('bet-box').hidden = false;
  }
  function closeBet() { $('bet-box').hidden = true; betHandler = null; }
  function initBetButtons(onCancel) {
    $('bet-ok').addEventListener('click', function () { if (betHandler && !locked) { var h = betHandler; locked = true; $('bet-box').hidden = true; h(); } });
    $('bet-cancel').addEventListener('click', function () {
      if (locked) return;
      closeBet(); $('actions').querySelectorAll('button').forEach(function (x) { x.disabled = false; }); onCancel && onCancel();
    });
  }

  // ---------- дилер ----------
  var dealerPoses = null, dealerEmos = {}, poseTimer = null;
  function setDealer(poses, emotions) { dealerPoses = poses; dealerEmos = emotions || {}; $('dealer-img').src = poses.idle; $('menu-dealer-img').src = poses.idle; }
  function dealerPose(name, ms) {
    var img = $('dealer-img'); if (!dealerPoses) return;
    clearTimeout(poseTimer);
    img.src = dealerPoses[name] || dealerPoses.idle;
    if (ms) poseTimer = setTimeout(function () { img.src = dealerPoses.idle; }, ms);
  }
  function dealerAnim(cls) {
    var img = $('dealer-img'); img.classList.remove('enter', 'nudge', 'accent'); void img.offsetWidth; img.classList.add(cls);
  }
  var bubbleTimer = null;
  // emotion — ключ портрета (smile, serious, surprise, joy, anger, sad, wink, shy); без него показывается только текст
  function dealerSay(text, ms, emotion) {
    var b = $('dealer-bubble'); b.textContent = ''; b.hidden = false;
    if (emotion && dealerEmos[emotion]) { var im = document.createElement('img'); im.src = dealerEmos[emotion]; im.alt = ''; im.draggable = false; b.appendChild(im); }
    var t = document.createElement('span'); t.textContent = text; b.appendChild(t); clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { b.hidden = true; }, ms || 2200);
  }
  function clearTimers() { clearTimeout(poseTimer); clearTimeout(bubbleTimer); clearTimeout(toastTimer); }

  // ---------- окна и уведомления ----------
  function openModal(title, node) {
    $('modal-title').textContent = title;
    var body = $('modal-body'); body.innerHTML = ''; body.appendChild(node); $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; }
  var toastTimer = null;
  function toast(msg) { var t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 2200); }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.toggle('active', s.id === id); });
  }

  root.RTUI = { $: $, fmt: fmt, escapeHtml: escapeHtml, cardEl: cardEl, renderTable: renderTable, resetTableCache: resetTableCache,
    renderActions: renderActions, lockActions: lockActions, clearActions: clearActions, openBet: openBet, closeBet: closeBet, initBetButtons: initBetButtons,
    setDealer: setDealer, dealerPose: dealerPose, dealerAnim: dealerAnim, dealerSay: dealerSay, clearTimers: clearTimers,
    openModal: openModal, closeModal: closeModal, toast: toast, showScreen: showScreen };
})(window);
