// "Your turn" alerts for every game: a short buzz on phones that can (Android). The games make no sound at all —
// alerts.on stays false so anything that asks (Catan's table sounds) stays quiet, and there is no sound switch.
export const alerts = {
  yourTurn() { navigator.vibrate?.([18, 40, 18]); },
  hurry() { navigator.vibrate?.(60); },
  get on() { return false; },
  toggle() { return false; },
};
export const soundRow = () => "";

// Links opened inside Instagram / Facebook / TikTok etc. run in that app's own browser, which forgets the game when
// it closes. Nudge people to open the game in their real browser so they can get back in later.
const UA = navigator.userAgent;
export const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Line\/|Snapchat|musical_ly|TikTok|Twitter|LinkedInApp|Pinterest/.test(UA) || (/Android/.test(UA) && /; wv\)/.test(UA));
export const inAppHint = () => inApp
  ? `<div class="iabhint" role="note">Opened inside another app? Tap <b>⋯</b> and choose <b>Open in ${/iPhone|iPad|iPod/.test(UA) ? "Safari" : "Chrome"}</b> so you can always get back into this game.</div>`
  : "";
