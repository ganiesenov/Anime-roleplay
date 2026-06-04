/* effects.js — per-character ambient particle effects on #particle-canvas. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    const BASE = { none: 0, snow: 120, rain: 150, sparks: 140, fireflies: 55, sakura: 35, fog: 30, steam: 55, aurora: 5, leaves: 40, darkness: 18 };
    const EMOJI = { none: '❌', snow: '❄️', rain: '🌧️', sparks: '🔥', fireflies: '🟢', sakura: '🌸', fog: '🌫️', steam: '♨️', aurora: '🌌', leaves: '🍂', darkness: '🌑' };

    let canvas, ctx, rafId = null;
    let particles = [];
    window.currentParticleEffect = 'none';
    let intensityFactor = 1;

    function ensureCanvas() {
        canvas = $('particle-canvas');
        if (!canvas) return false;
        ctx = canvas.getContext('2d');
        resize();
        return true;
    }
    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);

    function rand(a, b) { return a + Math.random() * (b - a); }

    function seed(effect) {
        particles = [];
        const target = Math.round((BASE[effect] || 0) * intensityFactor);
        for (let i = 0; i < target; i++) particles.push(spawn(effect));
    }
    function spawn(effect) {
        const w = canvas.width, h = canvas.height;
        switch (effect) {
            case 'snow': return { x: rand(0, w), y: rand(0, h), r: rand(1, 3.5), vy: rand(0.4, 1.4), vx: rand(-0.4, 0.4) };
            case 'rain': return { x: rand(0, w), y: rand(0, h), len: rand(8, 18), vy: rand(8, 14) };
            case 'sparks': return { x: rand(0, w), y: rand(0, h), r: rand(0.8, 2.4), vy: rand(-1.6, -0.4), vx: rand(-0.5, 0.5), life: rand(0.3, 1) };
            case 'fireflies': return { x: rand(0, w), y: rand(0, h), r: rand(1, 2.5), phase: rand(0, Math.PI * 2), vx: rand(-0.3, 0.3), vy: rand(-0.3, 0.3) };
            case 'sakura': return { x: rand(0, w), y: rand(0, h), r: rand(3, 7), vy: rand(0.6, 1.4), vx: rand(-0.6, 0.6), rot: rand(0, Math.PI * 2), vr: rand(-0.05, 0.05) };
            case 'fog': return { x: rand(0, w), y: rand(0, h), r: rand(60, 160), vx: rand(-0.3, 0.3), a: rand(0.02, 0.08) };
            case 'steam': return { x: rand(0, w), y: rand(h * 0.6, h), r: rand(20, 60), vy: rand(-1.2, -0.4), a: rand(0.03, 0.1) };
            case 'aurora': return { x: rand(0, w), y: rand(0, h * 0.5), r: rand(120, 300), hue: rand(120, 280), a: rand(0.05, 0.12), vx: rand(-0.2, 0.2) };
            case 'leaves': return { x: rand(0, w), y: rand(-h, h), r: rand(4, 9), vy: rand(0.8, 1.8), vx: rand(-0.8, 0.8), rot: rand(0, 6.28), vr: rand(-0.08, 0.08) };
            case 'darkness': return { x: rand(0, w), y: rand(0, h), r: rand(40, 120), a: rand(0.05, 0.15) };
            default: return { x: rand(0, w), y: rand(0, h) };
        }
    }

    function trimToTarget(effect) {
        const target = Math.round((BASE[effect] || 0) * intensityFactor);
        if (particles.length > target) particles.length = target;
        else while (particles.length < target) particles.push(spawn(effect));
    }

    function draw() {
        const effect = window.currentParticleEffect;
        if (effect === 'none' || !ctx) { stopParticles(); return; }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        trimToTarget(effect);
        const w = canvas.width, h = canvas.height;

        if (effect === 'darkness') { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, w, h); }

        particles.forEach((p) => {
            switch (effect) {
                case 'snow':
                    p.y += p.vy; p.x += p.vx; if (p.y > h) { p.y = -5; p.x = rand(0, w); }
                    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
                    break;
                case 'rain':
                    p.y += p.vy; if (p.y > h) { p.y = -p.len; p.x = rand(0, w); }
                    ctx.strokeStyle = 'rgba(170,200,255,0.5)'; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y + p.len); ctx.stroke();
                    break;
                case 'sparks':
                    p.y += p.vy; p.x += p.vx; p.life -= 0.01; if (p.life <= 0 || p.y < 0) { Object.assign(p, spawn('sparks'), { y: h + 5 }); }
                    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,150,40,' + Math.max(0, p.life) + ')';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
                    break;
                case 'fireflies':
                    p.x += p.vx; p.y += p.vy; p.phase += 0.05;
                    if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1;
                    ctx.globalCompositeOperation = 'lighter'; ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(180,255,120,0.8)';
                    ctx.fillStyle = 'rgba(190,255,130,' + (0.4 + 0.4 * Math.sin(p.phase)) + ')';
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'source-over';
                    break;
                case 'sakura':
                    p.y += p.vy; p.x += p.vx; p.rot += p.vr; if (p.y > h) { p.y = -8; p.x = rand(0, w); }
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.fillStyle = 'rgba(255,183,206,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, 6.28); ctx.fill(); ctx.restore();
                    break;
                case 'fog':
                    p.x += p.vx; if (p.x > w + p.r) p.x = -p.r; if (p.x < -p.r) p.x = w + p.r;
                    ctx.fillStyle = 'rgba(200,200,210,' + p.a + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
                    break;
                case 'steam':
                    p.y += p.vy; p.a -= 0.0008; if (p.y < 0 || p.a <= 0) Object.assign(p, spawn('steam'));
                    ctx.fillStyle = 'rgba(230,230,235,' + Math.max(0, p.a) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
                    break;
                case 'aurora':
                    p.x += p.vx; if (p.x > w + p.r) p.x = -p.r;
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
                    g.addColorStop(0, 'hsla(' + p.hue + ',80%,60%,' + p.a + ')');
                    g.addColorStop(1, 'hsla(' + p.hue + ',80%,60%,0)');
                    ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
                    break;
                case 'leaves':
                    p.y += p.vy; p.x += p.vx + Math.sin(p.y / 40); p.rot += p.vr; if (p.y > h) { p.y = -10; p.x = rand(0, w); }
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
                    ctx.fillStyle = 'rgba(200,120,40,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 6.28); ctx.fill(); ctx.restore();
                    break;
                case 'darkness':
                    ctx.fillStyle = 'rgba(0,0,0,' + p.a + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
                    break;
            }
        });

        if (effect === 'darkness') {
            const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
            vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
        }

        rafId = requestAnimationFrame(draw);
    }

    function startParticles(effect, savedIntensity) {
        if (!ensureCanvas()) return;
        stopParticles();
        const level = savedIntensity != null ? savedIntensity : 50;
        intensityFactor = level / 50;
        window.currentParticleEffect = effect || 'none';
        if (window.currentParticleEffect === 'none') return;
        seed(window.currentParticleEffect);
        rafId = requestAnimationFrame(draw);
    }

    function stopParticles() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles = [];
        window.currentParticleEffect = 'none';
    }

    // ── Picker UI ───────────────────────────────────────────────────────────
    function updateParticleButton() {
        const btn = $('particle-btn');
        const char = window.characters[window.currentCharacterId];
        if (!btn || !char) return;
        const eff = char.particleEffect || 'none';
        btn.classList.toggle('active', eff !== 'none');
        btn.title = 'Ambient Effects: ' + eff;
    }

    function openParticlePicker() {
        const modal = $('particle-picker-modal');
        const char = window.characters[window.currentCharacterId];
        if (!modal || !char) return;
        const eff = char.particleEffect || 'none';
        modal.querySelectorAll('.particle-option-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.effect === eff));
        const row = $('particle-intensity-row');
        if (row) row.classList.toggle('hidden', eff === 'none');
        const slider = $('particle-intensity-slider');
        const valEl = $('particle-intensity-value');
        if (slider) slider.value = char.particleIntensityLevel || 50;
        if (valEl) valEl.textContent = char.particleIntensityLevel || 50;
        modal.classList.remove('hidden');
    }

    async function pickParticleEffect(effect) {
        const char = window.characters[window.currentCharacterId];
        if (!char) return;
        char.particleEffect = effect;
        if (char.particleIntensityLevel == null) char.particleIntensityLevel = 50;
        const modal = $('particle-picker-modal');
        if (modal) modal.querySelectorAll('.particle-option-btn').forEach((b) =>
            b.classList.toggle('active', b.dataset.effect === effect));
        const row = $('particle-intensity-row');
        if (row) row.classList.toggle('hidden', effect === 'none');
        await window.saveSingleCharacterToDB(char);
        startParticles(effect, char.particleIntensityLevel);
        updateParticleButton();
    }

    async function setParticleIntensity(level) {
        const char = window.characters[window.currentCharacterId];
        if (!char) return;
        char.particleIntensityLevel = level;
        const valEl = $('particle-intensity-value');
        if (valEl) valEl.textContent = level;
        await window.saveSingleCharacterToDB(char);
        startParticles(char.particleEffect || 'none', level);
    }

    function closeParticlePicker() {
        const modal = $('particle-picker-modal');
        if (modal) modal.classList.add('hidden');
    }

    window.startParticles = startParticles;
    window.stopParticles = stopParticles;
    window.updateParticleButton = updateParticleButton;
    window.openParticlePicker = openParticlePicker;
    window.pickParticleEffect = pickParticleEffect;
    window.setParticleIntensity = setParticleIntensity;
    window.closeParticlePicker = closeParticlePicker;
    window.PARTICLE_EMOJI = EMOJI;
})();
