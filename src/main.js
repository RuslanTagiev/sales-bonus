/**
 * 1. Вспомогательные функции расчёта (теперь они определены)
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
 * 2. Валидация входных данных
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

  const { calculateRevenue, calculateBonus } = options || {};

  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  return { calculateRevenue, calculateBonus };
}

/**
 * 3. Основная функция анализа
 */
function analyzeSalesData(data, options) {
  // Получаем проверенные функции из опций
  const { calculateRevenue, calculateBonus } = validate(data, options);

  // Шаг 3: Подготовка промежуточных данных
  const sellerStats = data.sellers.map(seller => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`, 
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // Шаг 4: Индексы для быстрого доступа
  const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

  // Шаг 5: Обработка транзакций
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.sales_count += 1;
    seller.revenue += record.total_amount;

    record.items.forEach(item => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;
        
        seller.profit += (itemRevenue - cost);

        if (!seller.products_sold[item.sku]) {
          seller.products_sold[item.sku] = 0;
        }
        seller.products_sold[item.sku] += item.quantity;
      }
    });
  });

  // Шаг 6: Сортировка по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 7: Бонусы и Топ-10
  sellerStats.forEach((seller, index) => {
    // Вызываем calculateBonus, которую мы достали из options
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);
  });

  // Формирование итогового результата
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

