// =============================================================
// media.js — Background music (audio URL / YouTube embed) and
// text-to-speech (SpeechSynthesis). Extracted from main.js.
// Loaded AFTER main.js. Called at runtime from chat.js
// (playMusic/stopMusic/speakText) and on settings change.
// =============================================================
    // ── Feature B: Background Music ──
    const musicBtn = document.getElementById('music-btn');
    const musicPanel = document.getElementById('music-panel');
    const musicUrlInput = document.getElementById('music-url-input');
    const musicPlayBtn = document.getElementById('music-play-btn');
    const musicStopBtn = document.getElementById('music-stop-btn');
    let musicAudioEl = null;
    let musicIframeEl = null;
    let musicIsPlaying = false;

    function extractYouTubeId(url) {
        const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([A-Za-z0-9_-]{11})/);
        return m ? m[1] : null;
    }

    function stopMusic() {
        if (musicAudioEl) {
            musicAudioEl.pause();
            musicAudioEl.currentTime = 0;
            musicAudioEl.src = '';
            musicAudioEl.remove();
            musicAudioEl = null;
        }
        if (musicIframeEl) {
            musicIframeEl.src = '';
            musicIframeEl.remove();
            musicIframeEl = null;
        }
        musicIsPlaying = false;
        if (musicPlayBtn) musicPlayBtn.textContent = '▶ Play';
    }

    function pauseMusic() {
        if (musicAudioEl) musicAudioEl.pause();
        if (musicIframeEl) musicIframeEl.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
        musicIsPlaying = false;
        if (musicPlayBtn) musicPlayBtn.textContent = '▶ Play';
    }

    function resumeMusic() {
        if (musicAudioEl) musicAudioEl.play().catch(() => {});
        if (musicIframeEl) musicIframeEl.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
        musicIsPlaying = true;
        if (musicPlayBtn) musicPlayBtn.textContent = '⏸ Pause';
    }

    function playMusic(url) {
        stopMusic();
        if (!url) return;
        const ytId = extractYouTubeId(url);
        if (ytId) {
            musicIframeEl = document.createElement('iframe');
            musicIframeEl.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&enablejsapi=1`;
            musicIframeEl.allow = 'autoplay';
            musicIframeEl.style.cssText = 'display:none;width:0;height:0;border:0;position:absolute;';
            document.body.appendChild(musicIframeEl);
            musicIsPlaying = true;
            if (musicPlayBtn) musicPlayBtn.textContent = '⏸ Pause';
        } else {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.loop = true;
            document.body.appendChild(audio);
            musicAudioEl = audio;
            audio.play().catch(() => {
                musicIsPlaying = false;
                if (musicPlayBtn) musicPlayBtn.textContent = '▶ Play';
            });
            musicIsPlaying = true;
            if (musicPlayBtn) musicPlayBtn.textContent = '⏸ Pause';
        }
    }

    if (musicBtn) {
        musicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (musicPanel) musicPanel.classList.toggle('hidden');
        });
    }
    document.addEventListener('click', (e) => {
        if (musicPanel && !musicPanel.classList.contains('hidden') &&
            !musicBtn?.contains(e.target) && !musicPanel.contains(e.target)) {
            musicPanel.classList.add('hidden');
        }
    });
    if (musicPlayBtn) {
        musicPlayBtn.addEventListener('click', () => {
            if (musicIsPlaying) {
                pauseMusic();
            } else {
                if (musicAudioEl || musicIframeEl) {
                    resumeMusic();
                } else if (musicUrlInput) {
                    playMusic(musicUrlInput.value.trim());
                }
            }
        });
    }
    if (musicStopBtn) musicStopBtn.addEventListener('click', stopMusic);
    if (musicUrlInput) {
        musicUrlInput.addEventListener('input', () => {
            const val = musicUrlInput.value.trim();
            const charId = currentCharacterId;
            if (!charId) return;
            if (val) {
                localStorage.setItem(`userMusicUrl:${charId}`, val);
            } else {
                localStorage.removeItem(`userMusicUrl:${charId}`);
            }
        });
    }
    // Mark Feature B as ready; auto-play if a URL was already populated during startChat
    window._musicFeatureReady = true;
    const _initMusicUrl = musicUrlInput ? musicUrlInput.value.trim() : '';
    if (_initMusicUrl && currentCharacterId) playMusic(_initMusicUrl);

    // ── Feature C: TTS ──
    function populateTTSVoices() {
        if (!('speechSynthesis' in window)) return;
        const sel = document.getElementById('tts-voice-select');
        if (!sel) return;
        const voices = speechSynthesis.getVoices();
        sel.innerHTML = '<option value="">(Default voice)</option>';
        const groups = [
            { prefix: 'en', label: 'English', voices: [] },
            { prefix: 'de', label: 'German', voices: [] },
            { prefix: 'ja', label: 'Japanese', voices: [] },
        ];
        voices.forEach(v => {
            const lang = v.lang.toLowerCase();
            const g = groups.find(gr => lang.startsWith(gr.prefix));
            if (g) g.voices.push(v);
        });
        groups.forEach(g => {
            if (!g.voices.length) return;
            const og = document.createElement('optgroup');
            og.label = g.label;
            g.voices.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v.voiceURI;
                opt.textContent = `${v.name} (${v.lang})`;
                og.appendChild(opt);
            });
            sel.appendChild(og);
        });
        if (ttsCurrentVoiceURI) sel.value = ttsCurrentVoiceURI;
    }
    if ('speechSynthesis' in window) {
        speechSynthesis.onvoiceschanged = populateTTSVoices;
        populateTTSVoices();
    }

    function speakText(text, messageId) {
        if (!('speechSynthesis' in window)) return;
        speechSynthesis.cancel();
        if (!text) return;
        const utter = new SpeechSynthesisUtterance(text);
        const sel = document.getElementById('tts-voice-select');
        const voiceURI = sel?.value || ttsCurrentVoiceURI;
        if (voiceURI) {
            const voice = speechSynthesis.getVoices().find(v => v.voiceURI === voiceURI);
            if (voice) utter.voice = voice;
        }
        const btn = messageId ? document.querySelector(`[data-message-id="${messageId}"] .tts-btn`) : null;
        if (btn) btn.textContent = '⏹';
        utter.onend = () => { if (btn) btn.textContent = '🔊'; };
        speechSynthesis.speak(utter);
    }

    const ttsToggleEl2 = document.getElementById('tts-toggle');
    const ttsVoiceSelectEl2 = document.getElementById('tts-voice-select');
    if (ttsToggleEl2) addSettingListener(ttsToggleEl2, 'ttsEnabled', 'change');
    if (ttsVoiceSelectEl2) addSettingListener(ttsVoiceSelectEl2, 'ttsVoiceURI', 'change');
