// Optional "energy" economy — a lightweight gamification layer (competitor apps
// gate media behind a credit/diamond balance). Energy is spent on generating
// photos/videos, earned by chatting, and slowly refills over time. Device-global
// (one balance across all chats), stored in localStorage. Opt-in via settings.

const KEY = 'aria-energy';

export const ENERGY_MAX = 100;
const REGEN_PER_HOUR = 8;          // passive refill
export const EARN_PER_REPLY = 2;   // chatting earns a trickle
export const COST = { photo: 8, video: 20 };

function nowMs() { return Date.now(); }

function regen(s) {
  const hrs = Math.max(0, (nowMs() - (s.ts || nowMs())) / 3600000);
  const value = Math.min(ENERGY_MAX, (s.value || 0) + hrs * REGEN_PER_HOUR);
  return { value, ts: nowMs() };
}

// Read current balance, applying passive regen, and persist the new timestamp.
export function loadEnergy() {
  let s;
  try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { s = null; }
  if (!s || typeof s.value !== 'number') s = { value: ENERGY_MAX, ts: nowMs() };
  return regen(s);
}

function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } }

// Integer balance right now (regen applied + persisted).
export function getEnergy() { const s = loadEnergy(); save(s); return Math.floor(s.value); }

// Try to spend `cost`. Returns true and deducts if affordable, else false.
export function spendEnergy(cost) {
  const s = loadEnergy();
  if (s.value < cost) { save(s); return false; }
  s.value -= cost; save(s); return true;
}

// Add energy (capped at max). Returns the new integer balance.
export function earnEnergy(amt) {
  const s = loadEnergy();
  s.value = Math.min(ENERGY_MAX, s.value + amt);
  save(s);
  return Math.floor(s.value);
}
