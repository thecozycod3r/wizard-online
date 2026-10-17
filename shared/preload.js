// Fetch the rest of a game's art in the background so cards never appear blank, without getting in the way:
// waits until the pictures already on screen have loaded, then fetches two at a time, in the order given.
// Skipped when the phone asks to save data or is on a weak connection.
export function preload(urls) {
  const conn = navigator.connection;
  if (conn?.saveData || /2g|3g/.test(conn?.effectiveType || "")) return;   // data saver / weak signal: load pictures only as they show up
  const queue = [...new Set(urls)];
  let started = false;
  const onScreenDone = () => [...document.images].every(i => !i.src || i.complete);
  function go() {
    if (started) return; started = true;
    const next = () => {
      const u = queue.shift(); if (!u) return;
      const im = new Image();
      im.onload = im.onerror = () => setTimeout(next, 0);
      im.src = u;
    };
    next(); next();
  }
  const t0 = Date.now();
  (function wait() {
    if (document.readyState === "complete" && (onScreenDone() || Date.now() - t0 > 12000)) setTimeout(go, 400);
    else setTimeout(wait, 500);
  })();
  return { first: list => { for (const u of [...list].reverse()) { const i = queue.indexOf(u); if (i > 0) queue.splice(i, 1); if (i !== 0) queue.unshift(u); } } };
}
