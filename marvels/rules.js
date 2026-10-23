// Seven Marvels rules text: the 7 Wonders base-game rules (Repos Production, 2010) in our own words, with our names.
import { DATA } from "./data.js";

const R = DATA.resName;
const POWER = {
  anyRaw: "Produces one raw resource of your choice every turn (neighbours can't buy it).",
  anyGoods: "Produces one good of your choice every turn (neighbours can't buy it).",
  science: "A science symbol of your choice, picked for the best score at the end.",
  freeBuild: "Once per Age, build a structure for free.",
  tradeRaw: "Buy raw resources from both neighbours for 1 coin.",
  copyGuild: "At the end, copy one guild built by a neighbour (the best one is picked for you).",
  salvage: "At the end of the turn, build one card from the discard pile for free.",
  seventh: "Play the 7th card of each Age instead of discarding it.",
};
export const powerText = p => POWER[p] || "";
const costTxt = c => Object.entries(c).map(([k, n]) => `${n} ${R[k] || k}`).join(", ");
const stageTxt = s => [s.vp && `${s.vp} points`, s.coins && `${s.coins} coins`, s.shields && `${s.shields} shield${s.shields > 1 ? "s" : ""}`, s.power && POWER[s.power]].filter(Boolean).join(" · ");

export function setupTable(n) {
  const rows = [["Players", "3", "4", "5", "6", "7"], ["Cards per Age", "21", "28", "35", "42", "49"], ["Guilds in Age III", "5", "6", "7", "8", "9"]];
  const col = Math.max(1, Math.min(5, n - 2));
  return `<div class="tbl"><table>${rows.map((r, i) => `<tr>${r.map((c, j) => (i === 0 ? `<th${j === col ? ' style="color:var(--gold-2)"' : ""}>${c}</th>` : `<td${j === col ? ' style="color:var(--gold-2);font-weight:700"' : ""}>${c}</td>`)).join("")}</tr>`).join("")}</table></div>`;
}

const marvelList = () => DATA.marvels.map(m => `<h3>${m.city}: ${m.name}</h3><p class="muted">Starts with 1 ${R[m.res]}.</p>
  <p><b>Side A:</b> ${m.A.map((s, i) => `stage ${i + 1} (${costTxt(s.cost)}) → ${stageTxt(s)}`).join("; ")}.</p>
  <p><b>Side B:</b> ${m.B.map((s, i) => `stage ${i + 1} (${costTxt(s.cost)}) → ${stageTxt(s)}`).join("; ")}.</p>`).join("");

export const RULES = {
  basics: `
    <h3>Goal</h3><p>Lead one of seven ancient cities through three Ages. Gather resources, trade with your neighbours, raise armies, chase science and build your Marvel. After Age III, the most points wins.</p>
    <h3>Each turn, everyone plays at once</h3>
    <ol><li>Pick one card from your hand. Nobody sees what you picked until everyone has picked; you can change your mind until then.</li>
      <li>Use it in one of three ways: <b>build it</b> in your city, <b>tuck it under your Marvel</b> to build the next stage, or <b>sell it</b> for 3 coins.</li>
      <li>Pass the rest of your hand on: <b>left</b> in Ages I and III, <b>right</b> in Age II.</li></ol>
    <p>Each Age has 6 turns. You start each Age with 7 cards; the last card is thrown away.</p>
    <h3>Paying for things</h3><p>Buildings cost resources (and sometimes coins). Resources aren't used up: if your city produces Wood, it has Wood every turn. Missing something? <b>Buy it from a neighbour</b> for 2 coins each (1 with the right trading cards). The game works out the cheapest way and shows it before you confirm.</p>
    <p>Some buildings are <b>free</b> if you built the building named on them in an earlier Age (a chain, shown with ⛓).</p>
    <h3>Battles</h3><p>At the end of each Age, compare your shields with each neighbour. More: +1 / +3 / +5 points (Age I / II / III). Fewer: −1. Equal: nothing.</p>
    <h3>On screen</h3><p><b>Drag</b> a card up and drop it on Build, Marvel stage or Sell. Or <b>tap</b> a card to see every choice and its exact cost. Tap a player to see their city.</p>`,
  cards: `
    <h3>Card colours</h3><ul>
      <li><b style="color:#c99257">Brown</b>: raw resources (Wood, Stone, Clay, Ore). Neighbours can buy them from you.</li>
      <li><b style="color:#b8bec8">Grey</b>: goods (Glass, Cloth, Papyrus). Neighbours can buy them too.</li>
      <li><b style="color:#7aa2ff">Blue</b>: civic buildings, worth points.</li>
      <li><b style="color:#f0c45a">Yellow</b>: commerce: coins, cheaper trading, private resources, and in Age III points.</li>
      <li><b style="color:#ff8a7a">Red</b>: military: shields for the battles.</li>
      <li><b style="color:#7fd6a2">Green</b>: science: Compass, Gear or Tablet.</li>
      <li><b style="color:#c7a2f2">Purple</b>: guilds (Age III only): points for what you and your neighbours have built.</li></ul>
    <h3>Rules for building</h3><ul><li>You can never build two buildings with the same name.</li>
      <li>Coins you earn from trading arrive after the turn, so you can't spend them in the same turn.</li>
      <li>Neighbours can't refuse to sell, and selling doesn't stop them using that resource themselves.</li>
      <li>Resources from yellow cards and from Marvel stages are private: nobody can buy them.</li></ul>`,
  marvels: `<p>Each player gets a city with its Marvel. Stages are built left to right, with any card from your hand (the card is hidden and has no other effect). You don't have to finish your Marvel to win.</p>${marvelList()}`,
  scoring: `
    <h3>Final score</h3><ol>
      <li><b>Battles</b>: your victory and defeat tokens.</li>
      <li><b>Coins</b>: 1 point for every 3 coins.</li>
      <li><b>Marvel</b>: points from the stages you built.</li>
      <li><b>Civic</b>: points on your blue buildings.</li>
      <li><b>Science</b>: for each symbol, the count squared (1, 4, 9, 16…), plus 7 points for each set of Compass + Gear + Tablet.</li>
      <li><b>Commerce</b>: points from Age III yellow buildings.</li>
      <li><b>Guilds</b>: points from purple buildings.</li></ol>
    <p>Ties go to the player with more coins. A tie on coins stays a shared win.</p>
    <h3>Science example</h3><p>3 Compasses, 2 Gears and 1 Tablet: 9 + 4 + 1 = 14, plus one full set (7) = 21 points.</p>`,
  full: `
    <h3>Setup</h3><p>3–7 players. Each Age uses only the cards for your player count, so everyone gets exactly 7 cards. Age III adds players + 2 guilds, chosen at random. Everyone starts with 3 coins and a random city. The host picks Marvel side A (simpler), B, or random.</p><!--SETUP-->
    <h3>A turn</h3><p>Everyone picks a card at the same time and then all picks are revealed. With your card you either build it (paying its cost), build the next stage of your Marvel (paying the stage cost shown on your Marvel, not the card's), or sell it for 3 coins. If you can't afford anything, sell.</p>
    <h3>Trading</h3><p>You may buy any resource your left or right neighbour produces from their starting resource, brown cards or grey cards: 2 coins each to that neighbour, or 1 coin with East Gate Market (raw from the right), West Gate Market (raw from the left), Agora (goods from both) or the Sky Father's Throne B (raw from both). You can buy from both neighbours in one turn. Only coins you had at the start of the turn can be spent.</p>
    <h3>Chains</h3><p>Ages II and III have buildings that are free if you already own the building named on them (⛓). For example Bathhouse → Great Cistern, Shrine → Sanctuary → Hall of the Gods.</p>
    <h3>End of an Age</h3><p>After the 6th turn, the last card in each hand is discarded without coins. Then the battles: compare shields with each neighbour; win = +1 (Age I), +3 (Age II), +5 (Age III); lose = −1.</p>
    <h3>Special Marvel powers</h3><ul>
      <li><b>Royal Tomb</b>: at the end of the turn its stage is built, look through every discarded card and build one free (including cards discarded that very turn).</li>
      <li><b>Hanging Terraces B</b>: on the 6th turn, play your 7th card as well (build, stage or sell) instead of discarding it.</li>
      <li><b>Sky Father's Throne A</b>: once per Age, build one structure for free.</li>
      <li><b>Sky Father's Throne B</b>: cheap raw trading with both neighbours, and at the end copy the best guild one of your neighbours built.</li>
      <li><b>Great Beacon</b>: a private resource of your choice every turn.</li>
      <li><b>Science wildcards</b> (Hanging Terraces, Inventors' Guild): chosen at the end for the best score.</li></ul>
    <h3>Game end</h3><p>After the Age III battles, add up battles, coins (1 per 3), Marvel, civic, science, commerce and guilds. Most points wins; ties go to most coins.</p>
    <h3>Online play on Table Night</h3><ul><li>Picks are secret until everyone has picked. You can change your pick until then.</li>
      <li>The host sets a turn timer (30 s, 1 min or 2 min). If it runs out, the game picks a sensible card for you.</li>
      <li>If someone's connection drops, the game carries on and they can rejoin from any device with the same link.</li></ul>
    <p class="muted">Seven Marvels uses the rules of 7 Wonders (Antoine Bauza, Repos Production) with original names and art. The 2-player variant isn't included.</p>`,
};
