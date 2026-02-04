/**
 * Валидация входных данных и функций в опциях (Шаги 1 и 2)
 */
function validate(data, options) {
  // --- Шаг 1: Проверка данных ---
  if (
    !data ||
    !Array.isArray(data.sellers) || data.sellers.length === 0 ||
    !Array.isArray(data.products) || data.products.length === 0 ||
    !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  // --- Шаг 2: Проверка опций ---
  // Деструктурируем с защитой на случай, если options === null или undefined
  const { calculateRevenue, calculateBonus } = options || {};

  // Проверяем наличие переменных и их тип (что это именно функции)
  if (
    !calculateRevenue || 
    !calculateBonus || 
    typeof calculateRevenue !== "function" || 
    typeof calculateBonus !== "function"
  ) {
    throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
  }

  // Если всё хорошо, возвращаем функции для дальнейшего использования
  return { calculateRevenue, calculateBonus };
}




// шаг 3

const sellerStats = data.sellers.map(seller => ({
  id: seller.id,
  // Собираем полное имя сразу, чтобы потом не тратить на это время
  name: `${seller.first_name} ${seller.last_name}`, 
  revenue: 0,        // Начальная выручка
  profit: 0,         // Начальная прибыль
  salesCount: 0,     // Количество успешных сделок (чеков)
  productsSold: {},  // Объект для учета проданных товаров (ключ - SKU, значение - кол-во)
}));



// шаг 4 


// 1. Индекс для статистики продавцов (ключ — id, значение — объект из sellerStats)
// Мы используем sellerStats (из Шага 3), так как именно туда будем записывать цифры
const sellerIndex = Object.fromEntries(
  sellerStats.map((s) => [s.id, s])
);

// 2. Индекс для продуктов (ключ — sku, значение — сам объект продукта)
// Это позволит мгновенно узнавать закупочную цену (purchase_price) по артикулу
const productIndex = Object.fromEntries(
  data.products.map((p) => [p.sku, p])
);


// 



// Перебор чеков (внешний цикл)
data.purchase_records.forEach(record => {
  // 1. Находим продавца в нашем индексе
  const seller = sellerIndex[record.seller_id];
  
  // Если вдруг продавца нет в базе, пропускаем чек
  if (!seller) return;

  // 2. Обновляем базовую статистику продавца
  seller.sales_count += 1;
  seller.revenue += record.total_amount;

  // 3. Перебор товаров в чеке (внутренний цикл)
  record.items.forEach(item => {
    const product = productIndex[item.sku]; // Находим данные о товаре (цену закупки)
    
    if (product) {
      // Считаем себестоимость (закупка * количество)
      const cost = product.purchase_price * item.quantity;
      
      // Считаем выручку через функцию из опций
      const itemRevenue = calculateRevenue(item, product);
      
      // Считаем прибыль с этой позиции и прибавляем продавцу
      const itemProfit = itemRevenue - cost;
      seller.profit += itemProfit;

      // 4. Учёт количества проданных товаров (динамический словарь)
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      // Прибавляем количество именно этого товара
      seller.products_sold[item.sku] += item.quantity;
    }
  });
});

/**
 * Реализация эталонной функции (как указано в задании)
 */
function calculateSimpleRevenue(item, product) {
  // Коэффициент скидки (например, если скидка 20%, коэффициент 0.8)
  const discountFactor = 1 - (item.discount / 100);
  
  // Итоговая выручка за позицию
  return item.sale_price * item.quantity * discountFactor;
}



sellerStats.sort((a, b) => {
  return b.profit - a.profit;
});



function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  if (index === 0) {
    // 1 место — 15%
    return profit * 0.15;
  } else if (index === 1 || index === 2) {
    // 2 и 3 места — 10%
    return profit * 0.10;
  } else if (index === total - 1 && total > 1) {
    // Последнее место — 0% (добавляем total > 1, чтобы не обидеть единственного продавца)
    return 0;
  } else {
    // Все остальные — 5%
    return profit * 0.05;
  }
}




sellerStats.forEach((seller, index) => {
  // 1. Назначаем бонус (код из предыдущей части шага 7)
  seller.bonus = calculateBonus(index, sellerStats.length, seller);

  // 2. Формируем топ-10 продуктов
  seller.top_products = Object.entries(seller.products_sold) // [[sku, quantity], ...]
    .map(([sku, quantity]) => ({
      sku: sku,
      quantity: quantity
    })) // Преобразуем в [{sku, quantity}, ...]
    .sort((a, b) => b.quantity - a.quantity) // Сортируем по убыванию количества
    .slice(0, 10); // Берем первые 10 элементов
});


return sellerStats.map(seller => ({
  seller_id: seller.id,
  name: seller.name,
  // Округляем финансовые показатели до 2 знаков
  revenue: +seller.revenue.toFixed(2),
  profit: +seller.profit.toFixed(2),
  // Количество продаж оставляем целым числом
  sales_count: seller.sales_count,
  // Топ товаров уже сформирован на предыдущем шаге
  top_products: seller.top_products,
  // Округляем бонус
  bonus: +seller.bonus.toFixed(2)
}));