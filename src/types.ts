/** Tipos compartidos por toda la app. */

export type HabitType = "good" | "bad";

export interface Habit {
    id: string;
    name: string;
    type: HabitType;
}

/** Registro de un día: hábitos tildados, peso y tiempo de celular. */
export interface DayEntry {
    habits: Record<string, boolean>;
    weight: number | null;
    phoneMinutes: number | null;
}

export interface Settings {
    weightGoal: number;
    phoneGoal: number;
}

export interface AppData {
    habits: Habit[];
    settings: Settings;
    entries: Record<string, DayEntry>;
}

/** Promedio de un mes con datos. */
export interface MonthlyStat {
    key: string;
    label: string;
    avgWeight: number | null;
    avgPhone: number | null;
}

export interface WeightPoint {
    date: string;
    w: number;
}

export type TabId = "hoy" | "progreso" | "habitos";

export interface Feedback {
    kind: "ok" | "err";
    text: string;
}
