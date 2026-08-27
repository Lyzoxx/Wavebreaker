/**
 * game.js — boucle principale, décor, Fox, ennemis
 */

import { createFoxPlayer } from "./player.js";
import { getCharacter } from "./characters.js";
import { CombatSystem } from "./combat.js";
import { createEnemy, ENEMY_CONFIG } from "./enemy.js";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #game-canvas introuvable dans game.html");
}

const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Impossible d'obtenir le contexte 2D");

/** État des touches */
const keys = Object.create(null);

let showAttackButton = false;

let combat = null;
let player = null;

const INPUT_MAP = {
  up: ["KeyW", "KeyZ", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  left: ["KeyA", "KeyQ", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  keys[e.code] = false;
});

function readMovementInput() {
  return {
    up: INPUT_MAP.up.some((c) => keys[c]),
    down: INPUT_MAP.down.some((c) => keys[c]),
    left: INPUT_MAP.left.some((c) => keys[c]),
    right: INPUT_MAP.right.some((c) => keys[c]),
  };
}

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

function isMouseOverAttackButton(mouseX, mouseY) {
  const buttonWidth = 180;
  const buttonHeight = 55;

  const x = canvas.width / 2 - buttonWidth / 2;
  const y = groundY(canvas.height) + 45;

  return (
    mouseX >= x &&
    mouseX <= x + buttonWidth &&
    mouseY >= y &&
    mouseY <= y + buttonHeight
  );
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

canvas.addEventListener("click", (e) => {
  if (!showAttackButton) return;

  const rect = canvas.getBoundingClientRect();

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  if (isMouseOverAttackButton(mouseX, mouseY)) {
    showAttackButton = false;

    combat.tryAttack(
      player,
      "fireball"
    );
  }
});

function drawAttackButton(c) {
  if (!showAttackButton) return;

  const buttonWidth = 180;
  const buttonHeight = 55;

  const x = c.canvas.width / 2 - buttonWidth / 2;

  // Position du bouton sous l'herbe
  const y = groundY(c.canvas.height) + 45;

  // Fond du bouton
  c.fillStyle = "#8b2f2f";
  c.fillRect(
    x,
    y,
    buttonWidth,
    buttonHeight
  );

  // Bordure
  c.strokeStyle = "#e8c56a";
  c.lineWidth = 3;
  c.strokeRect(
    x,
    y,
    buttonWidth,
    buttonHeight
  );

  // Texte
  c.fillStyle = "#ffffff";
  c.font = "bold 20px Segoe UI, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";

  c.fillText(
    "ATTAQUE",
    c.canvas.width / 2,
    y + buttonHeight / 2
  );

  // On remet les valeurs normales
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
}

function drawHud(c, player, enemies) {
  c.fillStyle = "rgba(0, 0, 0, 0.4)";
  c.fillRect(16, 16, 220, 52);
  c.fillStyle = "#e8f4ff";
  c.font = "14px Segoe UI, sans-serif";
  c.fillText(`Fox HP ${player.hp}/${player.maxHp}`, 28, 38);
  const enemy = enemies.find((e) => e.alive || e.state === "death");
  const enemyHp = enemy ? `${Math.max(0, enemy.health)}/${enemy.maxHealth}` : "—";
  c.fillText(`Ennemi HP ${enemyHp}`, 28, 56);
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
    if (status) {
      status.textContent =
        "Personnage invalide. Retourne à la sélection.";
    }
    return;
  }

  try {
    /*
     * ---------------------------------------------------------
     * CHARGEMENT
     * ---------------------------------------------------------
     */

    const grassY = startPosition(canvas).y;

    combat = new CombatSystem();
    await combat.load();

    /*
     * Fox commence hors écran à gauche.
     */
    const foxStartX = -80;

    /*
     * Position finale de Fox : milieu-gauche.
     */
    const foxFinalX = canvas.width * 0.35;

    /*
     * Gobelin commence hors écran à droite.
     */
    const goblinStartX = canvas.width + 80;

    /*
     * Position finale du gobelin : milieu-droit.
     */
    const goblinFinalX = canvas.width * 0.65;

    /*
     * Création de Fox.
     */
    player = await createPlayerFor(
      def.id,
      foxStartX,
      grassY
    );

    /*
     * Création du gobelin.
     */
    const enemy = await createEnemy(
      goblinStartX,
      grassY
    );

    /*
     * Le gobelin regarde vers Fox.
     */
    enemy.faceTarget(player);

    /*
     * Tableau prévu pour plusieurs ennemis plus tard.
     */
    const enemies = [enemy];

    /*
     * On commence avec les animations de marche.
     */
    player.state = "walk";
    player.anims.play("walk", { force: true });

    enemy.state = "walk";
    enemy.anims.play("walk", { force: true });

    if (status) {
      status.remove();
    }

    /*
     * ---------------------------------------------------------
     * PHASE D'INTRODUCTION
     * ---------------------------------------------------------
     */

    let introFinished = false;
    let last = performance.now();
    let spaceWasDown = false; 

    function frame(now) {
      const dt = Math.min(
        0.05,
        (now - last) / 1000
      );

      last = now;

      const bounds = {
        width: canvas.width,
        height: canvas.height,
      };

      /*
       * =====================================================
       * INTRO
       * =====================================================
       */

      if (!introFinished) {

        player.anims.update(dt);
        enemy.anims.update(dt);
        
        /*
         * -------------------------
         * FOX AVANCE VERS LE CENTRE
         * -------------------------
         */

        if (player.x < foxFinalX) {
          player.x += player.speed * dt;
          player.facingRight = true;
          player.anims.play("walk");
        } else {
          player.x = foxFinalX;
          player.state = "idle";
          player.anims.play("idle");
        }

        /*
         * -------------------------
         * GOBELIN AVANCE VERS FOX
         * -------------------------
         */

        if (enemy.x > goblinFinalX) {
          enemy.x -= enemy.speed * dt;
          enemy.facingRight = false;
          enemy.anims.play("walk");
        } else {
          enemy.x = goblinFinalX;
          enemy.state = "idle";
          enemy.anims.play("idle");
        }

        /*
         * Les deux restent sur la ligne d'herbe.
         */
        player.y = grassY;
        enemy.y = grassY;

        /*
         * On vérifie si les deux sont arrivés.
         */
        const foxArrived =
          Math.abs(player.x - foxFinalX) < 1;

        const enemyArrived =
          Math.abs(enemy.x - goblinFinalX) < 1;

        if (foxArrived && enemyArrived) {
          /*
           * Position exacte.
           */
          player.x = foxFinalX;
          enemy.x = goblinFinalX;

          /*
           * Fox regarde vers le gobelin.
           */
          player.facingRight = true;

          /*
           * Gobelin regarde vers Fox.
           */
          enemy.facingRight = false;

          /*
           * Passage en idle.
           */
          player.state = "idle";
          player.anims.play("idle", { force: true });

          enemy.state = "idle";
          enemy.anims.play("idle", { force: true });

          /*
           * Fin de l'intro.
           */
          showAttackButton = true;

          introFinished = true;
        }
      }

      /*
       * =====================================================
       * JEU NORMAL
       * =====================================================
       */

      else {

        /*
         * Fox reste sur l'herbe.
         */
        player.y = grassY;

        /*
         * Attaque avec Espace.
         */
        const spaceDown = !!keys.Space;

        if (spaceDown && !spaceWasDown) {
          combat.tryAttack(
            player,
            "fireball"
          );
        }

        spaceWasDown = spaceDown;

        /*
         * Mise à jour des ennemis.
         */
        for (const e of enemies) {
          e.y = grassY;
        }

        /*
         * Mise à jour du combat.
         */
        combat.update(
          player,
          dt,
          bounds,
          enemies
        );

        /*
         * Suppression des ennemis morts.
         */
        for (
          let i = enemies.length - 1;
          i >= 0;
          i--
        ) {
          if (!enemies[i].alive) {
            enemies.splice(i, 1);
          }
        }
      }

      /*
       * =====================================================
       * DESSIN
       * =====================================================
       */

      drawBackground(
        ctx,
        def.background
      );

      /*
       * Fox.
       */
      player.draw(ctx);

      /*
       * Gobelin(s).
       */
      for (const e of enemies) {
        e.draw(ctx);
      }

      /*
       * Le système de combat ne dessine
       * que lorsqu'il y a quelque chose à afficher.
       */
      combat.draw(ctx);

      /*
       * HUD.
       */
      drawHud(
        ctx,
        player,
        enemies
      );

      /*
       * Bouton d'attaque.
       */
      drawAttackButton(ctx);

      requestAnimationFrame(frame);
    }

    /*
     * On démarre la boucle.
     */
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