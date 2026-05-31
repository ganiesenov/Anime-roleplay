// =============================================================
// utils.js — pure helper functions (no app state, no DOM refs)
// Loaded BEFORE script.js. All names are shared globals (variant A).
// =============================================================

// --- HTML / text ---

// NOTE: previously defined twice in script.js. The second definition
// (3-char escape, no String() coercion) was the one actually in effect,
// so it is kept here verbatim to preserve behavior.
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatSubString(text) {
    if (!text) return '';

    const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\s<>]+\.(?:jpg|jpeg|png|gif|webp|avif)[^\s<>]*)\)/gi;
    const bareImageUrlRegex = /(https?:\/\/[^\s<>]+\.(?:jpg|jpeg|png|gif|webp|avif)[^\s<>]*)/gi;

    let imagesHtml = '';
    let processedText = text;

    processedText = processedText.replace(markdownImageRegex, (match, url) => {
        imagesHtml += `<div class="message-image-container"><img src="${url}" alt="Image from chat" loading="lazy"></div>`;
        return '';
    });

    processedText = processedText.replace(bareImageUrlRegex, (url) => {
        imagesHtml += `<div class="message-image-container"><img src="${url}" alt="Image from chat" loading="lazy"></div>`;
        return '';
    });

    const safeRemainingText = escapeHtml(processedText.trim())
        .replace(/"(.*?)"/g, '<span class="dialogue">"$1"</span>')
        .replace(/“(.*?)”/g, '<span class="dialogue">“$1”</span>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/((?:https?:\/\/|www\.)[^\s<>()]+)/gi, (url) => {
            let href = url;
            if (href.toLowerCase().startsWith('www.')) {
                href = 'http://' + href;
            }
            return `<a href="${href}" target="_blank" style="text-decoration: underline; color: inherit;">${url}</a>`;
        });

    return imagesHtml + safeRemainingText;
}

// --- placeholders ---

function applyCharPlaceholder(s, charName) {
  return (s || '').replace(/{{\s*char\s*}}/g, charName);
}

function applyUserPlaceholder(s, persona) {
    if (persona && persona.name) {
        return (s || '').replace(/{{\s*user\s*}}/g, persona.name);
    }
    return s || '';
}

// --- files / images ---

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function imageFileToWebp(file, quality = 0.80) {
  const originalDataURL = await fileToDataURL(file);

  let source;
  try {
    source = await createImageBitmap(file);
  } catch {
    source = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, width, height);

  let blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/webp', quality)
  );

  let dataURL;
  if (blob) {
    dataURL = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.readAsDataURL(blob);
    });
    if (typeof source.close === 'function') source.close();
    return { blob, dataURL, originalDataURL };
  }

  blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Conversion failed'))), 'image/jpeg', 0.80)
  );
  dataURL = canvas.toDataURL('image/jpeg', 0.80);
  if (typeof source.close === 'function') source.close();
  return { blob, dataURL, originalDataURL };
}

// --- object-fit helpers ---

function smartObjectFit(img) {
  if (!img) return;
  const apply = () => {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h) return;
    img.style.objectFit = (w > h) ? 'cover' : 'contain';
    img.style.objectPosition = 'center';
  };
  if (img.complete) apply();
  else img.addEventListener('load', apply, { once: true });
}

function smartObjectFitAll(selector) {
  document.querySelectorAll(selector).forEach(smartObjectFit);
}

// --- layout freeze (modal scroll lock) ---

let __freezeScrollY = 0;

function freezeLayout() {
  const docEl = document.documentElement;
  const sbw = window.innerWidth - docEl.clientWidth;
  __freezeScrollY = window.scrollY || docEl.scrollTop || 0;

  docEl.classList.add('freeze-layout');
  document.body.classList.add('freeze-body');

  document.body.style.top = `-${__freezeScrollY}px`;
  if (sbw > 0) document.body.style.paddingRight = sbw + 'px';
}

function unfreezeLayout() {
  document.documentElement.classList.remove('freeze-layout');
  document.body.classList.remove('freeze-body');
  document.body.style.paddingRight = '';
  document.body.style.top = '';
  window.scrollTo(0, __freezeScrollY);
}
