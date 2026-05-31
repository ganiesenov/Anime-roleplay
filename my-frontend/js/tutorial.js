// =============================================================
// tutorial.js — guided tour (data, spotlight/tooltip positioning,
// step flow, screen-change hooks) + its own event listeners.
// Self-contained: queries its own DOM nodes (present at end of body)
// and exposes tutorialInit()/tutorialOnScreenChange() used elsewhere.
// =============================================================

// =============================================================
// TUTORIAL TOUR MODULE
// =============================================================

const tutorialData = {
    active: false,
    currentStep: 0,
    pendingPhase: null,
    localStorageKey: 'tutorialCompleted',
    steps: [
        // Phase 1 — Character Selection Screen
        {
            phase: 'character-selection',
            targetId: null,
            position: 'center',
            indicator: 'Welcome',
            title: 'Welcome to Casual Character Chat!',
            text: "This quick tour will show you the basics. It only takes a moment — feel free to skip anytime.",
            nextLabel: "Let's Go",
        },
        {
            phase: 'character-selection',
            targetId: 'app-settings-btn',
            position: 'bottom',
            indicator: 'Step 1 of 6',
            title: 'Enter your API Key first',
            text: 'Open Global Settings to add your AI API key. This is your first stop — no key, no AI chat.',
            nextLabel: 'Next',
        },
        {
            phase: 'character-selection',
            targetId: 'new-character-btn',
            position: 'bottom',
            indicator: 'Step 2 of 7',
            title: 'Create your first character',
            text: 'Give them a name, personality, and avatar. This is who you\'ll be chatting with.',
            nextLabel: 'Next',
        },
        {
            phase: 'character-selection',
            targetId: 'manage-personas-btn',
            position: 'bottom',
            indicator: 'Step 3 of 7',
            title: 'Play as your own persona',
            text: 'Optionally create a persona for yourself — useful if you like to roleplay as a specific character or personality across chats.',
            nextLabel: 'Got it',
        },
        // Phase 2 — Chat List Screen
        {
            phase: 'chat-list',
            targetId: 'start-new-chat-btn',
            position: 'top',
            indicator: 'Step 4 of 7',
            title: 'Start a new conversation',
            text: 'Click here to begin a fresh chat session with your character.',
            nextLabel: 'Next',
        },
        {
            phase: 'chat-list',
            targetId: 'edit-character-btn',
            position: 'top',
            indicator: 'Step 5 of 7',
            title: 'Edit your character anytime',
            text: 'Refine their personality, add scenarios, or change their avatar here.',
            nextLabel: 'Got it',
        },
        // Phase 3 — Chat Screen
        {
            phase: 'chat',
            targetId: 'chat-form',
            position: 'top',
            indicator: 'Step 6 of 7',
            title: 'Type your message here',
            text: '"Character" sends an AI reply. "Narrator" adds story narration. Try both!',
            nextLabel: 'Next',
        },
        {
            phase: 'chat',
            targetId: 'settings-container',
            position: 'bottom',
            indicator: 'Step 7 of 7',
            title: 'Your chat control panel',
            text: 'Memories, group chat, persona, and settings all live up here. That\'s the tour!',
            nextLabel: 'Done!',
        },
    ],
};

const tutorialBackdrop        = document.getElementById('tutorial-backdrop');
const tutorialSpotlight       = document.getElementById('tutorial-spotlight');
const tutorialTooltipEl       = document.getElementById('tutorial-tooltip');
const tutorialStepIndicatorEl = document.getElementById('tutorial-step-indicator');
const tutorialTitleEl         = document.getElementById('tutorial-title');
const tutorialTextEl          = document.getElementById('tutorial-text');
const tutorialSkipBtn         = document.getElementById('tutorial-skip-btn');
const tutorialNextBtn         = document.getElementById('tutorial-next-btn');

function tutorialGetActivePhase() {
    if (!characterSelectionScreen.classList.contains('is-inactive')) return 'character-selection';
    if (!chatListScreen.classList.contains('is-inactive'))           return 'chat-list';
    if (!chatScreen.classList.contains('is-inactive'))               return 'chat';
    return null;
}

function tutorialPositionSpotlight(step) {
    if (!step.targetId) {
        tutorialSpotlight.classList.add('tutorial-welcome');
        tutorialSpotlight.style.cssText = '';
        return null;
    }
    tutorialSpotlight.classList.remove('tutorial-welcome');
    const el = document.getElementById(step.targetId);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const pad = 7;
    tutorialSpotlight.style.top    = (rect.top    - pad) + 'px';
    tutorialSpotlight.style.left   = (rect.left   - pad) + 'px';
    tutorialSpotlight.style.width  = (rect.width  + pad * 2) + 'px';
    tutorialSpotlight.style.height = (rect.height + pad * 2) + 'px';
    return rect;
}

function tutorialComputeTooltipPos(targetRect, position) {
    const MARGIN = 14;
    const PAD    = 12;
    const tw = tutorialTooltipEl.offsetWidth  || 300;
    const th = tutorialTooltipEl.offsetHeight || 160;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (position === 'center') {
        return { top: (vh - th) / 2, left: (vw - tw) / 2 };
    }

    const midX = targetRect.left + targetRect.width  / 2;
    let top, left;

    if (position === 'bottom') {
        top  = targetRect.bottom + MARGIN;
        left = midX - tw / 2;
    } else if (position === 'top') {
        top  = targetRect.top - th - MARGIN;
        left = midX - tw / 2;
    } else if (position === 'left') {
        top  = targetRect.top + targetRect.height / 2 - th / 2;
        left = targetRect.left - tw - MARGIN;
    } else {
        top  = targetRect.top + targetRect.height / 2 - th / 2;
        left = targetRect.right + MARGIN;
    }

    if (top + th > vh - PAD) top = targetRect.top - th - MARGIN;
    if (top < PAD)           top = targetRect.bottom + MARGIN;
    left = Math.max(PAD, Math.min(left, vw - tw - PAD));

    return { top, left };
}

function tutorialHideUI() {
    tutorialSpotlight.classList.remove('tutorial-visible');
    tutorialTooltipEl.classList.remove('tutorial-visible');
    setTimeout(() => {
        tutorialBackdrop.classList.remove('tutorial-active');
        tutorialSpotlight.classList.remove('tutorial-active', 'tutorial-welcome');
        tutorialTooltipEl.classList.remove('tutorial-active', 'tutorial-centered');
    }, 260);
}

function tutorialComplete() {
    localStorage.setItem(tutorialData.localStorageKey, 'true');
    tutorialData.active = false;
    tutorialData.pendingPhase = null;
    tutorialSpotlight.classList.remove('tutorial-visible');
    tutorialTooltipEl.classList.remove('tutorial-visible');
    setTimeout(() => {
        tutorialBackdrop.classList.remove('tutorial-active');
        tutorialSpotlight.classList.remove('tutorial-active', 'tutorial-welcome');
        tutorialTooltipEl.classList.remove('tutorial-active', 'tutorial-centered');
        tutorialSpotlight.style.cssText = '';
        tutorialTooltipEl.style.cssText = '';
    }, 280);
}

function tutorialShowStep(stepIndex) {
    if (stepIndex >= tutorialData.steps.length) {
        tutorialComplete();
        return;
    }

    const step = tutorialData.steps[stepIndex];
    tutorialData.currentStep = stepIndex;

    const activePhase = tutorialGetActivePhase();
    if (step.phase !== activePhase) {
        tutorialData.pendingPhase = step.phase;
        tutorialHideUI();
        return;
    }

    tutorialData.pendingPhase = null;

    tutorialStepIndicatorEl.textContent = step.indicator;
    tutorialTitleEl.textContent         = step.title;
    tutorialTextEl.textContent          = step.text;
    tutorialNextBtn.textContent         = step.nextLabel;

    tutorialBackdrop.classList.add('tutorial-active');
    tutorialSpotlight.classList.add('tutorial-active');
    tutorialTooltipEl.classList.add('tutorial-active');

    if (step.position === 'center') {
        tutorialTooltipEl.classList.add('tutorial-centered');
    } else {
        tutorialTooltipEl.classList.remove('tutorial-centered');
    }

    const targetRect = tutorialPositionSpotlight(step);

    if (step.position !== 'center') {
        const pos = tutorialComputeTooltipPos(
            targetRect || { top: 0, left: 0, width: 0, height: 0, bottom: 0, right: 0 },
            step.position
        );
        tutorialTooltipEl.style.top  = pos.top  + 'px';
        tutorialTooltipEl.style.left = pos.left + 'px';
    }

    requestAnimationFrame(() => {
        tutorialSpotlight.classList.add('tutorial-visible');
        tutorialTooltipEl.classList.add('tutorial-visible');
    });
}

function tutorialOnScreenChange(screenName) {
    if (!tutorialData.active) return;
    if (tutorialData.pendingPhase !== screenName) return;
    setTimeout(() => {
        const stepIndex = tutorialData.steps.findIndex(s => s.phase === screenName);
        if (stepIndex !== -1) tutorialShowStep(stepIndex);
    }, 260);
}

function tutorialInit() {
    if (localStorage.getItem(tutorialData.localStorageKey)) return;
    tutorialData.active = true;
    const currentPhase = tutorialGetActivePhase();
    if (currentPhase === 'chat-list') {
        const i = tutorialData.steps.findIndex(s => s.phase === 'chat-list');
        tutorialShowStep(i);
    } else if (currentPhase === 'chat') {
        const i = tutorialData.steps.findIndex(s => s.phase === 'chat');
        tutorialShowStep(i);
    } else {
        tutorialShowStep(0);
    }
}

tutorialSkipBtn.addEventListener('click', () => {
    tutorialComplete();
});

tutorialNextBtn.addEventListener('click', () => {
    if (!tutorialData.active) return;
    tutorialShowStep(tutorialData.currentStep + 1);
});

tutorialBackdrop.addEventListener('click', (e) => {
    e.stopPropagation();
});

let tutorialResizeTimer;
window.addEventListener('resize', () => {
    if (!tutorialData.active || tutorialData.pendingPhase !== null) return;
    clearTimeout(tutorialResizeTimer);
    tutorialResizeTimer = setTimeout(() => {
        const step = tutorialData.steps[tutorialData.currentStep];
        if (!step) return;
        const targetRect = tutorialPositionSpotlight(step);
        if (step.position !== 'center' && targetRect) {
            const pos = tutorialComputeTooltipPos(targetRect, step.position);
            tutorialTooltipEl.style.top  = pos.top  + 'px';
            tutorialTooltipEl.style.left = pos.left + 'px';
        }
    }, 120);
});

// =============================================================
// END TUTORIAL TOUR MODULE
// =============================================================
