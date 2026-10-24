// Rules sheet for Spyfall.
export const RULES = {
  basics: `<h3>The idea</h3><p>Everyone is at the same secret location — except one player, the <b>spy</b>, who doesn't know where they are. Tap your card to peek at it (and keep it hidden).</p>
    <h3>Asking questions</h3><p>The player with the 🎤 asks anyone a question out loud, by name — "Anya, how often do you come here?" — then taps who they asked. That player answers and asks the next question. You can't ask back the person who just asked you.</p>
    <p>Answers should prove you know the place without making it obvious to the spy. The spy listens, bluffs, and tries to work out the location.</p>
    <h3>Catching the spy</h3><p>Once per round, anyone can <b>stop the clock and accuse</b> someone. Everyone except the suspect votes; if <b>all</b> say yes, the suspect's card is turned over and the round ends. One "no" and the clock runs again.</p>
    <h3>The spy's move</h3><p>While the clock is running, the spy can reveal themselves and <b>guess the location</b>. Right, and the spy wins; wrong, and everyone else does.</p>`,
  cards: `<h3>When the clock runs out</h3><p>Players accuse in turn, starting with the dealer. Each accusation is voted on; the first unanimous vote ends the round. If nobody is convicted after everyone has accused, the spy wins.</p>
    <h3>Scoring</h3><ul><li><b>Spy wins</b> (nobody convicted): spy +2.</li><li><b>An innocent is convicted</b>: spy +4.</li><li><b>Spy guesses the location</b>: spy +4.</li>
    <li><b>Spy caught or guesses wrong</b>: every other player +1 — and whoever stopped the clock to make the winning accusation gets +2 instead.</li></ul>
    <p>After the last round, most points wins.</p>`,
  full: `<h3>Locations</h3><p>Thirty places, each with seven roles; every round uses a new one. Everyone can see the full list — tap one to cross it off as you rule it out.</p>
    <h3>Settings</h3><p>3, 5 or 8 rounds of 4, 6 or 8 minutes. First game? Try 8 minutes. The turn timer covers votes and accusations — if it runs out, the game votes or accuses for you.</p>
    <h3>Tips</h3><ul><li>Ask questions only someone who's really there could answer.</li><li>Don't name the place — the spy is listening.</li><li>Spies: answer vaguely but confidently, and accuse someone else first.</li></ul>`,
};
