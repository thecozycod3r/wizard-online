// Open any game with &debug in the link to see errors on screen (phones have no console to look at).
const on = /[?&]debug\b/.test(location.search);
const seen = [];
function show(msg) {
  if (!on) return;
  seen.push(String(msg).slice(0, 300));
  let el = document.getElementById("g4f-debug");
  if (!el) {
    el = document.createElement("pre"); el.id = "g4f-debug";
    el.style.cssText = "position:fixed;left:6px;right:6px;bottom:calc(env(safe-area-inset-bottom,0px) + 6px);z-index:9999;max-height:40vh;overflow:auto;margin:0;padding:8px 10px;background:#7a1010;color:#fff;font:12px/1.35 ui-monospace,monospace;white-space:pre-wrap;border-radius:8px;pointer-events:auto";
    document.body.append(el);
  }
  el.textContent = seen.slice(-6).join("\n\n");
}
addEventListener("error", e => show(`${e.message} @ ${(e.filename || "").split("/").slice(-2).join("/")}:${e.lineno}:${e.colno}`));
addEventListener("unhandledrejection", e => show("promise: " + (e.reason?.stack || e.reason)));
export const debugShow = show;
export const debugOn = on;
