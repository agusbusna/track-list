import type { AppData, DayEntry, Habit, MonthlyStat, WeightPoint } from "../types.js";
import { MONTH_NAMES, addDays, monthKey, todayStr } from "./dates.js";

function average(nums: number[]): number | null {
    return nums.length ? nums.reduce((a, c) => a + c, 0) / nums.length : null;
}

/** Promedios de peso y celular de los últimos 6 meses con datos. */
export function computeMonthlyStats(data: AppData): MonthlyStat[] {
    const byMonth: Record<string, { weights: number[]; phones: number[] }> = {};
    for (const [date, e] of Object.entries(data.entries)) {
        const mk = monthKey(date);
        if (!byMonth[mk]) byMonth[mk] = { weights: [], phones: [] };
        if (e.weight != null) byMonth[mk].weights.push(e.weight);
        if (e.phoneMinutes != null) byMonth[mk].phones.push(e.phoneMinutes);
    }

    return Object.keys(byMonth).sort().slice(-6).map((mk) => {
        const b = byMonth[mk];
        const monthIndex = Number(mk.split("-")[1]) - 1;
        const name = MONTH_NAMES[monthIndex] || mk;
        return {
            key: mk,
            label: name.charAt(0).toUpperCase() + name.slice(1),
            avgWeight: average(b.weights),
            avgPhone: average(b.phones)
        };
    });
}

/** Pares {date, w} con los días que tienen peso cargado. */
export function weightSeries(data: AppData): WeightPoint[] {
    return Object.keys(data.entries)
        .sort()
        .map((date) => ({ date, w: data.entries[date].weight }))
        .filter((p): p is WeightPoint => p.w != null);
}

/**
 * Racha actual: días seguidos cumpliendo el hábito (o evitándolo, si es "malo").
 * Si hoy todavía no se registró el hábito, la racha se mide desde ayer para no
 * cortarla a mitad del día.
 */
export function habitCurrentStreak(data: AppData, habit: Habit): number {
    let count = 0;
    let d = todayStr();
    const today = data.entries[d];
    const registeredToday = !!today && Object.prototype.hasOwnProperty.call(today.habits, habit.id);
    if (!today || (habit.type === "good" && !registeredToday)) d = addDays(d, -1);
    while (true) {
        const e = data.entries[d];
        if (!e) break;
        const done = !!e.habits[habit.id];
        const ok = habit.type === "good" ? done : !done;
        if (!ok) break;
        count++;
        d = addDays(d, -1);
    }
    return count;
}

/**
 * % de días del mes en los que el hábito se registró bien (0-100) o null.
 *
 * Se cuentan los días con registro de cualquier dato (peso, celular o hábitos):
 * para los hábitos buenos, un día registrado sin tildar cuenta como incumplido;
 * para los malos, un día sin tildar cuenta como evitado (solo se tildan cuando
 * ocurren). Si el mes no tiene ningún día con datos, devuelve null ("sin datos").
 */
export function habitMonthRate(data: AppData, habit: Habit): number | null {
    const mk = monthKey(todayStr());
    let total = 0;
    let hit = 0;
    for (const [date, e] of Object.entries(data.entries)) {
        if (monthKey(date) !== mk) continue;
        const hasHabitData = Object.prototype.hasOwnProperty.call(e.habits, habit.id);
        if (!hasHabitData && e.weight == null && e.phoneMinutes == null) continue;
        total++;
        const done = !!e.habits[habit.id];
        if (habit.type === "good" ? done : !done) hit++;
    }
    return total ? Math.round((hit / total) * 100) : null;
}

export function hasAnyData(entry: DayEntry | undefined): boolean {
    if (!entry) return false;
    return entry.weight != null || entry.phoneMinutes != null || Object.keys(entry.habits).length > 0;
}
