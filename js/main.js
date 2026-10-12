/* Точка входа: навигация, настройки, коллекция, профиль, бесплатное пополнение. Игра за столом — js/game.js. */
(function () {
  'use strict';
  var UI = window.RTUI, S = window.RTStorage, C = window.RTCollections, P = window.RTProgress, $ = UI.$;
  var save = S.load();
  if (P.resolvePending(save)) S.save(save); // игра была закрыта посреди раздачи: внесённые фишки списаны
  var app = $('app');

  function persist() { S.save(save); }

  // ---------- применение настроек и косметики ----------
  function applyAppearance() {
    app.dataset.anim = save.settings.anim;
    ['table', 'back', 'dealer', 'chips'].forEach(function (cat) { // недоступный предмет заменяется стандартным
      var it = C.get(cat, save.equipped[cat]);
      if (!C.isUnlocked(it, save)) { it = C.byCategory(cat)[0]; save.equipped[cat] = it.id; }
    });
    app.dataset.table = save.equipped.table;
    app.dataset.back = save.equipped.back;
    app.dataset.chips = save.equipped.chips;
    var dealer = C.get('dealer', save.equipped.dealer);
    UI.setDealer(dealer.poses, dealer.emotions);
  }
  var xpNeeded = P.xpNeeded;
  function renderMenu() {
    $('menu-balance').textContent = UI.fmt(save.balance);
    $('menu-level').textContent = save.level;
    $('menu-xp-bar').style.width = Math.min(100, save.xp / xpNeeded(save.level) * 100) + '%';
    var rs = P.refillState(save, Date.now()), rb = $('btn-refill');
    rb.hidden = !rs.eligible;
    rb.disabled = !rs.available;
    rb.textContent = rs.available ? 'Бесплатные фишки +' + UI.fmt(rs.amount) : 'Фишки через ' + Math.ceil(rs.waitMs / 60000) + ' мин';
  }

  // ---------- окна ----------
  function settingsView() {
    var wrap = document.createElement('div');
    function toggleRow(title, sub, key) {
      var row = document.createElement('div'); row.className = 'row';
      row.innerHTML = '<div>' + title + '<small>' + sub + '</small></div>';
      var sw = document.createElement('button'); sw.className = 'switch'; sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', String(save.settings[key]));
      sw.addEventListener('click', function () {
        save.settings[key] = !save.settings[key]; sw.setAttribute('aria-checked', String(save.settings[key])); persist();
      });
      row.appendChild(sw); wrap.appendChild(row);
    }
    toggleRow('Звук', 'Звуковые эффекты стола', 'sound');
    toggleRow('Вибрация', 'Отклик в Telegram на нажатия', 'haptics');
    var row = document.createElement('div'); row.className = 'row';
    row.innerHTML = '<div>Анимации<small>Скорость игровых эффектов</small></div>';
    var group = document.createElement('div'); group.style.cssText = 'display:flex;gap:6px';
    [['normal', 'Обычно'], ['fast', 'Быстро'], ['off', 'Выкл']].forEach(function (o) {
      var b = document.createElement('button'); b.className = 'btn btn-ghost'; b.style.cssText = 'min-height:40px;padding:0 10px;font-size:13px';
      b.textContent = o[1];
      var paint = function () { b.className = 'btn ' + (save.settings.anim === o[0] ? 'btn-primary' : 'btn-ghost'); };
      paint();
      b.addEventListener('click', function () {
        save.settings.anim = o[0]; persist(); applyAppearance();
        group.childNodes.forEach(function (x, i) { x.className = 'btn ' + (['normal', 'fast', 'off'][i] === o[0] ? 'btn-primary' : 'btn-ghost'); });
      });
      group.appendChild(b);
    });
    row.appendChild(group); wrap.appendChild(row);
    return wrap;
  }

  function collectionView() {
    var wrap = document.createElement('div');
    function paint() {
      wrap.innerHTML = '';
      C.CATEGORIES.forEach(function (cat) {
        var h = document.createElement('div'); h.className = 'tag'; h.textContent = cat.title; h.style.margin = '8px 0'; wrap.appendChild(h);
        C.byCategory(cat.id).forEach(function (item) {
          var equipped = save.equipped[cat.id] === item.id;
          var el = document.createElement('div'); el.className = 'card-item';
          var PV = { back: { royal: 'linear-gradient(160deg,var(--wine-500),var(--wine-900))', onyx: 'linear-gradient(160deg,#2b272c,#0d0b0d)', gold: 'linear-gradient(160deg,var(--gold-300),var(--gold-500))' },
            table: { royal: 'radial-gradient(var(--wine-500),var(--wine-900))', onyx: 'radial-gradient(#3a343a,#0b090b)', noir: 'radial-gradient(var(--bg-2),var(--bg-0))' },
            chips: { classic: 'radial-gradient(circle at 35% 30%,var(--gold-300),var(--gold-500))', onyx: 'radial-gradient(circle at 35% 30%,#4a444a,var(--graphite))', ivory: 'radial-gradient(circle at 35% 30%,var(--ivory),var(--text-dim))' } };
          var bg = PV[cat.id] && PV[cat.id][item.id] || 'var(--graphite)';
          var preview = item.image ? '<img src="' + item.image + '" alt="">' : (cat.id === 'chips'
            ? '<div style="width:64px;height:64px;border-radius:50%;margin:10px 0;border:3px dashed var(--gold-400);background:' + bg + '"></div>'
            : '<div style="width:64px;height:84px;border-radius:8px;border:2px solid var(--gold-500);background:' + bg + '"></div>');
          el.innerHTML = preview + '<div><span class="tag">' + C.RARITY[item.rarity] + '</span><div><b>' + UI.escapeHtml(item.name) + '</b></div><small style="color:var(--text-dim)">' + UI.escapeHtml(item.desc) + '</small></div>';
          var btn = document.createElement('button'); btn.className = 'btn ' + (equipped ? 'btn-ghost' : 'btn-primary'); btn.style.minHeight = '44px';
          var owned = C.isUnlocked(item, save);
          btn.textContent = equipped ? 'Выбрано' : owned ? 'Выбрать' : 'Купить ' + UI.fmt(item.cost);
          btn.disabled = equipped;
          btn.addEventListener('click', function () {
            if (!owned) {
              var r = P.buy(save, C, item);
              if (!r.ok) { UI.toast('Не хватает фишек'); return; }
              persist(); renderMenu(); UI.toast('Куплено: ' + item.name);
            }
            save.equipped[cat.id] = item.id; persist(); applyAppearance(); paint();
          });
          el.appendChild(btn); wrap.appendChild(el);
        });
      });
    }
    paint(); return wrap;
  }

  function profileView() {
    var wrap = document.createElement('div');
    var u = window.RTTelegram.user();
    var name = u && (u.first_name || u.username) ? UI.escapeHtml(u.first_name || u.username) : 'Игрок';
    wrap.innerHTML = '<div class="row"><div><b style="font-size:18px">' + name + '</b><small>Уровень ' + save.level + ' · ' + save.xp + ' / ' + xpNeeded(save.level) + ' XP</small></div></div>' +
      '<div class="stat-grid" style="margin-top:12px"><div class="stat"><b>' + UI.fmt(save.balance) + '</b><span>Фишек</span></div><div class="stat"><b>' + save.handsPlayed + '</b><span>Сыграно раздач</span></div></div>' +
      '<div class="stat-grid" style="margin-top:10px"><div class="stat"><b>' + save.wins + '</b><span>Побед</span></div><div class="stat"><b>' + UI.fmt(save.biggestPot) + '</b><span>Лучший выигрыш</span></div></div>' +
      '<div class="tag" style="margin:16px 0 4px">Достижения</div>' +
      P.ACHIEVEMENTS.map(function (a) {
        var got = !!save.achievements[a.id];
        return '<div class="row" style="opacity:' + (got ? 1 : .5) + '"><div><b>' + UI.escapeHtml(a.title) + '</b><small>' + UI.escapeHtml(a.desc) + '</small></div><span style="color:var(--gold-300);font-size:20px">' + (got ? '★' : '☆') + '</span></div>';
      }).join('');
    return wrap;
  }

  function openPanel(kind) {
    if (kind === 'settings') UI.openModal('Настройки', settingsView());
    else if (kind === 'collection') UI.openModal('Коллекция', collectionView());
    else if (kind === 'profile') UI.openModal('Профиль', profileView());
  }

  // ---------- навигация ----------
  function goMenu() { game.stop(); UI.clearTimers(); UI.closeModal(); renderMenu(); UI.showScreen('screen-menu'); }
  function goGame() { UI.closeModal(); UI.showScreen('screen-game'); UI.resetTableCache(); game.start(); }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-action]'); if (!t) return;
    var a = t.dataset.action;
    if (save.settings.haptics) window.RTTelegram.haptic('light');
    window.RTSound.unlock();
    if (a === 'play') goGame();
    else if (a === 'refill') { var got = P.refill(save, Date.now()); if (got) { persist(); UI.toast('Получено ' + UI.fmt(got) + ' фишек'); } renderMenu(); }
    else if (a === 'exit') goMenu();
    else openPanel(a);
  });
  $('modal-close').addEventListener('click', UI.closeModal);
  $('modal').addEventListener('click', function (e) { if (e.target === $('modal')) UI.closeModal(); });

  // Свернули Telegram и вернулись: просто пересчитываем высоту, состояние раздачи не теряется.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) window.dispatchEvent(new Event('resize')); });

  var game = window.RTGame.create({ save: save, persist: persist, haptic: window.RTTelegram.haptic, onExit: goMenu });

  // Закрытие страницы посреди раздачи: раздача доигрывается мгновенно (герой сбрасывает карты), итог сохраняется один раз.
  window.addEventListener('pagehide', function () { game.stop(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  UI.initBetButtons();
  window.RTTelegram.init();
  applyAppearance();
  renderMenu();
})();
