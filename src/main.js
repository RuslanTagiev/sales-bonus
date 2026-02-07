/**
 * Функция для расчета выручки
 */
function calculateSimpleRevenue(purchase, _product) {
  const discount = purchase.discount || 0;
  return purchase.sale_price * purchase.quantity * (1 - discount / 100);
}

/**
 * Функция для расчета бонусов
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
 */
function analyzeSalesData(data, options) {
  // ✅ Проверки строго под тесты
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

  const round2 = (n) => Math.round(n * 100) / 100;

  // Индексация товаров
  const productIndex = Object.fromEntries(
    data.products.map(p => [p.sku, p])
  );

  // Подготовка продавцов
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

  // Расчет
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.sales_count += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;

      const revenue = calculateRevenue(item, product);
      const cost = product.purchase_price * item.quantity;

      seller.revenue += revenue;
      seller.profit += revenue - cost;

      seller.productsSold[item.sku] =
        (seller.productsSold[item.sku] || 0) + item.quantity;
    });
  });

  // Сортировка по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Финальный результат
  return sellerStats.map((seller, index) => {
    const profitRounded = round2(seller.profit);
    const bonus = round2(
      calculateBonus(index, sellerStats.length, { ...seller, profit: profitRounded })
    );

    const top_products = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => {
        if (b.quantity !== a.quantity) {
          return b.quantity - a.quantity;
        }
        return a.sku.localeCompare(b.sku); // 🔴 критично для тестов
      })
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: round2(seller.revenue),
      profit: profitRounded,
      sales_count: seller.sales_count,
      bonus,
      top_products
    };
  });
}