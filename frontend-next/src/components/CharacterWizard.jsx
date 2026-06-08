import { useState } from 'react';
import { saveCharacter } from '../lib/db.js';
import { syncCharacterToServer, fetchAsDataUrl } from '../lib/api.js';
import { buildPhotoUrl } from '../lib/chat.js';
import { DEFAULT_SETTINGS, resolveModel } from '../lib/settings.js';
import { generateCharacter, generateScenario } from '../lib/aigen.js';

// A guided, competitor-style "Fantasy Builder": pick a style, looks and personality
// from chips, then create. It assembles a fully working character (Danbooru
// `appearance` so photos fire immediately, personality `tags`, a templated
// description + greeting) and hands it to the full editor for any fine-tuning.

const STYLES = [
  { key: 'anime', label: 'Anime', tag: 'anime', emoji: '🌸' },
  { key: 'realistic', label: 'Realistic', tag: 'realistic, photorealistic', emoji: '📷' },
];
const GENDERS = [
  { key: 'female', label: 'Woman', tag: '1girl, woman' },
  { key: 'male', label: 'Man', tag: '1boy, man' },
  { key: 'nb', label: 'Androgynous', tag: '1other, androgynous' },
];
const AGES = [
  { key: 'young', label: 'Young adult', tag: 'young adult' },
  { key: 'adult', label: 'Adult', tag: 'adult' },
  { key: 'mature', label: 'Mature', tag: 'mature' },
];
const ETHNICITY = ['Asian', 'White', 'Black', 'Latina', 'Middle Eastern', 'Indian'];
const BODY = ['Slim', 'Curvy', 'Athletic', 'Petite', 'Voluptuous', 'Plus-size'];
const HAIR_COLOR = ['Black', 'Brown', 'Blonde', 'Red', 'White', 'Pink', 'Blue', 'Purple'];
const HAIR_STYLE = ['Long', 'Short', 'Ponytail', 'Bob', 'Curly', 'Braided', 'Bun'];
const EYES = ['Brown', 'Blue', 'Green', 'Hazel', 'Amber', 'Grey'];
const OUTFITS = ['Casual', 'Elegant dress', 'Office', 'Lingerie', 'Swimsuit', 'Sporty', 'Goth', 'Fantasy'];

const TRAITS = ['Shy', 'Bold', 'Caring', 'Playful', 'Flirty', 'Dominant', 'Submissive', 'Cold', 'Cheerful', 'Mysterious', 'Intellectual', 'Protective', 'Jealous', 'Sarcastic', 'Romantic', 'Wild'];
const VIBES = [
  { key: 'girlfriend', label: 'Girlfriend', desc: 'a loving romantic partner' },
  { key: 'crush', label: 'Crush', desc: 'someone you are just getting to know, with sparks flying' },
  { key: 'friend', label: 'Best friend', desc: 'a close, easygoing friend' },
  { key: 'mentor', label: 'Mentor', desc: 'a wise, guiding figure' },
  { key: 'rival', label: 'Rival', desc: 'a fierce rival with tension between you' },
  { key: 'stranger', label: 'Stranger', desc: 'an intriguing stranger you just met' },
];

const RANDOM_NAMES = ['Aria', 'Mia', 'Luna', 'Sora', 'Yuki', 'Eva', 'Nova', 'Ivy', 'Rin', 'Zoe', 'Kai', 'Leo', 'Aiden', 'Ren', 'Theo'];

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={'rounded-full border px-3 py-1.5 text-sm transition ' + (active
        ? 'border-em-accent/60 bg-em-accent/15 text-em-accent'
        : 'border-white/10 text-em-text hover:border-em-accent/40 hover:text-em-accent')}
    >{children}</button>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <div className="mb-1.5 text-sm font-medium text-em-text">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const STEPS = ['Style', 'Looks', 'Personality', 'Finish'];

export default function CharacterWizard({ onClose, onCreated, settings = DEFAULT_SETTINGS }) {
  const [step, setStep] = useState(0);
  const [style, setStyle] = useState('anime');
  const [gender, setGender] = useState('female');
  const [age, setAge] = useState('young');
  const [ethnicity, setEthnicity] = useState('');
  const [body, setBody] = useState('Slim');
  const [hairColor, setHairColor] = useState('Black');
  const [hairStyle, setHairStyle] = useState('Long');
  const [eyes, setEyes] = useState('Brown');
  const [outfit, setOutfit] = useState('Casual');
  const [traits, setTraits] = useState(['Caring', 'Playful']);
  const [vibe, setVibe] = useState('girlfriend');
  const [name, setName] = useState('');
  const [aiEnrich, setAiEnrich] = useState(true);
  const [genAvatar, setGenAvatar] = useState(settings.aiPhotos);
  const [busy, setBusy] = useState('');   // '' | 'enrich' | 'avatar' | 'save'
  const [error, setError] = useState('');

  const toggleTrait = (t) => setTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : (prev.length < 5 ? [...prev, t] : prev));
  const randomName = () => setName(RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]);

  // Assemble the Danbooru appearance line that drives photo/video likeness.
  function buildAppearance() {
    const g = GENDERS.find((x) => x.key === gender);
    const parts = [
      style === 'anime' ? 'anime' : 'realistic, photorealistic',
      g && g.tag,
      AGES.find((x) => x.key === age)?.tag,
      style === 'realistic' && ethnicity ? ethnicity.toLowerCase() : '',
      body && body.toLowerCase() + ' body',
      hairColor && hairStyle ? (hairColor + ' ' + hairStyle + ' hair').toLowerCase() : '',
      eyes && (eyes.toLowerCase() + ' eyes'),
      outfit && outfit.toLowerCase(),
    ];
    return parts.filter(Boolean).join(', ');
  }

  function buildDescription(nm) {
    const v = VIBES.find((x) => x.key === vibe);
    const looks = [style === 'realistic' && ethnicity, body && body.toLowerCase(), hairColor && hairStyle && (hairColor.toLowerCase() + ' ' + hairStyle.toLowerCase() + ' hair'), eyes && (eyes.toLowerCase() + ' eyes')].filter(Boolean).join(', ');
    const pers = traits.length ? traits.join(', ').toLowerCase() : 'warm';
    return `${nm} is ${v ? v.desc : 'a companion'}. ${looks ? 'They have ' + looks + '. ' : ''}Their personality is ${pers}. They speak naturally and stay true to who they are.`;
  }

  function buildGreeting(nm) {
    const v = VIBES.find((x) => x.key === vibe);
    if (vibe === 'stranger' || vibe === 'crush') return `*${nm} notices you and offers a small, curious smile.* "Oh — hi. I don't think we've met yet."`;
    if (vibe === 'rival') return `*${nm} crosses their arms, a competitive glint in their eyes.* "Well, look who showed up. Think you can keep up with me today?"`;
    if (vibe === 'mentor') return `*${nm} looks up from their work and gives you a measured nod.* "You came. Good. Sit — there's a lot I want to share with you."`;
    if (vibe === 'friend') return `*${nm} brightens the second they see you.* "Hey, you! Perfect timing, I was just thinking about you. What's up?"`;
    return `*${nm} lights up as you walk in, crossing the room to you.* "There you are. I missed you — come here, tell me everything about your day."`;
  }

  async function create() {
    setError('');
    const nm = (name.trim() || RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]);
    const appearance = buildAppearance();
    const rec = {
      id: 'char-' + Date.now(),
      type: 'character',
      name: nm,
      chatName: nm,
      appearance,
      tags: traits.join(', '),
      description: buildDescription(nm),
      instructions: '',
      reminder: '',
      lore: '',
      avatar: '',
      background: '',
      scenarios: [{ name: 'Greeting', text: buildGreeting(nm) }],
      traits: {},
      chats: {}, characterIds: [], isFavorite: false, isArchived: false,
      particleEffect: 'none', particleIntensityLevel: 50,
    };

    // Optional: flesh out the description/instructions + a richer greeting via the LLM.
    if (aiEnrich) {
      setBusy('enrich');
      try {
        const concept = `${nm}, ${VIBES.find((x) => x.key === vibe)?.desc || 'a companion'}; personality: ${traits.join(', ')}; looks: ${appearance}`;
        const c = await generateCharacter(concept, resolveModel(settings, settings.model));
        if (c) {
          if (c.description && c.description.trim()) rec.description = c.description.trim();
          if (c.instructions && c.instructions.trim()) rec.instructions = c.instructions.trim();
          if (c.tags && c.tags.trim()) rec.tags = [rec.tags, c.tags].filter(Boolean).join(', ');
          if (c.name && c.name.trim() && !name.trim()) { rec.name = c.name.trim(); rec.chatName = c.name.trim(); }
        }
        try {
          const g = await generateScenario({ name: rec.name, description: rec.description, lore: '', hints: VIBES.find((x) => x.key === vibe)?.desc || '' }, resolveModel(settings, settings.model));
          if (g && g.trim()) rec.scenarios = [{ name: 'Greeting', text: g.trim() }];
        } catch (e) { /* keep templated greeting */ }
      } catch (e) {
        setError('AI enrich failed — created with a templated profile instead.');
      }
    }

    // Optional: generate and bake a stable avatar from the appearance tags.
    if (genAvatar && settings.aiPhotos) {
      setBusy('avatar');
      try {
        const url = buildPhotoUrl(rec, 'portrait, upper body, looking at viewer, soft lighting', settings, {});
        const dataUrl = await fetchAsDataUrl(url);
        if (dataUrl) rec.avatar = dataUrl;
      } catch (e) { /* avatar is best-effort */ }
    }

    setBusy('save');
    await saveCharacter(rec);
    syncCharacterToServer(rec);
    setBusy('');
    onCreated && onCreated(rec);
  }

  const working = !!busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl glass-panel shadow-2xl">
        {/* Header + step rail */}
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-em-text">✨ Character wizard</h2>
            <button onClick={onClose} className="rounded-lg px-2 py-1 text-em-text-dim transition hover:bg-white/5 hover:text-em-text">✕</button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <div className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ' + (i <= step ? 'bg-em-accent text-em-bg' : 'bg-white/10 text-em-text-dim')}>{i + 1}</div>
                <span className={'text-xs ' + (i === step ? 'text-em-text' : 'text-em-text-dim')}>{s}</span>
                {i < STEPS.length - 1 && <div className={'h-px flex-1 ' + (i < step ? 'bg-em-accent/50' : 'bg-white/10')} />}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {step === 0 && (
            <>
              <Section title="Art style">
                {STYLES.map((s) => <Chip key={s.key} active={style === s.key} onClick={() => setStyle(s.key)}>{s.emoji} {s.label}</Chip>)}
              </Section>
              <Section title="Gender">
                {GENDERS.map((g) => <Chip key={g.key} active={gender === g.key} onClick={() => setGender(g.key)}>{g.label}</Chip>)}
              </Section>
              <Section title="Age">
                {AGES.map((a) => <Chip key={a.key} active={age === a.key} onClick={() => setAge(a.key)}>{a.label}</Chip>)}
              </Section>
            </>
          )}

          {step === 1 && (
            <>
              {style === 'realistic' && (
                <Section title="Ethnicity">
                  {ETHNICITY.map((e) => <Chip key={e} active={ethnicity === e} onClick={() => setEthnicity(ethnicity === e ? '' : e)}>{e}</Chip>)}
                </Section>
              )}
              <Section title="Body">{BODY.map((b) => <Chip key={b} active={body === b} onClick={() => setBody(b)}>{b}</Chip>)}</Section>
              <Section title="Hair colour">{HAIR_COLOR.map((h) => <Chip key={h} active={hairColor === h} onClick={() => setHairColor(h)}>{h}</Chip>)}</Section>
              <Section title="Hair style">{HAIR_STYLE.map((h) => <Chip key={h} active={hairStyle === h} onClick={() => setHairStyle(h)}>{h}</Chip>)}</Section>
              <Section title="Eyes">{EYES.map((e) => <Chip key={e} active={eyes === e} onClick={() => setEyes(e)}>{e}</Chip>)}</Section>
              <Section title="Outfit">{OUTFITS.map((o) => <Chip key={o} active={outfit === o} onClick={() => setOutfit(o)}>{o}</Chip>)}</Section>
            </>
          )}

          {step === 2 && (
            <>
              <Section title="Relationship to you">
                {VIBES.map((v) => <Chip key={v.key} active={vibe === v.key} onClick={() => setVibe(v.key)}>{v.label}</Chip>)}
              </Section>
              <div>
                <div className="mb-1.5 text-sm font-medium text-em-text">Personality <span className="text-xs text-em-text-dim">(up to 5)</span></div>
                <div className="flex flex-wrap gap-2">
                  {TRAITS.map((t) => <Chip key={t} active={traits.includes(t)} onClick={() => toggleTrait(t)}>{t}</Chip>)}
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div>
                <div className="mb-1.5 text-sm font-medium text-em-text">Name</div>
                <div className="flex gap-2">
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Leave blank for a random name"
                    className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-em-text placeholder:text-em-text-dim/60 focus:border-em-accent/50 focus:outline-none" />
                  <button onClick={randomName} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-em-text-dim transition hover:border-em-accent/40 hover:text-em-accent">🎲</button>
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-white/10 p-3">
                <input type="checkbox" checked={aiEnrich} onChange={(e) => setAiEnrich(e.target.checked)} className="mt-0.5" />
                <span className="text-sm text-em-text">✨ Flesh out with AI <span className="block text-xs text-em-text-dim">Write a richer personality, backstory and opening line from your choices.</span></span>
              </label>
              <label className={'flex items-start gap-3 rounded-xl border border-white/10 p-3 ' + (settings.aiPhotos ? '' : 'opacity-50')}>
                <input type="checkbox" disabled={!settings.aiPhotos} checked={genAvatar && settings.aiPhotos} onChange={(e) => setGenAvatar(e.target.checked)} className="mt-0.5" />
                <span className="text-sm text-em-text">🖼 Generate an avatar <span className="block text-xs text-em-text-dim">{settings.aiPhotos ? 'Render a portrait from the looks you picked.' : 'Enable AI photos in Settings to use this.'}</span></span>
              </label>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-em-text-dim">
                <span className="text-em-text">Preview tags:</span> {buildAppearance()}
              </div>
              {error && <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{error}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            disabled={working}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-em-text-dim transition hover:bg-white/5 disabled:opacity-40"
          >{step === 0 ? 'Cancel' : '← Back'}</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} className="rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300">Next →</button>
          ) : (
            <button onClick={create} disabled={working} className="flex items-center gap-2 rounded-xl bg-em-accent px-5 py-2 font-semibold text-em-bg transition hover:bg-emerald-300 disabled:opacity-60">
              {working && <span className="h-4 w-4 animate-spin rounded-full border-2 border-em-bg border-t-transparent" />}
              {busy === 'enrich' ? 'Writing personality…' : busy === 'avatar' ? 'Rendering avatar…' : busy === 'save' ? 'Saving…' : 'Create character'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
