// Genera los íconos PNG de la app a partir del mismo diseño del SVG.
// Uso: node scripts/generate-icons.mjs  (también corre solo antes de `npm run build`)
//
// No depende de nada externo: escribe el PNG a mano (zlib + CRC32) y hace
// antialiasing por supersampling, así el diseño queda igual al de icon.svg.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");

// --- diseño en un espacio de 512x512 (igual que public/icon.svg) ---
const BG = [18, 21, 26];      // #12151a
const BAR = [46, 52, 64];     // #2e3440
const BLUE = [143, 191, 224]; // #8fbfe0
const GOLD = [227, 179, 65];  // #e3b341

const LINE = [
    [96, 340],
    [200, 250],
    [280, 300],
    [416, 168]
];
const LINE_HALF = 17; // strokeWidth 34 / 2
const DOT = [416, 168];
const DOT_R = 34;
const BAR_RECT = { x: 96, y: 392, w: 320, h: 28, r: 14 };

const SS = 4; // supersampling: SS x SS muestras por pixel

// --- PNG mínimo (color type 6, RGBA) ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c;
});

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
    const stride = width * 4;
    const raw = Buffer.alloc(height * (stride + 1));
    for (let y = 0; y < height; y++) {
        raw[y * (stride + 1)] = 0; // filtro: ninguno
        rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
    }
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bits por canal
    ihdr[9] = 6;  // RGBA
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", ihdr),
        chunk("IDAT", deflateSync(raw, { level: 9 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

// --- geometría ---
function distToSegment(px, py, ax, ay, bx, by) {
    const vx = bx - ax;
    const vy = by - ay;
    const wx = px - ax;
    const wy = py - ay;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    const dx = px - (ax + t * vx);
    const dy = py - (ay + t * vy);
    return Math.hypot(dx, dy);
}

function insideRoundRect(px, py, { x, y, w, h, r }) {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const cx = Math.max(x + r, Math.min(x + w - r, px));
    const cy = Math.max(y + r, Math.min(y + h - r, py));
    return Math.hypot(px - cx, py - cy) <= r;
}

function lineDistance(px, py) {
    let min = Infinity;
    for (let i = 0; i < LINE.length - 1; i++) {
        const [ax, ay] = LINE[i];
        const [bx, by] = LINE[i + 1];
        min = Math.min(min, distToSegment(px, py, ax, ay, bx, by));
    }
    return min;
}

/**
 * Renderiza el diseño en un PNG de `size` px.
 * `inset` achica el diseño (1 = a full, 0.85 = para iconos "maskable",
 * donde el SO recorta las orillas y hay que dejar margen).
 */
function renderIcon(size, inset = 1) {
    const designOnCanvas = size * inset;
    const offset = (size - designOnCanvas) / 2;
    const scale = designOnCanvas / 512;

    const rgba = Buffer.alloc(size * size * 4);

    for (let Y = 0; Y < size; Y++) {
        for (let X = 0; X < size; X++) {
            let r = 0;
            let g = 0;
            let b = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const px = X + (sx + 0.5) / SS;
                    const py = Y + (sy + 0.5) / SS;
                    const dx = (px - offset) / scale;
                    const dy = (py - offset) / scale;

                    let color = BG;
                    if (insideRoundRect(dx, dy, BAR_RECT)) color = BAR;
                    if (lineDistance(dx, dy) <= LINE_HALF) color = BLUE;
                    if (Math.hypot(dx - DOT[0], dy - DOT[1]) <= DOT_R) color = GOLD;

                    r += color[0];
                    g += color[1];
                    b += color[2];
                }
            }
            const n = SS * SS;
            const i = (Y * size + X) * 4;
            rgba[i] = Math.round(r / n);
            rgba[i + 1] = Math.round(g / n);
            rgba[i + 2] = Math.round(b / n);
            rgba[i + 3] = 255;
        }
    }
    return encodePng(size, size, rgba);
}

mkdirSync(PUBLIC, { recursive: true });

const targets = [
    ["apple-touch-icon.png", 180, 1],   // iOS (recorta las esquinas solo)
    ["icon-192.png", 192, 1],
    ["icon-512.png", 512, 1],
    ["icon-maskable-512.png", 512, 0.85] // Android: deja margen para la máscara
];

for (const [name, size, inset] of targets) {
    const file = join(PUBLIC, name);
    writeFileSync(file, renderIcon(size, inset));
    console.log(`✔ ${name} (${size}x${size})`);
}
