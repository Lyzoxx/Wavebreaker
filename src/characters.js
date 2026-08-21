/**
 * characters.js — registre des personnages jouables
 *
 * COMMENT AJOUTER UN NOUVEAU PERSONNAGE PLUS TARD :
 *   1. Ajoute ses sprites dans assets/characters/<id>/
 *   2. Ajoute une entrée dans CHARACTERS ci-dessous
 *   3. Crée un loader (comme createFoxPlayer) si besoin
 *   4. La page select.html affichera automatiquement la carte
 */

/** @typedef {"fox"} CharacterId — étendre l'union quand tu ajoutes des persos */

/**
 * @typedef {object} CharacterDef
 * @property {CharacterId} id
 * @property {string} name - nom affiché
 * @property {string} description
 * @property {string} previewSrc - image pour le menu de sélection
 * @property {string} background - id du décor ("forest", …)
 * @property {boolean} available - false = grisé / "bientôt"
 */

/** Liste des personnages. Ajoute simplement un objet ici pour en afficher un nouveau. */
export const CHARACTERS = [
  {
    id: "fox",
    name: "Fox",
    description: "Renard magicien — bâton et boules de feu.",
    previewSrc: "assets/characters/fox/idle/fox_idle.png",
    background: "forest",
    available: true,
  },
  // Exemple pour plus tard (laisse en commentaire jusqu'à ce que tu sois prêt) :
  // {
  //   id: "wolf",
  //   name: "Wolf",
  //   description: "À venir…",
  //   previewSrc: "assets/characters/wolf/idle/wolf_idle.png",
  //   background: "mountain",
  //   available: false,
  // },
];

/**
 * @param {string} id
 * @returns {CharacterDef | undefined}
 */
export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id);
}
