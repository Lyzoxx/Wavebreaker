/**
 * player.js — personnage Fox : états, déplacements, orientation
 *
 * Contrôles (gérés via les touches fournies par game.js) :
 *   Z / W / ↑  = haut
 *   S / ↓      = bas
 *   Q / A / ←  = gauche
 *   D / →      = droite
 *   Espace     = attaque (via combat.js)
 *
 * COMMENT AJOUTER UNE NOUVELLE ANIMATION AU PERSONNAGE :
 *   1. Ajoute le PNG dans assets/characters/fox/...
 *   2. Ajoute une entrée dans FOX_ANIMATION_CONFIG ci-dessous
 *   3. Charge-la dans createFoxPlayer()
 *   4. Appelle this.anims.play("nouveauNom") au bon moment
 */

import { SpriteAnimation, AnimationController, loadImage } from "./animation.js";

/**
 * Config des animations Fox.
 * Modifie frameCount / frameWidth / frameHeight / frameDuration ici.
 *
 * frameDuration = secondes par frame (ex: 0.12 = assez rapide)
 */
export const FOX_ANIMATION_CONFIG = {
  idle: {
    // Remplace ce fichier par ta vraie sprite sheet idle
    src: "assets/characters/fox/idle/fox_idle.png",
    frameCount: 4,
    frameWidth: 64,
    frameHeight: 64,
    frameDuration: 0.18,
    loop: true,
  },
  walk: {
    src: "assets/characters/fox/walk/fox_walk.png",
    frameCount: 6,
    frameWidth: 64,
    frameHeight: 64,
    frameDuration: 0.1,
    loop: true,
  },
  attack: {
    src: "assets/characters/fox/attack/fox_attack.png",
    frameCount: 5,
    frameWidth: 64,
    frameHeight: 64,
    frameDuration: 0.08,
    loop: false, // important : une seule fois
  },
  hurt: {
    src: "assets/characters/fox/hurt/fox_hurt.png",
    frameCount: 2,
    frameWidth: 64,
    frameHeight: 64,
    frameDuration: 0.12,
    loop: false,
  },
};

export class Player {
  /**
   * @param {number} x
   * @param {number} y
   * @param {AnimationController} anims
   */
  constructor(x, y, anims) {
    this.x = x;
    this.y = y;
    this.anims = anims;

    /** @type {"idle"|"walk"|"attack"|"hurt"} */
    this.state = "idle";

    this.speed = 160; // pixels / seconde
    this.facingRight = true;
    this.scale = 2;

    /** Dernière direction de déplacement (pour les projectiles) */
    this.aimX = 1;
    this.aimY = 0;

    this.hp = 100;
    this.maxHp = 100;

    /** Pendant hurt, on bloque un peu le contrôle */
    this.hurtTimer = 0;
  }

  get isBusy() {
    return this.state === "attack" || this.state === "hurt";
  }

  /**
   * @param {{ up:boolean, down:boolean, left:boolean, right:boolean }} input
   * @param {number} dt
   * @param {{ width:number, height:number }} bounds
   */
  update(input, dt, bounds) {
    // Fin d'anim verrouillée → retour idle
    const finished = this.anims.update(dt);
    if (finished === "attack" || finished === "hurt") {
      this.state = "idle";
      this.anims.play("idle");
    }

    if (this.state === "hurt") {
      this.hurtTimer -= dt;
      return;
    }

    // Pendant l'attaque : pas de déplacement
    if (this.state === "attack") {
      return;
    }

    let dx = 0;
    let dy = 0;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;

    const moving = dx !== 0 || dy !== 0;

    if (moving) {
      // Normalise pour que la diagonale ne soit pas plus rapide
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;

      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;

      // Garde Fox dans le canvas
      const margin = 40;
      this.x = Math.max(margin, Math.min(bounds.width - margin, this.x));
      this.y = Math.max(margin, Math.min(bounds.height - margin, this.y));

      this.aimX = dx;
      this.aimY = dy;

      if (dx < 0) this.facingRight = false;
      if (dx > 0) this.facingRight = true;

      this.state = "walk";
      this.anims.play("walk");
    } else {
      this.state = "idle";
      this.anims.play("idle");
    }
  }

  /**
   * Démarre l'état attack (appelé par combat.js).
   * @returns {boolean}
   */
  startAttack() {
    if (this.isBusy) return false;
    this.state = "attack";
    this.anims.play("attack", { force: true });
    return true;
  }

  /**
   * Reçoit des dégâts → anim hurt.
   * Appelle player.takeDamage(10) depuis le jeu pour tester (touche H).
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.state === "hurt") return;
    this.hp = Math.max(0, this.hp - amount);
    this.state = "hurt";
    this.hurtTimer = 0.25;
    this.anims.play("hurt", { force: true });
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    this.anims.draw(ctx, this.x, this.y, this.facingRight, this.scale);
  }
}

/**
 * Charge les sprites Fox et crée le joueur.
 * Si une image manque, une erreur claire s'affiche dans la console.
 * @param {number} x
 * @param {number} y
 */
export async function createFoxPlayer(x, y) {
  /** @type {Record<string, SpriteAnimation>} */
  const animations = {};

  for (const [name, cfg] of Object.entries(FOX_ANIMATION_CONFIG)) {
    const image = await loadImage(cfg.src);
    animations[name] = new SpriteAnimation({
      image,
      frameCount: cfg.frameCount,
      frameWidth: cfg.frameWidth,
      frameHeight: cfg.frameHeight,
      frameDuration: cfg.frameDuration,
      loop: cfg.loop,
    });
  }

  const controller = new AnimationController(animations, "idle");
  return new Player(x, y, controller);
}
