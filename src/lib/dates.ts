export const MONTH_NAMES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

export const WEEKDAY_NAMES = [
    "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"
];

export function pad(n: number): string {
    return n < 10 ? "0" + n : String(n);
}

export function fmtDate(d: Date): string {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}

export function parseDate(s: string): Date {
    const p = s.split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}

export function addDays(s: string, n: number): string {
    const d = parseDate(s);
    d.setDate(d.getDate() + n);
    return fmtDate(d);
}

export function todayStr(): string {
    return fmtDate(new Date());
}

export function monthKey(dateStr: string): string {
    return dateStr.slice(0, 7);
}

export function shortDateLabel(dateStr: string): string {
    const d = parseDate(dateStr);
    return pad(d.getDate()) + " " + MONTH_NAMES[d.getMonth()].slice(0, 3);
}

export function uid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID().slice(0, 8);
    }
    return Math.random().toString(36).slice(2, 10);
}
