/**
 * Валидация входных данных
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
    throw new Error("опция не является объектом");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  return { calculateRevenue, calculateBonus };
}

//  Этап 3. Реализация бизнес-логики

/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  // Коэффициент для расчета суммы без скидки
  const discount = 1 - (purchase.discount / 100);
  // Формула: sale_price × количество × скидка
  return purchase.sale_price * purchase.quantity * discount;
  // @TODO: Расчет выручки от операции
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  // @TODO: Расчет бонуса от позиции в рейтинге
  const { profit } = seller;
  if (index === 0) {
    return profit * 0.15; // 15%
  } else if (index === 1 || index === 2) {
    return profit * 0.10; // 10%
  } else if (index === total - 1) {
    return 0;             // 0%
  } else {
    return profit * 0.05; // 5%
  }
}

/**
 * Функция для анализа данных продаж
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = validate(data, options);

  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));
  
  // Шаг 1. Двойной цикл
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (seller) {
      seller.sales_count += 1;
      // Выручка на общую сумму чека total_amount
      seller.revenue += record.total_amount; 

      record.items.forEach(item => {
        const product = productIndex[item.sku];
        if (product) {
          const cost = product.purchase_price * item.quantity;
          const itemRevenue = calculateRevenue(item, product);
          
          seller.profit += (itemRevenue - cost);

          if (!seller.products_sold[item.sku]) {
            seller.products_sold[item.sku] = 0;
          }
          seller.products_sold[item.sku] += item.quantity;
        }
      });
    }
  });

  // Шаг 2. Сортировка по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 3. Бонусы и Топ-10
  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);
  });

  // Шаг 4. Финальное округление
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validate,
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData
  };
}
