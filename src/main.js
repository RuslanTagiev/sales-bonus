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
  const profit = seller.profit;

  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1 && total > 1) return 0;
  return profit * 0.05;
}

/**
 * Функция для анализа данных продаж
 */
function analyzeSalesData(data, options) {
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  const { calculateRevenue, calculateBonus } = options || {};
  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  const round = (n) => Math.round(n * 100) / 100;

  const sellerStats = data.sellers.map(s => ({
    id: s.id,
    name: `${s.first_name} ${s.last_name}`,
    revenue: 0,
    profit: 0,
    salesCount: 0,
    productsSold: {}
  }));

  const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.salesCount += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (!product) return;

      const revenue = calculateRevenue(item, product);
      const cost = product.purchase_price * item.quantity;

      seller.revenue += revenue;
      seller.profit += (revenue - cost);

      seller.productsSold[item.sku] = (seller.productsSold[item.sku] || 0) + item.quantity;
    });
  });

  sellerStats.sort((a, b) => b.profit - a.profit);

  return sellerStats.map((seller, index) => {
    const roundedProfit = round(seller.profit);
    const roundedRevenue = round(seller.revenue);

    const bonus = round(
      calculateBonus(index, sellerStats.length, {
        ...seller,
        profit: roundedProfit
      })
    );

    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) =>
        b.quantity !== a.quantity
          ? b.quantity - a.quantity
          : a.sku.localeCompare(b.sku)
      )
      .slice(0, 10);

    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: roundedRevenue,
      profit: roundedProfit,
      sales_count: seller.salesCount,
      top_products: topProducts,
      bonus
    };
  });
}