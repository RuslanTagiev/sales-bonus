const calculateSimpleRevenue = (item, product) => {
  const discountFactor = 1 - (item.discount / 100);
  return item.sale_price * item.quantity * discountFactor;
};

// Расчет бонуса на основе рейтинга
const calculateBonusByProfit = (index, total, seller) => {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.10;
  if (index === total - 1 && total > 1) return 0;
  return profit * 0.05;
};

// Округление до 2 знаков (возвращает число)
const roundValue = (value) => Math.round(value * 100) / 100;

/**
 * 2. ВАЛИДАЦИЯ ВХОДНЫХ ДАННЫХ
 */
const validateData = (data, options) => {
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
 * 3. ОСНОВНАЯ ФУНКЦИЯ АНАЛИЗА
 */
function analyzeSalesData(data, options) {
  // Проверка входных данных и получение функций из опций
  const { calculateRevenue, calculateBonus } = validateData(data, options);

  // Подготовка массива статистики (используем camelCase внутри)
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    salesCount: 0,
    productsSold: {}, // Сюда будем записывать данные
  }));

  // Создаем индексы для быстрого доступа
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));

  // Обработка транзакций
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return;

    seller.salesCount += 1;

    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (product) {
        const itemRevenue = calculateRevenue(item, product);
        const cost = product.purchase_price * item.quantity;

        // Накопление показателей
        seller.revenue += itemRevenue;
        seller.profit += (itemRevenue - cost);

        // Учет количества проданных товаров
        if (!seller.productsSold[item.sku]) {
          seller.productsSold[item.sku] = 0;
        }
        seller.productsSold[item.sku] += item.quantity;
      }
    });
  });

  // Сортировка продавцов по прибыли (убывание)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Расчет бонусов и формирование Топ-10 товаров
  sellerStats.forEach((seller, index) => {
    // Назначаем бонус через функцию из опций
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    // Формируем ТОП-10
    seller.topProducts = Object.entries(seller.productsSold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => {
        // Сначала по количеству (убывание)
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        // Затем по SKU (алфавитный порядок)
        return a.sku < b.sku ? -1 : 1;
      })
      .slice(0, 10);
  });

  // Финальная трансформация в требуемый формат (с округлением)
  return sellerStats.map((seller) => ({
    seller_id: seller.id,
    name: seller.name,
    revenue: roundValue(seller.revenue),
    profit: roundValue(seller.profit),
    sales_count: seller.salesCount,
    top_products: seller.topProducts,
    bonus: roundValue(seller.bonus),
  }));
}