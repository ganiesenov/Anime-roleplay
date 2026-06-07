import { useEffect, useRef, useState } from 'react';

// Keeps the message list pinned to the bottom while new content streams in,
// unless the user has scrolled up. `stick()` re-arms auto-scroll (e.g. on send).
// `atBottom` drives a "scroll to latest" button; `scrollToBottom()` jumps down.
export default function useChatScroll() {
  const scrollRef = useRef(null);
  const autoScroll = useRef(true);
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    if (autoScroll.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    autoScroll.current = bottom;
    setAtBottom(bottom);
  }

  function stick() { autoScroll.current = true; setAtBottom(true); }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    autoScroll.current = true;
    setAtBottom(true);
  }

  return { scrollRef, onScroll, stick, atBottom, scrollToBottom };
}
