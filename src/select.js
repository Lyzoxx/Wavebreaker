/**
 * select.js — menu de sélection de personnage
 * Lit CHARACTERS et crée les cartes cliquables.
 */

import { CHARACTERS } from "./characters.js";

const list = document.getElementById("character-list");
if (!list) throw new Error("#character-list introuvable");

for (const character of CHARACTERS) {
  const card = document.createElement(character.available ? "a" : "div");
  card.className = "character-card" + (character.available ? "" : " character-card--locked");

  if (character.available) {
    // Passe l'id dans l'URL → game.html?character=fox
    card.href = `game.html?character=${encodeURIComponent(character.id)}`;
  }

  card.innerHTML = `
    <div class="character-card__preview">
      <img src="${character.previewSrc}" alt="${character.name}" width="64" height="64" />
    </div>
    <h2 class="character-card__name">${character.name}</h2>
    <p class="character-card__desc">${character.description}</p>
    ${character.available ? "" : '<span class="character-card__badge">Bientôt</span>'}
  `;

  list.appendChild(card);
}
