/* tutorial.js — first-run guided spotlight/tooltip tour. */
(function () {
    'use strict';
    function $(id) { return document.getElementById(id); }

    const STEPS = [
        { phase: 'character-selection', targetId: null, position: 'center', indicator: 'Welcome', title: 'Welcome to Aria!', text: 'Create AI characters and chat with them. Let\'s take a quick tour.', next: "Let's Go" },
        { phase: 'character-selection', targetId: 'app-settings-btn', position: 'bottom', indicator: 'Step 1', title: 'Set up your AI', text: 'Open Settings and enter your API key (or use the local backend) first.', next: 'Next' },
        { phase: 'character-selection', targetId: 'new-character-btn', position: 'bottom', indicator: 'Step 2', title: 'Create a Character', text: 'Click here to create your first character from scratch.', next: 'Next' },
        { phase: 'character-selection', targetId: 'manage-personas-btn', position: 'bottom', indicator: 'Step 3', title: 'Personas (optional)', text: 'Create personas to represent yourself in chats.', next: 'Next' },
        { phase: 'chat-list', targetId: 'start-new-chat-btn', position: 'top', indicator: 'Step 4', title: 'Start a Chat', text: 'Start a new conversation with this character.', next: 'Next' },
        { phase: 'chat-list', targetId: 'edit-character-btn', position: 'top', indicator: 'Step 5', title: 'Edit a Character', text: 'Tweak your character anytime from here.', next: 'Next' },
        { phase: 'chat', targetId: 'chat-form', position: 'top', indicator: 'Step 6', title: 'Type a Message', text: 'Use Character to speak to them, or Narrator for story narration.', next: 'Next' },
        { phase: 'chat', targetId: 'settings-container', position: 'bottom', indicator: 'Step 7', title: 'Chat Controls', text: 'Adjust design, effects, mood, and more from this panel.', next: 'Done' }
    ];

    let active = false;
    let current = 0;
    let pendingPhase = null;

    function activeScreenPhase() {
        if (!$('chat-screen').classList.contains('is-inactive')) return 'chat';
        if (!$('chat-list-screen').classList.contains('is-inactive')) return 'chat-list';
        return 'character-selection';
    }

    function tutorialInit() {
        if (localStorage.getItem('tutorialCompleted')) return;
        active = true;
        const phase = activeScreenPhase();
        let start = STEPS.findIndex((s) => s.phase === phase);
        if (start === -1) start = 0;
        tutorialShowStep(start);
    }

    function tutorialShowStep(i) {
        if (i >= STEPS.length) { complete(); return; }
        current = i;
        const step = STEPS[i];
        if (step.phase !== activeScreenPhase()) {
            pendingPhase = step.phase;
            hideUI();
            return;
        }
        pendingPhase = null;
        fillTooltip(step);
        position(step);
        requestAnimationFrame(() => {
            $('tutorial-backdrop').classList.add('active');
            $('tutorial-spotlight').classList.add('active');
            $('tutorial-tooltip').classList.add('active');
        });
    }

    function fillTooltip(step) {
        $('tutorial-step-indicator').textContent = step.indicator;
        $('tutorial-title').textContent = step.title;
        $('tutorial-text').textContent = step.text;
        $('tutorial-next-btn').textContent = step.next;
    }

    function position(step) {
        const spot = $('tutorial-spotlight');
        const tip = $('tutorial-tooltip');
        const pad = 7;
        const target = step.targetId ? $(step.targetId) : null;
        if (!target) {
            // Centered welcome.
            spot.style.left = (window.innerWidth / 2 - 80) + 'px';
            spot.style.top = (window.innerHeight / 2 - 80) + 'px';
            spot.style.width = '160px';
            spot.style.height = '160px';
            tip.style.left = (window.innerWidth / 2 - tip.offsetWidth / 2) + 'px';
            tip.style.top = (window.innerHeight / 2 + 100) + 'px';
            return;
        }
        const r = target.getBoundingClientRect();
        spot.style.left = (r.left - pad) + 'px';
        spot.style.top = (r.top - pad) + 'px';
        spot.style.width = (r.width + pad * 2) + 'px';
        spot.style.height = (r.height + pad * 2) + 'px';
        let top, left;
        const tw = tip.offsetWidth || 300, th = tip.offsetHeight || 160;
        let pos = step.position;
        if (pos === 'bottom' && r.bottom + th + 20 > window.innerHeight) pos = 'top';
        if (pos === 'top' && r.top - th - 20 < 0) pos = 'bottom';
        switch (pos) {
            case 'top': top = r.top - th - 14; left = r.left + r.width / 2 - tw / 2; break;
            case 'bottom': top = r.bottom + 14; left = r.left + r.width / 2 - tw / 2; break;
            case 'left': top = r.top + r.height / 2 - th / 2; left = r.left - tw - 14; break;
            case 'right': top = r.top + r.height / 2 - th / 2; left = r.right + 14; break;
            default: top = window.innerHeight / 2; left = window.innerWidth / 2 - tw / 2;
        }
        const margin = 12;
        left = Math.max(margin, Math.min(left, window.innerWidth - tw - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - th - margin));
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }

    function tutorialOnScreenChange(screenName) {
        if (!active) return;
        if (pendingPhase && screenName === pendingPhase) {
            setTimeout(() => {
                const idx = STEPS.findIndex((s, i) => i >= current && s.phase === pendingPhase);
                tutorialShowStep(idx === -1 ? current : idx);
            }, 350);
        }
    }

    function next() { tutorialShowStep(current + 1); }

    function complete() {
        active = false;
        pendingPhase = null;
        localStorage.setItem('tutorialCompleted', '1');
        ['tutorial-backdrop', 'tutorial-spotlight', 'tutorial-tooltip'].forEach((id) => {
            const el = $(id);
            if (el) { el.classList.remove('active'); }
        });
    }

    function hideUI() {
        ['tutorial-backdrop', 'tutorial-spotlight', 'tutorial-tooltip'].forEach((id) => {
            const el = $(id);
            if (el) el.classList.remove('active');
        });
    }

    function repositionActive() {
        if (!active || pendingPhase) return;
        position(STEPS[current]);
    }

    function wireTutorial() {
        const next1 = $('tutorial-next-btn');
        const skip = $('tutorial-skip-btn');
        if (next1) next1.addEventListener('click', next);
        if (skip) skip.addEventListener('click', complete);
        let t;
        window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(repositionActive, 150); });
    }

    window.tutorialInit = tutorialInit;
    window.tutorialShowStep = tutorialShowStep;
    window.tutorialOnScreenChange = tutorialOnScreenChange;
    window.wireTutorial = wireTutorial;
})();
