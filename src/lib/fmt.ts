import { pad } from "./dates.js";

/** Horas:minutos a partir de minutos totales (acepta promedios con decimales). */
export function fmtHM(minutes: number): string {
    const total = Math.max(0, Math.round(minutes));
    return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

export type DiffClass = "pos" | "neg" | "zero";

/** Clase visual para una diferencia: "pos" (por encima), "neg" o "zero" (dentro de la tolerancia). */
export function diffClass(diff: number, tolerance: number): DiffClass {
    if (Math.abs(diff) < tolerance) return "zero";
    return diff > 0 ? "pos" : "neg";
}
