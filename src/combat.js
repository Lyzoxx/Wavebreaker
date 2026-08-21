/**
 * combat.js — attaques, projectiles, cooldowns
 *
 * COMMENT AJOUTER UNE NOUVELLE ATTAQUE :
 *   1. Ajoute un PNG dans assets/projectiles/ (ex: icebolt.png)
 *   2. Crée une entrée dans ATTACKS ci-dessous (vitesse, dégâts, frame de spawn…)
 *   3. Dans tryAttack(), choisis l'attaque (ou mappe une autre touche)
 *
 * COMMENT MODIFIER LA FIREBALL :
 *   - speed / damage / cooldown / spawnFrame → objet ATTACKS.fireball
 *   - l'image → assets/projectiles/fireball.png
 */

import { SpriteAnimation, loadImage } from "./animation.js";

/**
 * Catalogue des attaques.
 * spawnFrame = index de frame de l'anim attack où le projectile apparaît
 * (0 = première frame). Pour Fox attack (5 frames), 2 = milieu du coup de bâton.
 */
export const ATTACKS = {
  fireball: {
    // Image du projectile (sprite sheet ou image simple)
    src: "assets/projectiles/fireball.png",
    frameCount: 4,
    frameWidth: 32,
    frameHeight: 24,
    frameDuration: 0.08,
    speed: 320, // px / s
    damage: 13, // comme sur la référence visuelle
    cooldown: 0.45, // secondes entre deux attaques
    spawnFrame: 2, // frame de l'anim Fox où la boule part
    scale: 2,
    lifetime: 2.5, // disparition auto après X secondes
  },

  // Exemple pour plus tard :
  // icebolt: {
  //   src: "assets/projectiles/icebolt.png",
  //   frameCount: 3,
  //   frameWidth: 32,
  //   frameHeight: 24,
  //   frameDuration: 0.1,
  //   speed: 280,
  //   damage: 10,
  //   cooldown: 0.6,
  //   spawnFrame: 2,
  //   scale: 2,
  //   lifetime: 2.5,
  // },
};

export class Projectile {
  /**
   * @param {object} opts
   * @param {number} opts.x
   * @param {number} opts.y
   * @param {number} opts.vx
   * @param {number} opts.vy
   * @param {number} opts.damage
   * @param {number} opts.lifetime
   * @param {SpriteAnimation} opts.anim
   * @param {number} opts.scale
   * @param {boolean} opts.facingRight
   */
  constructor({ x, y, vx, vy, damage, lifetime, anim, scale, facingRight }) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.lifetime = lifetime;
    this.anim = anim;
    this.scale = scale;
    this.facingRight = facingRight;
    this.alive = true;
  }

  /** @param {number} dt */
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.lifetime -= dt;
    this.anim.update(dt);
    if (this.lifetime <= 0) this.alive = false;
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    this.anim.draw(ctx, this.x, this.y, this.facingRight, this.scale);
  }
}

export class CombatSystem {
  constructor() {
    /** @type {Projectile[]} */
    this.projectiles = [];

    /** @type {Record<string, HTMLImageElement>} */
    this.images = {};

    /** Temps restant avant de pouvoir réattaquer */
    this.cooldownLeft = 0;

    /** Pendant une attaque en cours : quel sort, et a-t-on déjà spawné le projectile ? */
    this.pendingAttack = null;
    this.projectileSpawned = false;
  }

  /** Précharge les images des projectiles. */
  async load() {
    for (const [name, cfg] of Object.entries(ATTACKS)) {
      this.images[name] = await loadImage(cfg.src);
    }
  }

  get canAttack() {
    return this.cooldownLeft <= 0 && this.pendingAttack === null;
  }

  /**
   * Tente de lancer une attaque avec le joueur.
   * @param {import("./player.js").Player} player
   * @param {string} [attackName="fireball"]
   * @returns {boolean}
   */
  tryAttack(player, attackName = "fireball") {
    const cfg = ATTACKS[attackName];
    if (!cfg) {
      console.warn(`Attaque inconnue: ${attackName}`);
      return false;
    }
    if (!this.canAttack) return false;
    if (!player.startAttack()) return false;

    this.pendingAttack = attackName;
    this.projectileSpawned = false;
    this.cooldownLeft = cfg.cooldown;
    return true;
  }

  /**
   * @param {import("./player.js").Player} player
   * @param {number} dt
   * @param {{ width:number, height:number }} bounds
   */
  update(player, dt, bounds) {
    if (this.cooldownLeft > 0) {
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    }

    // Spawn du projectile à la bonne frame de l'anim attack
    if (this.pendingAttack && !this.projectileSpawned && player.state === "attack") {
      const cfg = ATTACKS[this.pendingAttack];
      const frame = player.anims.current?.frameIndex ?? 0;
      if (frame >= cfg.spawnFrame) {
        this.#spawnProjectile(player, this.pendingAttack);
        this.projectileSpawned = true;
      }
    }

    // Fin de l'attaque joueur → on libère le slot d'attaque
    if (this.pendingAttack && player.state !== "attack") {
      this.pendingAttack = null;
      this.projectileSpawned = false;
    }

    for (const p of this.projectiles) {
      p.update(dt);
      if (p.x < -50 || p.y < -50 || p.x > bounds.width + 50 || p.y > bounds.height + 50) {
        p.alive = false;
      }
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);
  }

  /**
   * @param {import("./player.js").Player} player
   * @param {string} attackName
   */
  #spawnProjectile(player, attackName) {
    const cfg = ATTACKS[attackName];
    const image = this.images[attackName];
    if (!image) return;

    // Direction = dernière direction regardée / déplacée
    let dx = player.aimX;
    let dy = player.aimY;
    if (dx === 0 && dy === 0) {
      dx = player.facingRight ? 1 : -1;
    }
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;

    const anim = new SpriteAnimation({
      image,
      frameCount: cfg.frameCount,
      frameWidth: cfg.frameWidth,
      frameHeight: cfg.frameHeight,
      frameDuration: cfg.frameDuration,
      loop: true,
    });

    // Léger offset devant Fox (côté bâton)
    const offset = 36;
    this.projectiles.push(
      new Projectile({
        x: player.x + dx * offset,
        y: player.y + dy * offset - 8,
        vx: dx * cfg.speed,
        vy: dy * cfg.speed,
        damage: cfg.damage,
        lifetime: cfg.lifetime,
        anim,
        scale: cfg.scale,
        facingRight: dx >= 0,
      })
    );
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    for (const p of this.projectiles) p.draw(ctx);
  }
}
