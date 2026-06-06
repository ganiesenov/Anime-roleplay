// Derive a vibrant accent colour from a character's avatar, so each chat can be
// themed by its character. Samples the image on a tiny canvas, bins pixels into
// hue buckets weighted by saturation (ignoring greys / near-black / near-white),
// and picks the dominant vibrant hue — then renders a pleasant accent at a fixed
// saturation/lightness so the UI stays readable regardless of the source art.

function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; } else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function accentFromHue(hue) {
  const main = hslToRgb(hue, 0.85, 0.6);
  const dim = hslToRgb(hue, 0.8, 0.42);
  return {
    accent: `rgb(${main[0]}, ${main[1]}, ${main[2]})`,
    dim: `rgb(${dim[0]}, ${dim[1]}, ${dim[2]})`,
    rgb: `${main[0]}, ${main[1]}, ${main[2]}`,
  };
}

export function accentFromImage(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const S = 32;
        const cv = document.createElement('canvas');
        cv.width = S; cv.height = S;
        const ctx = cv.getContext('2d');
        ctx.drawImage(img, 0, 0, S, S);
        const data = ctx.getImageData(0, 0, S, S).data;
        const weight = new Array(12).fill(0);
        const hueAcc = new Array(12).fill(0);
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
          const l = (max + min) / 2;
          if (d < 0.12 || l < 0.12 || l > 0.92) continue; // skip grey / too dark / too bright
          const sat = d / (1 - Math.abs(2 * l - 1));
          let h;
          if (max === r) h = ((g - b) / d) % 6;
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h = (h * 60 + 360) % 360;
          const bi = Math.floor(h / 30) % 12;
          weight[bi] += sat;
          hueAcc[bi] += h * sat;
        }
        let best = -1, bestW = 0;
        for (let i = 0; i < 12; i++) if (weight[i] > bestW) { bestW = weight[i]; best = i; }
        if (best < 0) return resolve(null);
        resolve(accentFromHue(hueAcc[best] / weight[best]));
      } catch (e) { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}
