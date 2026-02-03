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
    throw new Error("опция не является объектом");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  return { calculateRevenue, calculateBonus };
}

/**
 * Шаг 1. Реализация функции расчёта выручки (бизнес-логика)
 */
function calculateSimpleRevenue(purchase, _product) {
  // Коэффициент для расчета суммы без скидки
  const discount = 1 - (purchase.discount / 100);
  // Формула: sale_price × количество × скидка
  return purchase.sale_price * purchase.quantity * discount;
}

/**
 * Шаг 3. Реализация функции расчёта бонусов (бизнес-логика)
 */
function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  
  if (index === 0) {
    return profit * 0.15; // 15% — первое место
  } else if (index === 1 || index === 2) {
    return profit * 0.10; // 10% — второе и третье место
  } else if (index === total - 1) {
    return 0;             // 0% — последнее место
  } else {
    return profit * 0.05; // 5% — остальные
  }
}

/**
 * Главная функция анализа данных продаж
 */
function analyzeSalesData(data, options) {
  // Получаем функции из валидации
  const { calculateRevenue, calculateBonus } = validate(data, options);

  // Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // Индексация для быстрого доступа
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));
  
  // Шаг 1. Двойной цикл перебора чеков и покупок
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (seller) {
      // Число продаж на 1
      seller.sales_count += 1;
      // Выручка на общую сумму чека total_amount
      seller.revenue += record.total_amount; 

      record.items.forEach(item => {
        const product = productIndex[item.sku];
        if (product) {
          // Себестоимость товара
          const cost = product.purchase_price * item.quantity;
          // Выручка позиции через функцию calculateRevenue
          const itemRevenue = calculateRevenue(item, product);
          // Прибыль позиции
          const itemProfit = itemRevenue - cost;
          
          // Накапливаем общую прибыль продавца
          seller.profit += itemProfit;

          // Учёт количества проданных товаров (динамический словарь)
          if (!seller.products_sold[item.sku]) {
            seller.products_sold[item.sku] = 0;
          }
          seller.products_sold[item.sku] += item.quantity;
        }
      });
    }
  });

  // Шаг 2. Сортировка продавцов по прибыли (от большего к меньшему)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 3. Назначение премий и формирование топ-10 продуктов
  sellerStats.forEach((seller, index) => {
    // Считаем бонус
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    // Формируем топ-10 товаров
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      // Сортировка по количеству (DESC) + по SKU (ASC) для стабильности тестов
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);
  });

  // Шаг 4. Формирование итогового отчёта
  return sellerStats.map(seller => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
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
