/* dialogs.js — toasts + custom alert/confirm/prompt/choice dialogs. */
(function () {
    'use strict';

    function buildOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';
        const modal = document.createElement('div');
        modal.className = 'custom-alert-modal';
        overlay.appendChild(modal);
        // Swallow wheel on backdrop.
        overlay.addEventListener('wheel', (e) => { if (e.target === overlay) e.preventDefault(); }, { passive: false });
        return { overlay, modal };
    }

    function btnRow() {
        const row = document.createElement('div');
        row.className = 'custom-dialog-buttons';
        return row;
    }

    function showToast(message, opts) {
        opts = opts || {};
        const duration = opts.duration || 1600;
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.textContent = message;
        toast.style.pointerEvents = 'none';
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 200);
        }, duration);
    }

    function showCustomAlert(message) {
        return new Promise((resolve) => {
            const { overlay, modal } = buildOverlay();
            const p = document.createElement('p');
            p.textContent = message;
            modal.appendChild(p);
            const row = btnRow();
            const ok = document.createElement('button');
            ok.className = 'action-btn';
            ok.textContent = 'OK';
            row.appendChild(ok);
            modal.appendChild(row);
            document.body.appendChild(overlay);
            const close = () => { overlay.remove(); resolve(); };
            ok.addEventListener('click', close);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
            ok.focus();
        });
    }

    function showCustomConfirm(message, danger) {
        return new Promise((resolve) => {
            const { overlay, modal } = buildOverlay();
            const p = document.createElement('p');
            p.textContent = message;
            modal.appendChild(p);
            const row = btnRow();
            const cancel = document.createElement('button');
            cancel.className = 'secondary-btn';
            cancel.textContent = 'Cancel';
            const ok = document.createElement('button');
            ok.className = danger ? 'danger-btn' : 'action-btn';
            ok.textContent = 'OK';
            row.appendChild(cancel);
            row.appendChild(ok);
            modal.appendChild(row);
            document.body.appendChild(overlay);
            const done = (val) => { overlay.remove(); resolve(val); };
            ok.addEventListener('click', () => done(true));
            cancel.addEventListener('click', () => done(false));
            overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });
            ok.focus();
        });
    }

    function showCustomPrompt(message, defaultValue) {
        return new Promise((resolve) => {
            const { overlay, modal } = buildOverlay();
            const p = document.createElement('p');
            p.textContent = message;
            modal.appendChild(p);
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'custom-prompt-input settings-input';
            input.value = defaultValue || '';
            modal.appendChild(input);
            const row = btnRow();
            const cancel = document.createElement('button');
            cancel.className = 'secondary-btn';
            cancel.textContent = 'Cancel';
            const ok = document.createElement('button');
            ok.className = 'action-btn';
            ok.textContent = 'OK';
            row.appendChild(cancel);
            row.appendChild(ok);
            modal.appendChild(row);
            document.body.appendChild(overlay);
            const done = (val) => { overlay.remove(); resolve(val); };
            ok.addEventListener('click', () => done(input.value));
            cancel.addEventListener('click', () => done(null));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); done(input.value); }
                else if (e.key === 'Escape') { e.preventDefault(); done(null); }
            });
            input.focus();
            input.select();
        });
    }

    function showCustomLargePrompt(message, placeholder) {
        return new Promise((resolve) => {
            const { overlay, modal } = buildOverlay();
            const p = document.createElement('p');
            p.textContent = message;
            modal.appendChild(p);
            const ta = document.createElement('textarea');
            ta.rows = 6;
            ta.className = 'custom-prompt-input settings-input';
            ta.placeholder = placeholder || '';
            modal.appendChild(ta);
            const row = btnRow();
            const cancel = document.createElement('button');
            cancel.className = 'secondary-btn';
            cancel.textContent = 'Cancel';
            const ok = document.createElement('button');
            ok.className = 'action-btn';
            ok.textContent = 'OK';
            row.appendChild(cancel);
            row.appendChild(ok);
            modal.appendChild(row);
            document.body.appendChild(overlay);
            const done = (val) => { overlay.remove(); resolve(val); };
            ok.addEventListener('click', () => done(ta.value));
            cancel.addEventListener('click', () => done(null));
            ta.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); done(null); } });
            ta.focus();
        });
    }

    function showChoiceDialog(message, options) {
        return new Promise((resolve) => {
            const { overlay, modal } = buildOverlay();
            const p = document.createElement('p');
            p.textContent = message;
            modal.appendChild(p);
            const row = btnRow();
            (options || []).forEach((opt) => {
                const b = document.createElement('button');
                b.className = (opt.primary ? 'action-btn' : 'secondary-btn') + (opt.extraClass ? ' ' + opt.extraClass : '');
                b.textContent = opt.label;
                b.addEventListener('click', () => { overlay.remove(); resolve(opt.value); });
                row.appendChild(b);
            });
            modal.appendChild(row);
            document.body.appendChild(overlay);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
        });
    }

    window.showToast = showToast;
    window.showCustomAlert = showCustomAlert;
    window.showCustomConfirm = showCustomConfirm;
    window.showCustomPrompt = showCustomPrompt;
    window.showCustomLargePrompt = showCustomLargePrompt;
    window.showChoiceDialog = showChoiceDialog;
})();
