// Rules sheet for Bluff (a.k.a. Cheat / I Doubt It) — the "starter names the rank, everyone follows" house version.
import { decksFor, dealSizes, MAX_PLAY, MAX_DECKS } from "./engine.js";

export const RULES = (s = {}, n = 4) => {
  const d = decksFor(s, n || 4), { base, extra } = dealSizes(d, n || 4);
  return {
    basics: `<h3>The idea</h3><p>Get rid of every card in your hand. Cards go down face down, so you can lie about what they are — and anyone caught lying picks up the whole pile.</p>
    <h3>Dealing</h3><p>${d === 1 ? "One 52-card deck is" : `${d} decks (${52 * d} cards) are`} dealt out completely: ${n || 4} players get ${base} card${base === 1 ? "" : "s"} each${extra ? `, and ${extra} of them get one more` : ""}. The host can pick 1 to ${MAX_DECKS} decks in the lobby (Auto uses 1 deck up to six players, 2 beyond).</p>
    <h3>A round</h3><ol><li>The starter <b>names a rank</b> (say, Sevens) and lays 1 to ${MAX_PLAY} cards face down, claiming they're all that rank.</li>
      <li>Going round the table, on your turn you do <b>one</b> of these:<ul>
        <li><b>Bluff!</b> — call the last play. Its cards are turned over.</li>
        <li><b>Play</b> 1 to ${MAX_PLAY} cards face down, claiming the same rank (true or not).</li>
        <li><b>Pass.</b></li></ul></li>
      <li>If everyone else passes after a play, the pile is cleared away (out of the game) and whoever played last starts a new round with any rank.</li></ol>
    <h3>Calling Bluff</h3><p>If any card in the last play isn't the claimed rank, the player who played it <b>picks up the whole pile</b> and the caller starts the next round. If every card was true, the <b>caller</b> picks up the pile and the player who played starts the next round.</p>
    <h3>Winning</h3><p>Play your last cards and survive: once the next player plays or passes instead of calling, you're out and you win. If they call and you lied, you pick up the pile and play on. Everyone else is ranked by the cards left in hand.</p>`,
    cards: `<h3>Ranks</h3><p>Ace, 2–10, Jack, Queen, King. Suits don't matter. With ${d === 1 ? "one deck there are 4" : `${d} decks there are ${4 * d}`} of each rank, so if more than that have been claimed this round, someone is lying.</p>
    <h3>Reading the table</h3><p>You always see how many cards each player holds, how big the pile is, the rank being claimed and how many cards each player has put down this round.</p>`,
    full: `<h3>Only the next player can call</h3><p>Bluff is called on your own turn, on the play just before yours.</p>
    <h3>Turn timer</h3><p>If time runs out, the game plays for you honestly: it starts with your biggest set, follows with matching cards if you have them, and otherwise passes. It never calls Bluff for you.</p>
    <h3>Leaving</h3><p>If someone leaves mid-game, a bot takes their seat. It calls when a claim can't add up or someone is about to go out, and bluffs now and then.</p>`,
  };
};
