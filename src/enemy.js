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
 *
 * SYSTÈME DE ROUND :
 *   Le gobelin ne bouge que si `isChasing === true`. Ce flag passe à true
 *   dans takeDamage() (il vient d'être touché par Fox) et repasse à false
 *   dans #returnToStart() une fois qu'il est revenu chez lui. `turnFinished`
 *   bascule à true à ce même moment : c'est le signal que lit game.js pour
 *   redonner la main à Fox.
 */

import { SpriteAnimation, AnimationController, loadImage } from "./animation.js";
import { attackHitboxRect, distanceBetween, hitboxRect, rectsOverlap } from "./combat.js";

/** Distance initiale Fox ↔ ennemi (px). */
export const ENEMY_SPAWN_DISTANCE = 400;

/** L'ennemi s'arrête à cette distance de Fox (px). */
export const ENEMY_STOP_DISTANCE = 0;

/** Portée à laquelle l'ennemi peut attaquer (px). */
export const ENEMY_ATTACK_RANGE = 60;

/** Délai entre deux attaques (millisecondes). */
export const ENEMY_ATTACK_COOLDOWN = 1500;

export const ENEMY_MAX_HEALTH = 100;

/** Index de frame (0 = première) où le coup touche. */
export const ATTACK_HIT_FRAME = 2;

export const EnemyState = {
  IDLE: "idle",
  WALK: "walk",
  ATTACK: "attack",
  RETURN: "return",
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
  minDistance: 0,
  attackRange: ENEMY_ATTACK_RANGE,
  /** ms → converti en secondes dans update */
  attackCooldownMs: ENEMY_ATTACK_COOLDOWN,
  /** Court délai avant d'attaquer une fois à portée (secondes). */
  attackDelay: 0.25,
  attackDamage: 10,
  /** Probabilité d'un coup critique (0.25 = 1 chance sur 4). */
  critChance: 0.25,
  /** Multiplicateur de dégâts en cas de critique. */
  critMultiplier: 2,
  attackHitFrame: ATTACK_HIT_FRAME,
  maxHealth: ENEMY_MAX_HEALTH,
  speed: 300,
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

    this.homeX = x;
    this.homeY = y;

    this.isChasing = false;

    this.startX = x;
    this.startY = y;

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

    /** Vrai si l'attaque en cours est un coup critique (tiré au sort dans #tryAttack). */
    this.isCriticalHit = false;

    /**
     * Passe à true quand le gobelin est de retour chez lui après sa
     * riposte : c'est le signal de fin de tour lu par game.js.
     */
    this.turnFinished = false;
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

    // =========================
    // MORT
    // =========================
    if (this.state === EnemyState.DEATH) {
      if (finished === EnemyState.DEATH || this.anims.current?.finished) {
        this.alive = false;
      }
      return;
    }

    // =========================
    // BLESSÉ
    // =========================
    if (this.state === EnemyState.HURT) {
      if (finished === EnemyState.HURT) {
        this.state = EnemyState.WALK;
        this.anims.play(EnemyState.WALK);
      }

      this.faceTarget(target);
      return;
    }

    // =========================
    // ATTAQUE
    // =========================
    if (this.state === EnemyState.ATTACK) {
      this.#updateAttack(target, applyMeleeHit);

      if (this.anims.current?.finished) {
        this.state = EnemyState.RETURN;
        this.hitApplied = false;
      }

      return;
    }

    // =========================
    // RETOUR À LA POSITION INITIALE
    // =========================
    if (this.state === EnemyState.RETURN) {
      this.#returnToStart(dt, bounds);
      return;
    }

    // =========================
    // COMPORTEMENT NORMAL
    // =========================
    if (!this.isChasing) {
      this.state = EnemyState.IDLE;
      this.anims.play(EnemyState.IDLE);
      return;
    }

    this.faceTarget(target);

    const dist = distanceBetween(this, target);
    const { attackRange, attackDelay } = this.config;

    // Le gobelin est suffisamment proche pour attaquer
    if (dist > attackRange) {
      this.#walkToward(target, dt, bounds);
      return;
    }

    // Cas où le gobelin est très proche
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
    if (dist > attackRange) {
      return;
    }

    if (this.cooldownLeft > 0) {
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

    // Tirage au sort du coup critique pour CETTE attaque.
    this.isCriticalHit = Math.random() < this.config.critChance;

    this.anims.play(EnemyState.ATTACK, { force: true });

    this.cooldownLeft = this.config.attackCooldownMs / 1000;
  }

  /**
   * @param {import("./player.js").Player} target
   * @param {number} dt
   * @param {{ width:number, height:number }} bounds
   */
  #walkToward(target, dt, bounds) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.hypot(dx, dy);

    // Arrivé suffisamment près de Fox
    if (distance <= this.config.minDistance) {
      this.state = EnemyState.IDLE;
      this.anims.play(EnemyState.IDLE);
      return;
    }

    const len = distance || 1;
    const nx = dx / len;
    const ny = dy / len;

    this.x += nx * this.speed * dt;
    this.y += ny * this.speed * dt;

    const margin = 40;
    this.x = Math.max(margin, Math.min(bounds.width - margin, this.x));
    this.y = Math.max(margin, Math.min(bounds.height - margin, this.y));

    this.state = EnemyState.WALK;
    this.anims.play(EnemyState.WALK);
  }

  #returnToStart(dt, bounds) {
    const dx = this.startX - this.x;
    const dy = this.startY - this.y;
    const distance = Math.hypot(dx, dy);

    // Distance que le gobelin peut parcourir cette frame
    const step = this.speed * dt;

    // S'il est suffisamment proche pour atteindre sa position,
    // on le place EXACTEMENT dessus.
    if (distance <= step || distance < 4) {
      this.x = this.startX;
      this.y = this.startY;

      this.state = EnemyState.IDLE;
      this.isChasing = false;
      this.turnFinished = true;
      this.cooldownLeft = 0;
      this.anims.play(EnemyState.IDLE, { force: true });

      return;
    }

    const nx = dx / distance;
    const ny = dy / distance;

    this.x += nx * step;
    this.y += ny * step;

    const margin = 40;
    this.x = Math.max(margin, Math.min(bounds.width - margin, this.x));
    this.y = Math.max(margin, Math.min(bounds.height - margin, this.y));

    this.state = EnemyState.RETURN;
    this.anims.play(EnemyState.WALK);
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

    /*
     * C'EST ICI QUE LE ROUND SE DÉCLENCHE :
     * le gobelin vient d'être touché par Fox, donc il se met à le
     * pourchasser (isChasing = true). Sans cette ligne, le reste de la
     * logique de #walkToward / #tryAttack / #returnToStart n'est jamais
     * atteint, car update() force le retour en idle tant que
     * isChasing === false.
     */
    this.isChasing = true;
    this.turnFinished = false;
    this.cooldownLeft = 0;
    this.attackDelayLeft = this.config.attackDelay;

    this.state = EnemyState.HURT;
    this.hitApplied = false;
    this.anims.play(EnemyState.HURT, { force: true });
  }

  #die() {
    this.state = EnemyState.DEATH;
    this.health = 0;
    this.isChasing = false;
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