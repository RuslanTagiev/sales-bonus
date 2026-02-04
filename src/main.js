function calculateSimpleRevenue(item, product) {
  const discount = item.discount || 0;
  // Выручка: цена продажи * количество * (1 - скидка в процентах)
  return item.sale_price * item.quantity * (1 - discount / 100);
}

/**
 * 2. Расчёт бонуса продавца на основе его места в рейтинге прибыли.
 * @param {number} index - место в рейтинге (от 0)
 * @param {number} total - общее количество продавцов
 * @param {Object} seller - объект статистики продавца
 * @returns {number} - сумма бонуса в рублях
 */
function calculateBonusByProfit(index, total, seller) {
  const profit = seller.profit;

  if (index === 0) {
    return profit * 0.15; // 1-е место
  } else if (index === 1 || index === 2) {
    return profit * 0.10; // 2-е и 3-е места
  } else if (index === total - 1 && total > 1) {
    return 0; // Последнее место
  } else {
    return profit * 0.05; // Все остальные
  }
}

/**
 * 3. Основная функция анализа данных.
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных на существование и пустоту
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // Проверка наличия функций в опциях
  if (!options || typeof options.calculateRevenue !== "function" || typeof options.calculateBonus !== "function") {
    throw new Error("Некорректные опции");
  }

  const { calculateRevenue, calculateBonus } = options;
  
  // Создаем индекс товаров по SKU для быстрого поиска цен закупки
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // Шаг 3: Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    salesCount: 0,
    productsSold: {} // Словарь: { sku: quantity }
  }));

  // Шаг 4: Индекс для быстрого доступа к объектам статистики по ID продавца
  const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));

  // Шаг 5: Обработка транзакций (чеков)
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.salesCount += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;

        seller.revenue += itemRevenue;
        seller.profit += (itemRevenue - cost);

        // Учёт количества проданных товаров
        if (!seller.productsSold[item.sku]) {
          seller.productsSold[item.sku] = 0;
        }
        seller.productsSold[item.sku] += item.quantity;
      }
    });
  });

  // Шаг 6: Упорядочивание продавцов по прибыли (убывание)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 7: Формирование финального отчёта
  return sellerStats.map((seller, index) => {
    // Назначаем премии и формируем топ-10 товаров
    const bonusValue = calculateBonus(index, sellerStats.length, seller);

    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);

    // Вспомогательная функция округления
    const round = (num) => Math.round(num * 100) / 100;

    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: round(seller.revenue),
      profit: round(seller.profit),
      sales_count: seller.salesCount,
      top_products: topProducts,
      bonus: round(bonusValue)
    };
  });
}