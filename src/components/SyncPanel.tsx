import { useState } from "react";
import type { AppData } from "../types.js";
import {
    SyncConflictError,
    loadSyncConfig,
    pullData,
    pushData,
    saveSyncConfig
} from "../lib/sync.js";
import type { SyncConfig } from "../lib/sync.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

interface Status {
    kind: "ok" | "err";
    text: string;
}

interface SyncPanelProps {
    data: AppData;
    onImport: (data: AppData) => void;
}

function errorMessage(err: unknown): string {
    return err instanceof Error && err.message ? err.message : "Error desconocido.";
}

function formatMoment(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/** Conexión con el servidor propio: URL + token, con subida y descarga manuales. */
export default function SyncPanel({ data, onImport }: SyncPanelProps) {
    const [config, setConfig] = useState<SyncConfig>(() => loadSyncConfig());
    const [url, setUrl] = useState(config.url);
    const [token, setToken] = useState(config.token);
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    const [conflict, setConflict] = useState<{ data: AppData; updatedAt: string } | null>(null);

    const persist = (next: SyncConfig) => {
        setConfig(next);
        saveSyncConfig(next);
    };

    /** Guarda lo que esté en los campos y devuelve la config si está completa. */
    const currentConfig = (): SyncConfig | null => {
        const next: SyncConfig = { ...config, url: url.trim(), token: token.trim() };
        persist(next);
        if (!next.url) {
            setStatus({ kind: "err", text: "Cargá la URL del servidor." });
            return null;
        }
        if (!next.token) {
            setStatus({ kind: "err", text: "Cargá el token de acceso." });
            return null;
        }
        return next;
    };

    const handleSaveConnection = () => {
        const next: SyncConfig = { ...config, url: url.trim(), token: token.trim() };
        persist(next);
        setStatus({ kind: "ok", text: "Conexión guardada." });
    };

    const run = async (work: () => Promise<void>) => {
        setBusy(true);
        setStatus(null);
        try {
            await work();
        } catch (err) {
            setStatus({ kind: "err", text: errorMessage(err) });
        } finally {
            setBusy(false);
        }
    };

    const handlePull = () => {
        const cfg = currentConfig();
        if (!cfg) return;
        run(async () => {
            const result = await pullData(cfg);
            persist({ ...cfg, updatedAt: result.updatedAt, lastSync: new Date().toISOString() });
            onImport(result.data);
            setStatus({ kind: "ok", text: "Datos descargados del servidor." });
        });
    };

    const doPush = (cfg: SyncConfig, force = false) => {
        run(async () => {
            try {
                const updatedAt = await pushData(cfg, data, { force });
                persist({ ...cfg, updatedAt, lastSync: new Date().toISOString() });
                setStatus({ kind: "ok", text: "Datos subidos al servidor." });
            } catch (err) {
                if (err instanceof SyncConflictError) {
                    setConflict({ data: err.serverData, updatedAt: err.serverUpdatedAt });
                    setStatus({ kind: "err", text: "El servidor tiene una versión más reciente: elegí qué hacer." });
                    return;
                }
                throw err;
            }
        });
    };

    const handlePush = () => {
        const cfg = currentConfig();
        if (cfg) doPush(cfg);
    };

    // Resolución del conflicto: o uso la del servidor, o me quedo con la mía y la subo.
    const useServerData = () => {
        const c = conflict;
        setConflict(null);
        if (!c) return;
        onImport(c.data);
        persist({ ...config, updatedAt: c.updatedAt, lastSync: new Date().toISOString() });
        setStatus({ kind: "ok", text: "Se usaron los datos del servidor." });
    };

    const keepMineAndPush = () => {
        const c = conflict;
        setConflict(null);
        if (!c) return;
        const cfg: SyncConfig = { ...config, updatedAt: c.updatedAt };
        persist(cfg);
        doPush(cfg, true);
    };

    return (
        <>
            <div className="section-label">Sincronización</div>
            <div className="form-card">
                <h3>Servidor propio</h3>
                <div className="form-row">
                    <input
                        type="url"
                        inputMode="url"
                        placeholder="https://mi-servidor.com"
                        aria-label="URL del servidor"
                        autoComplete="off"
                        spellCheck={false}
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <input
                        type="password"
                        placeholder="Token de acceso"
                        aria-label="Token de acceso"
                        autoComplete="off"
                        spellCheck={false}
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                    />
                </div>
                <div className="form-row">
                    <button type="button" className="data-btn" onClick={handleSaveConnection}>
                        Guardar conexión
                    </button>
                </div>

                <div className="form-row">
                    <button type="button" className="data-btn" disabled={busy} onClick={handlePull}>
                        Descargar del servidor
                    </button>
                    <button type="button" className="data-btn primary" disabled={busy} onClick={handlePush}>
                        Subir mis datos
                    </button>
                </div>

                {status && (
                    <p className={status.kind === "err" ? "form-error" : "data-note"} role="status">
                        {status.text}
                    </p>
                )}
                <p className="data-note">
                    Los datos viajan en JSON y solo quien tiene el token puede leerlos o escribirlos.
                    {" "}Última sincronización: {config.lastSync ? formatMoment(config.lastSync) : "nunca"}.
                </p>
                <p className="data-note">
                    Para tener un servidor: <code>npm run build &amp;&amp; TRACK_TOKEN=clave npm run server</code>.
                </p>
            </div>

            <ConfirmDialog
                open={!!conflict}
                title="Conflicto de sincronización"
                message={
                    conflict
                        ? `El servidor tiene datos más recientes (${formatMoment(conflict.updatedAt)}).\n\n` +
                          "¿Usás los del servidor (reemplazan los tuyos) o te quedás con los tuyos y los subís encima?"
                        : ""
                }
                confirmLabel="Usar los del servidor"
                cancelLabel="Mantener los míos"
                destructive
                onConfirm={useServerData}
                onCancel={keepMineAndPush}
                onDismiss={() => setConflict(null)}
            />
        </>
    );
}
