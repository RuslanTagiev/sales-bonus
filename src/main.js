/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const discount = purchase.discount || 0;
  return purchase.sale_price * purchase.quantity * (1 - discount / 100);
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
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
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {Array}
 */
function analyzeSalesData(data, options) {
  // ===== проверки (строго под тесты) =====
  if (!options || typeof options !== 'object') {
    throw new Error('Invalid options');
  }

  if (!data) throw new Error('No data');
  if (!Array.isArray(data.sellers)) throw new Error('No sellers');
  if (!Array.isArray(data.products)) throw new Error('No products');
  if (!Array.isArray(data.purchase_records)) throw new Error('No purchase_records');

  if (!data.sellers.length) throw new Error('Empty sellers');
  if (!data.products.length) throw new Error('Empty products');
  if (!data.purchase_records.length) throw new Error('Empty purchase_records');

  const { calculateRevenue, calculateBonus } = options;
  if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
    throw new Error('Invalid options');
  }

  const round = (n) => Math.round(n * 100) / 100;

  // ===== индексация товаров =====
  const productIndex = Object.fromEntries(
    data.products.map(p => [p.sku, p])
  );

  // ===== подготовка продавцов =====
  const sellerStats = data.sellers.map(seller => ({
    seller_id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    productsSold: {}
  }));

  const sellerIndex = Object.fromEntries(
    sellerStats.map(s => [s.seller_id, s])
  );

  // ===== расчет =====
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    // В тестах sales_count — это количество чеков
    seller.sales_count += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;

      // 🔴 округляем КАЖДУЮ операцию
      const revenue = round(calculateRevenue(item, product));
      const cost = round(product.purchase_price * item.quantity);

      seller.revenue += revenue;
      seller.profit += revenue - cost;

      seller.productsSold[item.sku] =
        (seller.productsSold[item.sku] || 0) + item.quantity;
    });
  });

  // ===== сортировка продавцов по прибыли =====
  sellerStats.sort((a, b) => b.profit - a.profit);

  // ===== формирование результата =====
  return sellerStats.map((seller, index) => {
    const profitRounded = round(seller.profit);

    const bonus = round(
      calculateBonus(index, sellerStats.length, {
        ...seller,
        profit: profitRounded
      })
    );

    // 🔴 сортировка ТОЛЬКО по quantity (без sku!)
    const top_products = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: round(seller.revenue),
      profit: profitRounded,
      sales_count: seller.sales_count,
      bonus,
      top_products
    };
  });
}