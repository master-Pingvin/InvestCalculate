let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();

    // Обработчики
    document.getElementById('calcBtn').addEventListener('click', calculateResult);
    document.getElementById('taxCheck').addEventListener('change', calculateResult);
    document.getElementById('depositCheck').addEventListener('change', calculateResult);
    document.getElementById('reinvestCheck').addEventListener('change', calculateResult);
    document.getElementById('statsCheck').addEventListener('change', calculateResult);
    document.getElementById('periodUnit').addEventListener('change', () => {
        // При смене единицы меняем значение по умолчанию для удобства
        const unit = document.getElementById('periodUnit').value;
        const input = document.getElementById('periodInput');
        if (unit === 'years' && Number(input.value) > 50) input.value = 10;
        if (unit === 'months' && Number(input.value) > 600) input.value = 12;
        calculateResult();
    });

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
    // 1. Сбор данных
    let startSum = Number(document.getElementById('startSum').value.replace(/[\s\u202F]/g, ''));
    let monthlyAdd = Number(document.getElementById('monthlyAdd').value.replace(/[\s\u202F]/g, ''));
    let monthlyWithdraw = Number(document.getElementById('monthlyWithdraw').value.replace(/[\s\u202F]/g, ''));
    
    if (isNaN(startSum)) startSum = 0;
    if (isNaN(monthlyAdd)) monthlyAdd = 0;
    if (isNaN(monthlyWithdraw)) monthlyWithdraw = 0;

    let periodVal = Number(document.getElementById('periodInput').value);
    let periodUnit = document.getElementById('periodUnit').value;
    
    // Перевод в годы и месяцы
    let years = periodUnit === 'years' ? periodVal : periodVal / 12;
    let months = periodUnit === 'years' ? periodVal * 12 : periodVal;

    if (years > 100) {
        alert("Максимальный срок для расчета — 100 лет.");
        return;
    }
    if (years <= 0) return;

    let rate = Number(document.getElementById('rate').value);
    let inflation = Number(document.getElementById('inflation').value);
    let annualIncrease = Number(document.getElementById('annualIncrease').value) / 100;
    
    let useTax = document.getElementById('taxCheck').checked;
    let useDeposit = document.getElementById('depositCheck').checked;
    let isReinvest = document.getElementById('reinvestCheck').checked;
    let showStats = document.getElementById('statsCheck').checked;

    if (startSum < 0 || monthlyAdd < 0 || monthlyWithdraw < 0 || rate < 0 || inflation < 0) return;

    saveToStorage();

    // 2. Математика
    let monthlyRate = (rate / 100) / 12;
    let inflationMonthly = (inflation / 100) / 12;
    
    let total = startSum;
    let invested = startSum;
    let totalInterestIncome = 0;
    let totalWithdrawn = 0; 
    let currentMonthlyWithdraw = monthlyWithdraw; // Для индексации снятий

    // Данные для графиков
    let labels = ['Старт'];
    let dataTotal = [total];
    let dataInvested = [invested];
    let dataDeposit = [total];
    let dataInterest = [0];

    // Для статистики
    let monthlyStatsData = [];

    let depositMonthlyRate = (10 / 100) / 12;
    let depositTotal = startSum;
    let currentMonthlyAdd = monthlyAdd;

    // 3. Цикл по месяцам
    for (let i = 1; i <= months; i++) {
        // Начисление процентов
        let monthlyInterest = total * monthlyRate;
        
        if (isReinvest) {
            total = total + monthlyInterest;
        } else {
            totalWithdrawn = totalWithdrawn + monthlyInterest;
        }
        totalInterestIncome = totalInterestIncome + monthlyInterest;
        
        // Пополнение / Снятие
        total = total + currentMonthlyAdd - currentMonthlyWithdraw;
        invested = invested + currentMonthlyAdd;
        totalWithdrawn = totalWithdrawn + currentMonthlyWithdraw;

        // Банковский вклад
        depositTotal = depositTotal + (depositTotal * depositMonthlyRate);
        depositTotal = depositTotal + currentMonthlyAdd;

        // Ежегодная индексация (раз в 12 месяцев)
        if (i % 12 === 0) {
            if (annualIncrease > 0) currentMonthlyAdd = currentMonthlyAdd * (1 + annualIncrease);
            // Индексация снятий на инфляцию
            if (inflation > 0 && currentMonthlyWithdraw > 0) currentMonthlyWithdraw = currentMonthlyWithdraw * (1 + (inflation / 100));
        }

        // Сбор данных для графика (умный шаг)
                // Сбор данных для графика (умный шаг)
        let shouldAddPoint = false;
        if (months <= 12) shouldAddPoint = true; // До года - каждый месяц
        else if (months <= 36 && i % 2 === 0) shouldAddPoint = true; // 1-3 года - раз в 2 мес
        else if (months <= 60 && i % 6 === 0) shouldAddPoint = true; // 3-5 лет - раз в полгода
        else if (months > 60 && i % 12 === 0) shouldAddPoint = true; // Больше 5 лет - раз в год

        // Убрали принудительное добавление i === 1, чтобы не было точки "0.0833 года"
        if (shouldAddPoint) { 
            let labelText = '';
            if (months <= 12) labelText = `${i} мес`;
            else if (months <= 36) labelText = `${i} мес`;
            else if (months <= 60) labelText = `${i} мес`;
            else labelText = `Год ${i / 12}`;
            
            labels.push(labelText);
            dataTotal.push(total);
            dataInvested.push(invested);
            dataDeposit.push(depositTotal);
            dataInterest.push(totalInterestIncome);
        }

        // Сбор данных для статистики
        if (showStats) {
            monthlyStatsData.push({
                month: i,
                invested: invested,
                interest: monthlyInterest, // Локальный доход за месяц
                withdrawn: currentMonthlyWithdraw, // Текущее снятие (с индексацией)
                total: total
            });
        }
    }

    // 4. Итоги
    let profit = total + totalWithdrawn - invested;
    let tax = useTax ? profit * 0.13 : 0;
    let finalProfit = profit - tax;
    let finalTotal = total;
    let realValue = finalTotal / Math.pow((1 + (inflation / 100)), years);
    
    let realRate = ((1 + (rate/100)) / (1 + (inflation/100))) - 1;
    if (useTax) realRate = realRate - (realRate * 0.13);

    // 5. Вывод
    animateValue("investedResult", invested);
    animateValue("taxResult", tax);
    animateValue("profitResult", finalProfit, "+");
    animateValue("totalResult", finalTotal);
    animateValue("realResult", realValue);
    
    // Анимация процентов
    animateValue("realRateResult", realRate * 100, "", "%", true);

    // Строка "Выплачено на руки"
    const withdrawnCard = document.getElementById('withdrawnResultCard');
    if (totalWithdrawn > 0) {
        withdrawnCard.style.display = 'flex';
        animateValue("withdrawnResult", totalWithdrawn);
    } else {
        withdrawnCard.style.display = 'none';
    }

    // Отрисовка
    renderChart(labels, dataTotal, dataInvested, useDeposit ? dataDeposit : null, dataInterest);
    
    if (showStats) {
        renderMonthlyStats(monthlyStatsData, monthlyWithdraw > 0);
        document.getElementById('monthlyStatsContainer').classList.remove('hidden');
    } else {
        document.getElementById('monthlyStatsContainer').classList.add('hidden');
    }
}

// Обновленная функция анимации (с поддержкой процентов)
function animateValue(id, endValue, prefix = "", suffix = " ₽", isPercent = false) {
    const obj = document.getElementById(id);
    
    if (isNaN(endValue) || !isFinite(endValue)) {
        obj.textContent = prefix + "0" + suffix;
        return;
    }

    let startTimestamp = null;
    const duration = 800;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        let currentValue = progress * endValue;
        
        if (isPercent) {
            obj.textContent = prefix + currentValue.toFixed(1) + suffix;
        } else {
            obj.textContent = prefix + formatNumber(Math.floor(currentValue)) + suffix;
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            if (isPercent) {
                obj.textContent = prefix + endValue.toFixed(1) + suffix;
            } else {
                obj.textContent = prefix + formatNumber(endValue) + suffix;
            }
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

function renderMonthlyStats(data, showWithdrawn) {
    const container = document.getElementById('monthlyStatsContent');
    container.innerHTML = ''; 

    if (data.length === 0) return;

    let displayData = data.slice(0, 12);
    if (data.length > 24) {
        displayData = displayData.concat(data.slice(-12));
    } else if (data.length > 12) {
        displayData = data; 
    }

    // Формируем заголовок таблицы в зависимости от наличия снятий
    let tableHTML = `
        <table class="stats-table">
            <thead>
                <tr>
                    <th>Месяц</th>
                    <th>Вложено (₽)</th>
                    <th>Доход (₽)</th>
                    ${showWithdrawn ? '<th>Снято (₽)</th>' : ''}
                    <th>Капитал (₽)</th>
                </tr>
            </thead>
            <tbody>
    `;

    displayData.forEach((row, index) => {
        if (index === 12 && data.length > 24) {
            tableHTML += `<tr><td colspan="${showWithdrawn ? 5 : 4}" style="text-align:center; color:#555;">... (пропущено ${data.length - 24} месяцев) ...</td></tr>`;
        }
        tableHTML += `
            <tr>
                <td>${row.month}</td>
                <td>${formatNumber(row.invested)}</td>
                <td style="color: #4CAF50;">+${formatNumber(row.interest)}</td>
                ${showWithdrawn ? `<td style="color: #3498db;">${formatNumber(row.withdrawn)}</td>` : ''}
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
        periodVal: document.getElementById('periodInput').value,
        periodUnit: document.getElementById('periodUnit').value,
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
            
            // Загрузка срока
            if (data.periodVal !== undefined) {
                 document.getElementById('periodInput').value = data.periodVal;
                 document.getElementById('periodUnit').value = data.periodUnit || 'years';
            } else if (data.years !== undefined) {
                 // Совместимость со старыми данными
                 document.getElementById('periodInput').value = data.years;
                 document.getElementById('periodUnit').value = 'years';
            }
            
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
