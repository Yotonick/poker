/* Прогресс и экономика: XP, уровни, достижения, награды за раздачу, бесплатное пополнение, покупки.
   Без DOM. Все награды за раздачу начисляются ровно один раз (по id раздачи, см. save.lastHandId). */
(function (root) {
  'use strict';
  var REFILL_BELOW = 1000, REFILL_TO = 3000, REFILL_COOLDOWN = 30 * 60 * 1000;

  var xpNeeded = function (level) { return 100 + (level - 1) * 50; };

  // ctx: { won, cat (категория руки на вскрытии, -1 если вскрытия не было), name, pot, net, allin, handsPlayed, wins, level }
  var ACHIEVEMENTS = [
    { id: 'first_win',  title: 'Первая победа',     desc: 'Выиграйте раздачу.',                      test: function (c) { return c.wins >= 1; } },
    { id: 'hands_10',   title: 'Гость клуба',       desc: 'Сыграйте 10 раздач.',                     test: function (c) { return c.handsPlayed >= 10; } },
    { id: 'hands_100',  title: 'Завсегдатай',       desc: 'Сыграйте 100 раздач.',                    test: function (c) { return c.handsPlayed >= 100; } },
    { id: 'flush',      title: 'Масть пошла',       desc: 'Выиграйте на вскрытии с флешем или выше.', test: function (c) { return c.won && c.cat >= 5; } },
    { id: 'full_house', title: 'Полный дом',        desc: 'Выиграйте с фулл-хаусом или выше.',       test: function (c) { return c.won && c.cat >= 6; } },
    { id: 'quads',      title: 'Каре',              desc: 'Выиграйте с каре или выше.',              test: function (c) { return c.won && c.cat >= 7; } },
    { id: 'royal',      title: 'Королевский взгляд', desc: 'Соберите роял-флеш и выиграйте.',         test: function (c) { return c.won && c.name === 'Роял-флеш'; } },
    { id: 'allin_win',  title: 'Ва-банк!',          desc: 'Выиграйте раздачу, пойдя all-in.',        test: function (c) { return c.won && c.allin; } },
    { id: 'big_pot',    title: 'Крупный куш',       desc: 'Выиграйте 5 000 фишек за одну раздачу.',  test: function (c) { return c.won && c.net >= 5000; } },
    { id: 'level_5',    title: 'Уровень 5',         desc: 'Достигните 5 уровня.',                    test: function (c) { return c.level >= 5; } }
  ];

  // Один раз при загрузке: если игра закрыта посреди раздачи, внесённые в банк фишки считаются проигранными.
  function resolvePending(save) {
    var p = save.pendingHand;
    if (!p) return false;
    save.balance = Math.max(0, save.balance - Math.min(p.committed, save.balance));
    save.pendingHand = null;
    return true;
  }

  // Вызывается при каждом изменении вклада героя в раздаче (дёшево: только поля в памяти + persist вызывает вызывающий).
  function markHand(save, handId, committed) { save.pendingHand = { id: handId, committed: Math.max(0, Math.floor(committed)) }; }

  // Итог раздачи. res: { handId, finalStack, net, won, cat, name, pot, allin }
  function applyHandResult(save, res) {
    if (!res || !res.handId || save.lastHandId === res.handId) return { applied: false };
    save.lastHandId = res.handId;
    save.pendingHand = null;
    save.balance = Math.max(0, Math.floor(res.finalStack));
    save.handsPlayed += 1;
    if (res.won) { save.wins += 1; if (res.net > save.biggestPot) save.biggestPot = Math.floor(res.net); }
    var xp = 10 + (res.won ? 20 + Math.max(0, res.cat) * 2 : 0);
    var out = { applied: true, xpGain: 0, levels: [], levelBonus: 0, achievements: [] };
    var ctx = { won: !!res.won, cat: res.cat == null ? -1 : res.cat, name: res.name || '', pot: res.pot || 0, net: res.net || 0, allin: !!res.allin,
      handsPlayed: save.handsPlayed, wins: save.wins, level: save.level };
    // достижения и повышение уровня считаем до тех пор, пока что-то меняется (уровень может открыть достижение)
    var changed = true; save.xp += xp; out.xpGain = xp;
    while (changed) {
      changed = false;
      while (save.xp >= xpNeeded(save.level)) { save.xp -= xpNeeded(save.level); save.level += 1; out.levels.push(save.level); out.levelBonus += 250 * save.level; changed = true; }
      ctx.level = save.level;
      ACHIEVEMENTS.forEach(function (a) {
        if (!save.achievements[a.id] && a.test(ctx)) { save.achievements[a.id] = true; out.achievements.push(a.id); save.xp += 50; out.xpGain += 50; changed = true; }
      });
    }
    save.balance += out.levelBonus;
    return out;
  }

  function refillState(save, now) {
    var last = Math.min(save.lastFreeRefill, now), wait = Math.max(0, REFILL_COOLDOWN - (now - last));
    var eligible = save.balance < REFILL_BELOW;
    return { available: eligible && wait === 0, eligible: eligible, waitMs: eligible ? wait : 0, amount: Math.max(0, REFILL_TO - save.balance) };
  }
  function refill(save, now) {
    var st = refillState(save, now);
    if (!st.available) return 0;
    save.balance = REFILL_TO; save.lastFreeRefill = now;
    return st.amount;
  }

  // Покупка косметики. C — RTCollections.
  function buy(save, C, item) {
    if (!item || C.isUnlocked(item, save)) return { ok: false, reason: 'owned' };
    if (save.balance < item.cost) return { ok: false, reason: 'funds' };
    save.balance -= item.cost; save.unlocked.push(item.category + ':' + item.id);
    return { ok: true };
  }

  var P = { REFILL_BELOW: REFILL_BELOW, REFILL_TO: REFILL_TO, REFILL_COOLDOWN: REFILL_COOLDOWN, ACHIEVEMENTS: ACHIEVEMENTS,
    xpNeeded: xpNeeded, resolvePending: resolvePending, markHand: markHand, applyHandResult: applyHandResult, refillState: refillState, refill: refill, buy: buy };
  root.RTProgress = P;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : globalThis);
