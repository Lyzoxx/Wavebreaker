# Assets Wavebreaker

Place tes sprites ici (sprite sheets **horizontales**, frames de gauche à droite).

## Fox

| Animation | Chemin | frames (placeholder) | taille frame |
|-----------|--------|----------------------|--------------|
| idle | `characters/fox/idle/fox_idle.png` | 4 | 64×64 |
| walk | `characters/fox/walk/fox_walk.png` | 6 | 64×64 |
| attack | `characters/fox/attack/fox_attack.png` | 5 | 64×64 |
| hurt | `characters/fox/hurt/fox_hurt.png` | 2 | 64×64 |

## Projectiles

| Nom | Chemin |
|-----|--------|
| fireball | `projectiles/fireball.png` |

## Ennemi (gobelin)

| Animation | Chemin | frames (placeholder) | taille frame |
|-----------|--------|----------------------|--------------|
| idle | `characters/enemy/idle/enemy_idle.png` | 4 | 64×64 |
| walk | `characters/enemy/walk/enemy_walk.png` | 6 | 64×64 |
| attack | `characters/enemy/attack/enemy_attack.png` | 6 | 64×64 |
| hurt | `characters/enemy/hurt/enemy_hurt.png` | 2 | 64×64 |
| death | `characters/enemy/death/enemy_death.png` | 5 | 64×64 |

Après remplacement des PNG, ajuste `frameCount`, `frameWidth`, `frameHeight` et `frameDuration` dans :

- `src/player.js` → `FOX_ANIMATION_CONFIG`
- `src/combat.js` → `ATTACKS`
- `src/enemy.js` → `ENEMY_CONFIG`

Générer les placeholders :

```bash
bun run placeholders
```
