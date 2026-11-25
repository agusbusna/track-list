// Pruebas de integración del servidor de sincronización + el cliente de la app.
// Levanta el servidor real en un puerto efímero y habla con él por fetch.
import { createServer } from "vite";
import { createAppServer } from "../server/index.mjs";
import assert from "node:assert";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TOKEN = "token-de-prueba";
const tmp = mkdtempSync(join(tmpdir(), "track-sync-"));
const storeFile = join(tmp, "data.json");

const appServer = createAppServer({ token: TOKEN, storeFile });
await new Promise((resolve) => appServer.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${appServer.address().port}`;

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });

try {
    const { pullData, pushData, SyncError, SyncConflictError } =
        await vite.ssrLoadModule("/src/lib/sync.ts");

    const goodConfig = { url, token: TOKEN };
    const data = {
        habits: [{ id: "leer", name: "Leer", type: "good" }],
        settings: { weightGoal: 75, phoneGoal: 120 },
        entries: {
            "2026-10-01": { habits: { leer: true }, weight: 70.5, phoneMinutes: 90 },
            "2026-10-02": { habits: {}, weight: null, phoneMinutes: null }
        }
    };

    // --- salud del servidor ---
    const health = await fetch(`${url}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    // --- todavía no hay datos ---
    await assert.rejects(
        () => pullData(goodConfig),
        (err) => err instanceof SyncError && err.status === 404,
        "sin datos en el servidor debería dar 404"
    );

    // --- token equivocado ---
    await assert.rejects(
        () => pushData({ url, token: "otro" }, data),
        (err) => err instanceof SyncError && err.status === 401,
        "con token incorrecto debería dar 401"
    );

    // --- primera subida ---
    const updatedAt = await pushData(goodConfig, data);
    assert.ok(typeof updatedAt === "string" && updatedAt.length > 0, "debería devolver el updatedAt");

    // --- descarga ---
    const pulled = await pullData(goodConfig);
    assert.equal(pulled.updatedAt, updatedAt);
    assert.deepEqual(pulled.data, data, "los datos deberían volver idénticos");
    assert.equal(pulled.data.entries["2026-10-02"].weight, null, "el peso nulo tiene que seguir nulo");

    // --- conflicto: quien no conoce el updatedAt del servidor recibe 409 ---
    const nuevo = { ...data, settings: { weightGoal: 70, phoneGoal: 100 } };
    await assert.rejects(
        () => pushData({ ...goodConfig, updatedAt: "2020-01-01T00:00:00.000Z" }, nuevo),
        (err) => {
            assert.ok(err instanceof SyncConflictError, "debería ser un conflicto");
            assert.equal(err.serverData.settings.weightGoal, 75, "trae los datos del servidor");
            return true;
        },
        "con una versión vieja debería dar conflicto"
    );

    // --- subida forzada (el usuario eligió quedarse con lo suyo) ---
    const forced = await pushData({ ...goodConfig, updatedAt: "2020-01-01T00:00:00.000Z" }, nuevo, { force: true });
    assert.notEqual(forced, updatedAt, "el updatedAt debería cambiar");
    const pulled2 = await pullData(goodConfig);
    assert.equal(pulled2.data.settings.weightGoal, 70, "la subida forzada tiene que quedar guardada");

    // --- payload inválido ---
    const bad = await fetch(`${url}/api/data`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ data: { habits: "no" } })
    });
    assert.equal(bad.status, 400, "un payload inválido debería dar 400");

    // --- CORS para que la app pueda llamarla desde otro origen ---
    const preflight = await fetch(`${url}/api/data`, { method: "OPTIONS" });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "*");

    console.log("✔ El servidor de sincronización pasa sus pruebas");
} finally {
    await vite.close();
    await new Promise((resolve) => appServer.close(resolve));
    rmSync(tmp, { recursive: true, force: true });
}
