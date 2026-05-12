class Target {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.reset();
    }
    reset() {
        this.x = this.canvas.width / 2;
        this.y = this.canvas.height / 2;
        this.vx = 0; this.vy = 0;
        this.targetVX = 0; this.targetVY = 0;
        this.radius = parseInt(document.getElementById('target-size').value);
        this.speed = parseInt(document.getElementById('target-speed').value);
        this.accel = parseInt(document.getElementById('target-accel').value) / 100;
        this.chaos = parseInt(document.getElementById('target-chaos').value) / 100;
    }
    update() {
        if (Math.random() < this.chaos) {
            this.targetVX = (Math.random() - 0.5) * this.speed;
            this.targetVY = (Math.random() - 0.5) * this.speed;
        }
        this.vx += (this.targetVX - this.vx) * this.accel;
        this.vy += (this.targetVY - this.vy) * this.accel;
        this.x += this.vx; this.y += this.vy;

        let minY = this.radius;
        if (document.getElementById('touch-offset').checked) minY += 80;

        if (this.x < this.radius || this.x > this.canvas.width - this.radius) { this.vx *= -1; this.x = Math.max(this.radius, Math.min(this.canvas.width - this.radius, this.x)); }
        if (this.y < minY || this.y > this.canvas.height - this.radius) { this.vy *= -1; this.y = Math.max(minY, Math.min(this.canvas.height - this.radius, this.y)); }
    }
    draw(rX, rY) {
        const x = rX || this.x; const y = rY || this.y;
        this.ctx.beginPath(); this.ctx.arc(x, y, this.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(56, 189, 248, 0.2)'; this.ctx.fill();
        this.ctx.strokeStyle = '#38bdf8'; this.ctx.lineWidth = 2; this.ctx.stroke();
    }
}

class ResearchApp {
    constructor() {
        this.canvas = document.getElementById('aim-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.target = new Target(this.canvas);
        this.subjectName = "";
        this.currentSession = 0;
        this.sessionsData = [];
        this.active = false;
        
        this.calibrating = false;
        this.calibStep = 0;
        this.calibStartX = null;
        this.calibTotalDist = 0;

        this.mouseX = 0; this.mouseY = 0;
        this.protocol = [
            { type: 'mouse', label: 'Baseline 1', desc: 'Встановлення базового рівня навички роботи з мишею.' },
            { type: 'mouse', label: 'Baseline 2', desc: 'Стабілізація показників точності.' },
            { type: 'mouse', label: 'Baseline 3', desc: 'Фінальна фіксація бази перед втручанням.' },
            { type: 'mouse', label: 'Baseline 4', desc: 'Контрольна сесія.' },
            { type: 'touch', label: 'Intervention 1', desc: 'Втручання: Тренування пальцем для активації нейропластичності.' },
            { type: 'mouse', label: 'Transfer 1', desc: 'Тест переносу: Перевірка впливу тренування пальцем на аім мишею.' },
            { type: 'touch', label: 'Intervention 2', desc: 'Повторне втручання пальцем.' },
            { type: 'mouse', label: 'Transfer 2', desc: 'Відстеження динаміки покращення.' },
            { type: 'mouse', label: 'Transfer 3', desc: 'Закріплення результату.' },
            { type: 'mouse', label: 'Final Test', desc: 'Фінальна фіксація результатів дослідження.' }
        ];

        // Audio state
        this.aCtx = null;
        this.osc = null;
        this.gainNode = null;

        this.init();
    }

    init() {
        this.setupListeners();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    initAudio() {
        if (this.aCtx && this.aCtx.state !== 'closed') return;
        this.aCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playBeep() {
        this.initAudio();
        if (this.aCtx.state === 'suspended') {
            this.aCtx.resume();
            return; // Skip this beep to allow context to resume
        }
        
        if (this.beepCooldown) return;
        this.beepCooldown = true;

        try {
            const now = this.aCtx.currentTime;
            const osc = this.aCtx.createOscillator();
            const gain = this.aCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(330, now);
            
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
            gain.gain.linearRampToValueAtTime(0, now + 0.1);

            osc.connect(gain);
            gain.connect(this.aCtx.destination);

            osc.start(now);
            osc.stop(now + 0.12);
        } catch (e) {
            console.warn("Audio play failed:", e);
        }

        setTimeout(() => this.beepCooldown = false, 150);
    }

    setupListeners() {
        const tooltip = document.getElementById('calib-tooltip');
        window.addEventListener('pointermove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            if (this.calibrating) {
                tooltip.style.left = (e.clientX + 15) + 'px';
                tooltip.style.top = (e.clientY + 15) + 'px';
                if (this.calibStep === 1) {
                    this.calibTotalDist = Math.abs(e.screenX - this.calibStartX);
                    tooltip.textContent = `Вимірювання: ${Math.round(this.calibTotalDist)}px (Клікніть для збереження)`;
                }
            }
            const sens = parseFloat(document.getElementById('input-sens').value) || 1;
            if (this.active) {
                this.mouseX += (e.clientX - rect.left - this.mouseX) * sens;
                this.mouseY += (e.clientY - rect.top - this.mouseY) * sens;
            } else {
                this.mouseX = e.clientX - rect.left; this.mouseY = e.clientY - rect.top;
            }
            this.mouseX = Math.max(0, Math.min(this.canvas.width, this.mouseX));
            this.mouseY = Math.max(0, Math.min(this.canvas.height, this.mouseY));
        });

        window.addEventListener('click', (e) => {
            this.initAudio(); // Initialize on any click
            if (this.aCtx && this.aCtx.state === 'suspended') this.aCtx.resume();

            if (!this.calibrating) return;
            if (this.calibStep === 0) {
                this.calibStartX = e.screenX;
                this.calibStep = 1;
            } else if (this.calibStep === 1) {
                this.stopCalibration();
            }
        });

        const bind = (id, fn) => { const el = document.getElementById(id); if(el) el.onclick = fn; };
        bind('btn-start-test', () => this.startFlow());
        bind('btn-proceed', () => this.startSession());
        bind('settings-toggle', () => document.getElementById('sidebar').classList.toggle('hidden'));
        bind('btn-restart', () => location.reload());
        bind('btn-download-report', () => this.exportAllRawCSV());
        bind('btn-print-report', () => window.print());
        bind('btn-welcome-calib', (e) => { e.stopPropagation(); this.startCalibration(); });

        document.querySelectorAll('input[type="range"]').forEach(input => {
            input.oninput = (e) => {
                const val = e.target.parentElement.querySelector('.val-display');
                if (val) {
                    let suffix = 'px';
                    if (e.target.id === 'session-duration') suffix = 'с';
                    else if (e.target.id === 'target-speed') suffix = '';
                    else if (e.target.id.includes('accel') || e.target.id.includes('chaos')) suffix = '%';
                    val.textContent = e.target.value + suffix;
                }
            };
        });
    }

    resize() { this.canvas.width = window.innerWidth; this.canvas.height = window.innerHeight; }

    startCalibration() {
        this.calibrating = true; this.calibStep = 0; this.calibStartX = null; this.calibTotalDist = 0;
        document.getElementById('calibration-overlay').classList.remove('hidden');
        document.getElementById('calib-tooltip').textContent = "Натисніть КЛІК, щоб почати (10см)";
    }

    stopCalibration() {
        const total = Math.round(this.calibTotalDist);
        if (total > 50) {
            const autoSens = (2480 / total).toFixed(2);
            document.getElementById('input-sens').value = autoSens;
            document.getElementById('calib-status').textContent = `✅ Калібровка успішна: ${total}px. Sens адаптовано.`;
        }
        this.calibrating = false; this.calibStep = 0;
        document.getElementById('calibration-overlay').classList.add('hidden');
    }

    startFlow() {
        this.subjectName = document.getElementById('subject-name').value || "Анонім";
        this.currentSession = 0; this.sessionsData = [];
        this.initAudio();
        this.showInstruction();
    }

    showInstruction() {
        const config = this.protocol[this.currentSession];
        const duration = document.getElementById('session-duration').value;
        document.getElementById('inst-title').textContent = `${config.label}`;
        document.getElementById('inst-content').innerHTML = `
            <p style="margin-bottom:1rem; font-style:italic; color:var(--text-dim)">${config.desc}</p>
            <p>Введення: <b style="color:var(--accent)">${config.type.toUpperCase()}</b></p>
            <p>Тривалість: <b>${duration} сек.</b></p>
            <p>Ваша мета: максимальна концентрація на центрі цілі.</p>
        `;
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('screen-instruction').classList.remove('hidden');
    }

    startSession() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('screen-test').classList.remove('hidden');
        this.active = true; this.currentData = []; this.target.reset();
        this.sessionStartTime = Date.now(); this.totalMD = 0; this.totalTD = 0;
        this.loop();
    }

    loop() {
        if (!this.active) return;
        const duration = parseInt(document.getElementById('session-duration').value) || 30;
        const elapsed = (Date.now() - this.sessionStartTime) / 1000;
        if (elapsed >= duration) { this.endSession(); return; }

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        const oldTX = this.target.x, oldTY = this.target.y;
        this.target.update();

        let rTX = this.target.x, rTY = this.target.y;
        if (this.protocol[this.currentSession].type === 'touch' && document.getElementById('touch-offset').checked) rTY -= 80;

        this.target.draw(rTX, rTY);

        const dist = Math.sqrt((this.mouseX - rTX)**2 + (this.mouseY - rTY)**2);
        const onT = dist <= this.target.radius;
        if (document.getElementById('audio-feedback').checked && onT) this.playBeep();

        if (this.currentData.length > 0) {
            const prev = this.currentData[this.currentData.length - 1];
            this.totalMD += Math.sqrt((this.mouseX - prev.mx)**2 + (this.mouseY - prev.my)**2);
            this.totalTD += Math.sqrt((this.target.x - oldTX)**2 + (this.target.y - oldTY)**2);
        }
        
        const vars = { 
            speed: this.target.speed, 
            chaos: this.target.chaos, 
            size: this.target.radius, 
            sens: parseFloat(document.getElementById('input-sens').value),
            duration: document.getElementById('session-duration').value
        };
        this.currentData.push({ t: elapsed, tx: rTX, ty: rTY, mx: this.mouseX, my: this.mouseY, onT, dist, vars });

        document.getElementById('stat-session').textContent = `${this.currentSession + 1}/10`;
        document.getElementById('live-tot').textContent = (this.currentData.filter(d => d.onT).length / this.currentData.length * 100).toFixed(0);
        document.getElementById('live-eff').textContent = this.totalMD > 0 ? Math.min(100, (this.totalTD / this.totalMD * 100)).toFixed(0) : 100;

        requestAnimationFrame(() => this.loop());
    }

    endSession() {
        this.active = false;
        const tot = (this.currentData.filter(d => d.onT).length / this.currentData.length * 100).toFixed(1);
        const eff = this.totalMD > 0 ? (this.totalTD / this.totalMD * 100).toFixed(1) : 100;
        const rmse = Math.sqrt(this.currentData.reduce((acc, d) => acc + d.dist**2, 0) / this.currentData.length).toFixed(2);
        const avgError = (this.currentData.reduce((acc, d) => acc + d.dist, 0) / this.currentData.length).toFixed(1);

        let tj = 0;
        for (let i = 2; i < this.currentData.length; i++) {
            const d1 = this.currentData[i], d2 = this.currentData[i-1], d3 = this.currentData[i-2];
            const a = {x: (d1.mx-d2.mx)-(d2.mx-d3.mx), y: (d1.my-d2.my)-(d2.my-d3.my)};
            tj += Math.sqrt(a.x**2 + a.y**2);
        }

        this.sessionsData.push({
            session: this.currentSession + 1, type: this.protocol[this.currentSession].type, label: this.protocol[this.currentSession].label,
            vars: this.currentData[0].vars, tot: parseFloat(tot), eff: parseFloat(eff), jerk: parseFloat((tj / this.currentData.length).toFixed(2)),
            rmse: parseFloat(rmse), error: parseFloat(avgError), raw: this.currentData
        });

        this.currentSession++;
        if (this.currentSession < 10) this.showRest(); else this.showReport();
    }

    showRest() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('screen-rest').classList.remove('hidden');
        
        const lastSession = this.sessionsData[this.sessionsData.length - 1];
        const nextConfig = this.protocol[this.currentSession];
        const duration = document.getElementById('session-duration').value;

        document.getElementById('rest-session-info').textContent = `Сесія ${this.currentSession} завершена (ToT: ${lastSession.tot}%)`;
        document.getElementById('next-session-name').textContent = nextConfig.label;
        document.getElementById('next-session-duration-info').textContent = `Тривалість: ${duration} секунд`;

        let timeLeft = 10;
        const timerEl = document.getElementById('rest-timer'); timerEl.textContent = timeLeft;
        const interval = setInterval(() => {
            timeLeft--; timerEl.textContent = timeLeft;
            if (timeLeft <= 0) { clearInterval(interval); this.showInstruction(); }
        }, 1000);
    }

    showReport() {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.getElementById('screen-report').classList.remove('hidden');
        document.getElementById('rep-name').textContent = this.subjectName;
        document.getElementById('rep-date').textContent = new Date().toLocaleDateString();
        this.renderAllCharts(); this.renderTable(); this.calculateTransferEffect();
    }

    calculateTransferEffect() {
        const mouseBase = this.sessionsData.filter(d => d.session <= 4).map(d => d.tot);
        const mousePost = this.sessionsData.filter(d => d.session >= 6 && d.type === 'mouse').map(d => d.tot);
        const avgBase = (mouseBase.reduce((a, b) => a + b, 0) / mouseBase.length).toFixed(1);
        const avgPost = (mousePost.reduce((a, b) => a + b, 0) / mousePost.length).toFixed(1);
        const delta = (avgPost - avgBase).toFixed(1);
        const percent = ((delta / avgBase) * 100).toFixed(1);
        document.getElementById('transfer-stats').innerHTML = `
            <div class="stat-card"><span>Base (M1-M4)</span><b>${avgBase}%</b></div>
            <div class="stat-card"><span>Post (M6-M10)</span><b>${avgPost}%</b></div>
            <div class="stat-card"><span>Transfer Effect</span><b style="color:${delta > 0 ? '#10b981' : '#ef4444'}">${delta > 0 ? '+' : ''}${delta}% (${percent}%)</b></div>
        `;
    }

    renderTable() {
        document.querySelector('#session-table tbody').innerHTML = this.sessionsData.map(s => `
            <tr><td>${s.session}</td><td>${s.label}</td><td>${s.vars.duration}</td><td>${s.vars.speed}</td><td>${s.vars.chaos}</td><td>${s.vars.sens}</td><td>${s.tot}%</td><td>${s.rmse}</td></tr>
        `).join('');
    }

    renderAllCharts() {
        const labels = this.sessionsData.map(d => d.session);
        const colors = this.sessionsData.map(d => d.type === 'touch' ? '#fbbf24' : '#38bdf8');
        const createChart = (id, label, data, color) => {
            if (this[id]) this[id].destroy();
            this[id] = new Chart(document.getElementById(id), {
                type: 'line', data: { labels, datasets: [{ label, data, borderColor: color, pointBackgroundColor: colors, pointRadius: 5, tension: 0.3, fill: false }] },
                options: { maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, animation: false }
            });
        };
        createChart('chart-tot', 'Accuracy (RMSE)', this.sessionsData.map(d => d.rmse), '#38bdf8');
        createChart('chart-eff', 'Path Efficiency (%)', this.sessionsData.map(d => d.eff), '#10b981');
        createChart('chart-jerk', 'Motor Stability (Jerk)', this.sessionsData.map(d => d.jerk), '#f43f5e');
        createChart('chart-error', 'Avg Error (px)', this.sessionsData.map(d => d.error), '#fbbf24');
    }

    exportAllRawCSV() {
        let csv = "Subject,Session,SessionType,Time,TargetX,TargetY,MouseX,MouseY,Distance,OnTarget,Speed,Chaos,Radius,Sens\n";
        this.sessionsData.forEach(s => { s.raw.forEach(r => {
            csv += `${this.subjectName},${s.session},${s.type},${r.t.toFixed(3)},${r.tx.toFixed(1)},${r.ty.toFixed(1)},${r.mx},${r.my},${r.dist.toFixed(2)},${r.onT},${r.vars.speed},${r.vars.chaos},${r.vars.size},${r.vars.sens}\n`;
        }); });
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = `scientific_raw_data_${this.subjectName}.csv`; a.click();
    }
}
window.onload = () => { window.app = new ResearchApp(); };
