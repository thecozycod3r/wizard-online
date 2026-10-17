// Side-scrolling rows on phones: keep their position across re-renders and
// hold re-renders while a finger is swiping (or the row is still gliding),
// so a state update never yanks the row back or kills the swipe.
export function hscroll(sel) {
  let touching = false, until = 0, lift = 0;
  addEventListener("touchstart", e => { if (e.target.closest?.(sel)) touching = true; }, { capture: true, passive: true });
  const up = () => { if (touching) lift = Date.now(); touching = false; };
  addEventListener("touchend", up, { capture: true, passive: true });
  addEventListener("touchcancel", up, { capture: true, passive: true });
  document.addEventListener("scroll", e => { if ((touching || Date.now() - lift < 1500) && e.target.matches?.(sel)) until = Date.now() + 220; }, { capture: true, passive: true });
  const key = (el, i) => (el.className.split(" ")[0] || el.tagName) + ":" + i;
  return {
    busy: () => touching || Date.now() < until,
    save() {
      const m = {}, n = {};
      for (const el of document.querySelectorAll(sel)) { const c = el.className.split(" ")[0]; n[c] = (n[c] || 0) + 1; if (el.scrollLeft) m[key(el, n[c])] = el.scrollLeft; }
      return m;
    },
    restore(m) {
      const n = {};
      for (const el of document.querySelectorAll(sel)) { const c = el.className.split(" ")[0]; n[c] = (n[c] || 0) + 1; const v = m[key(el, n[c])]; if (v) el.scrollLeft = v; }
    },
  };
}
