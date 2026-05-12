/**
 * NeuroAim Lab - Sanity Test Suite
 * Запустіть цей файл у консолі браузера або додайте в HTML
 */

const runTests = () => {
    console.group("🚀 NeuroAim Lab: Запуск діагностики...");
    const results = [];

    const check = (name, condition) => {
        const status = condition ? "✅ PASS" : "❌ FAIL";
        console.log(`${status}: ${name}`);
        results.push({ name, status: condition });
    };

    // 1. Перевірка DOM елементів
    const criticalElements = [
        'aim-canvas', 'start-btn', 'target-size', 'target-speed', 
        'target-accel', 'target-chaos', 'input-sens'
    ];
    
    criticalElements.forEach(id => {
        check(`Елемент #${id} існує`, document.getElementById(id) !== null);
    });

    // 2. Перевірка об'єкта експерименту
    check("Об'єкт 'lab' ініціалізовано", typeof lab !== 'undefined');
    if (typeof lab !== 'undefined') {
        check("Canvas знайдено об'єктом lab", lab.canvas !== null);
        check("Ціль ініціалізована", lab.target !== null);
        check("Context 2D доступний", lab.ctx !== null);
    }

    // 3. Перевірка логіки фізики
    if (typeof lab !== 'undefined' && lab.target) {
        lab.target.reset();
        const isFinitePos = isFinite(lab.target.x) && isFinite(lab.target.y);
        check("Початкові координати цілі коректні (не NaN)", isFinitePos);
        check("Радіус цілі коректний", lab.target.radius > 0);
    }

    console.groupEnd();
    
    if (results.every(r => r.status)) {
        console.log("✨ Всі системи в нормі. Якщо коло не з'являється, перевірте верстку (CSS).");
    } else {
        console.error("🚨 Знайдено критичні помилки! Перевірте лог вище.");
    }
};

window.runDiagnostics = runTests;
