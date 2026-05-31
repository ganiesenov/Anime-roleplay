// =============================================================
// state.js — shared global app state & constants.
// Loaded FIRST (before all other scripts). Pure data, no DOM access.
// All names are top-level globals, shared across <script> tags (variant A).
// window.App is the namespace facade; the bare names below ARE the
// canonical state and are referenced directly throughout the app.
// =============================================================

window.App = window.App || {};

// --- IndexedDB handle (assigned in openDB(), storage layer) ---
let db;

// --- constants ---
// Default model points at the local FastAPI backend. The backend itself
// picks the actual Ollama model via its OLLAMA_MODEL env var, so the id/name
// here is just a label; only targetApiUrl needs to be the local endpoint.
const availableModels = [
  { id: "local-qwen", name: "Qwen (local backend)", targetApiUrl: "http://127.0.0.1:8000/v1/chat/completions" },
  { id: "z-ai/glm-4.5-air:free", name: "Z.AI: GLM 4.5 Air (free)" }
];

const APP_VERSION = 1.0;

const DEFAULT_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const defaultSettings = {
    fontSize: '18',
    temperature: '0.70',
    model: availableModels[0].id,
    mainTextColor: '#FFFFFF',
    dialogueColor: '#ffd952',
    userBubbleColor: '#141414',
    userBubbleOpacity: '0.7',
    aiBubbleColor: '#141414',
    aiBubbleOpacity: '0.7',
    messageSpacing: '50',
    soundEnabled: 'true',
    thinkEnabled: 'true',
    replyOptionsEnabled: 'true',
    blur: '5',
    avatarSize: '200',
    ttsEnabled: 'false',
    ttsVoiceURI: '',
    replyLength: 'default',
};

// --- mutable runtime state ---
let audioCtx;
let soundEnabled = true;
let thinkEnabled = true;
let replyOptionsEnabled = true;
let ttsEnabled = false;
let ttsCurrentVoiceURI = '';
let replyLength = 'default';
let replyOptionsLoading = false;
let pendingReplyOptions = null;
let replyOptionsReqId = 0;
let suggestionModelId = null;
let characters = {};
let currentCharacterId = null;
let tempUploadedImages = {
  avatar: null,
  avatarOriginal: null,
  background: null,
  backgroundOriginal: null,
  personaAvatar: null,
  personaAvatarOriginal: null
};
let currentChatId = null;
let worldCharSelectedIds = new Set();
let activeGroupParticipantId = null;
let personas = {};
let appSettings = {};
let currentStreamController = null;
