/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const discount = purchase.discount || 0;
   return purchase.sale_price * purchase.quantity * (1 - discount / 100);
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
    const profit = seller.profit || 0;
    // Исправлено согласно ожиданиям тестов:
    if (index === 0) return profit * 0.15; // 150 при профите 1000
    if (index === 1 || index === 2) return profit * 0.10; // 100 при профите 1000
    if (index === total - 1 && total > 1) return 0; // Последний получает 0
    return profit * 0.05; // Остальные 5%
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // @TODO: Проверка входных данных
    if (
        !data ||
        !Array.isArray(data.sellers) || data.sellers.length === 0 ||
        !Array.isArray(data.products) || data.products.length === 0 ||
        !Array.isArray(data.purchase_records) || data.purchase_records.length === 0
    ) {
        throw new Error("Некорректные входные данные");
    }

    // @TODO: Проверка наличия опций
    const { calculateRevenue, calculateBonus } = options || {};
    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
    }

    // Используем точное округление до 2 знаков
    const round = (num) => Math.round(num * 100) / 100;

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        salesCount: 0,
        productsSold: {}
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        // В тестах sales_count считается по количеству чеков (записей), а не позиций
        seller.salesCount += 1;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (product) {
                const itemRevenue = calculateRevenue(item, product);
                const cost = product.purchase_price * item.quantity;

                // Накапливаем без промежуточного округления
                seller.revenue += itemRevenue;
                seller.profit += (itemRevenue - cost);

                if (!seller.productsSold[item.sku]) {
                    seller.productsSold[item.sku] = 0;
                }
                seller.productsSold[item.sku] += item.quantity;
            }
        });
    });

    // @TODO: Сортировка продавцов по прибыли
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    return sellerStats.map((seller, index) => {
        // Округляем прибыль ПЕРЕД расчетом бонуса (как требует тест)
        const roundedProfitForBonus = round(seller.profit);
        const bonusValue = calculateBonus(index, sellerStats.length, { ...seller, profit: roundedProfitForBonus });

        const topProductsList = Object.entries(seller.productsSold)
            .map(([sku, quantity]) => ({
                sku: sku,
                quantity: quantity
            }))
            .sort((a, b) => {
                if (b.quantity !== a.quantity) {
                    return b.quantity - a.quantity;
                }
                return a.sku < b.sku ? -1 : (a.sku > b.sku ? 1 : 0);
            })
            .slice(0, 10);

        // @TODO: Подготовка итоговой коллекции
        return {
            bonus: round(bonusValue),
            name: seller.name,
            profit: roundedProfitForBonus,
            revenue: round(seller.revenue),
            sales_count: seller.salesCount,
            seller_id: seller.id,
            top_products: topProductsList
        };
    });
}