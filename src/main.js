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
    throw new Error("опция не является объектом");
  }

  const { calculateRevenue, calculateBonus } = options;

  if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
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
  // Коэффициент для расчета суммы без скидки
  const discount = 1 - (purchase.discount / 100);
  // Формула: sale_price × количество × скидка
  return purchase.sale_price * purchase.quantity * discount;
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
    return profit * 0.15; // 15% — для продавца, который принёс наибольшую прибыль.
  } else if (index === 1 || index === 2) {
    return profit * 0.10; // 10% — для продавцов, которые оказались на втором и третьем месте по прибыли.
  } else if (index === total - 1) {
    return 0;             // 0% — для продавца, который оказался на последнем месте.
  } else {
    return profit * 0.05; // 5% — для всех остальных продавцов, кроме последнего.
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
  
  // Шаг 1. Двойной цикл перебора чеков и покупок в них
  data.purchase_records.forEach(record => {
    const seller = sellerIndex[record.seller_id]; // Продавец
    if (seller) {
      // Увеличить количество продаж
      seller.sales_count += 1;
      // Увеличить общую сумму выручки всех продаж. Используем total_amount, как прописано в Шаге 1
      seller.revenue += record.total_amount; 
      
      record.items.forEach(item => {
        const product = productIndex[item.sku]; // Товар
        if (product) {
          // Посчитать себестоимость (cost) товара как product.purchase_price, умноженную на количество товаров из чека
          const cost = product.purchase_price * item.quantity;
          // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
          const itemRevenue = calculateRevenue(item, product);
          // Посчитать прибыль: выручка минус себестоимость
          const itemProfit = itemRevenue - cost;
          
          // Увеличить общую накопленную прибыль (profit) у продавца
          seller.profit += itemProfit;

          // Учёт количества проданных товаров
          if (!seller.products_sold[item.sku]) {
            seller.products_sold[item.sku] = 0;
          }
          // По артикулу товара увеличить его проданное количество у продавца
          seller.products_sold[item.sku] += item.quantity;
        }
      });
    }
  });

  // Шаг 2. Упорядочите продавцов по прибыли (От большего к меньшему (descending))
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Шаг 3. Назначьте премии на основе ранжирования
  sellerStats.forEach((seller, index) => {
    // 1. Считаем бонус, используя функцию из опций
    seller.bonus = calculateBonus(index, sellerStats.length, seller);

    // 2. Формируем топ-10 товаров
    // Преобразовать seller.products_sold из объекта вида {[sku]: quantity} в массив вида [[sku, quantity], …]
    seller.top_products = Object.entries(seller.products_sold)
      // Трансформируйте массив вида [[key, value]] в [{sku, quantity}]
      .map(([sku, quantity]) => ({ sku, quantity }))         
      // Отсортируйте массив по убыванию количества товаров quantity (добавлена стабильная сортировка по SKU)
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      // Отделите от массива первые 10 элементов
      .slice(0, 10);
  });

  // Шаг 4. Сформируйте результат (формирование итогового отчёта)
  return sellerStats.map(seller => ({
    seller_id: seller.id, // Строка, идентификатор продавца
    name: seller.name,     // Строка, имя продавца
    // Число с двумя знаками после точки, выручка продавца (+someNum.toFixed(2))
    revenue: +seller.revenue.toFixed(2),
    // Число с двумя знаками после точки, прибыль продавца
    profit: +seller.profit.toFixed(2),
    sales_count: seller.sales_count, // Целое число, количество продаж продавца
    // Массив объектов вида: { "sku": "SKU_008","quantity": 10}, топ-10 товаров продавца
    top_products: seller.top_products,
    bonus: +seller.bonus.toFixed(2) // Число с двумя знаками после точки, бонус продавца
  }));
}

// Экспорт для Node.js среды (Jest)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validate,
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData
  };
}