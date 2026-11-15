let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();

    // Обработчики кнопок и переключателей
    document.getElementById('calcBtn').addEventListener('click', calculateResult);
    document.getElementById('taxCheck').addEventListener('change', calculateResult);
    document.getElementById('depositCheck').addEventListener('change', calculateResult);
    document.getElementById('reinvestCheck').addEventListener('change', calculateResult);
    document.getElementById('statsCheck').addEventListener('change', calculateResult);

    // Показ/скрытие расширенных настроек
    const advancedToggle = document.getElementById('advancedToggleBtn');
    const advancedSettings = document.getElementById('advancedSettings');
    advancedToggle.addEventListener('click', () => {
        advancedSettings.classList.toggle('hidden');
        advancedToggle.classList.toggle('active');
        const textSpan = advancedToggle.querySelector('span');
        if (advancedSettings.classList.contains('hidden')) {
            textSpan.textContent = 'Показать расширенные настройки';
        } else {
            textSpan.textContent = 'Скрыть расширенные настройки';
        }
    });

    // Маска для полей ввода
    const numberInputs = ['startSum', 'monthlyAdd', 'monthlyWithdraw'];
    numberInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input.type === 'text') {
            input.value = formatNumberInput(input.value);
        }
        
        input.addEventListener('blur', () => {
            input.value = formatNumberInput(input.value);
        });
        input.addEventListener('focus', () => {
            input.value = input.value.replace(/[\s\u202F]/g, '');
        });
    });

    calculateResult();
});

function formatNumber(num) {
    if (isNaN(num) || !isFinite(num)) return "0";
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
}

function formatNumberInput(val) {
    let num = String(val).replace(/\D/g, '');
    if (!num) return '';
    return num.replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
}

function calculateResult() {
    // Сбор данных
    let startSum = Number(document.getElementById('startSum').value.replace(/[\s\u202F]/g, ''));
    let monthlyAdd = Number(document.getElementById('monthlyAdd').value.replace(/[\s\u202F]/g, ''));
    let monthlyWithdraw = Number(document.getElementById('monthlyWithdraw').value.replace(/[\s\u202F]/g, ''));
    
    if (isNaN(startSum)) startSum = 0;
    if (isNaN(monthlyAdd)) monthlyAdd = 0;
    if (isNaN(monthlyWithdraw)) monthlyWithdraw = 0;

    let years = Number(document.getElementById('years').value);
    if (years > 100) {
        alert("Максимальный срок для расчета — 100 лет.");
        document.getElementById('years').value = 10;
        years = 10;
    }
    
    let rate = Number(document.getElementById('rate').value);
    let inflation = Number(document.getElementById('inflation').value);
    let annualIncrease = Number(document.getElementById('annualIncrease').value) / 100;
    
    let useTax = document.getElementById('taxCheck').checked;
    let useDeposit = document.getElementById('depositCheck').checked;
    let isReinvest = document.getElementById('reinvestCheck').checked;
    let showStats = document.getElementById('statsCheck').checked;

    if (startSum < 0 || monthlyAdd < 0 || monthlyWithdraw < 0 || years <= 0 || rate < 0 || inflation < 0) {
        return;
    }

    saveToStorage();

    let monthlyRate = (rate / 100) / 12;
    let months = years * 12;
    let total = startSum;
    let invested = startSum;
    let totalInterestIncome = 0;
    let totalWithdrawn = 0; // Для учета снятий

    // Данные для графиков (по годам или месяцам)
    let labels = ['Старт'];
    let dataTotal = [total];
    let dataInvested = [invested];
    let dataDeposit = [total];
    let dataInterest = [0];

    // Для статистики по месяцам
    let monthlyStatsData = [];

    let depositMonthlyRate = (10 / 100) / 12;
    let depositTotal = startSum;
    let currentMonthlyAdd = monthlyAdd;

    for (let i = 1; i <= months; i++) {
        // 1. Начисляем проценты
        let monthlyInterest = total * monthlyRate;
        
        if (isReinvest) {
            total = total + monthlyInterest;
            totalInterestIncome = totalInterestIncome + monthlyInterest;
        } else {
            // Если не реинвестируем, проценты уходят в "выплачено на руки"
            totalWithdrawn = totalWithdrawn + monthlyInterest;
            totalInterestIncome = totalInterestIncome + monthlyInterest;
        }
        
        // 2. Пополнение / Снятие
        // Если мы снимаем больше, чем пополняем, это уменьшает капитал
        total = total + currentMonthlyAdd - monthlyWithdraw;
        invested = invested + currentMonthlyAdd;
        totalWithdrawn = totalWithdrawn + monthlyWithdraw;

        // 3. Банковский вклад (для сравнения)
        depositTotal = depositTotal + (depositTotal * depositMonthlyRate);
        depositTotal = depositTotal + currentMonthlyAdd;

        // 4. Увеличение взноса раз в год
        if (annualIncrease > 0 && i % 12 === 0) {
            currentMonthlyAdd = currentMonthlyAdd * (1 + annualIncrease);
        }

        // 5. Сбор данных для графиков
        // Если срок <= 5 лет, собираем каждый месяц. Иначе раз в год.
        if (years <= 5 || i % 12 === 0 || i === 1) {
            labels.push(i === 1 ? '1 мес' : (years <= 5 ? `${i} мес` : `Год ${i / 12}`));
            dataTotal.push(total);
            dataInvested.push(invested);
            dataDeposit.push(depositTotal);
            dataInterest.push(totalInterestIncome);
        }

        // 6. Сбор данных для статистики (если включено)
        if (showStats) {
            monthlyStatsData.push({
                month: i,
                invested: invested,
                interest: totalInterestIncome,
                withdrawn: totalWithdrawn,
                total: total
            });
        }
    }

    // Расчет итоговых показателей
    let profit = total + totalWithdrawn - invested;
    
    // Налог (упрощенно считаем со всей прибыли + снятий)
    let taxableBase = profit; 
    let tax = useTax ? taxableBase * 0.13 : 0;
    
    let finalProfit = profit - tax;
    let finalTotal = total; // Капитал на счету
    let realValue = finalTotal / Math.pow((1 + (inflation / 100)), years);
    
    // Реальная доходность (упрощенная формула Фишера)
    // ((1 + номинальная) / (1 + инфляция)) - 1
    let realRate = ((1 + (rate/100)) / (1 + (inflation/100))) - 1;
    // Учтем налог, если он есть (упрощенно уменьшим ставку)
    if (useTax) realRate = realRate - (realRate * 0.13);

    // Вывод результатов
    animateValue("investedResult", invested);
    animateValue("taxResult", tax);
    animateValue("profitResult", finalProfit, "+");
    animateValue("totalResult", finalTotal);
    animateValue("realResult", realValue);
    document.getElementById('realRateResult').textContent = (realRate * 100).toFixed(1) + '%';

    // Показ/скрытие строки "Выплачено на руки"
    const withdrawnCard = document.getElementById('withdrawnResultCard');
    if (totalWithdrawn > 0) {
        withdrawnCard.style.display = 'flex';
        animateValue("withdrawnResult", totalWithdrawn);
    } else {
        withdrawnCard.style.display = 'none';
    }

    // Отрисовка графиков и таблицы
    renderChart(labels, dataTotal, dataInvested, useDeposit ? dataDeposit : null, dataInterest);
    
    if (showStats) {
        renderMonthlyStats(monthlyStatsData);
        document.getElementById('monthlyStatsContainer').classList.remove('hidden');
    } else {
        document.getElementById('monthlyStatsContainer').classList.add('hidden');
    }
}

function animateValue(id, endValue, prefix = "") {
    const obj = document.getElementById(id);
    
    if (isNaN(endValue) || !isFinite(endValue)) {
        obj.textContent = prefix + "0 ₽";
        return;
    }

    let startTimestamp = null;
    const duration = 800;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        const currentValue = Math.floor(progress * endValue);
        obj.textContent = prefix + formatNumber(currentValue) + ' ₽';
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.textContent = prefix + formatNumber(endValue) + ' ₽';
        }
    };
    window.requestAnimationFrame(step);
}

function renderChart(labels, dataTotal, dataInvested, dataDeposit, dataInterest) {
    const ctx = document.getElementById('myChart').getContext('2d');
    if (myChart) myChart.destroy();

    let datasets = [
        { label: 'Ваш капитал (₽)', data: dataTotal, borderColor: '#FA9021', backgroundColor: 'rgba(250, 144, 33, 0.1)', borderWidth: 3, fill: true, tension: 0.4 },
        { label: 'Ваши вложения (₽)', data: dataInvested, borderColor: '#4CAF50', borderWidth: 2, borderDash: [5, 5], fill: false, tension: 0.4 },
        { label: 'Доход от процентов (₽)', data: dataInterest, borderColor: '#9b59b6', borderWidth: 2, borderDash: [1, 3], fill: false, tension: 0.4 }
    ];

    if (dataDeposit) {
        datasets.push({ label: 'Банковский вклад (10%) (₽)', data: dataDeposit, borderColor: '#3498db', borderWidth: 2, borderDash: [2, 4], fill: false, tension: 0.4 });
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#fff' } },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += formatNumber(context.parsed.y) + ' ₽';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: '#a0a0a0' }, grid: { color: '#2a2e37' } },
                y: { 
                    ticks: { 
                        color: '#a0a0a0',
                        callback: function(value) { return formatNumber(value); }
                    }, 
                    grid: { color: '#2a2e37' } 
                }
            }
        }
    });
}

function renderMonthlyStats(data) {
    const container = document.getElementById('monthlyStatsContent');
    container.innerHTML = ''; // Очищаем предыдущую таблицу

    if (data.length === 0) return;

    // Берем первые 12 месяцев и последние 12 месяцев (если срок больше 1 года)
    let displayData = data.slice(0, 12);
    if (data.length > 24) {
        displayData = displayData.concat(data.slice(-12));
    } else if (data.length > 12) {
        displayData = data; // Если срок до 2 лет, показываем все
    }

    let tableHTML = `
        <table class="stats-table">
            <thead>
                <tr>
                    <th>Месяц</th>
                    <th>Вложено (₽)</th>
                    <th>Доход (₽)</th>
                    <th>Снято (₽)</th>
                    <th>Капитал (₽)</th>
                </tr>
            </thead>
            <tbody>
    `;

    displayData.forEach(row => {
        // Добавляем разделитель, если показываем начало и конец
        if (displayData.indexOf(row) === 12 && data.length > 24) {
            tableHTML += `<tr><td colspan="5" style="text-align:center; color:#555;">... (пропущено ${data.length - 24} месяцев) ...</td></tr>`;
        }
        tableHTML += `
            <tr>
                <td>${row.month}</td>
                <td>${formatNumber(row.invested)}</td>
                <td style="color: #4CAF50;">+${formatNumber(row.interest)}</td>
                <td style="color: #3498db;">${formatNumber(row.withdrawn)}</td>
                <td style="color: #FA9021; font-weight: 600;">${formatNumber(row.total)}</td>
            </tr>
        `;
    });

    tableHTML += `</tbody></table>`;
    container.innerHTML = tableHTML;
}

function saveToStorage() {
    const data = {
        startSum: document.getElementById('startSum').value.replace(/[\s\u202F]/g, ''),
        monthlyAdd: document.getElementById('monthlyAdd').value.replace(/[\s\u202F]/g, ''),
        monthlyWithdraw: document.getElementById('monthlyWithdraw').value.replace(/[\s\u202F]/g, ''),
        years: document.getElementById('years').value,
        rate: document.getElementById('rate').value,
        inflation: document.getElementById('inflation').value,
        annualIncrease: document.getElementById('annualIncrease').value,
        taxCheck: document.getElementById('taxCheck').checked,
        reinvestCheck: document.getElementById('reinvestCheck').checked
    };
    localStorage.setItem('investCalcData', JSON.stringify(data));
}

function loadFromStorage() {
    const saved = localStorage.getItem('investCalcData');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            document.getElementById('startSum').value = formatNumberInput(data.startSum || '100000');
            document.getElementById('monthlyAdd').value = formatNumberInput(data.monthlyAdd || '10000');
            document.getElementById('monthlyWithdraw').value = formatNumberInput(data.monthlyWithdraw || '0');
            document.getElementById('years').value = data.years || '10';
            document.getElementById('rate').value = data.rate || '12';
            document.getElementById('inflation').value = data.inflation || '6';
            document.getElementById('annualIncrease').value = data.annualIncrease || '0';
            document.getElementById('taxCheck').checked = data.taxCheck || false;
            document.getElementById('reinvestCheck').checked = data.reinvestCheck !== undefined ? data.reinvestCheck : true;
        } catch (e) {
            console.log("Ошибка загрузки данных", e);
        }
    }
}
