import { useEffect, useRef, useState } from 'react';
import { audioSrcFor, musicKey } from '../lib/music.js';

// Background-music controller for a character: an <audio> element, the saved
// per-character URL, play/pause/stop, live volume, and the "now dancing" flag.
// Fully self-contained — the chat container just consumes the returned handles.
export default function useMusic(char) {
  const [showMusic, setShowMusic] = useState(false);     // url/controls panel
  const [musicUrl, setMusicUrl] = useState('');
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [showDancer, setShowDancer] = useState(true);    // floating "now dancing" portrait
  const [musicVolume, setMusicVolume] = useState(() => {
    const v = parseFloat(localStorage.getItem('musicVolume'));
    return Number.isFinite(v) ? v : 0.5;
  });
  const audioRef = useRef(null);

  // Load the saved/character URL and stop any track from a prior character.
  useEffect(() => {
    let saved = '';
    try { saved = localStorage.getItem(musicKey(char.id)) || ''; } catch (e) { /* ignore */ }
    setMusicUrl(saved || char.musicUrl || '');
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.removeAttribute('src'); }
    setMusicPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char.id]);

  useEffect(() => () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; } }, []);

  // Apply volume changes live to the playing track and remember the choice.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicVolume;
    try { localStorage.setItem('musicVolume', String(musicVolume)); } catch (e) { /* ignore */ }
  }, [musicVolume]);

  function playMusic(url) {
    const u = String(url != null ? url : musicUrl).trim();
    if (!u) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.loop = true;
      a.addEventListener('ended', () => setMusicPlaying(false));
      a.addEventListener('error', () => setMusicPlaying(false));
      audioRef.current = a;
    }
    a.volume = musicVolume;
    a.src = audioSrcFor(u);
    a.play().then(() => { setMusicPlaying(true); setShowDancer(true); }).catch(() => setMusicPlaying(false));
    try { localStorage.setItem(musicKey(char.id), u); } catch (e) { /* ignore */ }
  }

  function toggleMusic() {
    const a = audioRef.current;
    if (!a || !a.src) { playMusic(); return; }
    if (a.paused) { a.play().then(() => setMusicPlaying(true)).catch(() => {}); }
    else { a.pause(); setMusicPlaying(false); }
  }

  function stopMusic() {
    const a = audioRef.current;
    if (a) { a.pause(); a.currentTime = 0; }
    setMusicPlaying(false);
  }

  return {
    showMusic, setShowMusic,
    musicUrl, setMusicUrl,
    musicPlaying,
    showDancer, setShowDancer,
    musicVolume, setMusicVolume,
    playMusic, toggleMusic, stopMusic,
  };
}
