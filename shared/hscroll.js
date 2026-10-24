// Side-scrolling rows on phones: keep their position across re-renders and
// hold re-renders while a finger is swiping (or the row is still gliding),
// so a state update never yanks the row back or kills the swipe.
// Vertical scroll boxes (lobby page, table, side panels) also keep their position and hold re-renders while they move:
// every screen is one innerHTML swap, so without this a lobby update snaps the page back to the top mid-scroll.
const VSEL = ".page,.scroll,.opps,.side,.dock";
// a .page only gets its scroll back if it is the same screen (same first heading), so landing → lobby still starts at the top
const sig = el => (el.matches(".page") ? (el.querySelector("h1,h2,.eyebrow")?.textContent || "").slice(0, 40) : "");
export function hscroll(sel) {
  let touching = false, until = 0, lift = 0, touchAt = 0, vuntil = 0;
  addEventListener("touchstart", e => { if (e.target.closest?.(sel)) { touching = true; touchAt = Date.now(); } }, { capture: true, passive: true });
  addEventListener("touchmove", () => { if (touching) touchAt = Date.now(); }, { capture: true, passive: true });
  const up = () => { if (touching) lift = Date.now(); touching = false; };
  addEventListener("touchend", up, { capture: true, passive: true });
  addEventListener("touchcancel", up, { capture: true, passive: true });
  document.addEventListener("scroll", e => {
    if ((touching || Date.now() - lift < 1500) && e.target.matches?.(sel)) until = Date.now() + 220;
    if (e.target.matches?.(VSEL)) vuntil = Date.now() + 250;   // wheel, trackpad glide or finger fling still moving
  }, { capture: true, passive: true });
  const key = (el, i) => (el.className.split(" ")[0] || el.tagName) + ":" + i;
  return {
    // a finger resting still for 3 s, or a lost touchend (iOS drops it when the touched element is redrawn), stops holding
    busy: () => (touching && Date.now() - touchAt < 3000) || Date.now() < until || Date.now() < vuntil,
    save() {
      const m = {}, n = {};
      for (const el of document.querySelectorAll(sel)) { const c = el.className.split(" ")[0]; n[c] = (n[c] || 0) + 1; if (el.scrollLeft) m[key(el, n[c])] = el.scrollLeft; }
      const v = {}, k = {};
      for (const el of document.querySelectorAll(VSEL)) { const c = el.className.split(" ")[0]; k[c] = (k[c] || 0) + 1; if (el.scrollTop) v[key(el, k[c])] = [el.scrollTop, sig(el)]; }
      m.__v = v;
      return m;
    },
    restore(m) {
      const n = {};
      for (const el of document.querySelectorAll(sel)) { const c = el.className.split(" ")[0]; n[c] = (n[c] || 0) + 1; const v = m[key(el, n[c])]; if (v) el.scrollLeft = v; }
      const k = {};
      for (const el of document.querySelectorAll(VSEL)) { const c = el.className.split(" ")[0]; k[c] = (k[c] || 0) + 1; const v = m.__v?.[key(el, k[c])]; if (v && v[1] === sig(el)) el.scrollTop = v[0]; }
    },
  };
}
