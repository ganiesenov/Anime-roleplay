// Shared chat glyphs (lucide-react) and the small icon-button / meter atoms.
// Every glyph keeps its original export name so call sites are unchanged; the
// underlying art is now lucide for a crisp, consistent line weight.
import {
  RotateCw, ChevronsRight, Volume2, Square, Send, Pencil, Trash2, Copy, Check,
  Pin, GitFork, Brain, Music, Sparkles, Users, User, Smile, ArrowLeft, Heart,
  Settings, MessageSquare, Plus, Play, Pause, MoreHorizontal, Upload, Download,
  HelpCircle, Search, Home, Star,
} from 'lucide-react';

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
        'grid h-8 w-8 place-items-center rounded-lg transition duration-150 [&_svg]:h-[18px] [&_svg]:w-[18px] ' +
        'hover:-translate-y-0.5 active:scale-90 disabled:pointer-events-none disabled:opacity-30 ' +
        (active
          ? 'bg-em-accent/15 text-em-accent'
          : 'text-em-text/70 ' + (danger ? 'hover:bg-red-500/15 hover:text-red-400' : 'hover:bg-em-accent/15 hover:text-em-accent'))
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

// A consistent pill button for the chat tools bar (icon + label, toggle state).
export function Pill({ onClick, active, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition duration-150 active:scale-95 ' +
        (active
          ? 'border-em-accent/50 bg-em-accent/15 text-em-accent shadow-[0_0_14px_-3px_rgba(var(--accent-rgb),0.55)]'
          : 'border-white/10 bg-white/[0.03] text-em-text-dim hover:-translate-y-0.5 hover:border-em-accent/40 hover:bg-white/[0.06] hover:text-em-text')
      }
    >
      {children}
    </button>
  );
}

// ── Glyph wrappers (name kept; art = lucide). className overrides the default size. ──
export function RegenIcon({ className } = {}) { return <RotateCw className={className || ICO} />; }
export function ContinueIcon({ className } = {}) { return <ChevronsRight className={className || ICO} />; }
export function SpeakIcon({ className } = {}) { return <Volume2 className={className || ICO} />; }
export function StopIcon({ className } = {}) { return <Square className={className || ICO} fill="currentColor" />; }
export function SendIcon({ className } = {}) { return <Send className={className || ICO} />; }
export function PencilIcon({ className } = {}) { return <Pencil className={className || ICO} />; }
export function TrashIcon({ className } = {}) { return <Trash2 className={className || ICO} />; }
export function CopyIcon({ className } = {}) { return <Copy className={className || ICO} />; }
export function CheckIcon({ className } = {}) { return <Check className={className || ICO} />; }
export function PinIcon({ className } = {}) { return <Pin className={className || ICO} />; }
export function ForkIcon({ className } = {}) { return <GitFork className={className || ICO} />; }
export function MemoryIcon({ className } = {}) { return <Brain className={className || ICO} />; }
export function MusicIcon({ className } = {}) { return <Music className={className || ICO} />; }
export function SparkleIcon({ className } = {}) { return <Sparkles className={className || ICO} />; }
export function CastIcon({ className } = {}) { return <Users className={className || ICO} />; }
export function PersonaIcon({ className } = {}) { return <User className={className || ICO} />; }
export function MoodIcon({ className } = {}) { return <Smile className={className || ICO} />; }
export function BackIcon({ className } = {}) { return <ArrowLeft className={className || ICO} />; }
export function HeartIcon({ className } = {}) { return <Heart className={className || ICO} fill="currentColor" />; }
export function GearIcon({ className } = {}) { return <Settings className={className || ICO} />; }
export function ChatsIcon({ className } = {}) { return <MessageSquare className={className || ICO} />; }
export function PlusIcon({ className } = {}) { return <Plus className={className || ICO} />; }
export function PlayIcon({ className } = {}) { return <Play className={className || ICO} fill="currentColor" />; }
export function PauseIcon({ className } = {}) { return <Pause className={className || ICO} fill="currentColor" />; }
export function DotsIcon({ className } = {}) { return <MoreHorizontal className={className || ICO} />; }
export function UploadIcon({ className } = {}) { return <Upload className={className || ICO} />; }
export function DownloadIcon({ className } = {}) { return <Download className={className || ICO} />; }
export function HelpIcon({ className } = {}) { return <HelpCircle className={className || ICO} />; }
export function SearchIcon({ className } = {}) { return <Search className={className || ICO} />; }
export function HomeIcon({ className } = {}) { return <Home className={className || ICO} />; }
export function StarIcon({ className, filled } = {}) { return <Star className={className || ICO} fill={filled ? 'currentColor' : 'none'} />; }
