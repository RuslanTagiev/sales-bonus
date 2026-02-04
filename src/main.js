/**
 * Функция для расчета выручки
 */
function calculateSimpleRevenue(purchase, _product) {
   // @TODO: Расчет выручки от операции
   // Используем формулу из описания: цена продажи * кол-во * (1 - скидка_в_процентах / 100)
   const discount = purchase.discount || 0;
   return purchase.sale_price * purchase.quantity * (1 - discount / 100);
}

/**
 * Функция для расчета бонусов
 */
function calculateBonusByProfit(index, total, seller) {
    // @TODO: Расчет бонуса от позиции в рейтинге
    const profit = seller.profit || 0;
    if (index === 0) return profit * 0.15;
    if (index === 1 || index === 2) return profit * 0.10;
    if (index === total - 1 && total > 1) return 0;
    return profit * 0.05;
}

/**
 * Функция для анализа данных продаж
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

    const { calculateRevenue, calculateBonus } = options || {};
    if (typeof calculateRevenue !== "function" || typeof calculateBonus !== "function") {
        throw new Error("В опциях должны быть функции calculateRevenue и calculateBonus");
    }

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

    const sellerIndex = Object.fromEntries(sellerStats.map(s => [s.id, s]));
    const productIndex = Object.fromEntries(data.products.map(p => [p.sku, p]));

    // @TODO: Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return;

        seller.salesCount += 1;

        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (product) {
                // Расчет выручки по каждой позиции
                const itemRevenue = calculateRevenue(item, product);
                // Расчет себестоимости по закупочной цене из каталога
                const itemCost = product.purchase_price * item.quantity;

                seller.revenue += itemRevenue;
                // Прибыль = Выручка за товар - Себестоимость товара
                seller.profit += (itemRevenue - itemCost);

                if (!seller.productsSold[item.sku]) {
                    seller.productsSold[item.sku] = 0;
                }
                seller.productsSold[item.sku] += item.quantity;
            }
        });
    });

    // @TODO: Сортировка продавцов по прибыли
    // Важно округлять прибыль ПЕРЕД сортировкой, чтобы порядок был как в тестах
    sellerStats.sort((a, b) => round(b.profit) - round(a.profit));

    // @TODO: Назначение премий на основе ранжирования
    return sellerStats.map((seller, index) => {
        // Округляем данные продавца для корректного расчета бонуса
        const roundedProfit = round(seller.profit);
        const bonusValue = calculateBonus(index, sellerStats.length, { ...seller, profit: roundedProfit });

        const topProductsList = Object.entries(seller.productsSold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => {
                if (b.quantity !== a.quantity) return b.quantity - a.quantity;
                // Прямое сравнение строк для SKU
                return a.sku < b.sku ? -1 : (a.sku > b.sku ? 1 : 0);
            })
            .slice(0, 10);

        // @TODO: Подготовка итоговой коллекции. 
        // Порядок полей взят из примера в задании.
        return {
            bonus: round(bonusValue),
            name: seller.name,
            profit: roundedProfit,
            revenue: round(seller.revenue),
            sales_count: seller.salesCount,
            seller_id: seller.id,
            top_products: topProductsList
        };
    });
}