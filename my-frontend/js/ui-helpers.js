// =============================================================
// ui-helpers.js — generic UI/DOM helpers used across modules:
// adjustFontSizeToFit, getImageUrl (Blob->objectURL), responsive
// setting limits, textarea auto-resize + Enter handling, and the
// avatar-with-effect builder. Depend on DOM refs at call time only.
// =============================================================

  function adjustFontSizeToFit(element) {
    const MIN_FONT_SIZE = 8;
    const inner = element.querySelector('span') || element;

    element.style.fontSize = '';

    // Element has no layout (inside a hidden/collapsed parent) — skip
    if (element.clientHeight <= 0) return;

    const style = window.getComputedStyle(element);
    const paddingV = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const maxHeight = element.clientHeight - paddingV;

    let size = parseFloat(style.fontSize);
    while (size > MIN_FONT_SIZE) {
      if (inner.scrollHeight <= maxHeight) break;
      size -= 1;
      element.style.fontSize = size + 'px';
    }
  }



    function getImageUrl(source) {
  if (source instanceof Blob) {
    return URL.createObjectURL(source);
  }
  return source || ''; 
}



// smartObjectFit, smartObjectFitAll, applyCharPlaceholder, applyUserPlaceholder -> moved to js/utils.js



// APP settings + design settings + saveSettingToDB/loadAndApplySettingsFromDB -> moved to js/settings.js


function enforceResponsiveSettingLimits() {
    if (!fontSizeSlider || !avatarSizeSlider) return;

    const isMobileViewport = responsiveViewportQuery
        ? responsiveViewportQuery.matches
        : (typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT_PX : false);
    const targetFontMax = isMobileViewport ? MOBILE_FONT_SIZE_MAX : DESKTOP_FONT_SIZE_MAX;
    const targetAvatarMax = isMobileViewport ? MOBILE_AVATAR_SIZE_MAX : DESKTOP_AVATAR_SIZE_MAX;

    if (Number(fontSizeSlider.max) !== targetFontMax) {
        fontSizeSlider.max = String(targetFontMax);
    }

    if (Number(avatarSizeSlider.max) !== targetAvatarMax) {
        avatarSizeSlider.max = String(targetAvatarMax);
    }

    if (Number(fontSizeSlider.value) > targetFontMax) {
        fontSizeSlider.value = String(targetFontMax);
    }

    if (Number(avatarSizeSlider.value) > targetAvatarMax) {
        avatarSizeSlider.value = String(targetAvatarMax);
    }

    applySetting('fontSize', fontSizeSlider.value);
    applySetting('avatarSize', avatarSizeSlider.value);
}


function autoResizeTextarea(event) {
    const ta = event.target;
    if (!ta) return;

    const modalContent = ta.closest('.modal-content');
    const originalScrollTop = modalContent ? modalContent.scrollTop : 0;
    const isMobileViewport = responsiveViewportQuery
        ? responsiveViewportQuery.matches
        : (typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT_PX : false);

    const cssMaxValue = getComputedStyle(ta).maxHeight;
    const cssMax = parseInt(cssMaxValue, 10);
    let maxH = Number.isFinite(cssMax) ? cssMax : Infinity;

    if (ta.id === 'message-input' && isMobileViewport && typeof window !== 'undefined') {
        if (typeof cssMaxValue === 'string' && /(?:d|s|l)?vh$/.test(cssMaxValue.trim()) && Number.isFinite(cssMax)) {
            maxH = window.innerHeight * (cssMax / 100);
        } else if (!Number.isFinite(maxH)) {
            maxH = window.innerHeight * 0.38;
        }
    }

    ta.style.height = 'auto';
    const sh = Math.ceil(ta.scrollHeight);
    const newH = Math.min(sh, maxH);
    ta.style.height = newH + 'px';

    if (ta.id === 'message-input') {
        ta.style.overflowY = (isMobileViewport && ta.scrollHeight > maxH) ? 'auto' : 'hidden';
    } else {
        ta.style.overflowY = (ta.scrollHeight > maxH ? 'auto' : 'hidden');
    }

    if (modalContent) {
        modalContent.scrollTop = originalScrollTop;
    }
}



    function handleTextareaEnter(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        document.getElementById('dialog-btn').click();
    }
}



function createAvatarWithEffect(imageUrl, size, altText = '') {
  const container = document.createElement('div');
  container.className = 'avatar-container';
  container.style.width = size;
  container.style.height = size;

  if (imageUrl) {
    container.style.backgroundImage = `url('${imageUrl}')`;
    container.innerHTML = `<img src="${imageUrl}" alt="${altText}" loading="lazy">`;
  } else {
    container.innerHTML = `<div class="placeholder-icon">👤</div>`;
  }
  return container;
}
