/**
 * game.js — boucle principale, canvas, décor selon le personnage
 *
 * Pour l’instant : pas de déplacement ni d’attaque.
 * Les systèmes player/combat restent prêts pour plus tard.
 */

import { createFoxPlayer } from "./player.js";
import { getCharacter } from "./characters.js";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #game-canvas introuvable dans game.html");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Impossible d'obtenir le contexte 2D");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

/** Lit ?character=fox depuis l'URL */
function readSelectedCharacterId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("character") || "fox";
}

/**
 * Hauteur du sol (ligne d'herbe), remontée volontairement.
 * 0 = haut de l'écran, 1 = bas. Plus petit = herbe plus haute.
 */
const GROUND_Y_RATIO = 0.46;

/** Y pixel du dessus de l'herbe */
function groundY(h) {
  return h * GROUND_Y_RATIO;
}

/**
 * Fox à gauche, pieds posés sur l'herbe.
 * Le sprite est dessiné centré → on remonte d'une demi-hauteur.
 * @param {HTMLCanvasElement} c
 * @param {number} [spriteHalfH=64] - demi-hauteur affichée (64px * scale 2 / 2)
 */
function startPosition(c, spriteHalfH = 64) {
  return {
    x: c.width * 0.2,
    y: groundY(c.height) - spriteHalfH + 8,
  };
}

/** Décor forêt sombre / brume teal, inspiré des ruines moussues. */
function drawForestBackground(c, w, h) {
  const gy = groundY(h);

  // Brume teal profonde
  const fog = c.createLinearGradient(0, 0, 0, h);
  fog.addColorStop(0, "#0a2a32");
  fog.addColorStop(0.35, "#0f3d45");
  fog.addColorStop(0.7, "#145055");
  fog.addColorStop(1, "#0c3038");
  c.fillStyle = fog;
  c.fillRect(0, 0, w, h);

  // Voile de profondeur (brouillard)
  c.fillStyle = "rgba(20, 70, 78, 0.35)";
  c.fillRect(0, 0, w, gy);

  // Arbres lointains dans la brume
  drawRuinsTree(c, w * 0.12, gy - 10, 0.7, true);
  drawRuinsTree(c, w * 0.78, gy - 6, 0.85, true);
  drawRuinsTree(c, w * 0.92, gy - 14, 0.6, true);

  // Mur de ruines moussu (milieu-droit)
  drawMossyWall(c, w * 0.52, gy, 160, 150);
  drawMossyWall(c, w * 0.62, gy, 110, 210);

  // Statue capuchonnée au milieu
  drawHoodedStatue(c, w * 0.44, gy);

  // Arbre stylisé (tronc rougeâtre + feuillage en blocs)
  drawRuinsTree(c, w * 0.85, gy, 1.15, false);

  // Sol : terre rocheuse + herbe sombre (remontée)
  c.fillStyle = "#2a3530";
  c.fillRect(0, gy, w, h - gy);

  // Bandes d'herbe plus claires / plus foncées
  c.fillStyle = "#1f4a28";
  c.fillRect(0, gy, w, 28);
  c.fillStyle = "#265832";
  for (let i = 0; i < w; i += 28) {
    c.fillRect(i, gy + 6, 16, 14);
  }
  c.fillStyle = "#173d22";
  c.fillRect(0, gy + 26, w, h - gy - 26);

  // Touches de mousse au sol
  c.fillStyle = "#2d6b38";
  for (let i = 0; i < 12; i++) {
    const mx = (i * 97) % w;
    const my = gy + 40 + (i % 4) * 22;
    c.beginPath();
    c.ellipse(mx, my, 36, 10, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Légère brume basse au-dessus de l'herbe
  const groundFog = c.createLinearGradient(0, gy - 40, 0, gy + 20);
  groundFog.addColorStop(0, "rgba(40, 90, 95, 0)");
  groundFog.addColorStop(1, "rgba(40, 90, 95, 0.25)");
  c.fillStyle = groundFog;
  c.fillRect(0, gy - 40, w, 60);
}

/** Mur de pierre grise avec plaques de mousse. */
function drawMossyWall(c, x, gy, width, height) {
  const top = gy - height;
  c.fillStyle = "#6a7370";
  c.fillRect(x, top, width, height);

  // Joints de briques
  c.strokeStyle = "rgba(40, 45, 44, 0.45)";
  c.lineWidth = 2;
  const brickH = 18;
  const brickW = 36;
  for (let row = 0; row < Math.ceil(height / brickH); row++) {
    const y = top + row * brickH;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + width, y);
    c.stroke();
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < Math.ceil(width / brickW) + 1; col++) {
      const bx = x + offset + col * brickW;
      c.beginPath();
      c.moveTo(bx, y);
      c.lineTo(bx, y + brickH);
      c.stroke();
    }
  }

  // Mousse / lierre
  c.fillStyle = "#2a8a3a";
  c.fillRect(x + 8, top + 20, 40, 55);
  c.fillRect(x + width - 50, top + 50, 38, 70);
  c.fillStyle = "#1f6b2c";
  c.fillRect(x + 18, top + 70, 55, 40);
  c.fillRect(x + 4, gy - 35, width * 0.7, 20);
}

/** Petite statue capuchonnée sur un socle. */
function drawHoodedStatue(c, x, gy) {
  c.fillStyle = "#5a6260";
  c.fillRect(x - 18, gy - 14, 36, 14);
  c.fillRect(x - 12, gy - 52, 24, 40);
  // Capuche
  c.beginPath();
  c.arc(x, gy - 58, 14, Math.PI, 0);
  c.fill();
  c.fillStyle = "#3e4543";
  c.fillRect(x - 6, gy - 48, 12, 10);
}

/**
 * Arbre ruines : tronc rougeâtre, feuillage en blocs flottants.
 * @param {boolean} distant - plus pâle / dans la brume
 */
function drawRuinsTree(c, x, gy, scale, distant) {
  const trunkW = 16 * scale;
  const trunkH = 95 * scale;
  c.fillStyle = distant ? "#4a3538" : "#6b3a32";
  c.fillRect(x - trunkW / 2, gy - trunkH, trunkW, trunkH);

  const leaf = distant ? "#1a4a3a" : "#1e5c32";
  const leafHi = distant ? "#246048" : "#2a7a40";
  const sizes = [
    { dx: 0, dy: -trunkH - 10 * scale, s: 28 * scale },
    { dx: -22 * scale, dy: -trunkH + 18 * scale, s: 20 * scale },
    { dx: 24 * scale, dy: -trunkH + 12 * scale, s: 22 * scale },
    { dx: -8 * scale, dy: -trunkH + 40 * scale, s: 16 * scale },
    { dx: 14 * scale, dy: -trunkH + 48 * scale, s: 14 * scale },
  ];
  for (let i = 0; i < sizes.length; i++) {
    const L = sizes[i];
    c.fillStyle = i % 2 === 0 ? leaf : leafHi;
    // Blocs anguleux (style low-poly / PS1)
    c.beginPath();
    c.moveTo(x + L.dx, gy + L.dy - L.s);
    c.lineTo(x + L.dx + L.s, gy + L.dy);
    c.lineTo(x + L.dx, gy + L.dy + L.s * 0.55);
    c.lineTo(x + L.dx - L.s, gy + L.dy);
    c.closePath();
    c.fill();
  }
}

function drawBackground(c, backgroundId) {
  if (backgroundId === "forest") {
    drawForestBackground(c, canvas.width, canvas.height);
    return;
  }
  // Décor par défaut (si un futur perso n'a pas encore de thème)
  const g = c.createLinearGradient(0, 0, 0, canvas.height);
  g.addColorStop(0, "#1a4a6e");
  g.addColorStop(1, "#0a1628");
  c.fillStyle = g;
  c.fillRect(0, 0, canvas.width, canvas.height);
}

/**
 * Charge le bon personnage selon l'id.
 * Ajoute un `case` ici quand tu créeras d'autres persos.
 */
async function createPlayerFor(characterId, x, y) {
  switch (characterId) {
    case "fox":
      return createFoxPlayer(x, y);
    default:
      throw new Error(`Personnage inconnu: ${characterId}`);
  }
}

async function main() {
  const status = document.getElementById("load-status");
  const characterId = readSelectedCharacterId();
  const def = getCharacter(characterId);

  if (!def || !def.available) {
    if (status) status.textContent = "Personnage invalide. Retourne à la sélection.";
    return;
  }

  try {
    const pos = startPosition(canvas);
    const player = await createPlayerFor(def.id, pos.x, pos.y);
    // Idle uniquement pour l'instant
    player.anims.play("idle");

    if (status) status.remove();

    let last = performance.now();

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Garde la position (haut-gauche) si la fenêtre est redimensionnée
      const posNow = startPosition(canvas);
      player.x = posNow.x;
      player.y = posNow.y;

      // Anim idle seulement — pas de déplacement / attaque pour le moment
      player.anims.update(dt);

      drawBackground(ctx, def.background);
      player.draw(ctx);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  } catch (err) {
    console.error(err);
    if (status) {
      status.textContent =
        "Erreur de chargement des sprites. Lance : bun run placeholders";
    }
  }
}

main();
