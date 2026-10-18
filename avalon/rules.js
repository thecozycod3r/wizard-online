// Rules shown in the game's Rules sheet. Source: The Resistance: Avalon rulebook (Don Eskridge, Indie Boards & Cards).
import { EVIL_COUNT, QUEST_SIZES } from "./engine.js";

export function setupTable(n) {
  const cols = [5, 6, 7, 8, 9, 10];
  const cell = (c, v) => `<td${c === n ? ' style="background:rgba(227,194,117,.18);font-weight:800"' : ""}>${v}</td>`;
  return `<div class="tbl"><table><tr><th>Players</th>${cols.map(c => `<th${c === n ? ' style="color:#fff"' : ""}>${c}</th>`).join("")}</tr>
    <tr><td>Good</td>${cols.map(c => cell(c, c - EVIL_COUNT[c])).join("")}</tr>
    <tr><td>Evil</td>${cols.map(c => cell(c, EVIL_COUNT[c])).join("")}</tr>
    ${[0, 1, 2, 3, 4].map(q => `<tr><td>Quest ${q + 1}</td>${cols.map(c => cell(c, QUEST_SIZES[c][q] + (q === 3 && c >= 7 ? "★" : ""))).join("")}</tr>`).join("")}
    </table></div><p class="muted" style="font-size:14px">★ This quest only fails if two Fail cards are played.</p>`;
}

export const RULES = {
  basics: `<h3>The idea</h3>
    <p>Everyone is secretly <b>Good</b> (loyal to Arthur) or <b>Evil</b> (serving Mordred). Good wins by completing three quests. Evil wins by failing three quests — or, at the end, by unmasking Merlin.</p>
    <h3>Each round</h3>
    <ol><li><b>The leader picks a team</b> of the size the quest needs (they can pick themselves). Talk it over — out loud, on a call, in the chat.</li>
    <li><b>Everyone votes</b> Approve or Reject at the same time. Votes are shown to all. More than half must approve; a tie is a rejection.</li>
    <li>If rejected, the next player becomes leader and tries again. <b>Five rejected teams in one round and Evil wins.</b></li>
    <li>If approved, <b>the team goes on the quest</b>: each member secretly plays Success or Fail. Good can only play Success. Evil may play either.</li>
    <li>One Fail and the quest fails (quest 4 with 7+ players needs two). Nobody learns who played what — only how many Fails.</li></ol>
    <h3>The end</h3>
    <p>Three failed quests: Evil wins. Three successful quests: the Assassin gets one guess at who Merlin is. Right — Evil wins. Wrong — Good wins.</p>
    <h3>On this site</h3>
    <p>Your phone shows your secret role and what you know — tap <b>Your role</b> any time, and hide it when you're done. Never show your screen or reveal your card; you may say anything you like, true or false.</p>`,
  roles: `<h3>Always in the game</h3>
    <p><b>Merlin</b> (Good) — knows who is Evil (except Mordred). Must guide Good with hints, without being obvious: if Evil spots Merlin at the end, Evil wins.</p>
    <p><b>The Assassin</b> (Evil) — knows the other Evil players. If Good completes three quests, names one player as Merlin.</p>
    <p><b>Loyal Servants of Arthur</b> (Good) — know nothing. Watch the votes and the quests.</p>
    <p><b>Minions of Mordred</b> (Evil) — know the other Evil players.</p>
    <h3>Optional characters (the host turns them on)</h3>
    <p><b>Percival</b> (Good) — sees Merlin… and Morgana, without knowing which is which. Helps protect Merlin. With 5 players, add Morgana or Mordred too.</p>
    <p><b>Morgana</b> (Evil) — appears as Merlin to Percival.</p>
    <p><b>Mordred</b> (Evil) — hidden from Merlin.</p>
    <p><b>Oberon</b> (Evil) — doesn't know the other Evil players, and they don't know him. Merlin does see him.</p>
    <h3>Lady of the Lake (optional, best with 7+)</h3>
    <p>Starts with the player to the first leader's right. After quests 2, 3 and 4 its holder secretly learns one player's loyalty (Good or Evil — not the character), then hands the Lady to that player. Someone who held the Lady can't be checked. What you learn you may share — or lie about.</p>`,
  full: `<h3>Setup</h3>
    <p>Roles are dealt at random. Merlin and the Assassin are always in; the host can add Percival, Morgana, Mordred, Oberon and the Lady of the Lake. Every other Good player is a Loyal Servant, every other Evil player a Minion. A random player is the first leader.</p>
    <!--SETUP-->
    <h3>What you know at the start</h3>
    <ul><li>Evil players (except Oberon) see each other — but not Oberon.</li><li>Merlin sees every Evil player except Mordred.</li><li>Percival sees Merlin and Morgana, not knowing which is which.</li><li>Everyone else knows only their own side.</li></ul>
    <h3>Team building</h3>
    <p>The leader chooses exactly the number of players the quest needs; they may include themselves. All players vote at once. More than half approving sends the team on the quest. A tie or less is a rejection, and leadership passes to the left (the next player in the list). After the fifth rejected team in the same round, Evil wins immediately. Leadership also passes after every approved team.</p>
    <h3>Quests</h3>
    <p>Each team member secretly plays Success or Fail. Good players must play Success. The cards are shuffled before they're shown, so only the number of Fails is known. Any Fail fails the quest — except the 4th quest with 7 or more players, which needs two.</p>
    <h3>Winning</h3>
    <p>Three failed quests: Evil wins. Three successful quests: the Evil players talk it over and the Assassin names one player as Merlin. If that's Merlin, Evil wins; otherwise Good wins.</p>
    <h3>Talking</h3>
    <p>You can say anything at any time — claims, accusations, bluffs. You can't show your role or your screen.</p>
    <h3>Turn timer</h3>
    <p>The host sets a timer. If it runs out, the game makes a sensible move for whoever hasn't acted, so a game never stalls.</p>
    <p class="muted" style="font-size:14px">The Resistance: Avalon is designed by Don Eskridge and published by Indie Boards & Cards. Art on this site is original.</p>`,
};
