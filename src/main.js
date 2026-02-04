const round = (num) => Math.round(num * 100) / 100;

const createIndex = (array, key) => Object.fromEntries(array.map(item => [item[key], item]));

/**
 * 2. ФУНКЦИИ РАСЧЕТА (Бизнес-логика)
 * Объявляем их ПЕРЕД использованием в options
 */
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

/**
 * 3. ВАЛИДАЦИЯ
 */
const validate = (data, options) => {
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

  return { calculateRevenue, calculateBonus };
};

/**
 * 4. ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА
 */
function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = validate(data, options);

  // Индексируем продукты для быстрого поиска
  const productIndex = createIndex(data.products, 'sku');

  // Шаг 3, 5: Собираем статистику через reduce
  const statsMap = data.purchase_records.reduce((acc, record) => {
    const sellerId = record.seller_id;

    if (!acc[sellerId]) {
      const sellerInfo = data.sellers.find(s => s.id === sellerId);
      acc[sellerId] = {
        id: sellerId,
        name: sellerInfo ? `${sellerInfo.first_name} ${sellerInfo.last_name}` : "Unknown",
        revenue: 0,
        profit: 0,
        salesCount: 0,
        productsSoldMap: {}
      };
    }

    const currentSeller = acc[sellerId];
    currentSeller.salesCount += 1;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;

        currentSeller.revenue += itemRevenue;
        currentSeller.profit += (itemRevenue - cost);

        currentSeller.productsSoldMap[item.sku] = (currentSeller.productsSoldMap[item.sku] || 0) + item.quantity;
      }
    });

    return acc;
  }, {});

  // Шаг 6: Сортировка по прибыли
  const rankedSellers = Object.values(statsMap).sort((a, b) => b.profit - a.profit);

  // Шаг 7: Финальная трансформация
  return rankedSellers.map((seller, index) => {
    const topProducts = Object.entries(seller.productsSoldMap)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);

    return {
      seller_id: seller.id,
      name: seller.name,
      revenue: round(seller.revenue),
      profit: round(seller.profit),
      sales_count: seller.salesCount,
      top_products: topProducts,
      bonus: round(calculateBonus(index, rankedSellers.length, seller))
    };
  });
}