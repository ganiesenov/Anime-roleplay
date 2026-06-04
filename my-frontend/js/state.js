/* state.js — shared mutable state & constants for Aria.
 * All globals declared on window so the plain <script> modules can share them.
 */
(function () {
    'use strict';

    window.App = window.App || {};

    // ── Core data maps ──────────────────────────────────────────────────────
    window.characters = window.characters || {};   // id -> character
    window.personas = window.personas || {};        // id -> persona
    window.appSettings = window.appSettings || { apiKey: '', availableModels: [] };

    // ── Active session ──────────────────────────────────────────────────────
    window.currentCharacterId = null;
    window.currentChatId = null;
    window.activeGroupParticipantId = null;

    // ── Reply suggestions ───────────────────────────────────────────────────
    window.pendingReplyOptions = null;
    window.replyOptionsLoading = false;
    window.replyOptionsEnabled = true;
    window.replyOptionsReqId = 0;

    // ── Streaming ───────────────────────────────────────────────────────────
    window.currentStreamController = null;

    // ── Editor staging ──────────────────────────────────────────────────────
    window.tempUploadedImages = {};
    window.worldCharSelectedIds = new Set();

    // ── Audio ───────────────────────────────────────────────────────────────
    window.audioCtx = null;
    window._musicFeatureReady = false;

    // ── Home browse state ───────────────────────────────────────────────────
    window.sortMode = 'recent';
    window.activeCategory = null;
    window.activeTag = null;
    window.browseFilter = 'all';            // 'all' | 'favorites'
    window.currentPage = 1;
    window.PAGE_SIZE = 24;
    window._lastFilterSig = '';
    window._forceGrid = false;

    // ── Undo for deletes ────────────────────────────────────────────────────
    window._undoSnapshot = null;

    // ── DB ──────────────────────────────────────────────────────────────────
    window.db = null;

    // ── Endpoints / constants ───────────────────────────────────────────────
    window.DEFAULT_API_URL = 'http://127.0.0.1:8000/v1/chat/completions';
    window.DB_NAME = 'AriaBD';
    window.DB_VERSION = 3;
    window.LEGACY_DB_NAME = 'CasualCharacterChatDB';
    window.MOBILE_BREAKPOINT = 768;
    window.MOBILE_FONT_MAX = 24;
    window.MOBILE_AVATAR_MAX = 180;

    // ── Default design settings (JS defaults win over HTML value=) ───────────
    window.defaultSettings = {
        avatarSize: '200',
        fontSize: '18',
        messageSpacing: '50',
        mainTextColor: '#FFFFFF',
        dialogueColor: '#ffd952',
        userBubbleColor: '#141414',
        userBubbleOpacity: '0.7',
        aiBubbleColor: '#141414',
        aiBubbleOpacity: '0.7',
        blur: '5',
        model: 'local-qwen',
        temperature: '0.70',
        replyLength: 'default',
        replyOptionsEnabled: 'true',
        suggestionModelId: '',
        thinkEnabled: 'true',
        autoSummarizeEnabled: 'false',
        autoSummarizeEvery: '30',
        summaryModelId: '',
        ttsVoiceURI: '',
        ttsEnabled: 'false',
        soundEnabled: 'true'
    };

    // Default seed model list.
    window.DEFAULT_AVAILABLE_MODELS = [
        { id: 'local-qwen', name: 'Qwen (local backend)', targetApiUrl: 'http://127.0.0.1:8000/v1/chat/completions' },
        { id: 'z-ai/glm-4.5-air:free', name: 'Z.AI: GLM 4.5 Air (free)' }
    ];

    // Runtime feature flags (mirrors of settings, read at request time).
    window.runtimeFlags = {
        soundEnabled: true,
        thinkEnabled: true,
        replyOptionsEnabled: true,
        ttsEnabled: false,
        replyLength: 'default',
        suggestionModelId: '',
        autoSummarizeEnabled: false,
        autoSummarizeEvery: 30,
        summaryModelId: '',
        ttsVoiceURI: ''
    };

    // Curated categories (key, label, keyword set). 'All' has no key.
    window.CATEGORIES = [
        { key: null, label: 'All', keywords: [] },
        { key: 'anime', label: 'Anime', keywords: ['anime', 'manga', 'waifu', 'isekai', 'shounen', 'shoujo', 'otaku'] },
        { key: 'hero', label: 'Superheroes', keywords: ['hero', 'marvel', 'dc', 'superhero', 'avenger', 'spider', 'batman', 'super'] },
        { key: 'kpop', label: 'K-pop', keywords: ['kpop', 'k-pop', 'idol', 'bts', 'blackpink', 'kdrama'] },
        { key: 'music', label: 'Music', keywords: ['music', 'singer', 'band', 'rock', 'pop', 'rapper', 'musician'] },
        { key: 'movies', label: 'Movies', keywords: ['movie', 'film', 'cinema', 'hollywood', 'actor', 'actress'] },
        { key: 'games', label: 'Games', keywords: ['game', 'gaming', 'rpg', 'fps', 'minecraft', 'fortnite', 'gamer'] },
        { key: 'oc', label: 'OC', keywords: ['oc', 'original', ' original character'] }
    ];

    window.MOOD_EMOJI = {
        Happy: '😊', Sad: '😢', Angry: '😠', Excited: '🤩', Nervous: '😰',
        Flirty: '😏', Tired: '😴', Curious: '🧐', Scared: '😨', Bored: '😑'
    };
})();
