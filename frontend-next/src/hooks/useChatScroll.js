import { useEffect, useRef } from 'react';

// Keeps the message list pinned to the bottom while new content streams in,
// unless the user has scrolled up. `stick()` re-arms auto-scroll (e.g. on send).
export default function useChatScroll() {
  const scrollRef = useRef(null);
  const autoScroll = useRef(true);

  useEffect(() => {
    if (autoScroll.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  });

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    autoScroll.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  function stick() { autoScroll.current = true; }

  return { scrollRef, onScroll, stick };
}
