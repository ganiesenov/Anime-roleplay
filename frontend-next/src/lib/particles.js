// Per-character ambient particle effects rendered on a full-screen canvas.
// Ported from the legacy effects.js (same effects, counts and look).

export const PARTICLE_EFFECTS = [
  { key: 'none', emoji: '❌', label: 'None' },
  { key: 'snow', emoji: '❄️', label: 'Snow' },
  { key: 'rain', emoji: '🌧️', label: 'Rain' },
  { key: 'sparks', emoji: '🔥', label: 'Sparks' },
  { key: 'fireflies', emoji: '🟢', label: 'Fireflies' },
  { key: 'sakura', emoji: '🌸', label: 'Sakura' },
  { key: 'fog', emoji: '🌫️', label: 'Fog' },
  { key: 'steam', emoji: '♨️', label: 'Steam' },
  { key: 'aurora', emoji: '🌌', label: 'Aurora' },
  { key: 'leaves', emoji: '🍂', label: 'Leaves' },
  { key: 'darkness', emoji: '🌑', label: 'Darkness' },
];

const BASE = { none: 0, snow: 120, rain: 150, sparks: 140, fireflies: 55, sakura: 35, fog: 30, steam: 55, aurora: 5, leaves: 40, darkness: 18 };

function rand(a, b) { return a + Math.random() * (b - a); }

function spawn(effect, w, h) {
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

// Attach an animated particle field to a canvas. Returns control handles.
export function createParticleField(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rafId = null;
  let effect = 'none';
  let factor = 1;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function target() { return Math.round((BASE[effect] || 0) * factor); }

  function seed() {
    particles = [];
    const t = target();
    for (let i = 0; i < t; i++) particles.push(spawn(effect, canvas.width, canvas.height));
  }

  function trim() {
    const t = target();
    if (particles.length > t) particles.length = t;
    else while (particles.length < t) particles.push(spawn(effect, canvas.width, canvas.height));
  }

  function draw() {
    if (effect === 'none' || !ctx) { stop(); return; }
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    trim();

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
          p.y += p.vy; p.x += p.vx; p.life -= 0.01; if (p.life <= 0 || p.y < 0) { Object.assign(p, spawn('sparks', w, h), { y: h + 5 }); }
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
          p.y += p.vy; p.a -= 0.0008; if (p.y < 0 || p.a <= 0) Object.assign(p, spawn('steam', w, h));
          ctx.fillStyle = 'rgba(230,230,235,' + Math.max(0, p.a) + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
          break;
        case 'aurora': {
          p.x += p.vx; if (p.x > w + p.r) p.x = -p.r;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, 'hsla(' + p.hue + ',80%,60%,' + p.a + ')');
          g.addColorStop(1, 'hsla(' + p.hue + ',80%,60%,0)');
          ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
          break;
        }
        case 'leaves':
          p.y += p.vy; p.x += p.vx + Math.sin(p.y / 40); p.rot += p.vr; if (p.y > h) { p.y = -10; p.x = rand(0, w); }
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillStyle = 'rgba(200,120,40,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, 6.28); ctx.fill(); ctx.restore();
          break;
        case 'darkness':
          ctx.fillStyle = 'rgba(0,0,0,' + p.a + ')'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
          break;
        default: break;
      }
    });

    if (effect === 'darkness') {
      const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.8);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    }

    rafId = requestAnimationFrame(draw);
  }

  function start(eff, intensity) {
    stop();
    resize();
    factor = (intensity != null ? intensity : 50) / 50;
    effect = eff || 'none';
    if (effect === 'none') { if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    seed();
    rafId = requestAnimationFrame(draw);
  }

  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (ctx && canvas.width) ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = [];
  }

  window.addEventListener('resize', resize);

  function destroy() {
    stop();
    window.removeEventListener('resize', resize);
  }

  return { start, stop, destroy };
}
