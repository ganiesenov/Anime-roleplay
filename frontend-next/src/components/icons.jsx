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
