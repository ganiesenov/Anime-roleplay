import { useState } from 'react';
import { motion } from 'framer-motion';
import { avatarUrl } from '../lib/media.js';
import {
  displayName, getMessageText, getMessageThink, getMessageImage, getMessageImageLoading, getMessageImagePrompt, stripPhotoTag,
} from '../lib/chat.js';
import { renderStreaming, renderFinal, escapeHtml } from '../lib/format.js';
import { ttsSupported } from '../lib/tts.js';
import {
  CtrlBtn, RegenIcon, ContinueIcon, SpeakIcon, StopIcon, PencilIcon, TrashIcon, CopyIcon, CheckIcon, PinIcon, ForkIcon,
} from './icons.jsx';

// A character-sent selfie. Image generation can take a few seconds — show a
// shimmer placeholder until it loads, and gracefully drop out if it fails.
function PhotoMessage({ src, onOpen }) {
  const [state, setState] = useState('loading'); // loading | ok | error
  if (!src) {
    return (
      <div className="mb-2 flex aspect-square w-72 max-w-full items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <span className="flex items-center gap-2 text-xs text-em-text-dim">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-em-accent border-t-transparent" /> generating photo…
        </span>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="mb-2 flex max-w-[18rem] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-em-text-dim">
        🖼️ couldn’t generate photo — check the photo provider in Settings (token / Stable Diffusion running).
      </div>
    );
  }
  return (
    <div className="mb-2 max-w-[18rem] overflow-hidden rounded-xl border border-white/10">
      {state === 'loading' && (
        <div className="flex aspect-square w-72 max-w-full items-center justify-center bg-white/5">
          <span className="flex items-center gap-2 text-xs text-em-text-dim">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-em-accent border-t-transparent" /> developing photo…
          </span>
        </div>
      )}
      <img
        src={src}
        alt="photo"
        onLoad={() => setState('ok')}
        onError={() => setState('error')}
        onClick={() => state === 'ok' && onOpen && onOpen(src)}
        className={'w-72 max-w-full cursor-zoom-in object-cover transition hover:brightness-110 ' + (state === 'ok' ? 'block' : 'hidden')}
      />
    </div>
  );
}

function fmtTime(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
}

const REWRITE_OPTS = [
  { label: 'Shorter', tweak: 'make it noticeably shorter and tighter' },
  { label: 'Longer', tweak: 'make it longer and more detailed' },
  { label: 'More descriptive', tweak: 'add richer sensory detail and atmosphere' },
  { label: 'More dramatic', tweak: 'raise the emotional intensity and drama' },
  { label: 'Different take', tweak: 'take a clearly different direction than before' },
];

export default function MessageBubble({ msg, char, ts, streaming, showThink: showThinkSetting = true, onRegenerate, onRegenerateTweak, onContinue, onSwipe, onEditSave, onDelete, onSpeak, speaking, onFork, onPin, pinned, speaker, group, anchorId, onOpenImage }) {
  const [copied, setCopied] = useState(false);
  const [showThink, setShowThink] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [showRewrite, setShowRewrite] = useState(false);
  const isUser = msg.sender === 'user';
  const text = stripPhotoTag(getMessageText(msg));   // hide any [photo: …] tag from view
  const image = isUser ? '' : getMessageImage(msg);
  const imageLoading = isUser ? false : getMessageImageLoading(msg);
  const imagePrompt = isUser ? '' : getMessageImagePrompt(msg);
  const think = showThinkSetting ? getMessageThink(msg) : '';
  const nVariants = isUser ? 1 : (msg.variations ? msg.variations.length : 1);
  const isStreamingThis = msg.isStreaming;

  const html = isStreamingThis ? renderStreaming(text) : renderFinal(text);

  function beginEdit() { setDraft(getMessageText(msg)); setEditing(true); }
  function commitEdit() { onEditSave(draft); setEditing(false); }
  function cancelEdit() { setEditing(false); }
  function doCopy() {
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch (e) { /* ignore */ }
  }

  const avChar = group ? speaker : char;
  return (
    <motion.div
      id={anchorId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={'group flex w-full scroll-mt-24 items-start gap-2 ' + (isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div
          className="shrink-0 overflow-hidden rounded-full bg-em-panel"
          style={{ width: 'var(--ai-avatar-size)', height: 'var(--ai-avatar-size)' }}
        >
          {avChar && avChar.avatar
            ? <img src={avatarUrl(avChar.avatar)} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-em-text-dim">👤</div>}
        </div>
      )}
      <div className={'flex min-w-0 flex-1 flex-col gap-1 ' + (isUser ? 'items-end' : 'items-start')}>
      {pinned && <div className="px-1 text-[11px] text-em-accent">📌 pinned</div>}
      {!isUser && msg.offscreen && (
        <div className="max-w-[85%] px-1 text-[11px] italic text-em-text-dim">📔 While you were away: {msg.offscreen}</div>
      )}
      {!isUser && (group ? speaker : char) && (
        <div className="px-1 text-xs font-semibold text-em-accent/90">{displayName(group ? speaker : char)}</div>
      )}
      <div
        className={
          'w-fit max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed shadow text-em-text ' +
          (isUser
            ? 'msg-bubble-user border border-em-accent/20'
            : 'msg-bubble-ai border border-white/10 border-l-2 border-l-em-accent/50')
        }
      >
        {!isUser && think && !editing && (
          <details open={showThink} onToggle={(e) => setShowThink(e.target.open)} className="mb-2 rounded-lg bg-black/30 text-xs text-em-text-dim">
            <summary className="cursor-pointer select-none px-2 py-1">💭 Thoughts</summary>
            <div className="px-2 pb-2" dangerouslySetInnerHTML={{ __html: escapeHtml(think).replace(/\n/g, '<br>') }} />
          </details>
        )}
        {editing ? (
          <div className="flex w-[min(70vw,40rem)] max-w-full flex-col gap-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitEdit(); }
                else if (e.key === 'Escape') cancelEdit();
              }}
              rows={Math.min(14, Math.max(2, draft.split('\n').length))}
              className="w-full resize-y rounded-lg border border-white/10 bg-em-bg/60 px-3 py-2 text-em-text focus:border-em-accent/50 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 text-sm">
              <button onClick={cancelEdit} className="rounded-lg px-3 py-1 text-em-text-dim transition hover:text-em-text">Cancel</button>
              <button onClick={commitEdit} className="rounded-lg bg-em-accent px-3 py-1 font-semibold text-em-bg transition hover:bg-emerald-300">Save</button>
            </div>
          </div>
        ) : isStreamingThis && !text ? (
          <span className="inline-flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-em-text-dim" />
          </span>
        ) : (
          <>
            {(image || imageLoading) && <PhotoMessage src={image} onOpen={onOpenImage} />}
            {image && imagePrompt && (
              <details className="mb-2 max-w-[18rem] text-[10px] text-em-text-dim/70">
                <summary className="cursor-pointer select-none">🏷 photo tags</summary>
                <div className="mt-1 break-words rounded bg-black/30 p-1.5 font-mono leading-snug">{imagePrompt}</div>
              </details>
            )}
            {text && <div className="chat-md" dangerouslySetInnerHTML={{ __html: html }} />}
          </>
        )}
      </div>

      {/* Controls (not while this message streams or is being edited) */}
      {!isStreamingThis && !editing && (
        <div className="flex items-center gap-0.5 px-1">
          {!isUser && nVariants > 1 && (
            <span className="mr-1 flex items-center gap-1 text-xs">
              <button onClick={() => onSwipe(-1)} className="rounded p-1 transition hover:bg-white/5 hover:text-em-text">‹</button>
              <span className="tabular-nums">{(msg.activeVariant || 0) + 1}/{nVariants}</span>
              <button onClick={() => onSwipe(1)} className="rounded p-1 transition hover:bg-white/5 hover:text-em-text">›</button>
            </span>
          )}
          {!isUser && (
            <div className="relative">
              <CtrlBtn onClick={() => (onRegenerateTweak ? setShowRewrite((v) => !v) : onRegenerate())} disabled={streaming} active={showRewrite} title="Regenerate / rewrite"><RegenIcon /></CtrlBtn>
              {showRewrite && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowRewrite(false)} />
                  <div className="pop-in absolute left-0 top-full z-40 mt-1 w-44 rounded-xl border border-white/10 bg-em-panel p-1.5 shadow-2xl" style={{ transformOrigin: 'top left' }}>
                    <button onClick={() => { setShowRewrite(false); onRegenerate(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-em-text transition hover:bg-white/5"><RegenIcon /> Try again</button>
                    <div className="my-1 border-t border-white/10" />
                    {REWRITE_OPTS.map((o) => (
                      <button key={o.label} onClick={() => { setShowRewrite(false); onRegenerateTweak(o.tweak); }} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-em-text transition hover:bg-white/5">{o.label}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {!isUser && <CtrlBtn onClick={onContinue} disabled={streaming} title="Continue this reply"><ContinueIcon /></CtrlBtn>}
          {!isUser && ttsSupported() && <CtrlBtn onClick={onSpeak} active={speaking} title={speaking ? 'Stop' : 'Read aloud'}>{speaking ? <StopIcon /> : <SpeakIcon />}</CtrlBtn>}
          <CtrlBtn onClick={beginEdit} disabled={streaming} title="Edit message"><PencilIcon /></CtrlBtn>
          <CtrlBtn onClick={doCopy} active={copied} title={copied ? 'Copied!' : 'Copy text'}>{copied ? <CheckIcon /> : <CopyIcon />}</CtrlBtn>
          <CtrlBtn onClick={onPin} active={pinned} title={pinned ? 'Unpin' : 'Pin (keep in context)'}><PinIcon /></CtrlBtn>
          <CtrlBtn onClick={onFork} disabled={streaming} title="New chat from here"><ForkIcon /></CtrlBtn>
          <CtrlBtn onClick={onDelete} disabled={streaming} danger title="Delete this and following messages"><TrashIcon /></CtrlBtn>
          {ts ? <span className="ml-1 select-none text-[10px] text-em-text-dim/60 opacity-0 transition group-hover:opacity-100">{fmtTime(ts)}</span> : null}
        </div>
      )}
      </div>
    </motion.div>
  );
}
