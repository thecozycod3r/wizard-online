// Generated from data/deck.json (rule text = official rulebook pp. 8-10, condensed).
export const SPECIAL_CARDS = [
 {
  "id": "sp-shapeshifter",
  "name": "Shapeshifter",
  "value": "W/J",
  "rule": "When played, declare Wizard or Jester; it is exactly that card. Revealed as trump: dealer picks trump."
 },
 {
  "id": "sp-dragon",
  "name": "Dragon",
  "value": "∞",
  "rule": "Highest card in the game; beats every Wizard. Loses only if the Fairy is in the same trick. Leads like a Wizard. Revealed as trump: dealer picks trump."
 },
 {
  "id": "sp-fairy",
  "name": "Fairy",
  "value": "0",
  "rule": "Lower than a Jester — but if the Dragon is in the same trick, the Fairy wins it. Leads like a Jester. Revealed as trump: no trump."
 },
 {
  "id": "sp-bomb",
  "name": "Bomb",
  "value": "✶",
  "rule": "Nobody wins this trick; set it aside, it counts for no one. Whoever would have won leads next. Leads like a Jester. Revealed as trump: no trump."
 },
 {
  "id": "sp-werewolf",
  "name": "Werewolf",
  "value": "⇄",
  "rule": "Before bidding, swap it with the face-up trump card, then choose a trump suit or 'no trump'. Revealed as trump: dealer picks trump."
 },
 {
  "id": "sp-juggler",
  "name": "Juggler",
  "value": "7½",
  "rule": "Value 7½ in a suit you name (trump allowed). After the trick, everyone passes one card face-down to the left. Not in the last trick. Revealed as trump: dealer picks trump."
 },
 {
  "id": "sp-cloud",
  "name": "Cloud",
  "value": "9¾",
  "rule": "Value 9¾ in a suit you name (trump allowed). Whoever wins this trick must change their bid by +1 or −1. No change if the Bomb is also in the trick. Revealed as trump: dealer picks trump."
 },
 {
  "id": "sp-witch",
  "name": "Witch",
  "value": "−∞",
  "rule": "Lower than Jester and Fairy. After all effects resolve and the winner is set, put one hand card into the trick and take any other card (not a Witch) from it. Leads like a Jester. Revealed as trump: no trump."
 },
 {
  "id": "sp-vampire",
  "name": "Vampire",
  "value": "⧉",
  "rule": "Copies the trump-indicator card and all its effects. If that is the Werewolf, reveal a new trump card now and copy it. Leads per the copied card. Revealed as trump: dealer picks trump."
 }
];
