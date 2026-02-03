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

// Этап 3. Реализация бизнес-логики

function calculateSimpleRevenue(purchase, _product) {
  const { discount, quantity, sale_price } = purchase;
  const discountFactor = 1 - (discount / 100);
  return sale_price * quantity * discountFactor;
}

function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;
  if (index === 0) return profit * 0.15;
  if (index === 1 || index === 2) return profit * 0.1;
  if (index === total - 1) return 0;
  return profit * 0.05;
}

function analyzeSalesData(data, options) {
  const { calculateRevenue, calculateBonus } = validate(data, options);

  const sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0,
    profit: 0,
    sales_count: 0,
    products_sold: {},
  }));

  const sellerIndex = Object.fromEntries(sellerStats.map((s) => [s.id, s]));
  const productIndex = Object.fromEntries(data.products.map((p) => [p.sku, p]));
  
  data.purchase_records.forEach((record) => {
    const seller = sellerIndex[record.seller_id];
    if (!seller) return; 

    seller.sales_count += 1;
    
    record.items.forEach((item) => {
      const product = productIndex[item.sku];
      if (!product) return;

      // Выручка БЕЗ скидки (для итогового поля revenue)
      const grossRevenue = item.sale_price * item.quantity;
      // Выручка СО скидкой (через функцию для расчета profit)
      const netRevenue = calculateRevenue(item, product);
      
      const cost = product.purchase_price * item.quantity;

      seller.revenue += grossRevenue; 
      seller.profit += (netRevenue - cost);

      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // Сортировка по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  sellerStats.forEach((seller, index) => {
    seller.bonus = calculateBonus(index, sellerStats.length, seller);
    
    // Стабильная сортировка топ-товаров: количество DESC, затем SKU ASC
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
      .slice(0, 10);
  });

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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validate,
    calculateSimpleRevenue,
    calculateBonusByProfit,
    analyzeSalesData
  };
}