/**
 * Валидация входных данных и опций
 */
function validate(data, options) {
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  if (!options || typeof options !== "object") {
    throw new Error("Опции не являются объектом");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  return { calculateRevenue, calculateBonus };
}

/**
 * Расчет выручки от конкретной позиции в чеке
 */
function calculateSimpleRevenue(purchase) {
  const discountPercent = purchase.discount || 0;
  const discountFactor = 1 - (discountPercent / 100);
  
  return purchase.sale_price * purchase.quantity * discountFactor;
}

/**
 * Расчет бонуса на основе прибыли и позиции в рейтинге
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  // Если продавец единственный, он получает 15%. Если их двое, последний получает 0.
  if (total > 1 && index === total - 1) {
    return 0;
  }

  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;

  return profit * 0.05;
}

/**
 * Основная функция анализа данных о продажах
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = validate(data, options);

  // Подготовка данных: создаем массив объектов для статистики
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    salesCount: 0,
    productsSold: {},
  }));

  // Индексация для быстрого доступа O(1)
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  // Шаг 1. Обработка записей о покупках
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    
    if (seller) {
      seller.salesCount += 1;
      seller.revenue += record.total_amount;

      record.items.forEach((item) => {
        const product = productIndex[item.sku];
        
        if (product) {
          const cost = product.purchase_price * item.quantity;
          const itemRevenue = calculateRevenue(item, product);
          const itemProfit = itemRevenue - cost;

          seller.profit += itemProfit;

          if (!seller.productsSold[item.sku]) {
            seller.productsSold[item.sku] = 0;
          }
          seller.productsSold[item.sku] += item.quantity;
        }
      });
    }
  });

  // Шаг 2. Сортировка продавцов по прибыли (от большего к меньшему)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 3. Расчет бонусов и топ-товаров
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);
  });

  // Шаг 4. Формирование итогового отчета с округлением
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.salesCount,
    top_products: seller.topProducts,
    bonus: +seller.bonus.toFixed(2)
  }));
}

// Экспорт для Node.js среды (Jest)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validate,
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData
  };
}