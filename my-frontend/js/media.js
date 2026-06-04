/* media.js — background music (direct/YouTube via backend proxy) + TTS. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    let audioEl = null;

    function backendOrigin() {
        if (location.protocol === 'http:' || location.protocol === 'https:') return location.origin;
        try { return new URL(window.DEFAULT_API_URL).origin; } catch (e) { return 'http://127.0.0.1:8000'; }
    }

    function youtubeId(url) {
        const patterns = [
            /youtu\.be\/([A-Za-z0-9_-]{11})/,
            /[?&]v=([A-Za-z0-9_-]{11})/,
            /embed\/([A-Za-z0-9_-]{11})/,
            /\/v\/([A-Za-z0-9_-]{11})/
        ];
        for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
        return null;
    }

    function ensureAudio() {
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.loop = true;
            audioEl.addEventListener('error', () => {
                stopMusic();
                window.showToast('Не удалось воспроизвести аудио.');
            });
            document.body.appendChild(audioEl);
        }
        return audioEl;
    }

    function playMusicUrl(url, auto) {
        if (!url) return;
        const a = ensureAudio();
        const ytId = youtubeId(url);
        if (ytId) {
            a.src = backendOrigin() + '/api/yt-audio?url=' + encodeURIComponent(url);
        } else {
            a.src = url;
        }
        window._musicFeatureReady = true;
        a.play().then(() => updatePlayBtn(true)).catch(() => { if (!auto) window.showToast('Не удалось запустить воспроизведение.'); });
    }

    function togglePlay() {
        const inp = $('music-url-input');
        const url = inp ? inp.value.trim() : '';
        if (!audioEl || !audioEl.src) {
            if (url) {
                playMusicUrl(url, false);
                if (window.currentCharacterId) localStorage.setItem('userMusicUrl:' + window.currentCharacterId, url);
            }
            return;
        }
        if (audioEl.paused) { audioEl.play(); updatePlayBtn(true); }
        else { audioEl.pause(); updatePlayBtn(false); }
    }

    function updatePlayBtn(playing) {
        const btn = $('music-play-btn');
        if (btn) btn.textContent = playing ? '⏸ Pause' : '▶ Play';
    }

    function stopMusic() {
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
            audioEl.removeAttribute('src');
            audioEl.load();
            if (audioEl.parentNode) audioEl.remove();
            audioEl = null;
        }
        updatePlayBtn(false);
    }

    function clearMusicForCharacter() {
        const inp = $('music-url-input');
        if (inp) inp.value = '';
        if (window.currentCharacterId) localStorage.removeItem('userMusicUrl:' + window.currentCharacterId);
        stopMusic();
    }

    // ── TTS ─────────────────────────────────────────────────────────────────
    function populateTtsVoices() {
        if (!window.speechSynthesis) return;
        const sel = $('tts-voice-select');
        if (!sel) return;
        const voices = window.speechSynthesis.getVoices();
        const prev = window.runtimeFlags.ttsVoiceURI || sel.value;
        sel.innerHTML = '<option value="">(Default voice)</option>';
        const groups = { en: [], de: [], ja: [] };
        voices.forEach((v) => {
            const lang = (v.lang || '').slice(0, 2);
            if (groups[lang]) groups[lang].push(v);
        });
        [['en', 'English'], ['de', 'German'], ['ja', 'Japanese']].forEach(([code, label]) => {
            if (!groups[code].length) return;
            const og = document.createElement('optgroup');
            og.label = label;
            groups[code].forEach((v) => {
                const opt = document.createElement('option');
                opt.value = v.voiceURI;
                opt.textContent = v.name + ' (' + v.lang + ')';
                og.appendChild(opt);
            });
            sel.appendChild(og);
        });
        if (prev) sel.value = prev;
    }

    function speakText(text, messageId) {
        if (!window.speechSynthesis || !text) return;
        try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
        const utter = new SpeechSynthesisUtterance(window.stripThinkTags(text).replace(/<[^>]+>/g, ''));
        const uri = window.runtimeFlags.ttsVoiceURI;
        if (uri) {
            const voice = window.speechSynthesis.getVoices().find((v) => v.voiceURI === uri);
            if (voice) utter.voice = voice;
        }
        if (messageId) {
            const btn = document.querySelector('.message[data-message-id="' + messageId + '"] .tts-btn');
            if (btn) {
                btn.textContent = '⏹';
                utter.onend = () => { btn.textContent = '🔊'; };
                utter.onerror = () => { btn.textContent = '🔊'; };
            }
        }
        window.speechSynthesis.speak(utter);
    }

    function toggleTts(messageId, text) {
        if (!window.speechSynthesis) return;
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            const btn = document.querySelector('.message[data-message-id="' + messageId + '"] .tts-btn');
            if (btn) btn.textContent = '🔊';
        } else {
            speakText(text, messageId);
        }
    }

    if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = populateTtsVoices;
    }

    window.playMusicUrl = playMusicUrl;
    window.togglePlay = togglePlay;
    window.stopMusic = stopMusic;
    window.clearMusicForCharacter = clearMusicForCharacter;
    window.populateTtsVoices = populateTtsVoices;
    window.speakText = speakText;
    window.toggleTts = toggleTts;
    window.youtubeId = youtubeId;
})();
