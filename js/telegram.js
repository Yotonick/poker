/* Интеграция с Telegram Mini App. Игра полностью работает и без Telegram. */
(function (root) {
  'use strict';
  var tg = root.Telegram && root.Telegram.WebApp ? root.Telegram.WebApp : null;

  function setVar(name, v) { document.documentElement.style.setProperty(name, v); }

  function applyViewport() {
    var h = tg && tg.viewportStableHeight ? tg.viewportStableHeight : null;
    setVar('--vh', h ? h + 'px' : '100dvh');
    var sa = tg && tg.safeAreaInset, ca = tg && tg.contentSafeAreaInset;
    var top = (sa && sa.top || 0) + (ca && ca.top || 0);
    var bottom = (sa && sa.bottom || 0) + (ca && ca.bottom || 0);
    setVar('--tg-safe-top', top + 'px');
    setVar('--tg-safe-bottom', bottom + 'px');
  }

  function init() {
    if (!tg) { applyViewport(); return false; }
    try {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); // чтобы свайп не закрывал игру
      if (tg.setHeaderColor) tg.setHeaderColor('#120709');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0c0507');
      applyViewport();
      if (tg.onEvent) {
        tg.onEvent('viewportChanged', applyViewport);
        tg.onEvent('safeAreaChanged', applyViewport);
        tg.onEvent('contentSafeAreaChanged', applyViewport);
      }
    } catch (e) { applyViewport(); }
    return true;
  }

  // Данные Telegram приходят от клиента и НЕ считаются доверенными: используем только для отображения.
  function user() { return tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user : null; }
  function haptic(kind) {
    try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(kind || 'light'); } catch (e) {}
  }

  root.RTTelegram = { init: init, user: user, haptic: haptic, isTelegram: function () { return !!tg; } };
})(window);
