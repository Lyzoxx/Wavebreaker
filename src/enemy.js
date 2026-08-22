/**
 * enemy.js — ennemi autonome (gobelin)
 *
 * TOUS LES RÉGLAGES SONT DANS ENEMY_CONFIG (et les constantes ci-dessous).
 *
 * OÙ PLACER TES SPRITES :
 *   assets/characters/enemy/idle/enemy_idle.png
 *   assets/characters/enemy/walk/enemy_walk.png
 *   assets/characters/enemy/attack/enemy_attack.png
 *   assets/characters/enemy/hurt/enemy_hurt.png
 *   assets/characters/enemy/death/enemy_death.png
 *
 * COMMENT REMPLACER LES PLACEHOLDERS :
 *   remplace les PNG aux chemins ci-dessus (sprite sheets horizontales),
 *   puis ajuste frameCount / frameWidth / frameHeight / frameDuration.
 *
 * Chaque instance a sa propre position, vie, état, animation, cooldown et cible.
 */

import { SpriteAnimation, AnimationController, loadImage } from "./animation.js";
import { attackHitboxRect, distanceBetween, hitboxRect, rectsOverlap } from "./combat.js";

/** Distance initiale Fox ↔ ennemi (px). */
export const ENEMY_SPAWN_DISTANCE = 400;

/** L'ennemi s'arrête à cette distance de Fox (px). */
export const ENEMY_STOP_DISTANCE = 100;

/** Portée à laquelle l'ennemi peut attaquer (px). */
export const ENEMY_ATTACK_RANGE = 120;

/** Délai entre deux attaques (millisecondes). */
export const ENEMY_ATTACK_COOLDOWN = 1500;

export const ENEMY_MAX_HEALTH = 100;

/** Index de frame (0 = première) où le coup touche. */
export const ATTACK_HIT_FRAME = 4;

export const EnemyState = {
  IDLE: "idle",
  WALK: "walk",
  ATTACK: "attack",
  HURT: "hurt",
  DEATH: "death",
};

/**
 * Configuration unique de l'ennemi.
 * Modifie ici : vitesse, vie, dégâts, portées, cooldown, frames, hitboxes.
 */
export const ENEMY_CONFIG = {
  spawnDistance: ENEMY_SPAWN_DISTANCE,
  stopDistance: ENEMY_STOP_DISTANCE,
  /** Distance minimale : l'ennemi ne traverse jamais Fox. */
  minDistance: 56,
  attackRange: ENEMY_ATTACK_RANGE,
  /** ms → converti en secondes dans update */
  attackCooldownMs: ENEMY_ATTACK_COOLDOWN,
  /** Court délai avant d'attaquer une fois à portée (secondes). */
  attackDelay: 0.25,
  attackDamage: 10,
  attackHitFrame: ATTACK_HIT_FRAME,
  maxHealth: ENEMY_MAX_HEALTH,
  speed: 95,
  scale: 2,
  /** Hitbox corps — indépendante de la taille visuelle du sprite. */
  hitbox: { width: 40, height: 70, offsetX: 0, offsetY: 6 },
  /** Zone de frappe devant l'ennemi (offsetX dans le sens du regard). */
  attackHitbox: { width: 72, height: 52, offsetX: 44, offsetY: 4 },
  animations: {
    idle: {
      src: "assets/characters/enemy/idle/enemy_idle.png",
      frameCount: 4,
      frameWidth: 64,
      frameHeight: 64,
      frameDuration: 0.18,
      loop: true,
    },
    walk: {
      src: "assets/characters/enemy/walk/enemy_walk.png",
      frameCount: 6,
      frameWidth: 64,
      frameHeight: 64,
      frameDuration: 0.1,
      loop: true,
    },
    attack: {
      src: "assets/characters/enemy/attack/enemy_attack.png",
      frameCount: 6,
      frameWidth: 64,
      frameHeight: 64,
      frameDuration: 0.09,
      loop: false,
    },
    hurt: {
      src: "assets/characters/enemy/hurt/enemy_hurt.png",
      frameCount: 2,
      frameWidth: 64,
      frameHeight: 64,
      frameDuration: 0.12,
      loop: false,
    },
    death: {
      src: "assets/characters/enemy/death/enemy_death.png",
      frameCount: 5,
      frameWidth: 64,
      frameHeight: 64,
      frameDuration: 0.12,
      loop: false,
    },
  },
};

export class Enemy {
  /**
   * @param {number} x
   * @param {number} y
   * @param {AnimationController} anims
   * @param {typeof ENEMY_CONFIG} [config]
   */
  constructor(x, y, anims, config = ENEMY_CONFIG) {
    this.x = x;
    this.y = y;
    this.anims = anims;
    this.config = config;

    this.state = EnemyState.IDLE;
    this.facingRight = false;
    this.scale = config.scale;
    this.speed = config.speed;

    this.health = config.maxHealth;
    this.maxHealth = config.maxHealth;
    this.alive = true;

    this.hitbox = { ...config.hitbox };
    this.attackHitbox = { ...config.attackHitbox };

    this.cooldownLeft = 0;
    this.attackDelayLeft = 0;
    this.hitApplied = false;
  }

  get isDead() {
    return this.state === EnemyState.DEATH || !this.alive;
  }

  get isBusy() {
    return (
      this.state === EnemyState.ATTACK ||
      this.state === EnemyState.HURT ||
      this.state === EnemyState.DEATH
    );
  }

  /**
   * @param {import("./player.js").Player} target
   */
  faceTarget(target) {
    if (target.x < this.x) this.facingRight = false;
    else if (target.x > this.x) this.facingRight = true;
  }

  /**
   * @param {import("./player.js").Player} target
   * @param {number} dt
   * @param {{ width:number, height:number }} bounds
   * @param {(enemy: Enemy, player: import("./player.js").Player) => boolean} applyMeleeHit
   */
  update(target, dt, bounds, applyMeleeHit) {
    if (!this.alive) return;

    if (this.cooldownLeft > 0) {
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    }

    const finished = this.anims.update(dt);

    // DEATH : prioritaire, joue jusqu'à la dernière frame, puis suppression
    if (this.state === EnemyState.DEATH) {
      if (finished === EnemyState.DEATH || this.anims.current?.finished) {
        this.alive = false;
      }
      return;
    }

    if (this.state === EnemyState.HURT) {
      if (finished === EnemyState.HURT) {
        this.state = EnemyState.IDLE;
        this.anims.play(EnemyState.IDLE);
      }
      this.faceTarget(target);
      return;
    }

    if (this.state === EnemyState.ATTACK) {
      this.#updateAttack(target, applyMeleeHit);
      if (finished === EnemyState.ATTACK) {
        this.state = EnemyState.IDLE;
        this.anims.play(EnemyState.IDLE);
        this.hitApplied = false;
      }
      return;
    }

    this.faceTarget(target);
    this.#separateFrom(target);

    const dist = distanceBetween(this, target);
    const { stopDistance, attackRange, attackDelay, minDistance } = this.config;

    // Trop près : ne jamais avancer dans Fox
    if (dist <= stopDistance && dist > minDistance) {
      this.#tryAttack(dist, attackRange, attackDelay, dt);
      return;
    }

    if (dist > stopDistance) {
      this.attackDelayLeft = attackDelay;
      this.#walkToward(target, dt, bounds);
      return;
    }

    this.#tryAttack(dist, attackRange, attackDelay, dt);
  }

  /**
   * @param {import("./player.js").Player} target
   * @param {(enemy: Enemy, player: import("./player.js").Player) => boolean} applyMeleeHit
   */
  #updateAttack(target, applyMeleeHit) {
    const frame = this.anims.current?.frameIndex ?? 0;
    if (!this.hitApplied && frame >= this.config.attackHitFrame) {
      this.hitApplied = true;
      if (rectsOverlap(attackHitboxRect(this), hitboxRect(target))) {
        applyMeleeHit(this, target);
      }
    }
  }

  #tryAttack(dist, attackRange, attackDelay, dt) {
    if (dist > attackRange || this.cooldownLeft > 0) {
      this.attackDelayLeft = attackDelay;
      this.state = EnemyState.IDLE;
      this.anims.play(EnemyState.IDLE);
      return;
    }

    this.attackDelayLeft -= dt;
    if (this.attackDelayLeft > 0) {
      this.state = EnemyState.IDLE;
      this.anims.play(EnemyState.IDLE);
      return;
    }

    this.state = EnemyState.ATTACK;
    this.hitApplied = false;
    this.anims.play(EnemyState.ATTACK, { force: true });
    this.cooldownLeft = this.config.attackCooldownMs / 1000;
    this.attackDelayLeft = attackDelay;
  }

  /**
   * @param {import("./player.js").Player} target
   * @param {number} dt
   * @param {{ width:number, height:number }} bounds
   */
  #walkToward(target, dt, bounds) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    const nextDist = Math.hypot(dx - nx * this.speed * dt, dy - ny * this.speed * dt);
    if (nextDist < this.config.stopDistance) {
      this.state = EnemyState.IDLE;
      this.anims.play(EnemyState.IDLE);
      return;
    }

    this.x += nx * this.speed * dt;
    this.y += ny * this.speed * dt;

    const margin = 40;
    this.x = Math.max(margin, Math.min(bounds.width - margin, this.x));
    this.y = Math.max(margin, Math.min(bounds.height - margin, this.y));

    this.state = EnemyState.WALK;
    this.anims.play(EnemyState.WALK);
  }

  /** Repousse l'ennemi s'il chevauche Fox. */
  #separateFrom(target) {
    const dist = distanceBetween(this, target);
    const min = this.config.minDistance;
    if (dist >= min || dist === 0) return;

    const dx = this.x - target.x;
    const dy = this.y - target.y;
    const len = Math.hypot(dx, dy) || 1;
    const push = min - dist;
    this.x += (dx / len) * push;
    this.y += (dy / len) * push;
  }

  /**
   * @param {number} amount
   */
  takeDamage(amount) {
    if (this.isDead || !this.alive) return;

    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) {
      this.#die();
      return;
    }

    this.state = EnemyState.HURT;
    this.hitApplied = false;
    this.anims.play(EnemyState.HURT, { force: true });
  }

  #die() {
    this.state = EnemyState.DEATH;
    this.health = 0;
    this.anims.play(EnemyState.DEATH, { force: true });
  }

  /** @param {CanvasRenderingContext2D} ctx */
  draw(ctx) {
    if (!this.alive && this.state !== EnemyState.DEATH) return;
    this.anims.draw(ctx, this.x, this.y, this.facingRight, this.scale);
  }
}

/**
 * Charge les sprites et crée un ennemi indépendant.
 * @param {number} x
 * @param {number} y
 * @param {typeof ENEMY_CONFIG} [config]
 */
export async function createEnemy(x, y, config = ENEMY_CONFIG) {
  /** @type {Record<string, SpriteAnimation>} */
  const animations = {};

  for (const [name, cfg] of Object.entries(config.animations)) {
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

  const controller = new AnimationController(
    animations,
    EnemyState.IDLE,
    [EnemyState.ATTACK, EnemyState.HURT, EnemyState.DEATH]
  );
  return new Enemy(x, y, controller, config);
}
