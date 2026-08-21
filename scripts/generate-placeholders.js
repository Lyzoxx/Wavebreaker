/**
 * Générateur de placeholders PNG (sprite sheets horizontales).
 * Lance une fois : bun run scripts/generate-placeholders.js
 *
 * Remplace ensuite ces fichiers par tes vrais sprites aux mêmes chemins.
 */
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");

/** Encode RGBA brut en PNG (sans dépendance externe). */
function encodePNG(width, height, rgba) {
  const signature = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

  function crcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    return table;
  }
  const CRC = crcTable();
  function crc32(data) {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, data.length);
    const crcData = new Uint8Array(typeBytes.length + data.length);
    crcData.set(typeBytes, 0);
    crcData.set(data, typeBytes.length);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(crcData));
    const out = new Uint8Array(4 + typeBytes.length + data.length + 4);
    out.set(len, 0);
    out.set(typeBytes, 4);
    out.set(data, 8);
    out.set(crc, 8 + data.length);
    return out;
  }

  // Filtre "None" + scanlines, puis DEFLATE non compressé (blocks stored)
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), rowStart + 1);
  }

  function deflateStore(data) {
    const blocks = [];
    let offset = 0;
    const max = 65535;
    while (offset < data.length) {
      const size = Math.min(max, data.length - offset);
      const isLast = offset + size >= data.length ? 1 : 0;
      const block = new Uint8Array(5 + size);
      block[0] = isLast;
      block[1] = size & 0xff;
      block[2] = (size >> 8) & 0xff;
      block[3] = ~size & 0xff;
      block[4] = (~size >> 8) & 0xff;
      block.set(data.subarray(offset, offset + size), 5);
      blocks.push(block);
      offset += size;
    }
    // Adler-32
    let a = 1;
    let b = 0;
    for (let i = 0; i < data.length; i++) {
      a = (a + data[i]) % 65521;
      b = (b + a) % 65521;
    }
    const adler = new Uint8Array(4);
    new DataView(adler.buffer).setUint32(0, ((b << 16) | a) >>> 0);
    const zlib = new Uint8Array(2 + blocks.reduce((n, x) => n + x.length, 0) + 4);
    zlib[0] = 0x78;
    zlib[1] = 0x01;
    let p = 2;
    for (const block of blocks) {
      zlib.set(block, p);
      p += block.length;
    }
    zlib.set(adler, p);
    return zlib;
  }

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA

  const parts = [signature, chunk("IHDR", ihdr), chunk("IDAT", deflateStore(raw)), chunk("IEND", new Uint8Array())];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    png.set(p, o);
    o += p.length;
  }
  return png;
}

function fillRect(rgba, w, x, y, rw, rh, color) {
  const [r, g, b, a = 255] = color;
  for (let py = y; py < y + rh; py++) {
    for (let px = x; px < x + rw; px++) {
      if (px < 0 || py < 0 || px >= w) continue;
      const i = (py * w + px) * 4;
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = a;
    }
  }
}

/** Dessine un renard magicien simplifié (placeholder) dans une frame. */
function drawFoxFrame(rgba, sheetW, frameX, frameW, frameH, variant) {
  const ox = frameX;
  // fond transparent déjà à 0

  // chapeau bleu
  fillRect(rgba, sheetW, ox + 18, 4, 28, 10, [70, 130, 220]);
  fillRect(rgba, sheetW, ox + 28, 0, 14, 18, [70, 130, 220]);
  // tête orange
  fillRect(rgba, sheetW, ox + 22, 14, 20, 14, [230, 140, 60]);
  fillRect(rgba, sheetW, ox + 26, 20, 12, 6, [255, 230, 200]); // museau
  // corps / cape
  fillRect(rgba, sheetW, ox + 20, 28, 24, 16, [60, 110, 200]);
  fillRect(rgba, sheetW, ox + 24, 32, 16, 18, [50, 50, 55]);
  // jambes
  const legShift = variant === "walk" ? (frameX / frameW) % 2 === 0 ? -2 : 2 : 0;
  fillRect(rgba, sheetW, ox + 26 + legShift, 50, 6, 12, [50, 50, 55]);
  fillRect(rgba, sheetW, ox + 34 - legShift, 50, 6, 12, [50, 50, 55]);
  // bâton
  const staffRaise = variant === "attack" ? -8 : 0;
  fillRect(rgba, sheetW, ox + 14, 10 + staffRaise, 3, 42, [140, 90, 40]);
  if (variant === "hurt") {
    // flash rouge léger
    fillRect(rgba, sheetW, ox + 20, 14, 24, 40, [255, 80, 80, 60]);
  }
  if (variant === "attack") {
    // étincelle sur le bâton
    fillRect(rgba, sheetW, ox + 10, 8, 8, 8, [255, 200, 60]);
  }
}

function makeFoxSheet({ frameCount, frameW, frameH, variant }) {
  const sheetW = frameCount * frameW;
  const rgba = new Uint8Array(sheetW * frameH * 4);
  for (let f = 0; f < frameCount; f++) {
    drawFoxFrame(rgba, sheetW, f * frameW, frameW, frameH, variant);
  }
  return encodePNG(sheetW, frameH, rgba);
}

function makeFireballSheet({ frameCount, frameW, frameH }) {
  const sheetW = frameCount * frameW;
  const rgba = new Uint8Array(sheetW * frameH * 4);
  for (let f = 0; f < frameCount; f++) {
    const ox = f * frameW;
    const pulse = f % 2 === 0 ? 0 : 1;
    fillRect(rgba, sheetW, ox + 4 + pulse, 6, 20, 12, [255, 120, 30]);
    fillRect(rgba, sheetW, ox + 8 + pulse, 8, 12, 8, [255, 220, 80]);
    fillRect(rgba, sheetW, ox + 0, 8, 6, 8, [180, 60, 20, 180]); // traînée
  }
  return encodePNG(sheetW, frameH, rgba);
}

const jobs = [
  {
    path: "assets/characters/fox/idle/fox_idle.png",
    data: makeFoxSheet({ frameCount: 4, frameW: 64, frameH: 64, variant: "idle" }),
  },
  {
    path: "assets/characters/fox/walk/fox_walk.png",
    data: makeFoxSheet({ frameCount: 6, frameW: 64, frameH: 64, variant: "walk" }),
  },
  {
    path: "assets/characters/fox/attack/fox_attack.png",
    data: makeFoxSheet({ frameCount: 5, frameW: 64, frameH: 64, variant: "attack" }),
  },
  {
    path: "assets/characters/fox/hurt/fox_hurt.png",
    data: makeFoxSheet({ frameCount: 2, frameW: 64, frameH: 64, variant: "hurt" }),
  },
  {
    path: "assets/projectiles/fireball.png",
    data: makeFireballSheet({ frameCount: 4, frameW: 32, frameH: 24 }),
  },
];

for (const job of jobs) {
  const full = join(ROOT, job.path);
  await mkdir(join(full, ".."), { recursive: true });
  await Bun.write(full, job.data);
  console.log("Créé:", job.path);
}

console.log("Placeholders prêts. Remplace-les par tes vrais sprites aux mêmes chemins.");
