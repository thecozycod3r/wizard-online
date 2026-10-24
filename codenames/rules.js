// Rules sheet for Codenames.
export const RULES = {
  basics: `<h3>Teams</h3><p>Split into <b>Red</b> and <b>Blue</b>. Each team has one <b>spymaster</b> 🕶️ — the only one who sees the secret key — and one or more <b>operatives</b> 🔎. Pick teams on the first screen, then anyone taps Start.</p>
    <h3>The board</h3><p>25 words. The team that goes first has <b>9</b> agents to find, the other <b>8</b>. There are also <b>7 bystanders</b> and <b>1 assassin</b>.</p>
    <h3>Your team's turn</h3><p>The spymaster types <b>one word and a number</b> — "TREE · 2" means two of your words relate to trees. Operatives talk it over, tap a word to mark it (your team sees the marks), then confirm the guess.</p>
    <ul><li>Your colour: keep guessing — up to the number <b>plus one</b>.</li><li>Bystander or the other team's word: your turn ends.</li><li>The <b>assassin</b>: your team loses on the spot.</li></ul>
    <p>You must guess at least once; after that you can end your turn whenever you like.</p>
    <h3>Winning</h3><p>Find all your agents first — even if the other team turns over your last one for you.</p>`,
  cards: `<h3>Good clues</h3><ul><li>Exactly one word — no spaces. It can't be a word that's still uncovered on the board, or part of one.</li>
    <li>Spymasters, no hints by face, voice or pointing. Just the word and the number.</li>
    <li><b>0 / ∞</b> means "as many guesses as you like" — handy for mopping up old clues.</li></ul>
    <h3>Spymaster view</h3><p>Spymasters see every word tinted by its colour; the assassin is outlined in black. Operatives only see colours as words are revealed.</p>`,
  full: `<h3>Timers</h3><p>The lobby timer (1–3 minutes) covers each clue and each team's guessing. If a spymaster runs out of time, a blank clue for 1 is given. If the guessers run out of time, the turn passes to the other team.</p>
    <h3>Players</h3><p>4 to 12. With an odd number one team is bigger — that's fine. Anyone can switch team or become spymaster before the start.</p>
    <h3>Play again</h3><p>At the end the host can deal a fresh board with the same group, or move everyone to another game.</p>`,
};
