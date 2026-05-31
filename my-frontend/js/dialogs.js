// =============================================================
// dialogs.js — custom modal dialogs (alert/prompt/confirm/choice).
// Self-contained: only uses the DOM. No app state.
// =============================================================

function showCustomAlert(message) {
    const alertOverlay = document.createElement('div');
    alertOverlay.className = 'custom-alert-overlay';

    const alertModal = document.createElement('div');
    alertModal.className = 'custom-alert-modal';

    const messageP = document.createElement('p');
    messageP.textContent = message;

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.className = 'action-btn'; 

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'custom-dialog-buttons';
    buttonContainer.style.justifyContent = 'flex-end'; 
    buttonContainer.appendChild(okButton);

    alertModal.appendChild(messageP);
    alertModal.appendChild(buttonContainer); 
    alertOverlay.appendChild(alertModal);

    document.body.appendChild(alertOverlay);
    
    okButton.focus();

    okButton.addEventListener('click', () => {
        alertOverlay.remove();
    });
}



function showCustomPrompt(message, defaultValue = '') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';

        const modal = document.createElement('div');
        modal.className = 'custom-alert-modal';

        const messageP = document.createElement('p');
        messageP.textContent = message;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.className = 'custom-prompt-input';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'custom-dialog-buttons';

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'action-btn';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'secondary-btn';

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        modal.appendChild(messageP);
        modal.appendChild(input);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        input.focus();
        input.select();

        const confirm = () => {
            overlay.remove();
            resolve(input.value);
        };
        const cancel = () => {
            overlay.remove();
            resolve(null);
        };

        okButton.addEventListener('click', confirm);
        cancelButton.addEventListener('click', cancel);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') cancel();
        });
    });
}



function showCustomLargePrompt(message, placeholder = '') {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'custom-alert-overlay';

        const modal = document.createElement('div');
        modal.className = 'custom-alert-modal';
        modal.style.maxWidth = '520px';

        const messageP = document.createElement('p');
        messageP.textContent = message;
        messageP.style.cssText = 'margin:0 0 10px;font-size:0.95em;';

        const textarea = document.createElement('textarea');
        textarea.placeholder = placeholder;
        textarea.rows = 6;
        textarea.style.cssText = 'width:100%;background:#2a2a3a;color:#fff;border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:9px 10px;font-size:0.9em;margin-bottom:12px;box-sizing:border-box;resize:vertical;font-family:inherit;line-height:1.5;';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'custom-dialog-buttons';

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = 'action-btn';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'secondary-btn';

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        modal.appendChild(messageP);
        modal.appendChild(textarea);
        modal.appendChild(buttonContainer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        textarea.focus();

        const confirm = () => {
            overlay.remove();
            resolve(textarea.value);
        };
        const cancel = () => {
            overlay.remove();
            resolve(null);
        };

        okButton.addEventListener('click', confirm);
        cancelButton.addEventListener('click', cancel);
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cancel();
        });
    });
}



function showCustomConfirm(message, danger = false) {
    return new Promise(resolve => {
        const confirmOverlay = document.createElement('div');
        confirmOverlay.className = 'custom-alert-overlay';

        const confirmModal = document.createElement('div');
        confirmModal.className = 'custom-alert-modal';

        const messageP = document.createElement('p');
        messageP.textContent = message;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'custom-dialog-buttons';

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.className = danger ? 'action-btn danger-btn' : 'action-btn';

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'Cancel';
        cancelButton.className = 'secondary-btn';

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(okButton);
        confirmModal.appendChild(messageP);
        confirmModal.appendChild(buttonContainer);
        confirmOverlay.appendChild(confirmModal);
        document.body.appendChild(confirmOverlay);
        
        okButton.focus();

        okButton.addEventListener('click', () => {
            confirmOverlay.remove();
            resolve(true); 
        });

        cancelButton.addEventListener('click', () => {
            confirmOverlay.remove();
            resolve(false); 
        });
    });
}



function showChoiceDialog(message, options) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'custom-alert-overlay';
    const modal = document.createElement('div');
    modal.className = 'custom-alert-modal';

    const p = document.createElement('p');
    p.textContent = message;

    const btns = document.createElement('div');
    btns.className = 'custom-dialog-buttons';

    options.forEach(opt => {
      const b = document.createElement('button');
      b.textContent = opt.label;
      b.className = (opt.primary ? 'action-btn' : 'secondary-btn') + (opt.extraClass ? ' ' + opt.extraClass : '');
      b.addEventListener('click', () => { overlay.remove(); resolve(opt.value); });
      btns.appendChild(b);
    });

    modal.appendChild(p);
    modal.appendChild(btns);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  });
}
