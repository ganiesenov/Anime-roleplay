// =============================================================
// effects.js — Ambient particle effects (snow/rain/sparks/fireflies/
// sakura/fog/steam/aurora/leaves/darkness) + the particle picker UI.
// Extracted from main.js. Loaded AFTER main.js, so it can use the
// shared DOM refs / state / helpers declared there.
// Called at runtime from chat.js (startParticles/stopParticles/
// updateParticleButton).
// =============================================================
    // ── Feature E: Ambient Particle Effects ──
    const particleCanvas = document.getElementById('particle-canvas');
    const particleCtx = particleCanvas ? particleCanvas.getContext('2d') : null;
    let particleAnimId = null;
    let particlesList = [];
    let currentParticleEffect = 'none';
    const particleBtn = document.getElementById('particle-btn');
    const particlePickerModal = document.getElementById('particle-picker-modal');
    const closeParticlePickerBtn = document.getElementById('close-particle-picker-btn');
    let particleIntensityLevel = 50;
    let intensityFactor = 1.0;
    const particleIntensitySlider = document.getElementById('particle-intensity-slider');
    const particleIntensityValue = document.getElementById('particle-intensity-value');
    const particleIntensityRow = document.getElementById('particle-intensity-row');

    const PARTICLE_EMOJIS = { none:'✨', snow:'❄️', rain:'🌧️', sparks:'🔥', fireflies:'🟢', sakura:'🌸', fog:'🌫️', steam:'♨️', aurora:'🌌', leaves:'🍂', darkness:'🌑' };
    function updateParticleButton() {
        if (!particleBtn) return;
        const effect = characters[currentCharacterId]?.particleEffect || 'none';
        particleBtn.textContent = PARTICLE_EMOJIS[effect] || '✨';
        particleBtn.title = effect !== 'none' ? `Effect: ${effect.charAt(0).toUpperCase()+effect.slice(1)}` : 'Ambient Effects';
        particleBtn.classList.toggle('particle-active', effect !== 'none');
    }

    let W = window.innerWidth, H = window.innerHeight;
    function resizeParticleCanvas() {
        if (!particleCanvas) return;
        W = window.innerWidth;
        H = window.innerHeight;
        particleCanvas.width = W;
        particleCanvas.height = H;
    }
    resizeParticleCanvas();
    window.addEventListener('resize', resizeParticleCanvas);

    function stopParticles() {
        if (particleAnimId) { cancelAnimationFrame(particleAnimId); particleAnimId = null; }
        if (particleCtx && particleCanvas) particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        particlesList = [];
        currentParticleEffect = 'none';
    }

    function startParticles(effect, savedIntensity) {
        stopParticles();
        if (effect === 'none' || !particleCtx || !particleCanvas) return;
        if (savedIntensity !== undefined) {
            particleIntensityLevel = savedIntensity;
            intensityFactor = particleIntensityLevel / 50;
            if (particleIntensitySlider) particleIntensitySlider.value = particleIntensityLevel;
            if (particleIntensityValue) particleIntensityValue.textContent = particleIntensityLevel;
        }
        currentParticleEffect = effect;
        resizeParticleCanvas();

        if (effect === 'snow') {
            const BASE = 120;
            const spawnSnow = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*4+1.5, s: Math.random()*1.2+0.4, drift: (Math.random()-0.5)*0.5, opacity: Math.random()*0.3+0.7 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSnow());
            (function drawSnow() {
                if (currentParticleEffect !== 'snow') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSnow());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    particleCtx.shadowBlur=8; particleCtx.shadowColor='rgba(200,230,255,0.7)';
                    particleCtx.fillStyle=`rgba(255,255,255,${Math.min(p.opacity*intensityFactor,1)})`;
                    particleCtx.strokeStyle='rgba(120,170,220,0.45)'; particleCtx.lineWidth=0.8;
                    particleCtx.beginPath(); particleCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
                    particleCtx.fill(); particleCtx.stroke(); particleCtx.shadowBlur=0;
                    p.y+=p.s; p.x+=p.drift;
                    if (p.y>H) { p.y=-5; p.x=Math.random()*W; }
                    if (p.x<0||p.x>W) p.x=Math.random()*W;
                });
                particleAnimId = requestAnimationFrame(drawSnow);
            })();

        } else if (effect === 'rain') {
            const BASE = 150;
            const spawnRain = () => ({ x: Math.random()*W, y: Math.random()*H, len: Math.random()*25+15, s: Math.random()*6+10, opacity: Math.random()*0.35+0.55 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnRain());
            (function drawRain() {
                if (currentParticleEffect !== 'rain') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnRain());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    particleCtx.shadowBlur=3; particleCtx.shadowColor='rgba(0,0,0,0.25)';
                    particleCtx.strokeStyle=`rgba(180,220,255,${Math.min(p.opacity*intensityFactor,1)})`; particleCtx.lineWidth=1.5;
                    particleCtx.beginPath(); particleCtx.moveTo(p.x,p.y); particleCtx.lineTo(p.x-p.len*0.2,p.y+p.len); particleCtx.stroke();
                    particleCtx.shadowBlur=0;
                    p.y+=p.s; p.x-=p.s*0.2;
                    if (p.y>H) { p.y=-p.len; p.x=Math.random()*(W+50); }
                });
                particleAnimId = requestAnimationFrame(drawRain);
            })();

        } else if (effect === 'sparks') {
            const BASE = 140;
            const spawnSpark = () => ({ x: Math.random()*W, y: H+Math.random()*60, vx: (Math.random()-0.5)*6, vy: -(Math.random()*6+3), life: Math.random(), maxLife: Math.random()*0.75+0.5, r: Math.random()*4+1.5 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSpark());
            (function drawSparks() {
                if (currentParticleEffect !== 'sparks') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSpark());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                const baseGrad=particleCtx.createLinearGradient(0,H,0,H-200);
                baseGrad.addColorStop(0,`rgba(255,55,0,${Math.min(0.25*intensityFactor,0.55)})`);
                baseGrad.addColorStop(0.45,`rgba(255,110,0,${Math.min(0.10*intensityFactor,0.22)})`);
                baseGrad.addColorStop(1,'rgba(255,60,0,0)');
                particleCtx.fillStyle=baseGrad; particleCtx.fillRect(0,H-200,W,200);
                particleCtx.globalCompositeOperation='lighter';
                particlesList.forEach(p => {
                    const t=p.life/p.maxLife;
                    let rv,gv,bv;
                    if (t>0.72){rv=255;gv=255;bv=Math.floor(220*(t-0.72)/0.28);}
                    else if (t>0.38){rv=255;gv=Math.floor(100+155*(t-0.38)/0.34);bv=0;}
                    else{rv=255;gv=Math.floor(70*t/0.38);bv=0;}
                    const alpha=Math.min(Math.min(1,t*2.2)*0.75*intensityFactor,1);
                    const gr=p.r*4.5;
                    const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,gr);
                    grad.addColorStop(0,`rgba(255,255,220,${alpha})`);
                    grad.addColorStop(0.2,`rgba(${rv},${gv},${bv},${alpha*0.9})`);
                    grad.addColorStop(0.55,`rgba(${rv},${Math.floor(gv*0.4)},0,${alpha*0.35})`);
                    grad.addColorStop(1,'rgba(180,15,0,0)');
                    particleCtx.fillStyle=grad;
                    particleCtx.beginPath(); particleCtx.arc(p.x,p.y,gr,0,Math.PI*2); particleCtx.fill();
                    p.x+=p.vx; p.y+=p.vy; p.vy+=0.038; p.vx*=0.992; p.life-=0.007;
                    if (p.life<=0){p.x=Math.random()*W;p.y=H+Math.random()*20;p.vx=(Math.random()-0.5)*6;p.vy=-(Math.random()*6+3);p.life=p.maxLife;p.r=Math.random()*4+1.5;}
                });
                particleCtx.globalCompositeOperation='source-over';
                particleAnimId = requestAnimationFrame(drawSparks);
            })();

        } else if (effect === 'fireflies') {
            const BASE = 55;
            const spawnFirefly = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*4+2.5, phase: Math.random()*Math.PI*2, vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5, hue: 55+Math.random()*30 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnFirefly());
            let ff = 0;
            (function drawFireflies() {
                if (currentParticleEffect !== 'fireflies') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnFirefly());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H); ff+=0.025;
                // Pass 1: additive soft outer halo, elongated along travel direction
                particleCtx.globalCompositeOperation='lighter';
                particlesList.forEach(p => {
                    const glow=(Math.sin(ff+p.phase)+1)/2;
                    if (glow<0.15) return;
                    const angle=Math.atan2(p.vy,p.vx);
                    const haloR=p.r*(2+glow*2);
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(angle); particleCtx.scale(1.4,0.65);
                    const hg=particleCtx.createRadialGradient(0,0,0,0,0,haloR);
                    hg.addColorStop(0,`hsla(${p.hue},100%,80%,${Math.min(glow*0.18*intensityFactor,1)})`);
                    hg.addColorStop(1,`hsla(${p.hue},100%,60%,0)`);
                    particleCtx.fillStyle=hg;
                    particleCtx.beginPath(); particleCtx.arc(0,0,haloR,0,Math.PI*2); particleCtx.fill();
                    particleCtx.restore();
                });
                particleCtx.globalCompositeOperation='source-over';
                // Pass 2: elongated body with shadowBlur shine + physics
                particlesList.forEach(p => {
                    const glow=(Math.sin(ff+p.phase)+1)/2;
                    const angle=Math.atan2(p.vy,p.vx);
                    const bodyR=p.r*Math.max(glow,0.2);
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(angle);
                    particleCtx.shadowBlur=14*glow+4; particleCtx.shadowColor=`hsla(${p.hue},100%,72%,${glow*0.6})`;
                    particleCtx.fillStyle=`hsla(${p.hue},100%,75%,${Math.min(0.2+glow*0.8*intensityFactor,1)})`;
                    particleCtx.beginPath(); particleCtx.ellipse(0,0,bodyR*1.5,bodyR*0.75,0,0,Math.PI*2); particleCtx.fill();
                    if (glow>0.35){
                        particleCtx.shadowBlur=4; particleCtx.shadowColor=`rgba(255,255,230,${glow*0.5})`;
                        particleCtx.fillStyle=`rgba(255,255,230,${Math.min(glow*0.85*intensityFactor,1)})`;
                        particleCtx.beginPath(); particleCtx.ellipse(0,0,bodyR*0.55,bodyR*0.32,0,0,Math.PI*2); particleCtx.fill();
                    }
                    particleCtx.shadowBlur=0;
                    particleCtx.restore();
                    p.x+=p.vx; p.y+=p.vy;
                    if (p.x<0||p.x>W) p.vx*=-1; if (p.y<0||p.y>H) p.vy*=-1;
                });
                particleCtx.shadowBlur=0;
                particleAnimId = requestAnimationFrame(drawFireflies);
            })();

        } else if (effect === 'sakura') {
            const BASE = 35;
            const spawnSakura = () => ({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*10+7, s: Math.random()*0.7+0.25, drift: (Math.random()-0.5)*1.5, wobble: Math.random()*Math.PI*2, wobbleSpeed: Math.random()*0.03+0.01, rotation: Math.random()*Math.PI*2, rotSpeed: (Math.random()-0.5)*0.04, opacity: Math.random()*0.2+0.78 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSakura());
            (function drawSakura() {
                if (currentParticleEffect !== 'sakura') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSakura());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    p.wobble+=p.wobbleSpeed; p.rotation+=p.rotSpeed;
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(p.rotation);
                    const baseOpacity = Math.min(p.opacity * (0.5 + intensityFactor * 0.5), 1);
                    for (let k=0;k<5;k++){
                        particleCtx.save();
                        particleCtx.rotate(k*Math.PI*2/5);
                        const pg = particleCtx.createRadialGradient(0,-p.r*0.4,0,0,-p.r*0.4,p.r*0.85);
                        pg.addColorStop(0,`rgba(255,235,245,${baseOpacity})`);
                        pg.addColorStop(0.55,`rgba(255,185,215,${baseOpacity})`);
                        pg.addColorStop(1,`rgba(230,140,180,${baseOpacity*0.5})`);
                        particleCtx.fillStyle=pg;
                        particleCtx.strokeStyle=`rgba(210,120,155,${baseOpacity*0.55})`;
                        particleCtx.lineWidth=0.8;
                        particleCtx.beginPath();
                        const pr=p.r;
                        particleCtx.moveTo(0,0);
                        particleCtx.bezierCurveTo(-pr*0.5,-pr*0.15,-pr*0.48,-pr*0.65,-pr*0.18,-pr);
                        particleCtx.quadraticCurveTo(0,-pr*0.68,pr*0.18,-pr);
                        particleCtx.bezierCurveTo(pr*0.48,-pr*0.65,pr*0.5,-pr*0.15,0,0);
                        particleCtx.closePath();
                        particleCtx.fill();
                        particleCtx.stroke();
                        particleCtx.restore();
                    }
                    particleCtx.fillStyle=`rgba(255,150,180,${baseOpacity})`;
                    particleCtx.beginPath(); particleCtx.arc(0,0,p.r*0.15,0,Math.PI*2); particleCtx.fill();
                    particleCtx.restore();
                    p.y+=p.s; p.x+=Math.sin(p.wobble)*p.drift;
                    if (p.y>H+15){p.y=-15;p.x=Math.random()*W;}
                });
                particleAnimId = requestAnimationFrame(drawSakura);
            })();

        } else if (effect === 'fog') {
            const BASE = 30;
            const spawnFog = () => ({ x: Math.random()*W, y: H*0.15+Math.random()*H*0.9, rx: Math.random()*320+200, ry: Math.random()*110+65, opacity: Math.random()*0.18+0.13, vx: (Math.random()*0.5+0.1)*(Math.random()<0.5?1:-1), phase: Math.random()*Math.PI*2, layer: Math.floor(Math.random()*3) });
            for (let i = 0; i < Math.round(BASE * Math.max(intensityFactor, 0.3)); i++) particlesList.push(spawnFog());
            let fogT=0;
            (function drawFog() {
                if (currentParticleEffect !== 'fog') return;
                const target = Math.round(BASE * Math.max(intensityFactor, 0.3));
                while (particlesList.length < target) particlesList.push(spawnFog());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H); fogT+=0.003;
                [...particlesList].sort((a,b)=>a.layer-b.layer).forEach(p => {
                    const yOff=Math.sin(fogT+p.phase)*24;
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y+yOff);
                    particleCtx.scale(1,p.ry/p.rx);
                    const scaledOpacity=Math.min(p.opacity*intensityFactor*2.5,0.85);
                    const grad=particleCtx.createRadialGradient(0,0,0,0,0,p.rx);
                    grad.addColorStop(0,`rgba(200,215,232,${scaledOpacity})`);
                    grad.addColorStop(0.42,`rgba(190,208,228,${scaledOpacity*0.62})`);
                    grad.addColorStop(1,`rgba(185,205,225,0)`);
                    particleCtx.fillStyle=grad;
                    particleCtx.beginPath(); particleCtx.arc(0,0,p.rx,0,Math.PI*2); particleCtx.fill();
                    particleCtx.restore();
                    p.x+=p.vx;
                    if (p.x<-p.rx*1.5) p.x=W+p.rx;
                    if (p.x>W+p.rx*1.5) p.x=-p.rx;
                });
                particleAnimId=requestAnimationFrame(drawFog);
            })();

        } else if (effect === 'steam') {
            const BASE = 55;
            const spawnSteam = () => ({ x: Math.random()*W, y: H*0.1+Math.random()*H, r: Math.random()*32+16, vy: -(Math.random()*0.95+0.3), vx: (Math.random()-0.5)*0.55, life: Math.random(), maxLife: Math.random()*0.75+0.45, opacity: Math.random()*0.17+0.1 });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnSteam());
            (function drawSteam() {
                if (currentParticleEffect !== 'steam') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnSteam());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    const t=p.life/p.maxLife;
                    const cr=p.r+t*140;
                    const alpha=Math.min(p.opacity*intensityFactor*2.5*(1-t*t*0.82),0.7);
                    const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,cr);
                    grad.addColorStop(0,`rgba(245,249,255,${alpha})`);
                    grad.addColorStop(0.38,`rgba(230,243,255,${alpha*0.58})`);
                    grad.addColorStop(1,`rgba(220,240,255,0)`);
                    particleCtx.fillStyle=grad;
                    particleCtx.beginPath(); particleCtx.arc(p.x,p.y,cr,0,Math.PI*2); particleCtx.fill();
                    p.y+=p.vy; p.x+=p.vx+Math.sin(p.life*7)*0.55; p.life+=0.0024;
                    if (p.life>=p.maxLife){p.x=Math.random()*W;p.y=H*0.45+Math.random()*H*0.65;p.life=0;p.r=Math.random()*32+16;p.maxLife=Math.random()*0.75+0.45;}
                });
                particleAnimId=requestAnimationFrame(drawSteam);
            })();

        } else if (effect === 'aurora') {
            const BASE = 5;
            const AURORA_HUES = [125, 155, 175, 195, 270, 300];
            const spawnBand = (i) => ({
                hue: AURORA_HUES[i % AURORA_HUES.length]+Math.random()*14-7,
                phase: Math.random()*Math.PI*2,
                phaseSpeed: (Math.random()*0.003+0.0008)*(Math.random()<0.5?1:-1),
                flickerPhase: Math.random()*Math.PI*2,
                flickerSpeed: Math.random()*0.018+0.006,
                ampFrac: Math.random()*0.055+0.025,
                freq: Math.random()*1.2+0.5,
                yFrac: 0.08+(i/Math.max(BASE,5))*0.28+Math.random()*0.04,
                thickFrac: Math.random()*0.075+0.045
            });
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnBand(i));
            (function drawAurora() {
                if (currentParticleEffect !== 'aurora') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnBand(particlesList.length));
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particleCtx.globalCompositeOperation='lighter';
                particlesList.forEach(b => {
                    b.phase+=b.phaseSpeed; b.flickerPhase+=b.flickerSpeed;
                    const flicker=(Math.sin(b.flickerPhase)+1)/2;
                    const opacity=Math.min((0.05+flicker*0.09)*intensityFactor,0.9);
                    const yBase=b.yFrac*H, amp=b.ampFrac*H, thick=b.thickFrac*H;
                    const STEPS=90;
                    particleCtx.save();
                    particleCtx.beginPath();
                    for (let i=0;i<=STEPS;i++){const x=(i/STEPS)*W,y=yBase+Math.sin(x/W*Math.PI*2*b.freq+b.phase)*amp-thick*0.3;i===0?particleCtx.moveTo(x,y):particleCtx.lineTo(x,y);}
                    for (let i=STEPS;i>=0;i--){const x=(i/STEPS)*W,y=yBase+Math.sin(x/W*Math.PI*2*b.freq+b.phase)*amp+thick*1.5;particleCtx.lineTo(x,y);}
                    particleCtx.closePath();
                    const grad=particleCtx.createLinearGradient(0,yBase-thick*0.5,0,yBase+thick*1.8);
                    grad.addColorStop(0,`hsla(${b.hue},100%,80%,0)`);
                    grad.addColorStop(0.2,`hsla(${b.hue},100%,75%,${opacity})`);
                    grad.addColorStop(0.6,`hsla(${b.hue},100%,60%,${opacity*0.45})`);
                    grad.addColorStop(1,`hsla(${b.hue},100%,50%,0)`);
                    particleCtx.fillStyle=grad; particleCtx.fill(); particleCtx.restore();
                });
                particleCtx.globalCompositeOperation='source-over';
                particleAnimId=requestAnimationFrame(drawAurora);
            })();

        } else if (effect === 'leaves') {
            const BASE = 40;
            const LEAF_PALETTE = [{h:88,s:52,l:36},{h:102,s:57,l:38},{h:118,s:48,l:34},{h:92,s:62,l:42},{h:108,s:55,l:40},{h:74,s:62,l:44},{h:79,s:58,l:46},{h:50,s:72,l:54},{h:54,s:68,l:50},{h:26,s:78,l:52},{h:28,s:80,l:48},{h:22,s:76,l:50},{h:30,s:72,l:48},{h:9,s:66,l:46},{h:13,s:70,l:44},{h:27,s:42,l:38}];
            const spawnLeaf = () => { const c=LEAF_PALETTE[Math.floor(Math.random()*LEAF_PALETTE.length)]; return {x:Math.random()*W,y:Math.random()*H,r:Math.random()*15+10,aspect:Math.random()*0.2+0.45,vy:Math.random()*0.9+0.35,drift:(Math.random()-0.5)*0.5,wobble:Math.random()*Math.PI*2,wobbleSpeed:Math.random()*0.022+0.008,rotation:Math.random()*Math.PI*2,rotSpeed:(Math.random()-0.5)*0.04,h:c.h,sat:c.s,l:c.l,opacity:Math.random()*0.2+0.75}; };
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnLeaf());
            (function drawLeaves() {
                if (currentParticleEffect !== 'leaves') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnLeaf());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particlesList.forEach(p => {
                    p.wobble+=p.wobbleSpeed; p.rotation+=p.rotSpeed;
                    p.x+=p.drift+Math.sin(p.wobble)*0.35; p.y+=p.vy;
                    if (p.y>H+p.r*2){p.y=-p.r*2;p.x=Math.random()*W;}
                    if (p.x<-p.r*2) p.x=W+p.r*2; if (p.x>W+p.r*2) p.x=-p.r*2;
                    const baseOp=Math.min(p.opacity*(0.5+intensityFactor*0.5),1);
                    particleCtx.save();
                    particleCtx.translate(p.x,p.y); particleCtx.rotate(p.rotation);
                    const lg=particleCtx.createLinearGradient(0,-p.r,0,p.r);
                    lg.addColorStop(0,`hsla(${p.h},${p.sat}%,${Math.min(p.l+10,65)}%,${baseOp})`);
                    lg.addColorStop(1,`hsla(${p.h},${p.sat}%,${Math.max(p.l-8,20)}%,${baseOp})`);
                    particleCtx.fillStyle=lg;
                    particleCtx.strokeStyle=`hsla(${p.h},${p.sat-10}%,${p.l-18}%,${baseOp*0.45})`;
                    particleCtx.lineWidth=0.5;
                    particleCtx.beginPath();
                    particleCtx.moveTo(0,-p.r);
                    particleCtx.bezierCurveTo(p.r*p.aspect,-p.r*0.25,p.r*p.aspect,p.r*0.25,0,p.r);
                    particleCtx.bezierCurveTo(-p.r*p.aspect,p.r*0.25,-p.r*p.aspect,-p.r*0.25,0,-p.r);
                    particleCtx.closePath(); particleCtx.fill(); particleCtx.stroke();
                    particleCtx.strokeStyle=`hsla(${p.h},${p.sat-15}%,${p.l-22}%,${baseOp*0.3})`;
                    particleCtx.lineWidth=0.55;
                    particleCtx.beginPath(); particleCtx.moveTo(0,-p.r*0.8); particleCtx.lineTo(0,p.r*0.8); particleCtx.stroke();
                    particleCtx.restore();
                });
                particleAnimId=requestAnimationFrame(drawLeaves);
            })();

        } else if (effect === 'darkness') {
            const BASE = 18;
            const spawnWisp = () => ({x:Math.random()*W,y:Math.random()*H,r:Math.random()*220+100,vx:(Math.random()-0.5)*0.22,vy:(Math.random()-0.5)*0.14,pulsePhase:Math.random()*Math.PI*2,pulseSpeed:Math.random()*0.007+0.003,baseOp:Math.random()*0.18+0.12,purple:Math.random()<0.28});
            for (let i = 0; i < Math.round(BASE * intensityFactor); i++) particlesList.push(spawnWisp());
            (function drawDarkness() {
                if (currentParticleEffect !== 'darkness') return;
                const target = Math.round(BASE * intensityFactor);
                while (particlesList.length < target) particlesList.push(spawnWisp());
                if (particlesList.length > target) particlesList.length = target;
                particleCtx.clearRect(0,0,W,H);
                particleCtx.fillStyle=`rgba(0,0,0,${Math.min(0.25*intensityFactor,0.6)})`; particleCtx.fillRect(0,0,W,H);
                particlesList.forEach(p => {
                    p.pulsePhase+=p.pulseSpeed;
                    const pulse=(Math.sin(p.pulsePhase)+1)/2;
                    const op=Math.min((p.baseOp+pulse*0.1)*intensityFactor,0.75);
                    const r=p.r*(0.82+pulse*0.28);
                    const grad=particleCtx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
                    if (p.purple){grad.addColorStop(0,`rgba(12,0,22,${op})`);grad.addColorStop(0.55,`rgba(6,0,12,${op*0.5})`);}
                    else{grad.addColorStop(0,`rgba(0,0,0,${op})`);grad.addColorStop(0.55,`rgba(0,0,2,${op*0.45})`);}
                    grad.addColorStop(1,'rgba(0,0,0,0)');
                    particleCtx.fillStyle=grad; particleCtx.beginPath(); particleCtx.arc(p.x,p.y,r,0,Math.PI*2); particleCtx.fill();
                    p.x+=p.vx; p.y+=p.vy;
                    if (p.x<-p.r) p.x=W+p.r; if (p.x>W+p.r) p.x=-p.r;
                    if (p.y<-p.r) p.y=H+p.r; if (p.y>H+p.r) p.y=-p.r;
                });
                const vig=particleCtx.createRadialGradient(W/2,H/2,H*0.25,W/2,H/2,Math.max(W,H)*0.8);
                vig.addColorStop(0,'rgba(0,0,0,0)');
                vig.addColorStop(1,`rgba(0,0,0,${Math.min(0.4*intensityFactor,0.7)})`);
                particleCtx.fillStyle=vig; particleCtx.fillRect(0,0,W,H);
                particleAnimId=requestAnimationFrame(drawDarkness);
            })();
        }
    }

    if (particleBtn) {
        particleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const character = characters[currentCharacterId];
            if (particlePickerModal) {
                const currentEffect = character?.particleEffect || 'none';
                particlePickerModal.querySelectorAll('.particle-option-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.effect === currentEffect);
                });
                const savedLevel = character?.particleIntensityLevel ?? 50;
                particleIntensityLevel = savedLevel;
                intensityFactor = particleIntensityLevel / 50;
                if (particleIntensitySlider) particleIntensitySlider.value = particleIntensityLevel;
                if (particleIntensityValue) particleIntensityValue.textContent = particleIntensityLevel;
                if (particleIntensityRow) particleIntensityRow.classList.toggle('hidden', currentEffect === 'none');
                particlePickerModal.classList.remove('hidden');
            }
        });
    }
    if (closeParticlePickerBtn) closeParticlePickerBtn.addEventListener('click', () => { if (particlePickerModal) particlePickerModal.classList.add('hidden'); });
    if (particleIntensitySlider) {
        particleIntensitySlider.addEventListener('input', async () => {
            particleIntensityLevel = parseInt(particleIntensitySlider.value, 10);
            intensityFactor = particleIntensityLevel / 50;
            if (particleIntensityValue) particleIntensityValue.textContent = particleIntensityLevel;
            const character = characters[currentCharacterId];
            if (character) {
                character.particleIntensityLevel = particleIntensityLevel;
                await saveSingleCharacterToDB(character);
            }
        });
    }
    if (particlePickerModal) {
        particlePickerModal.addEventListener('click', async (e) => {
            if (e.target === particlePickerModal) { particlePickerModal.classList.add('hidden'); return; }
            const btn = e.target.closest('.particle-option-btn');
            if (!btn) return;
            const effect = btn.dataset.effect;
            const character = characters[currentCharacterId];
            if (!character) return;
            character.particleEffect = effect;
            particlePickerModal.querySelectorAll('.particle-option-btn').forEach(b => b.classList.toggle('active', b.dataset.effect === effect));
            if (particleIntensityRow) particleIntensityRow.classList.toggle('hidden', effect === 'none');
            await saveSingleCharacterToDB(character);
            startParticles(effect);
            updateParticleButton();
        });
    }
