function validate(data, options) {
  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records)
  ) {
    throw new Error("Некорректные входные данные");
  }

  if (!options || typeof options !== "object") {
    throw new Error("опция не является объектом");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (
    typeof calculateRevenue !== "function" ||
    typeof calculateBonus !== "function"
  ) {
    throw new Error(
      "В опциях должны быть функции calculateRevenue и calculateBonus",
    );
  }

  return { calculateRevenue, calculateBonus };
}

//  Этап 3. Реализация бизнес-логики

/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
  const { discount, quantity, sale_price } = purchase;
   const discountFactor = 1 - (discount / 100);
 return sale_price * quantity * discountFactor;
  // @TODO: Расчет выручки от операции
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
  // @TODO: Расчет бонуса от позиции в рейтинге
  const { profit } = seller;
  if (index === 0) {
    return profit * 0.15;
  }
  if (index === 1 || index === 2) {
    return profit * 0.1;
  }
  if (index === total - 1) {
    return 0;
  } else {
    return profit * 0.05;
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */

function analyzeSalesData(data, options) {
  // @TODO: Проверка входных данных
  const { calculateRevenue, calculateBonus } = validate(data, options);
  // @TODO: Проверка наличия опций

  // @TODO: Подготовка промежуточных данных для сбора статистики
  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  // @TODO: Индексация продавцов и товаров для быстрого доступа
  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));
  // @TODO: Расчет выручки и прибыли для каждого продавца
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    seller.sales_count += 1;
    seller.revenue += record.total_amount;
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      const cost = product.purchase_price * item.quantity;

      // Вычисляем выручку через переданную в опциях функцию
      const revenue = calculateRevenue(item, product);
      // Прибыль = Выручка - (Себестоимость * Кол-во)
      const profit = revenue - cost;

     seller.profit += profit;

       if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // @TODO: Сортировка продавцов по прибыли
  // От большего к меньшему (descending)
  sellerStats.sort((a, b) => b.profit - a.profit);

  // @TODO: Назначение премий на основе ранжирования
  sellerStats.forEach((seller, index) => {
    // 1. Считаем бонус, используя функцию из опций
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    // 2. Формируем топ-10 товаров
    seller.top_products = Object.entries(seller.products_sold) // [[sku, qty], [sku, qty]]
        .map(([sku, quantity]) => ({ sku, quantity }))         // [{sku, quantity}, ...]
        .sort((a, b) => b.quantity - a.quantity)               // Сортировка по убыванию количества
        .slice(0, 10);                                         // Только первые 10 элементов
});

  // @TODO: Подготовка итоговой коллекции с нужными полями
 return sellerStats.map(seller => ({
    seller_id: seller.id,
    name: seller.name,
    // Округляем до 2 знаков и преобразуем обратно в число (+)
    revenue: +seller.revenue.toFixed(2),
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count,
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2)
}));
}




