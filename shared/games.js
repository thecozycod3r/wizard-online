// Every Table Night game: folder, room-code letter, player range, rough length and type tags.
// Used by the home page (filters, "Join a game" by code) and by "Play again, same group".
export const GAMES = [
  { path: "wizard", letter: "W", name: "Wizard", min: 3, max: 8, mins: 45, tags: ["cards", "tricks"] },
  { path: "lodestone", letter: "S", name: "Splendor", min: 2, max: 6, mins: 30, tags: ["cards", "strategy"] },
  { path: "marvels", letter: "M", name: "Seven Marvels", min: 3, max: 7, mins: 30, tags: ["cards", "strategy"] },
  { path: "avalon", letter: "A", name: "Avalon", min: 5, max: 10, mins: 30, tags: ["party", "roles"] },
  { path: "incan", letter: "I", name: "Incan Gold", min: 3, max: 8, mins: 25, tags: ["party", "luck"] },
  { path: "unoflip", letter: "F", name: "UNO Flip", min: 2, max: 10, mins: 20, tags: ["cards", "party", "quick"] },
  { path: "nomercy", letter: "N", name: "UNO No Mercy", min: 2, max: 6, mins: 25, tags: ["cards", "party"] },
  { path: "skullking", letter: "K", name: "Skull King", min: 2, max: 8, mins: 40, tags: ["cards", "tricks"] },
  { path: "nimmt", letter: "6", name: "6 Nimmt!", min: 2, max: 10, mins: 20, tags: ["cards", "party", "quick"] },
  { path: "coup", letter: "U", name: "Coup", min: 2, max: 10, mins: 15, tags: ["cards", "party", "bluff", "quick"] },
  { path: "spyfall", letter: "Y", name: "Spyfall", min: 3, max: 10, mins: 15, tags: ["party", "roles", "bluff", "quick"] },
  { path: "catan", letter: "T", name: "Catan", min: 2, max: 6, mins: 60, tags: ["strategy"] },
  { path: "codenames", letter: "D", name: "Codenames", min: 4, max: 12, mins: 20, tags: ["party", "words", "teams"] },
  { path: "kingscup", letter: "C", name: "Kings Cup", min: 3, max: 12, mins: 30, tags: ["drinking", "party"] },
  { path: "ridebus", letter: "R", name: "Ride the Bus", min: 2, max: 10, mins: 20, tags: ["drinking", "party", "quick"] },
];
export const TAGS = { cards: "Card games", party: "Party", tricks: "Trick-taking", strategy: "Strategy", roles: "Hidden roles", luck: "Push your luck", bluff: "Bluffing", words: "Word games", teams: "Teams", quick: "Quick (≤20 min)", drinking: "Drinking 18+" };
// a typed code (or a pasted link) → the game it belongs to
export function gameForCode(input) {
  const raw = String(input || "").trim();
  const m = raw.match(/[?&]g=([A-Za-z0-9]+)/);
  if (m) { const path = raw.match(/\/([a-z]+)\/?\?/)?.[1]; return path && { game: GAMES.find(g => g.path === path) || null, code: m[1] }; }
  const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 4) return null;
  return { game: GAMES.find(g => g.letter === code[0]) || null, code };
}
