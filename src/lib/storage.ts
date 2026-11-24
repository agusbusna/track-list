import type { AppData, Habit, DayEntry } from "../types.js";
import { todayStr } from "./dates.js";

export const STORAGE_KEY = "app-data-v1";

export function defaultData(): AppData {
    return {
        habits: [
            { id: "ejercicio", name: "Ejercicio", type: "good" },
            { id: "tesis", name: "Tesis", type: "good" },
            { id: "leer", name: "Leer", type: "good" },
            { id: "escribir", name: "Escribir", type: "good" },
            { id: "dibujar", name: "Dibujar", type: "good" },
            { id: "delivery", name: "Delivery", type: "bad" },
            { id: "alcohol", name: "Alcohol", type: "bad" }
        ],
        settings: { weightGoal: 100, phoneGoal: 180 },
        entries: {}
    };
}

export function emptyEntry(): DayEntry {
    return { habits: {}, weight: null, phoneMinutes: null };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** `null` y `undefined` respetan el valor de relleno; el resto se numera si se puede. */
function toNumber(value: unknown, fallback: number): number;
function toNumber(value: unknown, fallback: null): null;
function toNumber(value: unknown, fallback: number | null): number | null {
    if (value == null) return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** Lo mínimo que necesita `normalizeData` para leer un JSON desconocido. */
interface RawData {
    habits?: Array<{ id?: unknown; name?: unknown; type?: unknown } | null> | unknown;
    settings?: Record<string, unknown> | unknown;
    entries?: Record<string, unknown> | unknown;
}

/** Normaliza lo que venga de localStorage o de un archivo importado. */
export function normalizeData(raw: unknown): AppData {
    const base = defaultData();
    if (!raw || typeof raw !== "object") return base;
    const input = raw as RawData;

    let habits: Habit[];
    if (Array.isArray(input.habits)) {
        habits = [];
        for (const h of input.habits) {
            if (!h || typeof h !== "object") continue;
            if (h.id == null || typeof h.name !== "string" || h.name.trim() === "") continue;
            habits.push({
                id: String(h.id),
                name: h.name.trim().slice(0, 60),
                type: h.type === "bad" ? "bad" : "good"
            });
        }
    } else {
        habits = base.habits;
    }

    const rawSettings = input.settings && typeof input.settings === "object"
        ? input.settings as Record<string, unknown>
        : {};
    const settings = {
        weightGoal: toNumber(rawSettings.weightGoal, base.settings.weightGoal),
        phoneGoal: Math.max(0, Math.round(toNumber(rawSettings.phoneGoal, base.settings.phoneGoal)))
    };

    const entries: Record<string, DayEntry> = {};
    if (input.entries && typeof input.entries === "object") {
        for (const [date, e] of Object.entries(input.entries)) {
            if (!DATE_RE.test(date) || !e || typeof e !== "object") continue;
            const rawEntry = e as { habits?: unknown; weight?: unknown; phoneMinutes?: unknown };

            const habitsEntry: Record<string, boolean> = {};
            if (rawEntry.habits && typeof rawEntry.habits === "object") {
                for (const [hid, on] of Object.entries(rawEntry.habits as Record<string, unknown>)) {
                    habitsEntry[hid] = !!on;
                }
            }

            entries[date] = {
                habits: habitsEntry,
                // ojo: `weight: null` tiene que seguir siendo null (Number(null) === 0)
                weight: toNumber(rawEntry.weight, null),
                phoneMinutes: rawEntry.phoneMinutes == null
                    ? null
                    : Math.max(0, Math.round(toNumber(rawEntry.phoneMinutes, 0)))
            };
        }
    }

    return { habits, settings, entries };
}

/**
 * Quita un hábito de todos los días y descarga los días que quedan sin datos.
 * Así no quedan flags huérfanos en el historial.
 */
export function removeHabitFromEntries(
    entries: Record<string, DayEntry>,
    habitId: string
): Record<string, DayEntry> {
    const next: Record<string, DayEntry> = {};
    for (const [date, e] of Object.entries(entries)) {
        if (!Object.prototype.hasOwnProperty.call(e.habits, habitId)) {
            next[date] = e;
            continue;
        }
        const habits = { ...e.habits };
        delete habits[habitId];
        const entry: DayEntry = { ...e, habits };
        if (entry.weight == null && entry.phoneMinutes == null && Object.keys(habits).length === 0) continue;
        next[date] = entry;
    }
    return next;
}

/**
 * Se avisa cuando los datos cambiaron desde otra pestaña o ventana del mismo navegador.
 * Devuelve la función para desuscribirse.
 */
export function subscribeToExternalChanges(onChange: () => void): () => void {
    const onStorage = (event: StorageEvent) => {
        // key === null significa que se limpió todo el storage
        if (event.key !== null && event.key !== STORAGE_KEY) return;
        onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
}

export function loadData(): AppData {
    if (typeof localStorage === "undefined") return defaultData();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultData();
        return normalizeData(JSON.parse(raw));
    } catch (err) {
        console.error("No se pudieron leer los datos, se usan los valores iniciales:", err);
        return defaultData();
    }
}

export function saveData(data: AppData): boolean {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (err) {
        console.error("No se pudo guardar:", err);
        return false;
    }
}

export function downloadJson(data: AppData): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seguimiento-" + todayStr() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Lee un archivo .json y devuelve datos normalizados (o lanza con mensaje en español). */
export async function readDataFile(file: File): Promise<AppData> {
    const text = await file.text();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("El archivo no es un JSON válido.");
    }
    if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as RawData).habits) ||
        !(parsed as RawData).entries ||
        typeof (parsed as RawData).entries !== "object"
    ) {
        throw new Error("El archivo no tiene el formato de un backup de Seguimiento.");
    }
    return normalizeData(parsed);
}
