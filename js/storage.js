/* Сохранение прогресса в localStorage: версия, проверка данных, значения по умолчанию, миграции. */
(function (root) {
  'use strict';
  var KEY = 'royal-table-save';
  var VERSION = 2;

  function defaults() {
    return {
      v: VERSION,
      balance: 10000,
      level: 1,
      xp: 0,
      handsPlayed: 0,
      achievements: {},
      unlocked: [],
      equipped: { dealer: 'main-dealer', table: 'royal', back: 'royal', chips: 'classic' },
      settings: { sound: true, anim: 'normal', haptics: true },
      lastFreeRefill: 0,
      wins: 0,
      biggestPot: 0,
      lastHandId: '',      // id последней раздачи, по которой уже начислены награды (защита от повторов)
      pendingHand: null    // { id, committed } — раздача идёт; при перезагрузке внесённые фишки списываются
    };
  }

  function isObj(x) { return x && typeof x === 'object' && !Array.isArray(x); }
  function num(x, def, min) {
    return (typeof x === 'number' && isFinite(x) && x >= (min == null ? 0 : min)) ? Math.floor(x) : def;
  }
  function str(x, def) { return (typeof x === 'string' && x.length < 64) ? x : def; }

  // Приводит любые данные к корректной структуре. Повреждённые поля заменяются значениями по умолчанию.
  function sanitize(raw) {
    var d = defaults();
    if (!isObj(raw)) return d;
    var s = {
      v: VERSION,
      balance: num(raw.balance, d.balance),
      level: Math.max(1, num(raw.level, d.level)),
      xp: num(raw.xp, d.xp),
      handsPlayed: num(raw.handsPlayed, 0),
      achievements: {},
      unlocked: [],
      equipped: {},
      settings: {},
      lastFreeRefill: num(raw.lastFreeRefill, 0),
      wins: num(raw.wins, 0),
      biggestPot: num(raw.biggestPot, 0),
      lastHandId: str(raw.lastHandId, ''),
      pendingHand: null
    };
    if (isObj(raw.pendingHand) && typeof raw.pendingHand.id === 'string' && raw.pendingHand.id.length < 64) {
      s.pendingHand = { id: raw.pendingHand.id, committed: num(raw.pendingHand.committed, 0) };
    }
    if (isObj(raw.achievements)) {
      Object.keys(raw.achievements).forEach(function (k) {
        if (raw.achievements[k] === true || num(raw.achievements[k], 0) > 0) s.achievements[k] = raw.achievements[k];
      });
    }
    if (Array.isArray(raw.unlocked)) s.unlocked = raw.unlocked.filter(function (x) { return typeof x === 'string'; }).slice(0, 200);
    var e = isObj(raw.equipped) ? raw.equipped : {};
    Object.keys(d.equipped).forEach(function (k) { s.equipped[k] = str(e[k], d.equipped[k]); });
    var st = isObj(raw.settings) ? raw.settings : {};
    s.settings.sound = typeof st.sound === 'boolean' ? st.sound : d.settings.sound;
    s.settings.haptics = typeof st.haptics === 'boolean' ? st.haptics : d.settings.haptics;
    s.settings.anim = (st.anim === 'fast' || st.anim === 'off' || st.anim === 'normal') ? st.anim : d.settings.anim;
    return s;
  }

  // Миграции: migrations[n] переводит данные версии n в версию n+1.
  var migrations = {
    // v1 → v2: новые поля получают значения по умолчанию в sanitize; выбранная ранее косметика остаётся доступной
    1: function (raw) {
      var e = isObj(raw.equipped) ? raw.equipped : {}, u = Array.isArray(raw.unlocked) ? raw.unlocked.slice() : [];
      ['table', 'back'].forEach(function (c) { if (e[c] === 'onyx' && u.indexOf(c + ':onyx') < 0) u.push(c + ':onyx'); });
      raw.unlocked = u; raw.v = 2; return raw;
    }
  };
  function migrate(raw) {
    if (!isObj(raw)) return null;
    var v = typeof raw.v === 'number' ? raw.v : 0;
    if (v > VERSION) return null; // сохранение из будущей версии не трогаем
    while (v < VERSION) { if (migrations[v]) raw = migrations[v](raw); v++; }
    return raw;
  }

  function load() {
    var raw = null;
    try {
      var text = root.localStorage && root.localStorage.getItem(KEY);
      if (text) raw = JSON.parse(text);
    } catch (e) { raw = null; }
    return sanitize(migrate(raw));
  }

  function save(data) {
    try { root.localStorage.setItem(KEY, JSON.stringify(sanitize(data))); return true; }
    catch (e) { return false; }
  }

  root.RTStorage = { KEY: KEY, VERSION: VERSION, defaults: defaults, sanitize: sanitize, migrate: migrate, load: load, save: save };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RTStorage;
})(typeof window !== 'undefined' ? window : globalThis);
