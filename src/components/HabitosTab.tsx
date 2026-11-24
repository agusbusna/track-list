import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { pad } from "../lib/dates.js";
import { readDataFile } from "../lib/storage.js";
import type { AppData, Feedback, Habit, HabitType, Settings } from "../types.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

function parseNumber(raw: string): number | null {
    const n = Number(String(raw).trim().replace(",", "."));
    return Number.isFinite(n) ? n : null;
}

interface HabitosTabProps {
    data: AppData;
    onAddHabit: (name: string, type: HabitType) => void;
    onDeleteHabit: (habitId: string) => void;
    onSetGoal: (key: keyof Settings, value: number) => void;
    onExport: () => void;
    onImport: (data: AppData) => void;
}

export default function HabitosTab({ data, onAddHabit, onDeleteHabit, onSetGoal, onExport, onImport }: HabitosTabProps) {
    const [name, setName] = useState("");
    const [typeChoice, setTypeChoice] = useState<HabitType>("good");
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
    const [pendingImport, setPendingImport] = useState<AppData | null>(null);

    const settings = data.settings;
    const fileRef = useRef<HTMLInputElement>(null);

    // Objetivos con estado local: se guardan al salir del campo.
    const [goalWeight, setGoalWeight] = useState(String(settings.weightGoal));
    const [goalHours, setGoalHours] = useState(String(Math.floor(settings.phoneGoal / 60)));
    const [goalMinutes, setGoalMinutes] = useState(pad(settings.phoneGoal % 60));

    const commitGoalWeight = () => {
        const n = parseNumber(goalWeight);
        if (n != null && n > 0) onSetGoal("weightGoal", n);
        setGoalWeight(String(settings.weightGoal));
    };

    const commitGoalPhone = () => {
        const h = parseInt(goalHours || "0", 10) || 0;
        const m = parseInt(goalMinutes || "0", 10) || 0;
        const total = Math.max(0, h * 60 + m);
        onSetGoal("phoneGoal", total);
        setGoalHours(String(Math.floor(total / 60)));
        setGoalMinutes(pad(total % 60));
    };

    const handleAdd = () => {
        const trimmed = name.trim();
        if (!trimmed) return;
        onAddHabit(trimmed, typeChoice);
        setName("");
        setFeedback(null);
    };

    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files && event.target.files[0];
        event.target.value = "";
        if (!file) return;
        try {
            const next = await readDataFile(file);
            setPendingImport(next);
        } catch (err) {
            setFeedback({
                kind: "err",
                text: err instanceof Error && err.message ? err.message : "No se pudo leer el archivo."
            });
        }
    };

    const confirmImport = () => {
        const next = pendingImport;
        setPendingImport(null);
        if (!next) return;
        onImport(next);
        setFeedback({ kind: "ok", text: "Datos importados correctamente." });
    };

    const confirmDeleteHabit = () => {
        const habit = habitToDelete;
        setHabitToDelete(null);
        if (habit) onDeleteHabit(habit.id);
    };

    const handleExportClick = () => {
        onExport();
        setFeedback({ kind: "ok", text: "Backup descargado." });
    };

    return (
        <>
            <div className="section-label">Agregar hábito</div>
            <div className="form-card">
                <div className="form-row">
                    <input
                        type="text"
                        placeholder="Nombre del hábito"
                        maxLength={30}
                        value={name}
                        aria-label="Nombre del hábito"
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    />
                    <div className="type-toggle">
                        <button
                            type="button"
                            data-t="good"
                            className={typeChoice === "good" ? "active" : ""}
                            aria-pressed={typeChoice === "good"}
                            onClick={() => setTypeChoice("good")}
                        >
                            Bien
                        </button>
                        <button
                            type="button"
                            data-t="bad"
                            className={typeChoice === "bad" ? "active" : ""}
                            aria-pressed={typeChoice === "bad"}
                            onClick={() => setTypeChoice("bad")}
                        >
                            Evitar
                        </button>
                    </div>
                </div>
                <button type="button" className="add-btn" disabled={!name.trim()} onClick={handleAdd}>
                    Agregar hábito
                </button>
            </div>

            <div className="section-label">Tus hábitos</div>
            {data.habits.length ? (
                data.habits.map((habit) => (
                    <div className="habit-manage-row" key={habit.id}>
                        <span className={`habit-dot ${habit.type}`} />
                        <div className="habit-name" style={{ flex: 1 }}>{habit.name}</div>
                        <button
                            type="button"
                            className="del-btn"
                            aria-label={`Eliminar ${habit.name}`}
                            onClick={() => setHabitToDelete(habit)}
                        >
                            ✕
                        </button>
                    </div>
                ))
            ) : (
                <div className="empty-note">Todavía no agregaste hábitos.</div>
            )}

            <div className="section-label">Objetivos</div>
            <div className="form-card">
                <h3>Peso objetivo</h3>
                <div className="metric-grid" style={{ marginBottom: 14 }}>
                    <div className="metric-card">
                        <div className="metric-inputs">
                            <input
                                className="metric-w num"
                                type="text"
                                inputMode="decimal"
                                aria-label="Peso objetivo en kilogramos"
                                value={goalWeight}
                                onChange={(e) => setGoalWeight(e.target.value)}
                                onBlur={commitGoalWeight}
                            />
                            <span className="unit">kg</span>
                        </div>
                    </div>
                </div>
                <h3>Objetivo de tiempo de celular por día</h3>
                <div className="metric-grid">
                    <div className="metric-card">
                        <div className="metric-inputs">
                            <input
                                className="metric-hm num"
                                type="number"
                                min="0"
                                aria-label="Horas objetivo"
                                value={goalHours}
                                onChange={(e) => setGoalHours(e.target.value)}
                                onBlur={commitGoalPhone}
                            />
                            <span className="colon">:</span>
                            <input
                                className="metric-hm num"
                                type="number"
                                min="0"
                                max="59"
                                aria-label="Minutos objetivo"
                                value={goalMinutes}
                                onChange={(e) => setGoalMinutes(e.target.value)}
                                onBlur={commitGoalPhone}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="section-label">Tus datos</div>
            <div className="form-card data-card">
                <button type="button" className="data-btn primary" onClick={handleExportClick}>
                    Exportar backup (.json)
                </button>
                <button type="button" className="data-btn" onClick={() => fileRef.current && fileRef.current.click()}>
                    Importar backup
                </button>
                <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    hidden
                    onChange={handleImport}
                />
                <p className="data-note">
                    Todo se guarda en este navegador. Descargá el backup de vez en cuando para no perder el
                    historial si cambiás de dispositivo o limpiás los datos del navegador.
                </p>
                {feedback && (
                    <p className={feedback.kind === "err" ? "form-error" : "data-note"} role="status">
                        {feedback.text}
                    </p>
                )}
            </div>

            <ConfirmDialog
                open={!!habitToDelete}
                title="Eliminar hábito"
                message={habitToDelete
                    ? `¿Eliminar el hábito "${habitToDelete.name}"? Sus registros quedan sin este hábito.`
                    : ""}
                confirmLabel="Eliminar"
                destructive
                onConfirm={confirmDeleteHabit}
                onCancel={() => setHabitToDelete(null)}
            />

            <ConfirmDialog
                open={!!pendingImport}
                title="Importar backup"
                message={pendingImport
                    ? "¿Reemplazar tus datos actuales por los del archivo?\n\n" +
                      `${pendingImport.habits.length} hábito(s) y ${Object.keys(pendingImport.entries).length} día(s) cargado(s).`
                    : ""}
                confirmLabel="Reemplazar"
                destructive
                onConfirm={confirmImport}
                onCancel={() => setPendingImport(null)}
            />
        </>
    );
}
