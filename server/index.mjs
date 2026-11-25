// API mínima de sincronización para Seguimiento.
//
//   npm run server            # http://localhost:8787
//   PORT=3000 TRACK_TOKEN=xxx npm run server
//
// Endpoints (todos requieren `Authorization: Bearer <token>` salvo health):
//   GET  /api/health          → { ok: true }
//   GET  /api/data            → { updatedAt, data }  | 404 si todavía no hay nada
//   PUT  /api/data            → body { updatedAt, data, force? }
//                               200 { updatedAt }  |  409 { error:"conflict", updatedAt, data }
//
// Si existe dist/ (npm run build), también sirve la app estática en "/",
// así un solo proceso publica la app completa.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes } from "node:crypto";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_STORE = join(ROOT, "server", "store", "data.json");
const DIST = join(ROOT, "dist");
const MAX_BODY = 5 * 1024 * 1024; // 5 MB

const MIME = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json",
    ".map": "application/json; charset=utf-8",
    ".ico": "image/x-icon"
};

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function readStore(storeFile) {
    try {
        const parsed = JSON.parse(readFileSync(storeFile, "utf8"));
        if (parsed && typeof parsed.data === "object" && typeof parsed.updatedAt === "string") return parsed;
    } catch {
        // archivo inexistente o corrupto: se trata como "sin datos"
    }
    return null;
}

function writeStore(storeFile, value) {
    mkdirSync(dirname(storeFile), { recursive: true });
    const tmp = storeFile + ".tmp";
    writeFileSync(tmp, JSON.stringify(value, null, 2), "utf8");
    renameSync(tmp, storeFile); // escritura atómica
}

function sendJson(res, status, body, extra = {}) {
    const payload = Buffer.from(JSON.stringify(body));
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": payload.length,
        ...CORS,
        ...extra
    });
    res.end(payload);
}

function readBody(req) {
    return new Promise((resolvePromise, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size > MAX_BODY) {
                reject(Object.assign(new Error("cuerpo demasiado grande"), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            try {
                resolvePromise(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : null);
            } catch {
                reject(Object.assign(new Error("JSON inválido"), { status: 400 }));
            }
        });
        req.on("error", reject);
    });
}

function isValidData(data) {
    return !!data &&
        typeof data === "object" &&
        Array.isArray(data.habits) &&
        !!data.entries &&
        typeof data.entries === "object" &&
        !Array.isArray(data.entries) &&
        !!data.settings &&
        typeof data.settings === "object";
}

function serveStatic(req, res, pathname) {
    if (!existsSync(DIST)) return false;
    const rel = normalize(pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""));
    const file = resolve(DIST, rel);
    if (!file.startsWith(resolve(DIST))) {
        sendJson(res, 403, { error: "forbidden" });
        return true;
    }
    if (existsSync(file) && statSync(file).isFile()) {
        const body = readFileSync(file);
        res.writeHead(200, {
            "Content-Type": MIME[extname(file).toLowerCase()] || "application/octet-stream",
            "Content-Length": body.length,
            ...CORS
        });
        res.end(body);
        return true;
    }
    // SPA fallback
    const index = join(DIST, "index.html");
    if (existsSync(index)) {
        const body = readFileSync(index);
        res.writeHead(200, { "Content-Type": MIME[".html"], "Content-Length": body.length, ...CORS });
        res.end(body);
        return true;
    }
    return false;
}

/**
 * Crea el servidor (sin escucharlo), para poder usarlo en las pruebas.
 * @param {{ token: string, storeFile?: string }} options
 */
export function createAppServer({ token, storeFile = DEFAULT_STORE }) {
    return createServer(async (req, res) => {
        const url = new URL(req.url || "/", "http://localhost");
        const pathname = url.pathname;

        if (req.method === "OPTIONS") {
            res.writeHead(204, CORS);
            res.end();
            return;
        }

        if (!pathname.startsWith("/api/")) {
            if (req.method === "GET" && serveStatic(req, res, pathname)) return;
            sendJson(res, 404, { error: "not-found" });
            return;
        }

        if (pathname === "/api/health") {
            sendJson(res, 200, { ok: true, name: "track-sync" });
            return;
        }

        const authorized = req.headers.authorization === `Bearer ${token}`;
        if (!authorized) {
            sendJson(res, 401, { error: "unauthorized", detail: "Falta o es incorrecto el token." });
            return;
        }

        if (pathname !== "/api/data") {
            sendJson(res, 404, { error: "not-found" });
            return;
        }

        try {
            if (req.method === "GET") {
                const stored = readStore(storeFile);
                if (!stored) {
                    sendJson(res, 404, { error: "no-data" });
                    return;
                }
                sendJson(res, 200, stored);
                return;
            }

            if (req.method === "PUT") {
                const body = await readBody(req);
                if (!body || typeof body !== "object" || !isValidData(body.data)) {
                    sendJson(res, 400, { error: "bad-data", detail: "El payload no tiene el formato de un backup." });
                    return;
                }
                const stored = readStore(storeFile);
                if (stored && body.force !== true && body.updatedAt !== stored.updatedAt) {
                    sendJson(res, 409, {
                        error: "conflict",
                        updatedAt: stored.updatedAt,
                        data: stored.data
                    });
                    return;
                }
                const updatedAt = new Date().toISOString();
                writeStore(storeFile, { updatedAt, data: body.data });
                sendJson(res, 200, { updatedAt });
                return;
            }

            sendJson(res, 405, { error: "method-not-allowed" });
        } catch (err) {
            sendJson(res, err && err.status ? err.status : 500, { error: "server-error", detail: String(err && err.message) });
        }
    });
}

// Arranca solo si se ejecutó este archivo (no al importarlo desde las pruebas).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
    const token = process.env.TRACK_TOKEN || randomBytes(16).toString("hex");
    const port = Number(process.env.PORT || 8787);
    const storeFile = process.env.STORE_FILE || DEFAULT_STORE;

    createAppServer({ token, storeFile }).listen(port, () => {
        console.log(`Seguimiento API escuchando en http://localhost:${port}`);
        console.log(`  token: ${token}`);
        console.log(`  datos: ${storeFile}`);
        if (!existsSync(DIST)) {
            console.log("  (no hay dist/: corré `npm run build` para que también sirva la app)");
        } else {
            console.log("  sirviendo la app de dist/ en /");
        }
        if (!process.env.TRACK_TOKEN) {
            console.log("\n  ⚠ TRACK_TOKEN no estaba definido: se generó uno. Copialo en la app");
            console.log("    y reiniciá con TRACK_TOKEN=... para que no cambie al próximo arranque.");
        }
    });
}
