/**
 * Функция для расчета выручки (Аналогично первой версии)
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   const discount = purchase.discount || 0;
   // В первой версии: item.sale_price * item.quantity * (1 - item.discount / 100)
   return purchase.sale_price * purchase.quantity * (1 - discount / 100);
}

/**
 * Функция для расчета бонусов (Переписана под логику первой версии)
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    // В первой версии расчет идет как 10% от СРЕДНЕЙ прибыли (bonusHighestAverageProfit)
    // Здесь мы адаптируем это под текущую структуру: 10% от прибыли для Топ-1, 5% для остальных
    const profit = seller.profit || 0;
    if (index === 0) return profit * 0.10; 
    return profit * 0.05;
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

    // Используем способ округления из первой версии (+val.toFixed(2))
    const round = (num) => +(num).toFixed(2);

    // @TODO: Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        salesCount: 0,
        totalItemsCount: 0, // Добавлено для расчета средней прибыли как в v1
        productsSold: {}
    }));

    // @TODO: Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        // В первой версии salesCount — это не количество записей, а количество проданных позиций (items)
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (product) {
                const itemRevenue = calculateRevenue(item, product);
                
                // Логика simpleProfit из первой версии:
                // revenue - (purchase_price * quantity)
                const cost = product.purchase_price * item.quantity;
                const itemProfit = itemRevenue - cost;

                seller.revenue += itemRevenue;
                seller.profit += itemProfit;
                seller.totalItemsCount += 1;
                seller.salesCount += 1; // Увеличиваем счетчик за каждую позицию

                if (!seller.productsSold[item.sku]) {
                    seller.productsSold[item.sku] = 0;
                }
                seller.productsSold[item.sku] += item.quantity;
            }
        });
    });

    // @TODO: Сортировка продавцов по прибыли (как во второй версии)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // @TODO: Назначение премий на основе ранжирования
    return sellerStats.map((seller, index) => {
        // Округляем как в первой версии перед передачей в бонусную функцию
        const currentProfit = round(seller.profit);
        
        // Передаем данные в calculateBonus (которая теперь берет % от прибыли)
        const bonusValue = calculateBonus(index, sellerStats.length, { ...seller, profit: currentProfit });

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

        // @TODO: Подготовка итоговой коллекции с алфавитным порядком ключей
        return {
            bonus: round(bonusValue),
            name: seller.name,
            profit: currentProfit,
            revenue: round(seller.revenue),
            sales_count: seller.salesCount,
            seller_id: seller.id,
            top_products: topProductsList
        };
    });
}