/**
 * animation.js — système d'animations par sprite sheets (réutilisable)
 *
 * OÙ PLACER TES IMAGES :
 *   assets/characters/fox/idle/fox_idle.png
 *   assets/characters/fox/walk/fox_walk.png
 *   assets/characters/fox/attack/fox_attack.png
 *   assets/characters/fox/hurt/fox_hurt.png
 *   assets/characters/enemy/idle/enemy_idle.png
 *   assets/characters/enemy/walk/enemy_walk.png
 *   assets/characters/enemy/attack/enemy_attack.png
 *   assets/characters/enemy/hurt/enemy_hurt.png
 *   assets/characters/enemy/death/enemy_death.png
 *
 * Une animation avec loop:false s'arrête sur la dernière frame (finished === true).
 *
 * COMMENT MODIFIER LE NOMBRE DE FRAMES :
 *   change `frameCount` dans la config passée à SpriteAnimation.
 *
 * COMMENT MODIFIER LA VITESSE :
 *   change `frameDuration` (secondes par frame). Plus petit = plus rapide.
 *
 * COMMENT REMPLACER LES PLACEHOLDERS :
 *   remplace simplement les PNG aux chemins ci-dessus.
 *   Garde le même ordre de frames (gauche → droite) et ajuste frameWidth / frameCount.
 */

/**
 * Charge une image depuis une URL.
 * @param {string} src
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Impossible de charger: ${src}`));
    img.src = src;
  });
}

/**
 * Une animation basée sur une sprite sheet horizontale.
 */
export class SpriteAnimation {
  /**
   * @param {object} options
   * @param {HTMLImageElement} options.image - sprite sheet
   * @param {number} options.frameCount - nombre de frames côte à côte
   * @param {number} options.frameWidth - largeur d'UNE frame (px)
   * @param {number} options.frameHeight - hauteur d'UNE frame (px)
   * @param {number} options.frameDuration - durée d'une frame en secondes
   * @param {boolean} [options.loop=true] - rejouer en boucle ?
   */
  constructor({ image, frameCount, frameWidth, frameHeight, frameDuration, loop = true }) {
    this.image = image;
    this.frameCount = frameCount;
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.frameDuration = frameDuration;
    this.loop = loop;

    this.frameIndex = 0;
    this.elapsed = 0;
    this.finished = false;
  }

  /** Remet l'animation au début. */
  reset() {
    this.frameIndex = 0;
    this.elapsed = 0;
    this.finished = false;
  }

  /**
   * Avance l'animation.
   * @param {number} dt - delta time en secondes
   */
  update(dt) {
    if (this.finished) return;

    this.elapsed += dt;
    while (this.elapsed >= this.frameDuration) {
      this.elapsed -= this.frameDuration;
      this.frameIndex += 1;

      if (this.frameIndex >= this.frameCount) {
        if (this.loop) {
          this.frameIndex = 0;
        } else {
          this.frameIndex = this.frameCount - 1;
          this.finished = true;
        }
      }
    }
  }

  /**
   * Dessine la frame courante.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x - centre X à l'écran
   * @param {number} y - centre Y à l'écran
   * @param {boolean} facingRight - false = miroir horizontal
   * @param {number} [scale=2]
   */
  draw(ctx, x, y, facingRight = true, scale = 2) {
    const sx = this.frameIndex * this.frameWidth;
    const sy = 0;
    const dw = this.frameWidth * scale;
    const dh = this.frameHeight * scale;

    ctx.save();
    ctx.translate(x, y);
    if (!facingRight) ctx.scale(-1, 1);
    ctx.drawImage(
      this.image,
      sx,
      sy,
      this.frameWidth,
      this.frameHeight,
      -dw / 2,
      -dh / 2,
      dw,
      dh
    );
    ctx.restore();
  }
}

/**
 * Gère plusieurs animations et le changement d'état.
 * Empêche idle/walk d'interrompre attack (ou hurt) avant la fin.
 */
export class AnimationController {
  /**
   * @param {Record<string, SpriteAnimation>} animations
   * @param {string} [initial="idle"]
   * @param {string[]} [lockedStates=["attack","hurt"]] - états non interruptibles par idle/walk
   */
  constructor(animations, initial = "idle", lockedStates = ["attack", "hurt", "death"]) {
    this.animations = animations;
    this.currentName = initial;
    this.lockedStates = new Set(lockedStates);
    this.animations[initial]?.reset();
  }

  get current() {
    return this.animations[this.currentName];
  }

  get isLocked() {
    return this.lockedStates.has(this.currentName) && this.current && !this.current.finished;
  }

  /**
   * Demande un changement d'animation.
   * @param {string} name
   * @param {{ force?: boolean }} [opts] - force=true ignore le verrou (ex: hurt)
   * @returns {boolean} true si le changement a eu lieu
   */
  play(name, { force = false } = {}) {
    if (!this.animations[name]) {
      console.warn(`Animation inconnue: ${name}`);
      return false;
    }

    // Même animation déjà en cours → ne pas reset (sauf force)
    if (name === this.currentName && !force) return true;

    // idle / walk ne coupent pas une attack / hurt en cours
    if (!force && this.isLocked && (name === "idle" || name === "walk")) {
      return false;
    }

    this.currentName = name;
    this.animations[name].reset();
    return true;
  }

  /**
   * @param {number} dt
   * @returns {string|null} nom de l'anim qui vient de se terminer, sinon null
   */
  update(dt) {
    const anim = this.current;
    if (!anim) return null;

    const wasFinished = anim.finished;
    anim.update(dt);

    if (!wasFinished && anim.finished) {
      return this.currentName;
    }
    return null;
  }

  draw(ctx, x, y, facingRight, scale) {
    this.current?.draw(ctx, x, y, facingRight, scale);
  }
}
