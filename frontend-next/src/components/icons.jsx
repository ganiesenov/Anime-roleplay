// Shared chat glyphs and the small icon-button / meter atoms.

const ICO = 'h-4 w-4';

// Compact icon button for the per-message action row.
export function CtrlBtn({ onClick, disabled, title, active, danger, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        'grid h-7 w-7 place-items-center rounded-lg transition disabled:opacity-30 ' +
        (active ? 'text-em-accent ' : '') +
        (danger ? 'hover:bg-red-500/10 hover:text-red-400' : 'hover:bg-white/5 hover:text-em-accent')
      }
    >
      {children}
    </button>
  );
}

// A 0–100 progress meter (used by the inner-life panel).
export function Meter({ label, value }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-em-text-dim"><span>{label}</span><span>{v}</span></div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-em-accent" style={{ width: v + '%' }} />
      </div>
    </div>
  );
}

export function RegenIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></svg>;
}
export function ContinueIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><path d="M5 5l8 7-8 7z" /><path d="M14 5l6 7-6 7z" /></svg>;
}
export function SpeakIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>;
}
export function StopIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
}
export function SendIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.4 21 12 3.4 3.6 3 10l12 2-12 2z" /></svg>;
}
export function PencilIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
}
export function TrashIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" /><path d="M10 11v6M14 11v6" /></svg>;
}
export function CopyIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>;
}
export function CheckIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}
export function PinIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5" /><path d="M9 3h6l-1 6 3 3H7l3-3-1-6z" /></svg>;
}
export function ForkIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="5" r="2.5" /><circle cx="18" cy="5" r="2.5" /><circle cx="12" cy="19" r="2.5" /><path d="M6 7.5v3a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-3" /><path d="M12 13.5v3" /></svg>;
}

// ── Tool-bar / header glyphs (same 16px stroke style) ──────────────────────
export function MemoryIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h11l3 3v15H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M9 8h7M9 12h7M9 16h4" /></svg>;
}
export function MusicIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>;
}
export function SparkleIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9z" /><path d="M19 14l.9 2.4L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.6z" /></svg>;
}
export function CastIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><circle cx="17.5" cy="9" r="2.5" /><path d="M16 14.3A5 5 0 0 1 21 19" /></svg>;
}
export function PersonaIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
}
export function MoodIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M8.5 14a4 4 0 0 0 7 0" /><path d="M9 9h.01M15 9h.01" /></svg>;
}
export function BackIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>;
}
export function HeartIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.3C.6 8.9 2 5.7 5 5.2c2-.3 3.4.8 4.3 2 .9 1.2 1.2 1.2 2.1 0 .9-1.2 2.3-2.3 4.3-2 3 .5 4.4 3.7 3 6.5C19.5 16.4 12 21 12 21z" /></svg>;
}
export function GearIcon({ className } = {}) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.4a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 2.6 14H2.5a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 7a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 2.6V2.5a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.6a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.6 1H22a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
}
export function ChatsIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>;
}
export function PlusIcon({ className } = {}) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>;
}
export function PlayIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>;
}
export function PauseIcon() {
  return <svg className={ICO} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>;
}

// A consistent pill button for the chat tools bar (icon + label, toggle state).
export function Pill({ onClick, active, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm transition ' +
        (active
          ? 'border-em-accent/50 bg-em-accent/10 text-em-accent'
          : 'border-white/10 text-em-text-dim hover:border-em-accent/40 hover:text-em-text')
      }
    >
      {children}
    </button>
  );
}

// ── Landing / navbar glyphs (accept an explicit className for variable sizing) ──
export function DotsIcon({ className }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" /></svg>;
}
export function UploadIcon({ className }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>;
}
export function DownloadIcon({ className }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>;
}
export function HelpIcon({ className }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12" y2="17" /></svg>;
}
export function SearchIcon({ className }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>;
}
export function HomeIcon({ className }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>;
}
export function StarIcon({ className, filled }) {
  return <svg className={className || ICO} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.9 5.9 6.1.9-4.5 4.4 1 6L12 17.8 6.5 20.2l1-6L3 9.8l6.1-.9z" /></svg>;
}
