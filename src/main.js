/**
 * Расчет выручки для одной позиции (Чистая функция)
 * @param {Object} item - Товар из чека (sku, discount, quantity, sale_price)
 * @param {Object} product - Товар из каталога (для получения purchase_price, если нужно)
 * @returns {number}
 */
function calculateSimpleRevenue(item, product) {
  const discount = item.discount || 0;
  return item.sale_price * item.quantity * (1 - discount / 100);
}

/**
 * Расчет бонуса (Чистая функция)
 * @param {number} index - Место в рейтинге (0 - первое)
 * @param {number} total - Общее кол-во продавцов
 * @param {Object} seller - Объект со статистикой (должен содержать profit)
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  const profit = seller.profit || 0;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1 && total > 1) return 0;
  return profit * 0.05;
}

/**
 * Основная функция анализа данных продаж
 * @param {Object} data - Весь объект данных (sellers, products, и т.д.)
 * @param {Object} options - Объект с функциями расчета
 */
function analyzeSalesData(data, options) {
  // 1. Валидация входных данных (включая проверку на пустые массивы)
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // 2. Проверка опций
  const { calculateRevenue, calculateBonus } = options || {};
  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("Некорректные опции");
  }

  // Вспомогательная функция для округления (внутренняя)
  const round = (num) => Math.round(num * 100) / 100;

  // 3. Индексация товаров для быстрого доступа
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // 4. Подготовка структуры статистики (Mapping)
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    salesCount: 0,
    productsSold: {}
  }));

  // Индекс для связи чеков со статистикой
  const sellerStatsIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));

  // 5. Обработка транзакций (Reduce/ForEach)
  data.purchase_records.forEach(record => {
    const currentSeller = sellerStatsIndex[record.seller_id];
    if (!currentSeller) return;

    currentSeller.salesCount += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        // Используем переданную в опциях чистую функцию
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;

        currentSeller.revenue += itemRevenue;
        currentSeller.profit += (itemRevenue - cost);

        // Учет количества товаров
        if (!currentSeller.productsSold[item.sku]) {
          currentSeller.productsSold[item.sku] = 0;
        }
        currentSeller.productsSold[item.sku] += item.quantity;
      }
    });
  });

  // 6. Сортировка по прибыли (Ranking)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // 7. Формирование финального отчета
  return sellerStats.map((seller, index) => {
    // Расчет бонуса через чистую функцию из опций
    const bonusAmount = calculateBonus(index, sellerStats.length, seller);

    // Топ-10 товаров (сортировка по кол-ву, затем по SKU)
    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);

    // Возврат объекта в строгом соответствии с форматом ТЗ
    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: round(seller.revenue),
      profit: round(seller.profit),
      sales_count: seller.salesCount,
      top_products: topProducts,
      bonus: round(bonusAmount)
    };
  });
}