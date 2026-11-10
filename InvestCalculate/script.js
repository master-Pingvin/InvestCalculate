let myChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadFromStorage();

    document.getElementById('calcBtn').addEventListener('click', calculateResult);
    document.getElementById('taxCheck').addEventListener('change', calculateResult);
    document.getElementById('depositCheck').addEventListener('change', calculateResult);

    // Убрали monthlyIncome из списка полей
    const numberInputs = ['startSum', 'monthlyAdd'];
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
    let startSum = Number(document.getElementById('startSum').value.replace(/[\s\u202F]/g, ''));
    let monthlyAdd = Number(document.getElementById('monthlyAdd').value.replace(/[\s\u202F]/g, ''));
    
    if (isNaN(startSum)) startSum = 0;
    if (isNaN(monthlyAdd)) monthlyAdd = 0;

    let years = Number(document.getElementById('years').value);
    let rate = Number(document.getElementById('rate').value);
    let inflation = Number(document.getElementById('inflation').value);
    let useTax = document.getElementById('taxCheck').checked;
    let useDeposit = document.getElementById('depositCheck').checked;

    if (startSum < 0 || monthlyAdd < 0 || years <= 0 || rate < 0 || inflation < 0) {
        return;
    }

    saveToStorage();

    let monthlyRate = (rate / 100) / 12;
    let months = years * 12;
    let total = startSum;
    let invested = startSum;
    
    // Общая сумма процентов, начисленных за всё время
    let totalInterestIncome = 0; 

    let labels = ['Старт'];
    let dataTotal = [total];
    let dataInvested = [invested];
    let dataDeposit = [total];
    let dataInterest = [0]; // Массив для графика процентов

    let depositMonthlyRate = (10 / 100) / 12;
    let depositTotal = startSum;

    for (let i = 1; i <= months; i++) {
        // 1. Считаем, сколько процентов начислилось за этот месяц
        let monthlyInterest = total * monthlyRate;
        
        // 2. Добавляем эти проценты к общей сумме
        total = total + monthlyInterest;
        
        // 3. Прибавляем ваше пополнение
        total = total + monthlyAdd;
        invested = invested + monthlyAdd;

        // 4. Суммируем все полученные проценты за всё время
        totalInterestIncome = totalInterestIncome + monthlyInterest;

        // Банковский вклад
        depositTotal = depositTotal + (depositTotal * depositMonthlyRate);
        depositTotal = depositTotal + monthlyAdd;

        // Каждый год сохраняем данные для графика
        if (i % 12 === 0) {
            labels.push(`Год ${i / 12}`);
            dataTotal.push(total);
            dataInvested.push(invested);
            dataDeposit.push(depositTotal);
            // На график процентов выводим НАКОПЛЕННУЮ сумму процентов за всё время
            dataInterest.push(totalInterestIncome); 
        }
    }

    let profit = total - invested;
    
    // Налог платим с прибыли (проценты) и с процентов (если решите их снимать)
    let taxableBase = profit; 
    let tax = useTax ? taxableBase * 0.13 : 0;
    
    let finalProfit = profit - tax;
    let finalTotal = invested + finalProfit;
    let realValue = finalTotal / Math.pow((1 + (inflation / 100)), years);

    animateValue("investedResult", invested);
    animateValue("taxResult", tax);
    animateValue("profitResult", finalProfit, "+");
    animateValue("totalResult", finalTotal);
    animateValue("realResult", realValue);

    renderChart(labels, dataTotal, dataInvested, useDeposit ? dataDeposit : null, dataInterest);
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

// Добавили параметр dataInterest для графика
function renderChart(labels, dataTotal, dataInvested, dataDeposit, dataInterest) {
    const ctx = document.getElementById('myChart').getContext('2d');
    if (myChart) myChart.destroy();

    let datasets = [
        { label: 'Ваш капитал (₽)', data: dataTotal, borderColor: '#FA9021', backgroundColor: 'rgba(250, 144, 33, 0.1)', borderWidth: 3, fill: true, tension: 0.4 },
        { label: 'Ваши вложения (₽)', data: dataInvested, borderColor: '#4CAF50', borderWidth: 2, borderDash: [5, 5], fill: false, tension: 0.4 },
        // Новая линия для процентов
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

function saveToStorage() {
    const data = {
        startSum: document.getElementById('startSum').value.replace(/[\s\u202F]/g, ''),
        monthlyAdd: document.getElementById('monthlyAdd').value.replace(/[\s\u202F]/g, ''),
        years: document.getElementById('years').value,
        rate: document.getElementById('rate').value,
        inflation: document.getElementById('inflation').value,
        taxCheck: document.getElementById('taxCheck').checked
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
            document.getElementById('years').value = data.years || '10';
            document.getElementById('rate').value = data.rate || '12';
            document.getElementById('inflation').value = data.inflation || '6';
            document.getElementById('taxCheck').checked = data.taxCheck || false;
        } catch (e) {
            console.log("Ошибка загрузки данных", e);
        }
    }
}