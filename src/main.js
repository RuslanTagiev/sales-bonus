const calculateSimpleRevenue = (item, product) => {
  const discountFactor = 1 - (item.discount / 100);
  return item.sale_price * item.quantity * discountFactor;
};

const calculateBonusByProfit = (index, total, seller) => {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1 && total > 1) return 0;
  return profit * 0.05;
};

const roundValue = (value) => Math.round(value * 100) / 100;

/**
 * 2. Основная функция анализа
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = options;
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // Сбор статистики
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
    // Выручка берется из total_amount чека для соответствия эталону
    seller.revenue += record.total_amount; 

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;
        seller.profit += (itemRevenue - cost);
        
        seller.productsSold[item.sku] = (seller.productsSold[item.sku] || 0) + item.quantity;
      }
    });
  });

  // Ранжирование по прибыли
  const rankedSellers = Object.values(statsMap).sort((a, b) => b.profit - a.profit);

  // Формирование финального отчета
  return rankedSellers.map((seller, index) => {
    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({
        sku: sku,        // В твоем текстовом эталоне SKU первый
        quantity: quantity
      }))
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        // Обратная сортировка SKU (от большего к меньшему), как в твоем примере
        return b.sku.localeCompare(a.sku); 
      })
      .slice(0, 10);

    return {
      seller_id: seller.seller_id,
      name: seller.name,
      revenue: roundValue(seller.revenue),
      profit: roundValue(seller.profit),
      sales_count: seller.sales_count,
      top_products: topProducts,
      bonus: roundValue(calculateBonus(index, rankedSellers.length, seller))
    };
  });
}

/**
 * 3. Настройка опций и запуск
 */
const options = {
  calculateRevenue: calculateSimpleRevenue,
  calculateBonus: calculateBonusByProfit
};