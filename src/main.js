const round = (num) => Math.round(num * 100) / 100;

const calculateSimpleRevenue = (item, product) => {
  const discount = item.discount || 0;
  return item.sale_price * item.quantity * (1 - discount / 100);
};

const calculateBonusByProfit = (index, total, seller) => {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1 && total > 1) return 0;
  return profit * 0.05;
};

/**
 * 2. ОСНОВНАЯ ФУНКЦИЯ
 */
function analyzeSalesData(data, options) {
  // ШАГ 1 и 2: Жесткая валидация для тестов (включая пустые массивы)
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  if (!options || typeof options.calculateRevenue !== "function" || typeof options.calculateBonus !== "function") {
    throw new Error("Некорректные опции");
  }

  const { calculateRevenue, calculateBonus } = options;
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // ШАГ 3: Инициализация
  const statsMap = Object.fromEntries(data.sellers.map(s => [
    s.id,
    {
      id: s.id,
      name: `${s.first_name} ${s.last_name}`,
      revenue: 0,
      profit: 0,
      salesCount: 0,
      productsSold: {}
    }
  ]));

  // ШАГ 5: Сбор данных (Расчет выручки по позициям для Варианта 3)
  data.purchase_records.forEach(record => {
    const seller = statsMap[record.seller_id];
    if (!seller) return;

    seller.salesCount++;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;
        
        seller.revenue += itemRevenue; 
        seller.profit += (itemRevenue - cost);
        
        seller.productsSold[item.sku] = (seller.productsSold[item.sku] || 0) + item.quantity;
      }
    });
  });

  // ШАГ 6: Сортировка по прибыли
  const rankedSellers = Object.values(statsMap).sort((a, b) => b.profit - a.profit);

  // ШАГ 7: Формирование результата с ПРАВИЛЬНЫМ ПОРЯДКОМ КЛЮЧЕЙ
  return rankedSellers.map((seller, index) => {
    const topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({
        sku: sku,        // SKU первым
        quantity: quantity 
      }))
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

/**
 * 3. ОБЪЕКТ ОПЦИЙ (Объявлять после функций!)
 */
const options = {
  calculateRevenue: calculateSimpleRevenue,
  calculateBonus: calculateBonusByProfit
};