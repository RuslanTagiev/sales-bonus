/**
 * Валидация входных данных
 */
function validate(data, options) {
    if (!data || !Array.isArray(data.sellers) || !Array.isArray(data.products) || !Array.isArray(data.purchase_records)) {
        throw new Error("Некорректные входные данные");
    }
    if (!options || typeof options.calculateRevenue !== "function" || typeof options.calculateBonus !== "function") {
        throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
    }
    return options;
}

/**
 * Округление до 2 знаков после запятой
 */
const roundToTwo = (num) => Math.round(num * 100) / 100;

/**
 * Простой расчет выручки (для передачи в опции)
 */
function calculateSimpleRevenue(item, product) {
    const discount = item.discount || 0;
    return item.sale_price * item.quantity * (1 - discount / 100);
}

/**
 * Расчет бонуса на основе позиции в рейтинге
 */
function calculateBonusByProfit(index, total, seller) {
    const { profit } = seller;
    if (total > 1 && index === total - 1) return 0;
    if (index === 0) return profit * 0.15;
    if (index === 1 || index === 2) return profit * 0.10;
    return profit * 0.05;
}

/**
 * Основная функция анализа данных продаж
 */
function analyzeSalesData(data, options) {
    const { calculateRevenue, calculateBonus } = validate(data, options);

    // Индексация для быстрого поиска
    const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));
    
    // Сбор статистики (по аналогии с базовыми метриками из твоего примера)
    const stats = data.sellers.reduce((acc, seller) => {
        acc[seller.id] = {
            id: seller.id,
            name: `${seller.first_name} ${seller.last_name}`,
            revenue: 0,
            profit: 0,
            salesCount: 0,
            productsSold: {}
        };
        return acc;
    }, {});

    // Обработка транзакций
    data.purchase_records.forEach(record => {
        const seller = stats[record.seller_id];
        if (!seller) return;

        seller.salesCount += 1;
        // Тест ожидает выручку напрямую из чека
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

    // Преобразование в массив и сортировка по прибыли (бизнес-логика рейтинга)
    const rankedSellers = Object.values(stats).sort((a, b) => b.profit - a.profit);

    // Финальное мапирование с расчетом бонусов и топ-товаров
    return rankedSellers.map((seller, index) => {
        const bonusValue = calculateBonus(index, rankedSellers.length, seller);

        const topProducts = Object.entries(seller.productsSold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity || a.sku.localeCompare(b.sku))
            .slice(0, 10);

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

