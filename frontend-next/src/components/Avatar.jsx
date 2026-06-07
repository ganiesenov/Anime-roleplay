import { avatarUrl } from '../lib/media.js';

// Pleasant gradient palette for initials-fallback avatars (no more lone emoji).
const GRADIENTS = [
  ['#34d399', '#0ea5e9'], ['#a78bfa', '#ec4899'], ['#fb7185', '#f59e0b'],
  ['#22d3ee', '#6366f1'], ['#f472b6', '#8b5cf6'], ['#facc15', '#fb923c'],
  ['#4ade80', '#14b8a6'], ['#60a5fa', '#a855f7'],
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Image avatar if a url exists; otherwise a name-coloured gradient with initials.
// `size` is a pixel number; pass `className` for shape/extra (default rounded-full).
export default function Avatar({ src, name, size = 40, className = '', rounded = 'rounded-full' }) {
  const dim = { width: size, height: size };
  if (src) {
    return <img src={avatarUrl(src)} alt={name || ''} style={dim} className={`${rounded} object-cover ${className}`} />;
  }
  const [a, b] = GRADIENTS[hash(name || '?') % GRADIENTS.length];
  return (
    <div
      style={{ ...dim, background: `linear-gradient(135deg, ${a}, ${b})`, fontSize: Math.max(11, size * 0.4) }}
      className={`flex items-center justify-center font-semibold text-white/95 ${rounded} ${className}`}
      aria-label={name || ''}
    >
      {initials(name)}
    </div>
  );
}
