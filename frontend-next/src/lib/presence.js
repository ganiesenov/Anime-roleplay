// "Living presence" — gives a character a sense of real time: a daily sleep
// schedule (deterministic per character), time-of-day awareness, and the gap
// since the last message. Pure helpers; the chat layer wires them into prompts.

function hashStr(s) {
  let h = 0;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

// A stable wake/sleep window per character so different characters live on
// slightly different clocks. wake 6–9h, sleep 22/23/00h.
export function scheduleFor(charId) {
  const h = hashStr(charId);
  return { wake: 6 + (h % 4), sleep: (22 + (Math.floor(h / 4) % 3)) % 24 };
}

function isAsleep(hour, sched) {
  const { wake, sleep } = sched;
  return sleep < wake ? (hour >= sleep && hour < wake) : (hour >= sleep || hour < wake);
}

export function presenceFor(charId, date = new Date()) {
  const asleep = isAsleep(date.getHours(), scheduleFor(charId));
  return asleep
    ? { state: 'asleep', badge: '🌙', label: 'asleep', promptLabel: "in the middle of their night and asleep — groggy and sleepy if woken" }
    : { state: 'online', badge: '🟢', label: 'online', promptLabel: 'awake and around' };
}

export function formatElapsed(ms) {
  const min = Math.round(ms / 60000);
  if (min < 90) return min + (min === 1 ? ' minute' : ' minutes');
  const hrs = Math.round(min / 60);
  if (hrs < 36) return hrs + (hrs === 1 ? ' hour' : ' hours');
  const days = Math.round(hrs / 24);
  return days + (days === 1 ? ' day' : ' days');
}

// The TIME & PRESENCE prompt section for the speaking character.
export function buildPresenceText(speakerName, charId, now, lastTs) {
  const parts = [];
  parts.push('Current time: ' + now.toLocaleString(undefined, { weekday: 'long', hour: '2-digit', minute: '2-digit' }) + '.');
  if (lastTs) {
    const gap = now.getTime() - lastTs;
    if (gap > 10 * 60 * 1000) parts.push('It has been ' + formatElapsed(gap) + ' since you last spoke with the user.');
  }
  parts.push(speakerName + ' is ' + presenceFor(charId, now).promptLabel + '.');
  return '--- TIME & PRESENCE ---\n' + parts.join(' ')
    + '\nReact naturally to the time of day and any gap — weave it in, never recap it mechanically.';
}
