import { useEffect, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { MONTH_NAMES, WEEKDAY_NAMES, addDays, pad, parseDate, todayStr } from "../lib/dates.js";
import { hasAnyData } from "../lib/stats.js";
import { emptyEntry } from "../lib/storage.js";
import type { AppData, DayEntry, Habit } from "../types.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

function parseWeight(raw: string): number | null {
    const cleaned = String(raw).trim().replace(",", ".");
    if (cleaned === "") return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

function parsePhoneMinutes(hours: string, minutes: string): number | null {
    const h = String(hours).trim();
    const m = String(minutes).trim();
    if (h === "" && m === "") return null;
    const total = (parseInt(h || "0", 10) || 0) * 60 + (parseInt(m || "0", 10) || 0);
    return Math.max(0, Math.round(total));
}

interface DayMetricsProps {
    entry: DayEntry;
    onWeight: (weight: number | null) => void;
    onPhoneMinutes: (minutes: number | null) => void;
}

/** Métricas del día con estado local: se guardan al salir del campo (blur) o con Enter. */
function DayMetrics({ entry, onWeight, onPhoneMinutes }: DayMetricsProps) {
    const [weight, setWeight] = useState(entry.weight == null ? "" : String(entry.weight));
    const [hours, setHours] = useState(entry.phoneMinutes == null ? "" : String(Math.floor(entry.phoneMinutes / 60)));
    const [minutes, setMinutes] = useState(entry.phoneMinutes == null ? "" : pad(entry.phoneMinutes % 60));

    const commitWeight = () => {
        const value = parseWeight(weight);
        onWeight(value);
        setWeight(value == null ? "" : String(value));
    };

    const commitPhone = () => {
        const total = parsePhoneMinutes(hours, minutes);
        onPhoneMinutes(total);
        setHours(total == null ? "" : String(Math.floor(total / 60)));
        setMinutes(total == null ? "" : pad(total % 60));
    };

    const handleEnter = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") event.currentTarget.blur();
    };

    return (
        <>
            <div className="section-label">Peso y pantalla</div>
            <div className="metric-grid">
                <div className="metric-card">
                    <label htmlFor="weight-input">Peso</label>
                    <div className="metric-inputs">
                        <input
                            id="weight-input"
                            className="metric-w num"
                            type="text"
                            inputMode="decimal"
                            placeholder="—"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            onBlur={commitWeight}
                            onKeyDown={handleEnter}
                        />
                        <span className="unit">kg</span>
                    </div>
                </div>
                <div className="metric-card">
                    <label htmlFor="phone-h-input">Tiempo de celular</label>
                    <div className="metric-inputs">
                        <input
                            id="phone-h-input"
                            className="metric-hm num"
                            type="number"
                            min="0"
                            inputMode="numeric"
                            placeholder="0"
                            value={hours}
                            onChange={(e) => setHours(e.target.value)}
                            onBlur={commitPhone}
                            onKeyDown={handleEnter}
                        />
                        <span className="colon">:</span>
                        <input
                            id="phone-m-input"
                            className="metric-hm num"
                            type="number"
                            min="0"
                            max="59"
                            inputMode="numeric"
                            placeholder="00"
                            value={minutes}
                            onChange={(e) => setMinutes(e.target.value)}
                            onBlur={commitPhone}
                            onKeyDown={handleEnter}
                        />
                    </div>
                </div>
            </div>
        </>
    );
}

export interface HoyTabProps {
    data: AppData;
    date: string;
    onNavigate: (delta: number | "today") => void;
    onToggleHabit: (date: string, habitId: string) => void;
    onWeight: (date: string, weight: number | null) => void;
    onPhoneMinutes: (date: string, minutes: number | null) => void;
    onDeleteDay: (date: string) => void;
    onGoToHabits: () => void;
}

export default function HoyTab({
    data,
    date,
    onNavigate,
    onToggleHabit,
    onWeight,
    onPhoneMinutes,
    onDeleteDay,
    onGoToHabits
}: HoyTabProps) {
    const entry = data.entries[date] || emptyEntry();
    const day = parseDate(date);
    const isToday = date === todayStr();

    const [confirmingDelete, setConfirmingDelete] = useState(false);

    // Flechas ←/→ para cambiar de día (y "t" para volver a hoy), con teclado de compu.
    useEffect(() => {
        if (confirmingDelete) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            const el = event.target as HTMLElement | null;
            const tag = el && el.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || (el && el.isContentEditable)) return;
            if (event.key === "ArrowLeft") onNavigate(-1);
            else if (event.key === "ArrowRight") onNavigate(1);
            else if (event.key === "t" || event.key === "T") onNavigate("today");
            else return;
            event.preventDefault();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [confirmingDelete, onNavigate]);

    let relabel = "";
    if (isToday) relabel = "Hoy";
    else if (date === addDays(todayStr(), -1)) relabel = "Ayer";
    else if (date === addDays(todayStr(), 1)) relabel = "Mañana";

    const goodHabits = data.habits.filter((h) => h.type === "good");
    const badHabits = data.habits.filter((h) => h.type === "bad");

    const habitRow = (habit: Habit) => {
        const on = !!entry.habits[habit.id];
        return (
            <button
                key={habit.id}
                type="button"
                className={`habit-row ${habit.type}${on ? " on" : ""}`}
                aria-pressed={on}
                onClick={() => onToggleHabit(date, habit.id)}
            >
                <span className="habit-check" aria-hidden="true">{on ? "✓" : ""}</span>
                <span className="habit-name">{habit.name}</span>
            </button>
        );
    };

    let habitsSection: ReactNode;
    if (data.habits.length === 0) {
        habitsSection = (
            <div className="empty-note">
                Todavía no cargaste hábitos.{" "}
                <button type="button" className="text-btn" onClick={onGoToHabits}>
                    Andá a la pestaña Hábitos
                </button>{" "}
                para sumar los tuyos.
            </div>
        );
    } else {
        habitsSection = (
            <>
                {goodHabits.length > 0 && (
                    <>
                        <div className="section-label"><span style={{ color: "var(--good)" }}>●</span> Quiero hacer</div>
                        <div className="habit-grid">{goodHabits.map(habitRow)}</div>
                    </>
                )}
                {badHabits.length > 0 && (
                    <>
                        <div className="section-label"><span style={{ color: "var(--bad)" }}>●</span> Quiero evitar</div>
                        <div className="habit-grid">{badHabits.map(habitRow)}</div>
                    </>
                )}
            </>
        );
    }

    const dayLabel = `${WEEKDAY_NAMES[day.getDay()]} ${day.getDate()} de ${MONTH_NAMES[day.getMonth()]}`;

    return (
        <>
            <div className="day-card">
                <div className="day-nav">
                    <button type="button" data-nav="-1" aria-label="Día anterior" onClick={() => onNavigate(-1)}>‹</button>
                    <div className="day-main">
                        <div className="day-weekday">{WEEKDAY_NAMES[day.getDay()]}</div>
                        <div className="day-date num">{pad(day.getDate())} {MONTH_NAMES[day.getMonth()].slice(0, 3)}</div>
                        <div className="day-relabel">
                            <button type="button" className="pill-btn" onClick={() => onNavigate("today")}>
                                {relabel ? `${relabel}${isToday ? "" : " · ir a hoy"}` : "Ir a hoy"}
                            </button>
                        </div>
                    </div>
                    <button type="button" data-nav="1" aria-label="Día siguiente" onClick={() => onNavigate(1)}>›</button>
                </div>
                {hasAnyData(entry) && (
                    <div className="day-actions">
                        <button type="button" className="text-btn" onClick={() => setConfirmingDelete(true)}>
                            Eliminar datos de este día
                        </button>
                    </div>
                )}
            </div>

            <DayMetrics
                key={date}
                entry={entry}
                onWeight={(weight) => onWeight(date, weight)}
                onPhoneMinutes={(minutes) => onPhoneMinutes(date, minutes)}
            />

            {habitsSection}

            <ConfirmDialog
                open={confirmingDelete}
                title="Eliminar datos de este día"
                message={`¿Eliminar todos los datos del ${dayLabel}?`}
                confirmLabel="Eliminar"
                destructive
                onConfirm={() => {
                    setConfirmingDelete(false);
                    onDeleteDay(date);
                }}
                onCancel={() => setConfirmingDelete(false)}
            />
        </>
    );
}
