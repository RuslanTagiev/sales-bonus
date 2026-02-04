const round = (num) => Math.round(num * 100) / 100;

function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = options;
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // 1. Сбор статистики
  const statsMap = data.sellers.reduce((acc, s) => {
    acc[s.id] = {
      seller_id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      revenue: 0,
      profit: 0,
      sales_count: 0,
      productsSold: {}
    };
    return acc;
  }, {});

  data.purchase_records.forEach(record => {
    const seller = statsMap[record.seller_id];
    if (!seller) return;

    seller.sales_count++;
    seller.revenue += record.total_amount; // Выручка строго из total_amount

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        seller.profit += (itemRevenue - (product.purchase_price * item.quantity));
        seller.productsSold[item.sku] = (seller.productsSold[item.sku] || 0) + item.quantity;
      }
    });
  });

  // 2. Сортировка продавцов по прибыли
  const rankedSellers = Object.values(statsMap).sort((a, b) => b.profit - a.profit);

  // 3. Формирование финала
  return rankedSellers.map((seller, index) => {
    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({
        quantity: quantity, // Ключ quantity ПЕРВЫМ
        sku: sku            // Ключ sku ВТОРЫМ
      }))
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return b.sku.localeCompare(a.sku); // Сортировка SKU по УБЫВАНИЮ (как в твоем эталоне)
      })
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: round(seller.revenue),
      profit: round(seller.profit),
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: round(calculateBonus(index, rankedSellers.length, seller))
    };
  });
}