/**
 * Валидация входных данных
 */
function validate(data, options) {
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records)
  ) {
    throw new Error("Некорректные входные данные");
  }

  const { calculateRevenue, calculateBonus } = options || {};

  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  return { calculateRevenue, calculateBonus };
}

/**
 * Округление до 2 знаков (стандартный метод)
 */
const roundToTwo = (num) => Math.round(num * 100) / 100;

/**
 * Расчет выручки (эталонная реализация)
 */
function calculateSimpleRevenue(item, product) {
  const discount = item.discount || 0;
  return item.sale_price * item.quantity * (1 - discount / 100);
}

/**
 * Расчет бонуса
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (total > 1 && index === total - 1) return 0;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  return profit * 0.05;
}

/**
 * Основная функция анализа
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = validate(data, options);

  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));
  
  // Создаем структуру для сбора статистики
  const stats = Object.fromEntries(
    data.sellers.map((s) => [
      s.id,
      {
        id: s.id,
        name: `${s.first_name} ${s.last_name}`,
        revenue: 0,
        profit: 0,
        salesCount: 0,
        productsSold: {},
      },
    ])
  );

  // Обработка транзакций
  data.purchase_records.forEach((record) => {
    const seller = stats[record.seller_id];
    if (!seller) return;

    seller.salesCount += 1;

    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;

        // ВАЖНО: Суммируем выручку именно из функции calculateRevenue
        seller.revenue += itemRevenue;
        seller.profit += itemRevenue - cost;
        
        seller.productsSold[item.sku] = (seller.productsSold[item.sku] || 0) + item.quantity;
      }
    });
  });

  // Рейтинг по прибыли (убывание)
  const rankedSellers = Object.values(stats).sort((a, b) => b.profit - a.profit);

  return rankedSellers.map((seller, index) => {
    const bonusValue = calculateBonus(index, rankedSellers.length, seller);

    // Сортировка топ-10: сначала количество (desc), потом SKU (asc)
    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);

    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: roundToTwo(seller.revenue),
      profit: roundToTwo(seller.profit),
      sales_count: seller.salesCount,
      top_products: topProducts,
      bonus: roundToTwo(bonusValue),
    };
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { validate, calculateSimpleRevenue, calculateBonusByProfit, analyzeSalesData };
}