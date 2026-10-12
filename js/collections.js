/* Каталог косметики. Не влияет на результаты раздач.
   Поля предмета: id, name, category, rarity, desc, cost, unlock (условие), image (для дилеров).
   Предмет с cost > 0 покупается за фишки (RTProgress.buy) и попадает в save.unlocked как 'категория:id'. */
(function (root) {
  'use strict';
  var CATEGORIES = [
    { id: 'dealer', title: 'Дилеры' },
    { id: 'table', title: 'Столы' },
    { id: 'back', title: 'Рубашки' },
    { id: 'chips', title: 'Фишки' }
  ];

  var D = 'assets/dealers/';
  var ITEMS = [
    { id: 'main-dealer', category: 'dealer', name: 'Роза', rarity: 'common', desc: 'Главный дилер клуба ROYAL TABLE.', cost: 0, unlock: 'default',
      image: D + 'main-dealer.webp',
      poses: { idle: D + 'main-dealer.webp', deal: D + 'pose-deal.webp', think: D + 'pose-think.webp', win: D + 'pose-win.webp', lose: D + 'pose-lose.webp' },
      emotions: { smile: D + 'emo-smile.webp', serious: D + 'emo-serious.webp', surprise: D + 'emo-surprise.webp', joy: D + 'emo-joy.webp', anger: D + 'emo-anger.webp', sad: D + 'emo-sad.webp', wink: D + 'emo-wink.webp', shy: D + 'emo-shy.webp' } },
    { id: 'royal', category: 'table', name: 'Бордо', rarity: 'common', desc: 'Бархат цвета выдержанного вина.', cost: 0, unlock: 'default' },
    { id: 'onyx', category: 'table', name: 'Оникс', rarity: 'rare', desc: 'Графитовое сукно с золотой нитью.', cost: 3000, unlock: 'shop' },
    { id: 'royal', category: 'back', name: 'Бордо', rarity: 'common', desc: 'Классическая рубашка клуба.', cost: 0, unlock: 'default' },
    { id: 'onyx', category: 'back', name: 'Оникс', rarity: 'rare', desc: 'Чёрная рубашка с золотым узором.', cost: 2000, unlock: 'shop' },
    { id: 'noir', category: 'table', name: 'Нуар', rarity: 'epic', desc: 'Глубокий чёрный бархат с золотой окантовкой.', cost: 6000, unlock: 'shop' },
    { id: 'gold', category: 'back', name: 'Золото', rarity: 'epic', desc: 'Золотая рубашка с бордовым узором.', cost: 4000, unlock: 'shop' },
    { id: 'classic', category: 'chips', name: 'Классика', rarity: 'common', desc: 'Золотые фишки клуба.', cost: 0, unlock: 'default' },
    { id: 'onyx', category: 'chips', name: 'Оникс', rarity: 'rare', desc: 'Чёрные фишки с золотым кантом.', cost: 1500, unlock: 'shop' },
    { id: 'ivory', category: 'chips', name: 'Слоновая кость', rarity: 'rare', desc: 'Светлые фишки с бордовым кантом.', cost: 1500, unlock: 'shop' }
  ];

  function byCategory(cat) { return ITEMS.filter(function (i) { return i.category === cat; }); }
  function get(cat, id) {
    var list = byCategory(cat);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return list[0] || null; // запасной вариант, если сохранён неизвестный id
  }
  function isUnlocked(item, save) {
    return item.cost === 0 || item.unlock === 'default' || (save.unlocked || []).indexOf(item.category + ':' + item.id) !== -1;
  }
  var RARITY = { common: 'Обычный', rare: 'Редкий', epic: 'Эпический', legendary: 'Легендарный' };

  root.RTCollections = { CATEGORIES: CATEGORIES, ITEMS: ITEMS, RARITY: RARITY, byCategory: byCategory, get: get, isUnlocked: isUnlocked };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.RTCollections;
})(typeof window !== 'undefined' ? window : globalThis);
