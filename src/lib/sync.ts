import { normalizeData } from "./storage.js";
import type { AppData } from "../types.js";

const SYNC_KEY = "app-sync-v1";
const TIMEOUT_MS = 15000;

/** Conexión guardada con el servidor propio (no se incluye en los backups). */
export interface SyncConfig {
    url: string;
    token: string;
    /** Último `updatedAt` que conocemos: sirve para detectar conflictos. */
    updatedAt?: string;
    /** Cuándo se hizo la última operación exitosa. */
    lastSync?: string;
}

export interface PullResult {
    data: AppData;
    updatedAt: string;
}

export class SyncError extends Error {
    readonly status: number;

    constructor(message: string, status = 0) {
        super(message);
        this.name = "SyncError";
        this.status = status;
    }
}

/** El servidor tiene datos más recientes que los locales: hay que resolverlo. */
export class SyncConflictError extends SyncError {
    readonly serverData: AppData;
    readonly serverUpdatedAt: string;

    constructor(serverData: AppData, serverUpdatedAt: string) {
        super("El servidor tiene datos más recientes.", 409);
        this.name = "SyncConflictError";
        this.serverData = serverData;
        this.serverUpdatedAt = serverUpdatedAt;
    }
}

function endpoint(baseUrl: string): string {
    return baseUrl.trim().replace(/\/+$/, "") + "/api/data";
}

function authHeaders(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}

async function request(config: SyncConfig, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
        res = await fetch(endpoint(config.url), {
            ...init,
            headers: authHeaders(config.token),
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
    } catch {
        throw new SyncError("No se pudo conectar con el servidor. Revisá la URL y tu conexión.");
    }
    if (res.status === 401) throw new SyncError("Token incorrecto.", 401);
    return res;
}

function failByStatus(res: Response, fallback: string): never {
    throw new SyncError(`${fallback} (el servidor respondió ${res.status}).`, res.status);
}

/** Descarga los datos del servidor (normalizados, como si fuera un backup). */
export async function pullData(config: SyncConfig): Promise<PullResult> {
    const res = await request(config, { method: "GET" });
    if (res.status === 404) throw new SyncError("El servidor todavía no tiene datos guardados.", 404);
    if (!res.ok) failByStatus(res, "No se pudieron descargar los datos");

    const body = (await res.json()) as { updatedAt?: unknown; data?: unknown };
    if (typeof body.updatedAt !== "string" || !body.data) {
        throw new SyncError("El servidor devolvió un formato desconocido.");
    }
    return { data: normalizeData(body.data), updatedAt: body.updatedAt };
}

/**
 * Sube los datos. Lanza `SyncConflictError` si el servidor tiene una versión
 * más nueva (hay que volver a pedirle al usuario qué hacer).
 */
export async function pushData(
    config: SyncConfig,
    data: AppData,
    options: { force?: boolean } = {}
): Promise<string> {
    const res = await request(config, {
        method: "PUT",
        body: JSON.stringify({ updatedAt: config.updatedAt, data, force: options.force === true })
    });

    if (res.status === 409) {
        const body = (await res.json()) as { updatedAt?: unknown; data?: unknown };
        if (typeof body.updatedAt === "string" && body.data) {
            throw new SyncConflictError(normalizeData(body.data), body.updatedAt);
        }
        throw new SyncError("Conflicto de versión en el servidor.", 409);
    }
    if (!res.ok) failByStatus(res, "No se pudieron subir los datos");

    const body = (await res.json()) as { updatedAt?: unknown };
    if (typeof body.updatedAt !== "string") throw new SyncError("El servidor devolvió un formato desconocido.");
    return body.updatedAt;
}

// --- configuración guardada en el navegador ---

export function loadSyncConfig(): SyncConfig {
    const empty: SyncConfig = { url: "", token: "" };
    if (typeof localStorage === "undefined") return empty;
    try {
        const raw = localStorage.getItem(SYNC_KEY);
        if (!raw) return empty;
        const parsed = JSON.parse(raw) as Partial<SyncConfig>;
        return {
            url: typeof parsed.url === "string" ? parsed.url : "",
            token: typeof parsed.token === "string" ? parsed.token : "",
            updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
            lastSync: typeof parsed.lastSync === "string" ? parsed.lastSync : undefined
        };
    } catch {
        return empty;
    }
}

export function saveSyncConfig(config: SyncConfig): void {
    if (typeof localStorage === "undefined") return;
    try {
        localStorage.setItem(SYNC_KEY, JSON.stringify(config));
    } catch (err) {
        console.error("No se pudo guardar la configuración de sincronización:", err);
    }
}
