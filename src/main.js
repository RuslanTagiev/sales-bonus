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

function calculateSimpleRevenue(item, product) {
  // Важно: берем цену из записи о продаже (item), а не из каталога (product)
  const discountPercent = item.discount || 0;
  const discountFactor = 1 - (discountPercent / 100);
  return item.sale_price * item.quantity * discountFactor;
}

function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  // Последний в рейтинге (если продавцов больше одного) бонус не получает
  if (total > 1 && index === total - 1) return 0;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  return profit * 0.05;
}

function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = validate(data, options);

  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    salesCount: 0,
    productsSold: {},
  }));

  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (seller) {
      seller.salesCount += 1;

      record.items.forEach((item) => {
        const product = productIndex[item.sku];
        if (product) {
          // ВЫРУЧКА: Считаем через функцию, а не берем total_amount из записи
          const itemRevenue = calculateRevenue(item, product);
          const cost = product.purchase_price * item.quantity;
          
          seller.revenue += itemRevenue;
          seller.profit += (itemRevenue - cost);
          seller.productsSold[item.sku] = (seller.productsSold[item.sku] || 0) + item.quantity;
        }
      });
    }
  });

  // Сортировка по прибыли (от большего к меньшему)
  sellerStats.sort((a, b) => b.profit - a.profit);

  return sellerStats.map((seller, index) => {
    // Бонус считается от "грязной" прибыли до округления
    const bonusValue = calculateBonus(index, sellerStats.length, seller);

    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      // Сортировка: сначала по количеству (desc), затем по алфавиту SKU (desc) для стабильности
      .sort((a, b) => b.quantity - a.quantity || b.sku.localeCompare(a.sku))
      .slice(0, 10);

    const roundToTwo = (num) => Number(Math.round(num + "e2") + "e-2");

    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: roundToTwo(seller.revenue),
      profit: roundToTwo(seller.profit),
      sales_count: seller.salesCount,
      top_products: topProducts,
      bonus: roundToTwo(bonusValue)
    };
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { validate, calculateSimpleRevenue, calculateBonusByProfit, analyzeSalesData };
}